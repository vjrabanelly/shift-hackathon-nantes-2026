package com.shift.ballad.hikecore.intervention

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.client.statement.bodyAsText
import io.ktor.http.encodeURLPathPart
import io.ktor.http.isSuccess
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

internal class LightPoiEnricher(
    private val httpClient: HttpClient,
    private val sourceProviders: List<PoiSourceProvider> = listOf(
        WikipediaPoiSourceProvider(httpClient),
        WikidataPoiSourceProvider(httpClient),
    ),
) : PoiEnricher {

    override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext {
        val policy = SourceSelectionPolicy.from(request.experiencePreferences.detailLevel)
        val materials = sourceProviders
            .asSequence()
            .flatMap { provider ->
                runCatching { provider.fetchAll(poi, request) }
                    .getOrElse { emptyList() }
                    .asSequence()
            }
            .sortedWith(
                compareBy<PoiSourceMaterial> { policy.priorityFor(it.materialType) }
                    .thenBy(PoiSourceMaterial::priority),
            )
            .take(policy.maxBlocks)
            .toList()

        val summaries = materials.map { material ->
            val maxChars = when (material.blockType) {
                PoiSourceBlockType.NARRATIVE -> policy.narrativeSnippetMaxChars
                PoiSourceBlockType.FACTS -> policy.factsSnippetMaxChars
            }
            material.summary.copy(snippet = material.summary.snippet.limitChars(maxChars))
        }
        val mergedSourceRefs = (poi.sourceRefs + materials.flatMap(PoiSourceMaterial::sourceRefs))
            .distinctBy { "${it.kind}:${it.value}" }

        return poi.copy(
            sourceRefs = mergedSourceRefs,
            sourceSummaries = summaries,
        )
    }
}

private data class SourceSelectionPolicy(
    val maxBlocks: Int,
    val narrativeSnippetMaxChars: Int,
    val factsSnippetMaxChars: Int,
    private val priorities: Map<PoiSourceMaterialType, Int>,
) {
    fun priorityFor(type: PoiSourceMaterialType): Int = priorities[type] ?: Int.MAX_VALUE

    companion object {
        fun from(detailLevel: InterventionDetailLevel): SourceSelectionPolicy =
            when (detailLevel) {
                InterventionDetailLevel.SHORT -> SourceSelectionPolicy(
                    maxBlocks = 1,
                    narrativeSnippetMaxChars = 160,
                    factsSnippetMaxChars = 120,
                    priorities = mapOf(
                        PoiSourceMaterialType.WIKIPEDIA_SUMMARY to 10,
                        PoiSourceMaterialType.WIKIDATA_DESCRIPTION to 20,
                        PoiSourceMaterialType.WIKIDATA_FACTS to 30,
                        PoiSourceMaterialType.WIKIVOYAGE_SUMMARY to 40,
                    ),
                )
                InterventionDetailLevel.BALANCED -> SourceSelectionPolicy(
                    maxBlocks = 2,
                    narrativeSnippetMaxChars = 320,
                    factsSnippetMaxChars = 180,
                    priorities = mapOf(
                        PoiSourceMaterialType.WIKIPEDIA_SUMMARY to 10,
                        PoiSourceMaterialType.WIKIDATA_DESCRIPTION to 20,
                        PoiSourceMaterialType.WIKIDATA_FACTS to 30,
                        PoiSourceMaterialType.WIKIVOYAGE_SUMMARY to 40,
                    ),
                )
                InterventionDetailLevel.DETAILED -> SourceSelectionPolicy(
                    maxBlocks = 3,
                    narrativeSnippetMaxChars = 520,
                    factsSnippetMaxChars = 260,
                    priorities = mapOf(
                        PoiSourceMaterialType.WIKIPEDIA_SUMMARY to 10,
                        PoiSourceMaterialType.WIKIVOYAGE_SUMMARY to 20,
                        PoiSourceMaterialType.WIKIDATA_FACTS to 30,
                        PoiSourceMaterialType.WIKIDATA_DESCRIPTION to 40,
                    ),
                )
            }
    }
}

