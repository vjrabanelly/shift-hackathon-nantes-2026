package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.ExperiencePreferences
import com.shift.ballad.hikecore.intervention.PoiSelectionMode
import com.shift.ballad.hikecore.intervention.PoiCategorySelection
import com.shift.ballad.hikecore.intervention.PoiDiscoveryPreferences
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.PoiContext
import com.shift.ballad.hikecore.intervention.PoiEnrichmentRequest
import com.shift.ballad.hikecore.intervention.PoiEnricher
import com.shift.ballad.hikecore.intervention.SourceKind
import com.shift.ballad.hikecore.intervention.SourceReference
import com.shift.ballad.hikecore.intervention.SourceSummary
import java.nio.file.Files
import java.nio.file.Path
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class RoutePoiDiscoveryServiceTest {

    @Test
    fun `corridor filter keeps only POIs close to the route`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi("node/near", pointOnRoute(distanceMeters = 500.0)),
                poi("node/far", pointOffRoute(distanceMetersAlong = 500.0, offsetMeters = 240.0)),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )

        assertEquals(listOf("node/near"), result.discoveredPois.map { it.id })
        assertTrue(result.discoveredPois.first().distanceToRouteMeters <= 100)
    }

    @Test
    fun `route discovery repositions retained POIs to the closest point on the route`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi("node/off-route", pointOffRoute(distanceMetersAlong = 650.0, offsetMeters = 42.0)),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )

        val discovered = result.discoveredPois.single()
        val projectedPoint = pointOnRoute(650.0)

        assertEquals(projectedPoint.lat, discovered.lat, absoluteTolerance = 0.00001)
        assertEquals(projectedPoint.lon, discovered.lon, absoluteTolerance = 0.000001)
        assertTrue(discovered.distanceAlongRouteMeters in 640..660)
        assertTrue(discovered.distanceToRouteMeters in 35..50)
    }

    @Test
    fun `density policy never keeps more than four POIs in any sliding kilometer`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi("node/1", pointOnRoute(100.0), tags = mapOf("name" to "Poi 1", "historic" to "monument", "wikipedia" to "fr:Poi_1")),
                poi("node/2", pointOnRoute(300.0), tags = mapOf("name" to "Poi 2", "historic" to "monument")),
                poi("node/3", pointOnRoute(500.0), tags = mapOf("name" to "Poi 3", "historic" to "monument")),
                poi("node/4", pointOnRoute(700.0), tags = mapOf("name" to "Poi 4", "historic" to "monument")),
                poi("node/5", pointOnRoute(900.0), tags = mapOf("name" to "Poi 5", "historic" to "monument")),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 2_000),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )

        assertEquals(4, result.discoveredPois.size)
        assertSlidingCap(result.discoveredPois.map { it.distanceAlongRouteMeters }, maxPerKm = 4)
    }

    @Test
    fun `minimum spacing keeps the strongest POI in a micro cluster`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi(
                    "node/strong",
                    pointOnRoute(250.0),
                    tags = mapOf(
                        "name" to "Strong POI",
                        "historic" to "castle",
                        "wikipedia" to "fr:Strong_POI",
                        "wikidata" to "Q1",
                    ),
                ),
                poi(
                    "node/weak",
                    pointOnRoute(310.0),
                    tags = mapOf("name" to "Weak POI", "historic" to "monument"),
                ),
                poi(
                    "node/far",
                    pointOnRoute(900.0),
                    tags = mapOf("name" to "Far POI", "historic" to "monument"),
                ),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )

        assertTrue(result.discoveredPois.any { it.id == "node/strong" })
        assertFalse(result.discoveredPois.any { it.id == "node/weak" })
        assertTrue(result.discoveredPois.any { it.id == "node/far" })
    }

    @Test
    fun `deduplicates OSM POIs returned by single route query`() = runTest {
        val requests = mutableListOf<RouteBounds>()
        val service = serviceWithProvider { bounds, _ ->
            requests += bounds
            // Simulate duplicates in the same response (e.g. node + way with same logical POI)
            listOf(
                poi("node/dup", pointOnRoute(650.0)),
                poi("node/dup", pointOnRoute(650.0)),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 4_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )

        assertEquals(1, requests.size)
        assertEquals(1, result.discoveredPois.count { it.id == "node/dup" })
    }

    @Test
    fun `sample GPX remains usable when LLM reranking is unavailable`() = runTest {
        val sampleGpx = readSample("nantes-graslin-commerce.gpx")
        val service = RoutePoiDiscoveryService(
            gpxRouteParser = GpxRouteParser(),
            routePoiProvider = FakeRoutePoiProvider { _, _ ->
                listOf(
                    poi(
                        "node/graslin",
                        GeoPoint(47.21295, -1.56220),
                        name = "Place Graslin",
                        category = PoiCategory.HISTORIC,
                        tags = mapOf("name" to "Place Graslin", "historic" to "square", "wikipedia" to "fr:Place_Graslin"),
                    ),
                    poi(
                        "node/museum",
                        GeoPoint(47.21268, -1.56369),
                        name = "Museum",
                        category = PoiCategory.HISTORIC,
                        tags = mapOf("name" to "Museum", "historic" to "museum", "wikidata" to "Q123"),
                    ),
                )
            },
            poiEnricher = FakePoiEnricher(),
            poiRanker = com.shift.ballad.hikecore.intervention.DefaultPoiRanker(),
            llmScorer = ThrowingLlmScorer(),
        )

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = sampleGpx,
                routeBufferMeters = 120,
                llmScoringEnabled = true,
            ),
        )

        assertTrue(result.discoveredPois.isNotEmpty())
        assertTrue(result.gpxWaypoints.isNotEmpty())
        assertTrue(result.discoveredPois.zipWithNext().all { (left, right) ->
            left.distanceAlongRouteMeters <= right.distanceAlongRouteMeters
        })
    }

    @Test
    fun `route discovery filters out categories disabled in preferences`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi(
                    "node/viewpoint",
                    pointOnRoute(300.0),
                    category = PoiCategory.VIEWPOINT,
                    tags = mapOf("name" to "Viewpoint", "tourism" to "viewpoint"),
                ),
                poi(
                    "node/historic",
                    pointOnRoute(600.0),
                    category = PoiCategory.HISTORIC,
                    tags = mapOf("name" to "Historic", "historic" to "monument"),
                ),
            )
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
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
        )

        assertEquals(listOf("node/historic"), result.discoveredPois.map { it.id })
    }

    @Test
    fun `route discovery returns no POI and skips lookup when every category is disabled`() = runTest {
        var providerCalled = false
        val service = serviceWithProvider { _, _ ->
            providerCalled = true
            emptyList()
        }

        val result = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
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

        assertTrue(result.discoveredPois.isEmpty())
        assertFalse(providerCalled)
    }

    @Test
    fun `route discovery uses poi selection mode in deterministic scoring`() = runTest {
        val service = serviceWithProvider { _, _ ->
            listOf(
                poi(
                    "node/historic",
                    pointOnRoute(350.0),
                    category = PoiCategory.HISTORIC,
                    name = "Abbaye",
                    tags = mapOf(
                        "name" to "Abbaye",
                        "historic" to "monastery",
                        "wikidata" to "Q100",
                    ),
                ),
                poi(
                    "node/viewpoint",
                    pointOnRoute(760.0),
                    category = PoiCategory.VIEWPOINT,
                    name = "Belvédère",
                    tags = mapOf(
                        "name" to "Belvédère",
                        "tourism" to "viewpoint",
                        "wikipedia" to "fr:Belvedere",
                    ),
                ),
            )
        }

        val balanced = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
            ),
        )
        val panorama = service.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(lengthMeters = 1_500),
                routeBufferMeters = 100,
                llmScoringEnabled = false,
                experiencePreferences = ExperiencePreferences(
                    poiSelectionMode = PoiSelectionMode.PANORAMA,
                ),
            ),
        )

        val balancedViewpoint = balanced.discoveredPois.first { it.id == "node/viewpoint" }
        val balancedHistoric = balanced.discoveredPois.first { it.id == "node/historic" }
        val panoramaViewpoint = panorama.discoveredPois.first { it.id == "node/viewpoint" }
        val panoramaHistoric = panorama.discoveredPois.first { it.id == "node/historic" }

        assertTrue(panoramaViewpoint.score > panoramaHistoric.score)
        assertTrue(
            panoramaViewpoint.score - panoramaHistoric.score >
                balancedViewpoint.score - balancedHistoric.score,
        )
    }

    private fun serviceWithProvider(
        provider: suspend (RouteBounds, Set<PoiCategory>) -> List<PoiContext>,
    ): RoutePoiDiscoveryService =
        RoutePoiDiscoveryService(
            gpxRouteParser = GpxRouteParser(),
            routePoiProvider = FakeRoutePoiProvider(provider),
            poiEnricher = FakePoiEnricher(),
            poiRanker = com.shift.ballad.hikecore.intervention.DefaultPoiRanker(),
            llmScorer = null,
        )

    private fun assertSlidingCap(distances: List<Int>, maxPerKm: Int) {
        val sorted = distances.sorted()
        var left = 0
        for (right in sorted.indices) {
            while (sorted[right] - sorted[left] > 1_000) {
                left += 1
            }
            assertTrue(right - left + 1 <= maxPerKm)
        }
    }

    private fun poi(
        id: String,
        point: GeoPoint,
        name: String = id,
        category: PoiCategory = PoiCategory.HISTORIC,
        tags: Map<String, String> = mapOf("name" to name, "historic" to "monument"),
    ): PoiContext =
        PoiContext(
            id = id,
            name = name,
            point = point,
            category = category,
            tags = tags,
            sourceRefs = listOf(
                SourceReference(
                    kind = SourceKind.OSM,
                    label = name,
                    value = id,
                    url = "https://www.openstreetmap.org/$id",
                ),
            ),
        )

    private fun pointOnRoute(distanceMeters: Double): GeoPoint {
        val lat = BASE_LAT + distanceMeters / METERS_PER_DEGREE_LAT
        return GeoPoint(lat = lat, lon = BASE_LON)
    }

    private fun pointOffRoute(distanceMetersAlong: Double, offsetMeters: Double): GeoPoint {
        val lat = BASE_LAT + distanceMetersAlong / METERS_PER_DEGREE_LAT
        val lon = BASE_LON + offsetMeters / metersPerDegreeLon(BASE_LAT)
        return GeoPoint(lat = lat, lon = lon)
    }

    private fun straightTrackGpx(lengthMeters: Int): String {
        val stepMeters = 250
        val points = buildList {
            var distance = 0
            while (distance <= lengthMeters) {
                add(pointOnRoute(distance.toDouble()))
                distance += stepMeters
            }
            val endPoint = pointOnRoute(lengthMeters.toDouble())
            if (last() != endPoint) {
                add(endPoint)
            }
        }

        return buildString {
            appendLine("""<?xml version="1.0" encoding="UTF-8"?>""")
            appendLine("""<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">""")
            appendLine("""  <wpt lat="${pointOnRoute(lengthMeters / 2.0).lat}" lon="$BASE_LON"><name>Midpoint</name></wpt>""")
            appendLine("""  <trk><trkseg>""")
            points.forEach { point ->
                appendLine("""    <trkpt lat="${point.lat}" lon="${point.lon}" />""")
            }
            appendLine("""  </trkseg></trk>""")
            appendLine("""</gpx>""")
        }
    }

    private fun readSample(fileName: String): String {
        val candidates = listOf(
            Path.of("samples", fileName),
            Path.of("..", "samples", fileName),
        )
        val path = candidates.firstOrNull { Files.isRegularFile(it) }
            ?: error("Could not find sample GPX: $fileName")
        return Files.readString(path)
    }

    private class FakeRoutePoiProvider(
        private val provider: suspend (RouteBounds, Set<PoiCategory>) -> List<PoiContext>,
    ) : RoutePoiProvider {
        override suspend fun findPois(
            bounds: RouteBounds,
            allowedCategories: Set<PoiCategory>,
        ): List<PoiContext> = provider(bounds, allowedCategories)
    }

    private class FakePoiEnricher : PoiEnricher {
        override suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext =
            if (poi.tags.containsKey("wikipedia") || poi.tags.containsKey("wikidata")) {
                poi.copy(
                    sourceSummaries = listOf(
                        SourceSummary(
                            kind = SourceKind.WIKIPEDIA,
                            title = poi.name ?: poi.id,
                            snippet = "Short trusted summary",
                            url = "https://example.com/${poi.id}",
                        ),
                    ),
                )
            } else {
                poi
            }
    }

    private class ThrowingLlmScorer : RoutePoiLlmScorer {
        override suspend fun rerank(
            request: RoutePoiDiscoveryRequest,
            windowIndex: Int,
            routeLengthMeters: Int,
            candidates: List<RoutePoiCandidateContext>,
        ): Map<String, Double> = error("LLM unavailable")
    }

    companion object {
        private const val BASE_LAT = 47.0
        private const val BASE_LON = -1.0
        private const val METERS_PER_DEGREE_LAT = 111_320.0

        private fun metersPerDegreeLon(latitude: Double): Double =
            max(1.0, METERS_PER_DEGREE_LAT * cos(Math.toRadians(latitude)))
    }
}
