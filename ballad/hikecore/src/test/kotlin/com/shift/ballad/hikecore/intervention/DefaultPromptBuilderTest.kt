package com.shift.ballad.hikecore.intervention

import kotlin.test.Test
import kotlin.test.assertTrue

class DefaultPromptBuilderTest {

    @Test
    fun `build includes caller instructions and structured context`() {
        val request = InterventionRequest(
            point = GeoPoint(45.83, 6.86),
            radiusMeters = 800,
            promptInstructions = "Prends un ton enthousiaste mais calme.",
            userPreferencesJson = """{"tone":"encouraging","history":true}""",
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.DETAILED,
                poiSelectionMode = PoiSelectionMode.HISTORY,
                ageRange = UserAgeRange.AGE_8_11,
            ),
        )
        val selectedPoi = PoiCandidate(
            id = "node/1",
            name = "Aiguille du Test",
            lat = 45.831,
            lon = 6.861,
            distanceMeters = 135,
            category = PoiCategory.PEAK,
            tags = mapOf("natural" to "peak", "wikidata" to "Q123"),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIVOYAGE,
                    label = "Aiguille du Test",
                    value = "fr:Aiguille_du_Test",
                ),
            ),
            score = 82.4,
        )
        val prompt = DefaultPromptBuilder().build(
            request = request,
            selectedPoi = selectedPoi,
            candidatePois = listOf(selectedPoi),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIVOYAGE,
                    title = "Aiguille du Test",
                    snippet = "Sommet rocheux au-dessus de la vallée.",
                ),
            ),
        )

        assertTrue(prompt.contains("Prends un ton enthousiaste mais calme."))
        assertTrue(prompt.contains("Aiguille du Test"))
        assertTrue(prompt.contains("Règles liées au niveau de détail (DETAILED)"))
        assertTrue(prompt.contains("Respecte le mode éditorial actif : HISTORY"))
        assertTrue(prompt.contains("Parle uniquement du POI sélectionné."))
        assertTrue(prompt.contains("Ces règles de détail priment sur tout signal legacy de longueur"))
        assertTrue(prompt.contains("3 à 5 phrases maximum, pour un maximum d'environ 120 mots"))
        assertTrue(prompt.contains("Règles liées à la tranche d'âge (AGE_8_11)"))
        assertTrue(prompt.contains("Fais des phrases courtes avec des mots concrets"))
        assertTrue(prompt.contains("Bloc d'identité du POI sélectionné"))
        assertTrue(prompt.contains("\"id\": \"node/1\""))
        assertTrue(prompt.contains("Bloc de preuves / source evidence"))
        assertTrue(prompt.contains("\"exactExternalSources\""))
        assertTrue(prompt.contains("WIKIVOYAGE"))
        assertTrue(prompt.contains("Des sources externes exactes sont disponibles"))
        assertTrue(prompt.contains("encouraging"))
        assertTrue(prompt.contains("\"ageRange\": \"8_11\""))
        assertTrue(prompt.contains("\"radiusMeters\": 800"))
    }
}
