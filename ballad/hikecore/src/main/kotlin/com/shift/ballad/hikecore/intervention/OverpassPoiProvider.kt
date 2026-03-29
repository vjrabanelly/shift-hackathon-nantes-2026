package com.shift.ballad.hikecore.intervention

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.Parameters
import io.ktor.http.contentType
import io.ktor.http.encodeURLPathPart
import io.ktor.http.formUrlEncode
import io.ktor.http.headers
import io.ktor.http.isSuccess
import kotlinx.coroutines.delay
import kotlinx.serialization.Serializable
import java.io.IOException

internal class OverpassPoiProvider(
    private val httpClient: HttpClient,
    private val endpoints: List<String> = DEFAULT_ENDPOINTS,
    private val maxAttemptsPerEndpoint: Int = 2,
    private val retryBaseDelayMillis: Long = 350,
) : PoiProvider {

    override suspend fun findNearbyPois(
        point: GeoPoint,
        radiusMeters: Int,
        allowedCategories: Set<PoiCategory>,
    ): List<PoiContext> {
        if (allowedCategories.isEmpty()) {
            return emptyList()
        }

        val query = buildQuery(point, radiusMeters, allowedCategories)
        val endpointPool = endpoints
            .map(String::trim)
            .filter(String::isNotBlank)
            .ifEmpty { DEFAULT_ENDPOINTS }
        val failures = mutableListOf<String>()

        endpointPool.forEach { endpoint ->
            repeat(maxAttemptsPerEndpoint) { attemptIndex ->
                val attemptNumber = attemptIndex + 1
                val result = runCatching { executeRequest(endpoint, query) }
                val payload = result.getOrNull()
                if (payload != null) {
                    return mapPois(payload, allowedCategories)
                }

                val failure = result.exceptionOrNull() ?: IllegalStateException("Unknown Overpass error")
                failures += "${endpoint}#${attemptNumber}: ${failure.message ?: failure::class.simpleName.orEmpty()}"

                if (!isRetryable(failure)) {
                    throw failure
                }

                if (attemptNumber < maxAttemptsPerEndpoint) {
                    delay(retryBaseDelayMillis * attemptNumber)
                }
            }
        }

        throw IllegalStateException(
            "Overpass request failed after ${endpointPool.size} endpoint(s): ${failures.joinToString(" | ")}",
        )
    }

    private suspend fun executeRequest(endpoint: String, query: String): OverpassResponse {
        val response = httpClient.post(endpoint) {
            contentType(ContentType.Application.FormUrlEncoded)
            headers {
                append(HttpHeaders.Accept, ContentType.Application.Json.toString())
                append(HttpHeaders.UserAgent, "HikeBuddy/0.1")
            }
            setBody(Parameters.build { append("data", query) }.formUrlEncode())
        }

        if (!response.status.isSuccess()) {
            throw OverpassRequestException(
                endpoint = endpoint,
                statusCode = response.status.value,
                responseBody = response.bodyAsText(),
            )
        }

        return response.body()
    }

    private fun mapPois(
        payload: OverpassResponse,
        allowedCategories: Set<PoiCategory>,
    ): List<PoiContext> =
        mapOverpassElementsToPoiContexts(
            elements = payload.elements,
            allowedCategories = allowedCategories,
        )

    private fun isRetryable(exception: Throwable): Boolean =
        when (exception) {
            is OverpassRequestException -> exception.statusCode == 429 || exception.statusCode in 500..599
            is IOException -> true
            else -> false
        }

    companion object {
        const val DEFAULT_ENDPOINT = "https://overpass-api.de/api/interpreter"
        val DEFAULT_ENDPOINTS = listOf(
            DEFAULT_ENDPOINT,
            "https://lz4.overpass-api.de/api/interpreter",
            "https://z.overpass-api.de/api/interpreter",
            "https://overpass.private.coffee/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
        )

        fun buildQuery(
            point: GeoPoint,
            radiusMeters: Int,
            allowedCategories: Set<PoiCategory> = AllSelectablePoiCategories,
        ): String =
            buildOverpassQuery(allowedCategories) { filter ->
                listOf(
                    "node(around:$radiusMeters,${point.lat},${point.lon})$filter;",
                    "way(around:$radiusMeters,${point.lat},${point.lon})$filter;",
                    "rel(around:$radiusMeters,${point.lat},${point.lon})$filter;",
                )
            }

        internal fun categoryFromTags(tags: Map<String, String>): PoiCategory? =
            when {
                tags["tourism"] == "viewpoint" -> PoiCategory.VIEWPOINT
                tags["natural"] == "peak" -> PoiCategory.PEAK
                tags["waterway"] == "waterfall" -> PoiCategory.WATERFALL
                tags["natural"] == "cave_entrance" -> PoiCategory.CAVE
                tags.containsKey("historic") -> PoiCategory.HISTORIC
                tags["tourism"] == "attraction" -> PoiCategory.ATTRACTION
                tags["tourism"] == "information" -> PoiCategory.INFORMATION
                else -> null
            }

    }
}

internal class OverpassRequestException(
    endpoint: String,
    val statusCode: Int,
    responseBody: String,
) : IllegalStateException("Overpass request failed on $endpoint with $statusCode: $responseBody")

