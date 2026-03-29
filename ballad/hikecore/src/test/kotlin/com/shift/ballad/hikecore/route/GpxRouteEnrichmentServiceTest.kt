package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.intervention.AudioSynthesizer
import com.shift.ballad.hikecore.intervention.DefaultPoiRanker
import com.shift.ballad.hikecore.intervention.ExperiencePreferences
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.LlmClient
import com.shift.ballad.hikecore.intervention.LlmGeneration
import com.shift.ballad.hikecore.intervention.ModelInfo
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.PoiCategorySelection
import com.shift.ballad.hikecore.intervention.PoiContext
import com.shift.ballad.hikecore.intervention.PoiDiscoveryPreferences
import com.shift.ballad.hikecore.intervention.PoiEnrichmentRequest
import com.shift.ballad.hikecore.intervention.PoiEnricher
import com.shift.ballad.hikecore.intervention.PreparedInterventionContext
import com.shift.ballad.hikecore.intervention.SourceReference
import com.shift.ballad.hikecore.intervention.config.InterventionConfigProvider
import java.nio.file.Files
import java.nio.file.Path
import kotlin.math.cos
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest

class GpxRouteEnrichmentServiceTest {
    private val parser = GpxRouteParser()

    @Test
    fun `enrich uses typed POI preferences from config provider`() = runTest {
        val harness = testHarness(
            configProvider = TestConfigProvider(
                poiPreferences = PoiDiscoveryPreferences(
                    categories = PoiCategorySelection(
                        viewpoint = false,
                        peak = false,
                        waterfall = false,
                        cave = false,
                        historic = true,
                        attraction = false,
                        information = false,
                    ),
                ),
            ),
            routeProvider = { _, _ ->
                listOf(
                    poi(
                        id = "node/viewpoint",
                        point = pointOnRoute(300.0),
                        category = PoiCategory.VIEWPOINT,
                        name = "Viewpoint",
                        tags = mapOf("name" to "Viewpoint", "tourism" to "viewpoint"),
                    ),
                    poi(
                        id = "node/historic",
                        point = pointOnRoute(600.0),
                        category = PoiCategory.HISTORIC,
                        name = "Historic",
                        tags = mapOf("name" to "Historic", "historic" to "monument"),
                    ),
                )
            },
            generatedIds = listOf("pref-1"),
        )

        val states = harness.service.enrich(straightTrackGpx(lengthMeters = 1_500)).toList()

        assertIs<GpxRouteEnrichmentState.Init>(states[0])
        assertIs<GpxRouteEnrichmentState.Loading>(states[1])
        val success = assertIs<GpxRouteEnrichmentState.Success>(states.last())
        val syntheticWaypointNames = parser.parse(success.gpxXml).gpxWaypoints
            .mapNotNull(GpxWaypoint::name)
            .filter { it.startsWith("hb_at_") }
        val expectedAssetId = GpxRouteEnrichmentService.buildAssetId(
            uuid = "pref-1",
            lat = pointOnRoute(600.0).lat,
            lon = pointOnRoute(600.0).lon,
        )

        assertEquals(listOf(expectedAssetId), syntheticWaypointNames)
        assertTrue(Files.exists(harness.cacheDir.resolve(expectedAssetId)))
    }

    @Test
    fun `enrich keeps the existing route density policy`() = runTest {
        val harness = testHarness(
            routeProvider = { _, _ ->
                listOf(
                    poi("node/1", pointOnRoute(100.0), tags = historicTags("POI 1")),
                    poi("node/2", pointOnRoute(300.0), tags = historicTags("POI 2")),
                    poi("node/3", pointOnRoute(500.0), tags = historicTags("POI 3")),
                    poi("node/4", pointOnRoute(700.0), tags = historicTags("POI 4")),
                    poi("node/5", pointOnRoute(900.0), tags = historicTags("POI 5")),
                )
            },
            generatedIds = listOf("1", "2", "3", "4", "5"),
        )

        val success = assertIs<GpxRouteEnrichmentState.Success>(
            harness.service.enrich(straightTrackGpx(lengthMeters = 2_000)).toList().last(),
        )
        val syntheticWaypoints = parser.parse(success.gpxXml).gpxWaypoints
            .mapNotNull(GpxWaypoint::name)
            .filter { it.startsWith("hb_at_") }

        assertEquals(4, syntheticWaypoints.size)
    }