private fun String.limitChars(maxChars: Int): String {
    if (length <= maxChars) return this
    return take(maxChars).trimEnd().removeSuffix(".") + "..."
}

internal class WikipediaPoiSourceProvider(
    private val httpClient: HttpClient,
) : PoiSourceProvider {
    override suspend fun fetchAll(poi: PoiContext, request: PoiEnrichmentRequest): List<PoiSourceMaterial> {
        val tag = poi.tags["wikipedia"] ?: return emptyList()
        val descriptor = parseWikipediaTag(tag, request.language.code) ?: return emptyList()
        val summary = fetchWikiSummary(
            httpClient = httpClient,
            language = descriptor.language,
            family = "wikipedia",
            title = descriptor.title,
            kind = SourceKind.WIKIPEDIA,
        ) ?: return emptyList()

        return listOf(
            PoiSourceMaterial(
                summary = summary,
                materialType = PoiSourceMaterialType.WIKIPEDIA_SUMMARY,
            ),
        )
    }
}

internal class WikidataPoiSourceProvider(
    private val httpClient: HttpClient,
) : PoiSourceProvider {
    override suspend fun fetchAll(poi: PoiContext, request: PoiEnrichmentRequest): List<PoiSourceMaterial> {
        val entityId = poi.tags["wikidata"] ?: return emptyList()
        val entity = fetchEntity(entityId) ?: return emptyList()
        val label = entity.labels.pick(request.language.code)?.value ?: entityId
        val materials = mutableListOf<PoiSourceMaterial>()

        buildDescriptionMaterial(entityId, entity, label, request)?.let(materials::add)
        buildFactsMaterial(entityId, entity, label, poi.category, request)?.let(materials::add)
        buildWikivoyageMaterial(entity, request)?.let(materials::add)

        return materials
    }

    private suspend fun fetchEntity(entityId: String): WikidataEntity? {
        val response = httpClient.get("https://www.wikidata.org/wiki/Special:EntityData/$entityId.json")
        if (!response.status.isSuccess()) {
            throw IllegalStateException(
                "Wikidata request failed with ${response.status.value}: ${response.bodyAsText()}",
            )
        }

        return response.body<WikidataEntityResponse>().entities[entityId]
    }

    private fun buildDescriptionMaterial(
        entityId: String,
        entity: WikidataEntity,
        label: String,
        request: PoiEnrichmentRequest,
    ): PoiSourceMaterial? {
        val description = entity.descriptions.pick(request.language.code)?.value ?: return null
        val sitelink = entity.sitelinks["${request.language.code}wiki"] ?: entity.sitelinks["enwiki"]
        val wikiUrl = sitelink?.pageUrl(family = "wikipedia")

        return PoiSourceMaterial(
            summary = SourceSummary(
                kind = SourceKind.WIKIDATA,
                title = label,
                snippet = description,
                url = wikiUrl ?: "https://www.wikidata.org/wiki/$entityId",
            ),
            materialType = PoiSourceMaterialType.WIKIDATA_DESCRIPTION,
        )
    }

    private suspend fun buildFactsMaterial(
        entityId: String,
        entity: WikidataEntity,
        label: String,
        category: PoiCategory,
        request: PoiEnrichmentRequest,
    ): PoiSourceMaterial? {
        val orderedPropertyIds = factsPriorityFor(category)
        val rawFacts = orderedPropertyIds
            .mapNotNull { propertyId ->
                entity.claims[propertyId]
                    .orEmpty()
                    .firstNotNullOfOrNull { statement -> statement.toFactValue(propertyId) }
            }

        if (rawFacts.isEmpty()) return null

        val labelsById = resolveLabels(
            ids = rawFacts.mapNotNull(WikidataFactValue::entityId).toSet(),
            languageCode = request.language.code,
        )
        val facts = rawFacts
            .mapNotNull { fact -> fact.toSentence(labelsById) }
            .distinct()
            .take(MAX_FACTS_PER_BLOCK)

        if (facts.isEmpty()) return null

        return PoiSourceMaterial(
            summary = SourceSummary(
                kind = SourceKind.WIKIDATA,
                title = label,
                snippet = facts.joinToString(separator = ". ", postfix = "."),
                url = "https://www.wikidata.org/wiki/$entityId",
            ),
            blockType = PoiSourceBlockType.FACTS,
            materialType = PoiSourceMaterialType.WIKIDATA_FACTS,
        )
    }

    private suspend fun buildWikivoyageMaterial(
        entity: WikidataEntity,
        request: PoiEnrichmentRequest,
    ): PoiSourceMaterial? {
        val sitelink = entity.sitelinks["${request.language.code}wikivoyage"] ?: entity.sitelinks["enwikivoyage"]
        val title = sitelink?.title ?: return null
        val language = sitelink.site?.removeSuffix("wikivoyage").orEmpty().ifBlank { request.language.code }
        val summary = fetchWikiSummary(
            httpClient = httpClient,
            language = language,
            family = "wikivoyage",
            title = title,
            kind = SourceKind.WIKIVOYAGE,
        ) ?: return null
        val pageUrl = summary.url ?: sitelink.pageUrl(family = "wikivoyage")

        return PoiSourceMaterial(
            summary = summary.copy(url = pageUrl),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIVOYAGE,
                    label = summary.title,
                    value = "$language:$title",
                    url = pageUrl,
                ),
            ),
            materialType = PoiSourceMaterialType.WIKIVOYAGE_SUMMARY,
        )
    }

    private suspend fun resolveLabels(ids: Set<String>, languageCode: String): Map<String, String> {
        if (ids.isEmpty()) return emptyMap()

        val response = httpClient.get("https://www.wikidata.org/w/api.php") {
            parameter("action", "wbgetentities")
            parameter("format", "json")
            parameter("props", "labels")
            parameter("ids", ids.joinToString(separator = "|"))
            parameter("languages", listOf(languageCode, "fr", "en").distinct().joinToString(separator = "|"))
        }
        if (!response.status.isSuccess()) {
            throw IllegalStateException(
                "Wikidata labels request failed with ${response.status.value}: ${response.bodyAsText()}",
            )
        }

        return response.body<WikidataEntityResponse>().entities.mapValues { (_, entity) ->
            entity.labels.pick(languageCode)?.value.orEmpty()
        }.filterValues(String::isNotBlank)
    }

    private fun factsPriorityFor(category: PoiCategory): List<String> =
        when (category) {
            PoiCategory.VIEWPOINT,
            PoiCategory.PEAK,
            PoiCategory.WATERFALL,
            PoiCategory.CAVE -> listOf("P2044", "P31", "P131", "P1435")
            PoiCategory.HISTORIC,
            PoiCategory.ATTRACTION,
            PoiCategory.INFORMATION -> listOf("P31", "P571", "P1435", "P84", "P131")
            PoiCategory.OTHER -> listOf("P31", "P571", "P1435", "P2044", "P84", "P131")
        }

    companion object {
        private const val MAX_FACTS_PER_BLOCK = 3
    }
}

