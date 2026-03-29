package com.shift.ballad.hikecore.intervention

import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NearbyInterventionServiceTest {

    @Test
    fun `generate returns no intervention when provider finds no poi`() = runTest {
        val service = NearbyInterventionService(
            poiProvider = object : PoiProvider {
                override suspend fun findNearbyPois(
                    point: GeoPoint,
                    radiusMeters: Int,
                    allowedCategories: Set<PoiCategory>,
                ): List<PoiContext> = emptyList()
            },
            poiEnricher = object : PoiEnricher {
                override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext = poi
            },
            poiRanker = DefaultPoiRanker(),
            promptBuilder = DefaultPromptBuilder(),
            llmClient = object : LlmClient {
                override suspend fun generate(context: PreparedInterventionContext): LlmGeneration =
                    error("Should not be called")
            },
        )

        val result = service.generate(sampleRequest())

        val noIntervention = assertIs<InterventionResult.NoIntervention>(result)
        assertEquals("No nearby POI matched the V1 whitelist", noIntervention.reason)
    }

    @Test
    fun `generate returns generation failure when llm call fails`() = runTest {
        val poi = samplePoi()
        val service = NearbyInterventionService(
            poiProvider = object : PoiProvider {
                override suspend fun findNearbyPois(
                    point: GeoPoint,
                    radiusMeters: Int,
                    allowedCategories: Set<PoiCategory>,
                ): List<PoiContext> = listOf(poi)
            },
            poiEnricher = object : PoiEnricher {
                override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext = poi
            },
            poiRanker = DefaultPoiRanker(),
            promptBuilder = DefaultPromptBuilder(),
            llmClient = object : LlmClient {
                override suspend fun generate(context: PreparedInterventionContext): LlmGeneration {
                    throw IllegalStateException("boom")
                }
            },
        )

        val result = service.generate(sampleRequest())

        val failure = assertIs<InterventionResult.GenerationFailed>(result)
        assertEquals("llm_generation", failure.stage)
        assertEquals(1, failure.candidatePois.size)
    }

    @Test
    fun `generate returns selected poi summaries and intervention text`() = runTest {
        val enrichedPoi = samplePoi().copy(
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIPEDIA,
                    title = "Belvédère",
                    snippet = "Point de vue dominant la vallée.",
                ),
            ),
        )
        val service = NearbyInterventionService(
            poiProvider = object : PoiProvider {
                override suspend fun findNearbyPois(
                    point: GeoPoint,
                    radiusMeters: Int,
                    allowedCategories: Set<PoiCategory>,
                ): List<PoiContext> {
                    assertEquals(AllSelectablePoiCategories, allowedCategories)
                    return listOf(samplePoi())
                }
            },
            poiEnricher = object : PoiEnricher {
                override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext = enrichedPoi
            },
            poiRanker = DefaultPoiRanker(),
            promptBuilder = object : PromptBuilder {
                override fun build(
                    request: InterventionRequest,
                    selectedPoi: PoiCandidate,
                    candidatePois: List<PoiCandidate>,
                    sourceSummaries: List<SourceSummary>,
                ): String = "PROMPT"
            },
            llmClient = object : LlmClient {
                override suspend fun generate(context: PreparedInterventionContext): LlmGeneration =
                    LlmGeneration(
                        text = "Encore quelques pas et la vue s'ouvre sur la vallée.",
                        modelInfo = ModelInfo(provider = "openai", model = "gpt-4.1-mini", responseId = "resp_1"),
                    )
            },
        )

        val result = service.generate(sampleRequest())

        val generated = assertIs<InterventionResult.Generated>(result)
        assertEquals("Encore quelques pas et la vue s'ouvre sur la vallée.", generated.text)
        assertEquals(1, generated.sourceSummaries.size)
        assertEquals("Belvédère", generated.selectedPoi.name)
    }

    @Test
    fun `generate returns no intervention and skips lookup when every category is disabled`() = runTest {
        var providerCalled = false
        val service = NearbyInterventionService(
            poiProvider = object : PoiProvider {
                override suspend fun findNearbyPois(
                    point: GeoPoint,
                    radiusMeters: Int,
                    allowedCategories: Set<PoiCategory>,
                ): List<PoiContext> {
                    providerCalled = true
                    return emptyList()
                }
            },
            poiEnricher = object : PoiEnricher {
                override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext = poi
            },
            poiRanker = DefaultPoiRanker(),
            promptBuilder = DefaultPromptBuilder(),
            llmClient = object : LlmClient {
                override suspend fun generate(context: PreparedInterventionContext): LlmGeneration =
                    error("Should not be called")
            },
        )

        val result = service.generate(
            sampleRequest().copy(
                poiPreferences = PoiDiscoveryPreferences(
                    categories = PoiCategorySelection(
                        viewpoint = false,
                        peak = false,
                        waterfall = false,
                        cave = false,
                        historic = false,
                        attraction = false,
                        information = false,
                    ),
                ),
            ),
        )

        val noIntervention = assertIs<InterventionResult.NoIntervention>(result)
        assertEquals("No POI category is enabled in preferences", noIntervention.reason)
        assertFalse(providerCalled)
    }

    private fun sampleRequest() = InterventionRequest(
        point = GeoPoint(45.0, 6.0),
        radiusMeters = 800,
        promptInstructions = "Reste bref.",
        userPreferencesJson = """{"tone":"warm"}""",
    )

    private fun samplePoi() = PoiContext(
        id = "node/1",
        name = "Belvédère",
        point = GeoPoint(45.0005, 6.0004),
        category = PoiCategory.VIEWPOINT,
        tags = mapOf(
            "name" to "Belvédère",
            "tourism" to "viewpoint",
            "wikipedia" to "fr:Belvédère",
        ),
        sourceRefs = emptyList(),
    )
}