    @Test
    fun `enrich writes generated waypoints and asset ids at the projected route point`() = runTest {
        val harness = testHarness(
            routeProvider = { _, _ ->
                listOf(
                    poi("node/off-route", pointOffRoute(distanceMetersAlong = 650.0, offsetMeters = 38.0)),
                )
            },
            generatedIds = listOf("projected"),
        )

        val success = assertIs<GpxRouteEnrichmentState.Success>(
            harness.service.enrich(straightTrackGpx(lengthMeters = 1_500)).toList().last(),
        )
        val generatedWaypoint = parser.parse(success.gpxXml).gpxWaypoints
            .first { it.name?.startsWith("hb_at_") == true }
        val projectedPoint = pointOnRoute(650.0)
        val expectedAssetId = GpxRouteEnrichmentService.buildAssetId(
            uuid = "projected",
            lat = projectedPoint.lat,
            lon = projectedPoint.lon,
        )

        assertEquals(expectedAssetId, generatedWaypoint.name)
        assertEquals(projectedPoint.lat, generatedWaypoint.lat, absoluteTolerance = 0.00001)
        assertEquals(projectedPoint.lon, generatedWaypoint.lon, absoluteTolerance = 0.000001)
        assertTrue(Files.exists(harness.cacheDir.resolve(expectedAssetId)))
    }

    @Test
    fun `enrich keeps successful POIs when one generation fails`() = runTest {
        val harness = testHarness(
            routeProvider = { _, _ ->
                listOf(
                    poi("node/good", pointOnRoute(250.0), tags = historicTags("Good")),
                    poi("node/bad", pointOnRoute(650.0), tags = historicTags("Bad")),
                )
            },
            llmClient = FakeLlmClient { context ->
                if (context.selectedPoi.id == "node/bad") {
                    error("LLM failure for node/bad")
                }
                "Description for ${context.selectedPoi.id}"
            },
            generatedIds = listOf("good-id", "bad-id"),
        )

        val success = assertIs<GpxRouteEnrichmentState.Success>(
            harness.service.enrich(straightTrackGpx(lengthMeters = 1_500, includeWaypoint = true)).toList().last(),
        )
        val waypointNames = parser.parse(success.gpxXml).gpxWaypoints.mapNotNull(GpxWaypoint::name)
        val goodAssetId = GpxRouteEnrichmentService.buildAssetId(
            uuid = "good-id",
            lat = pointOnRoute(250.0).lat,
            lon = pointOnRoute(250.0).lon,
        )
        val badAssetId = GpxRouteEnrichmentService.buildAssetId(
            uuid = "bad-id",
            lat = pointOnRoute(650.0).lat,
            lon = pointOnRoute(650.0).lon,
        )

        assertTrue("Midpoint" in waypointNames)
        assertTrue(goodAssetId in waypointNames)
        assertTrue(badAssetId !in waypointNames)
        assertFileNames(harness.cacheDir, setOf(goodAssetId))
    }

    @Test
    fun `enrich returns error when every retained POI fails`() = runTest {
        val harness = testHarness(
            routeProvider = { _, _ ->
                listOf(
                    poi("node/a", pointOnRoute(250.0), tags = historicTags("A")),
                    poi("node/b", pointOnRoute(650.0), tags = historicTags("B")),
                )
            },
            audioSynthesizer = FakeAudioSynthesizer { error("TTS down") },
            generatedIds = listOf("a-id", "b-id"),
        )

        val states = harness.service.enrich(straightTrackGpx(lengthMeters = 1_500)).toList()

        assertIs<GpxRouteEnrichmentState.Init>(states[0])
        assertIs<GpxRouteEnrichmentState.Loading>(states[1])
        val error = assertIs<GpxRouteEnrichmentState.Error>(states.last())
        assertTrue(error.message.contains("No waypoint audio could be generated"))
        assertFileNames(harness.cacheDir, emptySet())
    }

    @Test
    fun `enrich returns error on blank GPX input`() = runTest {
        val harness = testHarness(routeProvider = { _, _ -> emptyList() })

        val states = harness.service.enrich("   ").toList()

        assertIs<GpxRouteEnrichmentState.Init>(states[0])
        assertIs<GpxRouteEnrichmentState.Loading>(states[1])
        val error = assertIs<GpxRouteEnrichmentState.Error>(states.last())
        assertTrue(error.message.contains("must not be blank"))
    }

    @Test
    fun `enrich returns error on invalid GPX`() = runTest {
        val harness = testHarness(routeProvider = { _, _ -> emptyList() })

        val states = harness.service.enrich(
            """
            <?xml version="1.0" encoding="UTF-8"?>
            <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1" />
            """.trimIndent(),
        ).toList()

        val error = assertIs<GpxRouteEnrichmentState.Error>(states.last())
        assertTrue(error.message.contains("GPX did not contain any track or route points"))
    }