private suspend fun fetchWikiSummary(
    httpClient: HttpClient,
    language: String,
    family: String,
    title: String,
    kind: SourceKind,
): SourceSummary? {
    val response = httpClient.get(
        "https://$language.$family.org/api/rest_v1/page/summary/" +
            title.replace(' ', '_').encodeURLPathPart(),
    )

    if (!response.status.isSuccess()) {
        throw IllegalStateException(
            "$family summary request failed with ${response.status.value}: ${response.bodyAsText()}",
        )
    }

    val payload = response.body<WikipediaSummaryResponse>()
    val snippet = payload.extract?.takeIf { it.isNotBlank() } ?: return null
    val pageUrl = payload.contentUrls?.desktop?.page
        ?: "https://$language.$family.org/wiki/${title.replace(' ', '_').encodeURLPathPart()}"
    return SourceSummary(
        kind = kind,
        title = payload.title ?: title,
        snippet = snippet,
        url = pageUrl,
    )
}

private fun Map<String, WikidataValue>.pick(language: String): WikidataValue? =
    this[language] ?: this["fr"] ?: this["en"] ?: values.firstOrNull()

private fun WikidataSitelink.pageUrl(family: String): String? {
    val titleValue = title ?: return null
    val language = site?.removeSuffix(family).orEmpty().ifBlank { "en" }
    return "https://$language.$family.org/wiki/${titleValue.replace(' ', '_').encodeURLPathPart()}"
}

