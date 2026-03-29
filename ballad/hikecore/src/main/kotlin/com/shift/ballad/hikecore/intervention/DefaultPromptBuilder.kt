package com.shift.ballad.hikecore.intervention

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive

internal class DefaultPromptBuilder : PromptBuilder {
    override fun build(
        request: InterventionRequest,
        selectedPoi: PoiCandidate,
        candidatePois: List<PoiCandidate>,
        sourceSummaries: List<SourceSummary>,
    ): String {
        val preferencesElement = runCatching { DefaultJson.parseToJsonElement(request.userPreferencesJson) }
            .getOrElse { JsonPrimitive(request.userPreferencesJson) }
        val selectedPoiIdentity = PromptPoiIdentity(
            id = selectedPoi.id,
            name = selectedPoi.name,
            category = selectedPoi.category,
            latitude = selectedPoi.lat,
            longitude = selectedPoi.lon,
            distanceMeters = selectedPoi.distanceMeters,
            discriminatingTags = selectedPoi.discriminatingTags(),
            sourceRefs = selectedPoi.sourceRefs,
            identityConfidence = selectedPoi.identityConfidence(),
        )
        val sourceEvidence = PromptSourceEvidence(
            sourceRefs = selectedPoi.sourceRefs,
            sourceSummaries = sourceSummaries,
            exactExternalSources = selectedPoi.sourceRefs.filter { it.kind.isExactExternalSource() },
            guidance = sourceGuidance(selectedPoiIdentity.identityConfidence),
        )
        val context = PromptContext(
            latitude = request.point.lat,
            longitude = request.point.lon,
            radiusMeters = request.radiusMeters,
            language = request.language.code,
            experiencePreferences = request.experiencePreferences,
            userPreferences = preferencesElement,
            selectedPoiIdentity = selectedPoiIdentity,
            candidatePois = candidatePois.map(PoiCandidate::toPromptCandidate),
            sourceEvidence = sourceEvidence,
        )

        return """
            Tu es Hike Buddy, un copilote vocal de randonnée.
            Ta mission est de produire UNE intervention audio textuelle naturelle, utile et fidèle au lieu réellement ciblé.

            Mission :
            - Produis UNE intervention audio textuelle qui aide l'utilisateur à vivre le lieu maintenant.
            - Respecte le mode éditorial actif : ${request.experiencePreferences.poiSelectionMode}.

            Règles de précision :
            - Utilise uniquement les faits présents dans le contexte fourni.
            - N'invente ni histoire, ni localisation, ni détail absent des données.
            - Parle uniquement du POI sélectionné.
            - Si l'identité du lieu est faible ou peu discriminante, reste factuel, prudent et générique.
            - Ton attendu : chaleureux, incarné, utile sur le terrain.
            - La langue finale attendue est : ${request.language.code}.
            - Pas de markdown, pas de liste, pas de guillemets superflus.
            - Réponds uniquement via le schéma JSON demandé.

            Règles liées au niveau de détail (${request.experiencePreferences.detailLevel}) :
            ${detailInstructions(request.experiencePreferences.detailLevel)}
            - Ces règles de détail priment sur tout signal legacy de longueur présent dans les préférences utilisateur.

            Règles liées à la tranche d'âge (${request.experiencePreferences.ageRange}) :
            ${ageRangeInstructions(request.experiencePreferences.ageRange)}
            - Adapte le niveau de langage et la manière d'expliquer, sans changer les faits disponibles.

            Instructions spécifiques de l'appelant :
            ${request.promptInstructions.trim()}

            Bloc d'identité du POI sélectionné :
            ${DefaultJson.encodeToString(selectedPoiIdentity)}

            Bloc de preuves / source evidence :
            ${DefaultJson.encodeToString(sourceEvidence)}

            Préférences utilisateur structurées :
            ${DefaultJson.encodeToString(preferencesElement)}

            Contexte structuré complémentaire :
            ${DefaultJson.encodeToString(context)}
        """.trimIndent()
    }

    private fun detailInstructions(detailLevel: InterventionDetailLevel): String =
        when (detailLevel) {
            InterventionDetailLevel.SHORT -> """
                - Fais 1 à 2 phrases, pour un maximum d'environ 35 mots.
                - Garde un seul fait principal vraiment utile ou marquant.
                - Évite les détails secondaires ou les digressions.
            """.trimIndent()
            InterventionDetailLevel.BALANCED -> """
                - Fais 2 à 3 phrases, pour un maximum d'environ 70 mots.
                - Tu peux combiner un fait principal et un complément utile s'ils sont solidement étayés.
                - Reste fluide et facile à écouter en marchant.
            """.trimIndent()
            InterventionDetailLevel.DETAILED -> """
                - Fais 3 à 5 phrases maximum, pour un maximum d'environ 120 mots.
                - Tu peux donner plus de contexte ou de matière si les sources exactes le permettent.
                - Garde une narration compacte, jamais encyclopédique.
            """.trimIndent()
        }