    private fun testHarness(
        configProvider: InterventionConfigProvider = TestConfigProvider(),
        routeProvider: suspend (RouteBounds, Set<PoiCategory>) -> List<PoiContext>,
        llmClient: LlmClient = FakeLlmClient { context ->
            "Description for ${context.selectedPoi.id}"
        },
        audioSynthesizer: AudioSynthesizer = FakeAudioSynthesizer(),
        generatedIds: List<String> = listOf("1", "2", "3", "4"),
    ): TestHarness {
        val ids = ArrayDeque(generatedIds)
        val cacheDir = Files.createTempDirectory("gpx-route-enrichment-test")
        return TestHarness(
            service = GpxRouteEnrichmentService(
                routePoiDiscoveryService = RoutePoiDiscoveryService(
                    gpxRouteParser = GpxRouteParser(),
                    routePoiProvider = FakeRoutePoiProvider(routeProvider),
                    poiEnricher = PassthroughPoiEnricher(),
                    poiRanker = DefaultPoiRanker(),
                    llmScorer = null,
                ),
                configProvider = configProvider,
                llmClient = llmClient,
                audioSynthesizer = audioSynthesizer,
                audioCacheDirectory = cacheDir,
                voiceConfig = VoiceConfig.Auto(Language.FR),
                uuidProvider = { ids.removeFirst() },
            ),
            cacheDir = cacheDir,
        )
    }

    private fun assertFileNames(directory: Path, expected: Set<String>) {
        Files.list(directory).use { stream ->
            val actual = stream.map { it.fileName.toString() }.toList().toSet()
            assertEquals(expected, actual)
        }
    }

    private fun poi(
        id: String,
        point: GeoPoint,
        category: PoiCategory = PoiCategory.HISTORIC,
        name: String? = id,
        tags: Map<String, String> = mapOf("name" to (name ?: id), "historic" to "monument"),
    ): PoiContext =
        PoiContext(
            id = id,
            name = name,
            point = point,
            category = category,
            tags = tags,
            sourceRefs = listOf(SourceReference(kind = com.shift.ballad.hikecore.intervention.SourceKind.OSM, label = "osm", value = id)),
        )

    private fun historicTags(name: String): Map<String, String> =
        mapOf(
            "name" to name,
            "historic" to "monument",
        )

    private fun straightTrackGpx(lengthMeters: Int, includeWaypoint: Boolean = false): String =
        buildString {
            appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
            appendLine("""<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">""")
            if (includeWaypoint) {
                val point = pointOnRoute(lengthMeters / 2.0)
                appendLine("""  <wpt lat="${point.lat}" lon="${point.lon}"><name>Midpoint</name></wpt>""")
            }
            appendLine("""  <trk><trkseg>""")
            appendLine("""    <trkpt lat="$BASE_LAT" lon="$BASE_LON" />""")
            appendLine("""    <trkpt lat="${pointOnRoute(lengthMeters.toDouble()).lat}" lon="$BASE_LON" />""")
            appendLine("""  </trkseg></trk>""")
            appendLine("""</gpx>""")
        }

    private fun pointOnRoute(distanceMeters: Double): GeoPoint =
        GeoPoint(
            lat = BASE_LAT + (distanceMeters / METERS_PER_DEGREE_LAT),
            lon = BASE_LON,
        )

    private fun pointOffRoute(distanceMetersAlong: Double, offsetMeters: Double): GeoPoint =
        GeoPoint(
            lat = BASE_LAT + (distanceMetersAlong / METERS_PER_DEGREE_LAT),
            lon = BASE_LON + (offsetMeters / metersPerDegreeLon),
        )

    private data class TestHarness(
        val service: GpxRouteEnrichmentService,
        val cacheDir: Path,
    )

    private class FakeRoutePoiProvider(
        private val provider: suspend (RouteBounds, Set<PoiCategory>) -> List<PoiContext>,
    ) : RoutePoiProvider {
        override suspend fun findPois(
            bounds: RouteBounds,
            allowedCategories: Set<PoiCategory>,
        ): List<PoiContext> = provider(bounds, allowedCategories)
    }

    private class PassthroughPoiEnricher : PoiEnricher {
        override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext = poi
    }

    private class FakeLlmClient(
        private val generator: suspend (PreparedInterventionContext) -> String,
    ) : LlmClient {
        override suspend fun generate(context: PreparedInterventionContext): LlmGeneration =
            LlmGeneration(
                text = generator(context),
                modelInfo = ModelInfo(provider = "test", model = "fake"),
            )
    }

    private class FakeAudioSynthesizer(
        private val generator: suspend (String) -> ByteArray = { text -> "audio:$text".toByteArray() },
    ) : AudioSynthesizer {
        override suspend fun synthesize(text: String): ByteArray = generator(text)
    }

    private class TestConfigProvider(
        private val promptInstructions: String = "Reste concise.",
        private val userPreferencesJson: String = """{"tone":"warm"}""",
        private val poiPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
        private val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
    ) : InterventionConfigProvider {
        override fun getPromptInstructions(): String = promptInstructions

        override fun getUserPreferencesJson(): String = userPreferencesJson

        override fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences = poiPreferences

        override fun getExperiencePreferences(): ExperiencePreferences = experiencePreferences
    }

    companion object {
        private const val BASE_LAT = 47.0
        private const val BASE_LON = -1.0
        private const val METERS_PER_DEGREE_LAT = 111_111.0

        @Suppress("unused")
        private val metersPerDegreeLon: Double = METERS_PER_DEGREE_LAT * cos(Math.toRadians(BASE_LAT))
    }
}