@Serializable
internal data class OverpassResponse(
    val elements: List<OverpassElement> = emptyList(),
)

@Serializable
internal data class OverpassElement(
    val type: String,
    val id: Long,
    val lat: Double? = null,
    val lon: Double? = null,
    val center: OverpassCenter? = null,
    val tags: Map<String, String> = emptyMap(),
) {
    fun point(): GeoPoint? =
        when {
            lat != null && lon != null -> GeoPoint(lat, lon)
            center != null -> GeoPoint(center.lat, center.lon)
            else -> null
        }
}

@Serializable
internal data class OverpassCenter(
    val lat: Double,
    val lon: Double,
)

internal data class WikipediaDescriptor(
    val language: String,
    val title: String,
)

internal fun parseWikipediaTag(tag: String, fallbackLanguage: String = "fr"): WikipediaDescriptor? {
    if (tag.isBlank()) {
        return null
    }

    if (tag.startsWith("http://") || tag.startsWith("https://")) {
        val language = tag.substringAfter("://").substringBefore('.').ifBlank { fallbackLanguage }
        val title = tag.substringAfter("/wiki/", "").replace('_', ' ')
        return title.takeIf { it.isNotBlank() }?.let { WikipediaDescriptor(language, it) }
    }

    val parts = tag.split(':', limit = 2)
    return when {
        parts.size == 2 && parts[0].isNotBlank() && parts[1].isNotBlank() ->
            WikipediaDescriptor(parts[0], parts[1].replace('_', ' '))
        parts.size == 1 && parts[0].isNotBlank() ->
            WikipediaDescriptor(fallbackLanguage, parts[0].replace('_', ' '))
        else -> null
    }
}

internal val AllSelectablePoiCategories: Set<PoiCategory> = setOf(
    PoiCategory.VIEWPOINT,
    PoiCategory.PEAK,
    PoiCategory.WATERFALL,
    PoiCategory.CAVE,
    PoiCategory.HISTORIC,
    PoiCategory.ATTRACTION,
    PoiCategory.INFORMATION,
)

internal fun buildOverpassQuery(
    allowedCategories: Set<PoiCategory>,
    locationQueryBuilder: (String) -> List<String>,
): String {
    if (allowedCategories.isEmpty()) {
        return """
            [out:json][timeout:25];
            (
            );
            out center tags;
        """.trimIndent()
    }

    val clauses = allowedCategories
        .filter { it in AllSelectablePoiCategories }
        .flatMap { category -> locationQueryBuilder(overpassFilterForCategory(category)) }

    return """
        [out:json][timeout:25];
        (
        ${clauses.joinToString(separator = "\n") { "  $it" }}
        );
        out center tags;
    """.trimIndent()
}

internal fun overpassFilterForCategory(category: PoiCategory): String =
    when (category) {
        PoiCategory.VIEWPOINT -> "[tourism=viewpoint]"
        PoiCategory.PEAK -> "[natural=peak]"
        PoiCategory.WATERFALL -> "[waterway=waterfall]"
        PoiCategory.CAVE -> "[natural=cave_entrance]"
        PoiCategory.HISTORIC -> "[historic]"
        PoiCategory.ATTRACTION -> "[tourism=attraction]"
        PoiCategory.INFORMATION -> "[tourism=information]"
        PoiCategory.OTHER -> error("PoiCategory.OTHER is not queryable in Overpass preferences")
    }

internal fun mapOverpassElementsToPoiContexts(
    elements: List<OverpassElement>,
    allowedCategories: Set<PoiCategory> = AllSelectablePoiCategories,
): List<PoiContext> =
    elements.mapNotNull { element ->
        val pointForElement = element.point() ?: return@mapNotNull null
        val category = OverpassPoiProvider.categoryFromTags(element.tags) ?: return@mapNotNull null
        if (category !in allowedCategories) return@mapNotNull null
        val name = element.tags["name"]?.takeIf { it.isNotBlank() }
        PoiContext(
            id = "${element.type}/${element.id}",
            name = name,
            point = pointForElement,
            category = category,
            tags = element.tags,
            sourceRefs = buildSourceRefs(element, category, name),
        )
    }

internal fun buildSourceRefs(
    element: OverpassElement,
    category: PoiCategory,
    name: String?,
): List<SourceReference> {
    val refs = mutableListOf(
        SourceReference(
            kind = SourceKind.OSM,
            label = name ?: category.name.lowercase(),
            value = "${element.type}/${element.id}",
            url = "https://www.openstreetmap.org/${element.type}/${element.id}",
        ),
    )

    element.tags["wikipedia"]?.let { tag ->
        val descriptor = parseWikipediaTag(tag)
        if (descriptor != null) {
            refs += SourceReference(
                kind = SourceKind.WIKIPEDIA,
                label = descriptor.title,
                value = tag,
                url = "https://${descriptor.language}.wikipedia.org/wiki/${descriptor.title.replace(' ', '_').encodeURLPathPart()}",
            )
        }
    }

    element.tags["wikidata"]?.let { tag ->
        refs += SourceReference(
            kind = SourceKind.WIKIDATA,
            label = tag,
            value = tag,
            url = "https://www.wikidata.org/wiki/$tag",
        )
    }

    return refs
}
