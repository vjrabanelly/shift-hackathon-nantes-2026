package com.shift.ballad.hikecore.intervention

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DefaultPoiRankerTest {
    private val ranker = DefaultPoiRanker()

    @Test
    fun `rank prefers close named poi with richer metadata`() {
        val request = InterventionRequest(
            point = GeoPoint(45.0, 6.0),
            radiusMeters = 1000,
            promptInstructions = "Reste motivant.",
            userPreferencesJson = """{"tone":"warm"}""",
        )

        val richerPoi = PoiContext(
            id = "node/1",
            name = "Cascade",
            point = GeoPoint(45.001, 6.001),
            category = PoiCategory.WATERFALL,
            tags = mapOf(
                "name" to "Cascade",
                "waterway" to "waterfall",
                "description" to "Belle chute",
                "wikipedia" to "fr:Cascade",
            ),
            sourceRefs = emptyList(),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIPEDIA,
                    title = "Cascade",
                    snippet = "Une cascade remarquable.",
                ),
            ),
        )
        val sparsePoi = PoiContext(
            id = "node/2",
            name = null,
            point = GeoPoint(45.006, 6.006),
            category = PoiCategory.INFORMATION,
            tags = mapOf("tourism" to "information"),
            sourceRefs = emptyList(),
        )

        val ranked = ranker.rank(listOf(sparsePoi, richerPoi), request)

        assertEquals("node/1", ranked.first().id)
        assertTrue(ranked.first().score > ranked.last().score)
    }

    @Test
    fun `nature mode favors natural landmarks over historic ones`() {
        val scores = compareScores(
            mode = PoiSelectionMode.NATURE,
            first = naturalPoi(),
            second = historicPoi(),
        )

        assertTrue(scores.first > scores.second)
    }

    @Test
    fun `history mode favors historic landmarks over natural ones`() {
        val scores = compareScores(
            mode = PoiSelectionMode.HISTORY,
            first = historicPoi(),
            second = naturalPoi(),
        )

        assertTrue(scores.first > scores.second)
    }

    @Test
    fun `architecture mode favors building oriented poi`() {
        val architectureDelta = scoreForMode(PoiSelectionMode.ARCHITECTURE, architecturePoi()) -
            scoreForMode(PoiSelectionMode.BALANCED, architecturePoi())
        val historicDelta = scoreForMode(PoiSelectionMode.ARCHITECTURE, historicPoi()) -
            scoreForMode(PoiSelectionMode.BALANCED, historicPoi())

        assertTrue(architectureDelta > historicDelta)
    }

    @Test
    fun `panorama mode favors viewpoints over other candidates`() {
        val scores = compareScores(
            mode = PoiSelectionMode.PANORAMA,
            first = panoramaPoi(),
            second = historicPoi(),
        )

        assertTrue(scores.first > scores.second)
    }

    private fun compareScores(
        mode: PoiSelectionMode,
        first: PoiContext,
        second: PoiContext,
    ): Pair<Double, Double> =
        scoreForMode(mode, first) to scoreForMode(mode, second)

    private fun scoreForMode(mode: PoiSelectionMode, poi: PoiContext): Double =
        ranker.scorePoi(
            poi = poi,
            distanceMeters = 120,
            radiusMeters = 800,
            experiencePreferences = ExperiencePreferences(
                poiSelectionMode = mode,
                detailLevel = InterventionDetailLevel.BALANCED,
            ),
        )

    private fun naturalPoi(): PoiContext =
        PoiContext(
            id = "node/nature",
            name = "Cascade du Test",
            point = GeoPoint(45.001, 6.001),
            category = PoiCategory.WATERFALL,
            tags = mapOf(
                "name" to "Cascade du Test",
                "waterway" to "waterfall",
                "natural" to "waterfall",
                "wikipedia" to "fr:Cascade_du_Test",
            ),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIPEDIA,
                    label = "Cascade du Test",
                    value = "fr:Cascade_du_Test",
                ),
            ),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIPEDIA,
                    title = "Cascade du Test",
                    snippet = "A scenic waterfall above the valley.",
                ),
            ),
        )

    private fun historicPoi(): PoiContext =
        PoiContext(
            id = "node/history",
            name = "Abbaye du Test",
            point = GeoPoint(45.001, 6.001),
            category = PoiCategory.HISTORIC,
            tags = mapOf(
                "name" to "Abbaye du Test",
                "historic" to "monastery",
                "heritage" to "yes",
                "start_date" to "1142",
                "wikidata" to "Q42",
            ),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIDATA,
                    label = "Abbaye du Test",
                    value = "Q42",
                ),
            ),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIDATA,
                    title = "Abbaye du Test",
                    snippet = "Historic monastery with medieval heritage.",
                ),
            ),
        )

    private fun architecturePoi(): PoiContext =
        PoiContext(
            id = "node/architecture",
            name = "Pont du Test",
            point = GeoPoint(45.001, 6.001),
            category = PoiCategory.ATTRACTION,
            tags = mapOf(
                "name" to "Pont du Test",
                "building" to "bridge",
                "architect" to "Jane Doe",
                "architecture" to "stone arch",
                "wikidata" to "Q99",
            ),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIDATA,
                    label = "Pont du Test",
                    value = "Q99",
                ),
            ),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIDATA,
                    title = "Pont du Test",
                    snippet = "Bridge known for its architecture and stone facade.",
                ),
            ),
        )

    private fun panoramaPoi(): PoiContext =
        PoiContext(
            id = "node/panorama",
            name = "Belvédère du Test",
            point = GeoPoint(45.001, 6.001),
            category = PoiCategory.VIEWPOINT,
            tags = mapOf(
                "name" to "Belvédère du Test",
                "tourism" to "viewpoint",
                "ele" to "1540",
                "wikipedia" to "fr:Belvedere_du_Test",
            ),
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.WIKIPEDIA,
                    label = "Belvédère du Test",
                    value = "fr:Belvedere_du_Test",
                ),
            ),
            sourceSummaries = listOf(
                SourceSummary(
                    kind = SourceKind.WIKIPEDIA,
                    title = "Belvédère du Test",
                    snippet = "Panorama over the valley and surrounding ridges.",
                ),
            ),
        )
}