    private fun ageRangeInstructions(ageRange: UserAgeRange): String =
        when (ageRange) {
            UserAgeRange.ADULT -> """
                - Garde le niveau de langage naturel et actuel.
                - Tu peux conserver des formulations nuancées si elles restent faciles à écouter.
            """.trimIndent()
            UserAgeRange.AGE_15_18 -> """
                - Adopte un ton naturel et accessible, jamais infantilisant.
                - Préfère des formulations claires et vivantes plutôt qu'un registre trop technique.
            """.trimIndent()
            UserAgeRange.AGE_12_14 -> """
                - Simplifie le vocabulaire et allège la densité des explications.
                - Quand un terme est peu courant, reformule-le simplement dans la phrase.
            """.trimIndent()
            UserAgeRange.AGE_8_11 -> """
                - Fais des phrases courtes avec des mots concrets.
                - Va à l'essentiel, avec une idée principale à la fois.
            """.trimIndent()
            UserAgeRange.UNDER_8 -> """
                - Utilise une formulation très simple, très concrète et rassurante.
                - Évite de surcharger la narration : un seul élément marquant suffit.
            """.trimIndent()
        }

    private fun sourceGuidance(identityConfidence: IdentityConfidence): String =
        when (identityConfidence) {
            IdentityConfidence.HIGH   -> "Des sources externes exactes sont disponibles : tu peux t'appuyer dessus, sans extrapoler."
            IdentityConfidence.MEDIUM -> "L'identité semble plausible mais pas fortement sourcée : reste précis et évite les détails non essentiels."
            IdentityConfidence.LOW    -> "L'identité est faible ou peu discriminante : reste sobre, descriptive et très prudent."
        }
}

@Serializable
internal data class PromptContext(
    val latitude: Double,
    val longitude: Double,
    val radiusMeters: Int,
    val language: String,
    val experiencePreferences: ExperiencePreferences,
    val userPreferences: JsonElement,
    val selectedPoiIdentity: PromptPoiIdentity,
    val candidatePois: List<PromptCandidate>,
    val sourceEvidence: PromptSourceEvidence,
)

internal enum class IdentityConfidence { HIGH, MEDIUM, LOW }

@Serializable
internal data class PromptPoiIdentity(
    val id: String,
    val name: String?,
    val category: PoiCategory,
    val latitude: Double,
    val longitude: Double,
    val distanceMeters: Int,
    val discriminatingTags: Map<String, String>,
    val sourceRefs: List<SourceReference>,
    val identityConfidence: IdentityConfidence,
)

@Serializable
internal data class PromptCandidate(
    val id: String,
    val name: String?,
    val category: PoiCategory,
    val distanceMeters: Int,
    val score: Double,
)

@Serializable
internal data class PromptSourceEvidence(
    val sourceRefs: List<SourceReference>,
    val sourceSummaries: List<SourceSummary>,
    val exactExternalSources: List<SourceReference>,
    val guidance: String,
)

private fun PoiCandidate.toPromptCandidate(): PromptCandidate =
    PromptCandidate(
        id = id,
        name = name,
        category = category,
        distanceMeters = distanceMeters,
        score = score,
    )

private fun PoiCandidate.discriminatingTags(): Map<String, String> {
    val preferredKeys = listOf(
        "name",
        "historic",
        "tourism",
        "natural",
        "waterway",
        "heritage",
        "start_date",
        "architect",
        "architecture",
        "building",
        "description",
        "ele",
        "wikipedia",
        "wikidata",
    )
    val selected = preferredKeys
        .mapNotNull { key -> tags[key]?.takeIf(String::isNotBlank)?.let { key to it } }
        .toMap()
    return if (selected.isNotEmpty()) selected else tags.entries.sortedBy { it.key }.take(6).associate { it.key to it.value }
}

private fun PoiCandidate.identityConfidence(): IdentityConfidence =
    when {
        sourceRefs.any { it.kind.isExactExternalSource() } -> IdentityConfidence.HIGH
        !name.isNullOrBlank() && discriminatingTags().isNotEmpty() -> IdentityConfidence.MEDIUM
        else -> IdentityConfidence.LOW
    }

private fun SourceKind.isExactExternalSource(): Boolean =
    this == SourceKind.WIKIPEDIA || this == SourceKind.WIKIDATA || this == SourceKind.WIKIVOYAGE