private data class WikidataFactValue(
    val propertyId: String,
    val entityId: String? = null,
    val literalValue: String? = null,
) {
    fun toSentence(labelsById: Map<String, String>): String? =
        when (propertyId) {
            "P31" -> labelsById[entityId]?.let { "Type : $it" }
            "P571" -> literalValue?.let { "Date d'origine : $it" }
            "P1435" -> labelsById[entityId]?.let { "Statut patrimonial : $it" }
            "P84" -> labelsById[entityId]?.let { "Architecte : $it" }
            "P2044" -> literalValue?.let { "Altitude : $it" }
            "P131" -> labelsById[entityId]?.let { "Localisation administrative : $it" }
            else -> null
        }
}

private fun WikidataStatement.toFactValue(propertyId: String): WikidataFactValue? =
    when (propertyId) {
        "P31", "P1435", "P84", "P131" -> mainsnak?.entityId()?.let { entityId ->
            WikidataFactValue(propertyId = propertyId, entityId = entityId)
        }
        "P571" -> mainsnak?.timeYear()?.let { year ->
            WikidataFactValue(propertyId = propertyId, literalValue = year)
        }
        "P2044" -> mainsnak?.quantityAmountMeters()?.let { altitude ->
            WikidataFactValue(propertyId = propertyId, literalValue = altitude)
        }
        else -> null
    }

private fun WikidataSnak.entityId(): String? =
    datavalue?.value
        ?.asObject()
        ?.get("id")
        ?.jsonPrimitive
        ?.contentOrNull

private fun WikidataSnak.timeYear(): String? {
    val raw = datavalue?.value
        ?.asObject()
        ?.get("time")
        ?.jsonPrimitive
        ?.contentOrNull
        ?: return null

    val normalized = raw.removePrefix("+")
    return when {
        normalized.length >= 4 -> normalized.take(4)
        else -> null
    }
}

private fun WikidataSnak.quantityAmountMeters(): String? {
    val rawAmount = datavalue?.value
        ?.asObject()
        ?.get("amount")
        ?.jsonPrimitive
        ?.contentOrNull
        ?.removePrefix("+")
        ?: return null
    val amount = rawAmount.toDoubleOrNull() ?: return null
    val rendered = if (amount == amount.toInt().toDouble()) {
        amount.toInt().toString()
    } else {
        String.format(Locale.US, "%.1f", amount)
    }
    return "$rendered m"
}

private fun JsonElement.asObject(): JsonObject? = this as? JsonObject

@Serializable
internal data class WikipediaSummaryResponse(
    val title: String? = null,
    val extract: String? = null,
    @SerialName("content_urls") val contentUrls: WikipediaContentUrls? = null,
)

@Serializable
internal data class WikipediaContentUrls(
    val desktop: WikipediaUrl? = null,
)

@Serializable
internal data class WikipediaUrl(
    val page: String? = null,
)

@Serializable
internal data class WikidataEntityResponse(
    val entities: Map<String, WikidataEntity> = emptyMap(),
)

@Serializable
internal data class WikidataEntity(
    val labels: Map<String, WikidataValue> = emptyMap(),
    val descriptions: Map<String, WikidataValue> = emptyMap(),
    val sitelinks: Map<String, WikidataSitelink> = emptyMap(),
    val claims: Map<String, List<WikidataStatement>> = emptyMap(),
)

@Serializable
internal data class WikidataStatement(
    val mainsnak: WikidataSnak? = null,
)

@Serializable
internal data class WikidataSnak(
    val snaktype: String? = null,
    val datatype: String? = null,
    val datavalue: WikidataDataValue? = null,
)

@Serializable
internal data class WikidataDataValue(
    val value: JsonElement? = null,
)

@Serializable
internal data class WikidataValue(
    val language: String? = null,
    val value: String,
)

@Serializable
internal data class WikidataSitelink(
    val site: String? = null,
    val title: String? = null,
)
