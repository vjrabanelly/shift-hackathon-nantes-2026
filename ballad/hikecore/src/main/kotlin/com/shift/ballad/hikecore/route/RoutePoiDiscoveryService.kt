package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.intervention.DefaultPoiRanker
import com.shift.ballad.hikecore.intervention.LightPoiEnricher
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.PoiContext
import com.shift.ballad.hikecore.intervention.PoiEnrichmentRequest
import com.shift.ballad.hikecore.intervention.PoiEnricher
import com.shift.ballad.hikecore.intervention.OverpassPoiProvider
import com.shift.ballad.hikecore.intervention.enabledPoiCategories
import com.shift.ballad.hikecore.intervention.defaultHttpClient
import io.ktor.client.HttpClient
import kotlin.math.abs
import kotlin.math.max
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Découvre et priorise les POI le long d'un GPX.
 *
 * Le pipeline suit la logique suivante :
 *
 * 1. parser le GPX et calculer sa géométrie
 * 2. interroger Overpass dans un corridor autour du tracé
 * 3. enrichir seulement les meilleurs candidats de chaque fenêtre
 * 4. appliquer un éventuel reranking LLM localisé
 * 5. faire respecter une densité maximale de POI sur le parcours
 */
class RoutePoiDiscoveryService internal constructor(
    private val gpxRouteParser: GpxRouteParser,
    private val routePoiProvider: RoutePoiProvider,
    private val poiEnricher: PoiEnricher,
    private val poiRanker: DefaultPoiRanker,
    private val llmScorer: RoutePoiLlmScorer? = null,
) {

    /** Retourne une vue curée des POI de parcours, triée par distance le long de la route. */
    suspend fun discover(request: RoutePoiDiscoveryRequest): RoutePoiDiscoveryResult {
        val parsedRoute = gpxRouteParser.parse(request.gpxXml)
        val allowedCategories = request.poiPreferences.enabledPoiCategories()
        if (allowedCategories.isEmpty()) {
            return RoutePoiDiscoveryResult(
                routeLengthMeters = parsedRoute.routeLengthMeters.roundToIntMeters(),
                routeBounds = parsedRoute.routeBounds,
                discoveredPois = emptyList(),
                gpxWaypoints = parsedRoute.gpxWaypoints,
            )
        }
        val windows = RouteGeometry.windows(
            routePoints = parsedRoute.routePoints,
            windowSizeMeters = WINDOW_SIZE_METERS,
            paddingMeters = request.routeBufferMeters,
        )

        val rawCandidates = discoverRawCandidates(parsedRoute, windows, request, allowedCategories)
        if (rawCandidates.isEmpty()) {
            return RoutePoiDiscoveryResult(
                routeLengthMeters = parsedRoute.routeLengthMeters.roundToIntMeters(),
                routeBounds = parsedRoute.routeBounds,
                discoveredPois = emptyList(),
                gpxWaypoints = parsedRoute.gpxWaypoints,
            )
        }

        val preliminaryCandidates = rawCandidates.map { candidate ->
            candidate.copy(
                deterministicScore = scoreCandidate(
                    poi = candidate.poi,
                    distanceToRouteMeters = candidate.distanceToRouteMeters,
                    distanceAlongRouteMeters = candidate.distanceAlongRouteMeters,
                    routeLengthMeters = parsedRoute.routeLengthMeters,
                    routeBufferMeters = request.routeBufferMeters,
                    experiencePreferences = request.experiencePreferences,
                ),
            )
        }

        val idsForEnrichment = preliminaryCandidates
            .groupBy(RoutePoiCandidateContext::windowIndex)
            .values
            .flatMap { windowCandidates ->
                windowCandidates
                    .sortedByDescending(RoutePoiCandidateContext::deterministicScore)
                    .take(request.maxPoisPerKm + ENRICHMENT_MARGIN)
                    .map { it.poi.id }
            }
            .toSet()

        // Levier 2 : enrichissement Wikipedia/Wikidata en parallèle via coroutines.
        val enrichedCandidates = coroutineScope {
            preliminaryCandidates.map { candidate ->
                async {
                    val enrichedPoi = if (candidate.poi.id in idsForEnrichment) {
                        poiEnricher.enrich(
                            poi = candidate.poi,
                            request = PoiEnrichmentRequest(
                                language = request.language,
                                experiencePreferences = request.experiencePreferences,
                            ),
                        )
                    } else {
                        candidate.poi
                    }

                    candidate.copy(
                        poi = enrichedPoi,
                        deterministicScore = scoreCandidate(
                            poi = enrichedPoi,
                            distanceToRouteMeters = candidate.distanceToRouteMeters,
                            distanceAlongRouteMeters = candidate.distanceAlongRouteMeters,
                            routeLengthMeters = parsedRoute.routeLengthMeters,
                            routeBufferMeters = request.routeBufferMeters,
                            experiencePreferences = request.experiencePreferences,
                        ),
                    )
                }
            }.awaitAll()
        }

        val rerankedCandidates = if (request.llmScoringEnabled && llmScorer != null) {
            applyLlmReranking(
                request = request,
                routeLengthMeters = parsedRoute.routeLengthMeters.roundToIntMeters(),
                candidates = enrichedCandidates,
            )
        } else {
            enrichedCandidates
        }

        val selectedCandidates = applyDensityPolicy(
            candidates = rerankedCandidates,
            maxPoisPerKm = request.maxPoisPerKm,
        )

        return RoutePoiDiscoveryResult(
            routeLengthMeters = parsedRoute.routeLengthMeters.roundToIntMeters(),
            routeBounds = parsedRoute.routeBounds,
            discoveredPois = selectedCandidates
                .sortedBy(RoutePoiCandidateContext::distanceAlongRouteMeters)
                .map(::toDiscoveredPoi),
            gpxWaypoints = parsedRoute.gpxWaypoints,
        )
    }

    private suspend fun discoverRawCandidates(
        parsedRoute: ParsedGpxRoute,
        windows: List<RouteWindow>,
        request: RoutePoiDiscoveryRequest,
        allowedCategories: Set<PoiCategory>,
    ): List<RoutePoiCandidateContext> {
        val candidatesById = linkedMapOf<String, RoutePoiCandidateContext>()

        // Levier 1 : une seule requête Overpass couvrant tout le tracé au lieu de N batches
        // séquentiels. La répartition par fenêtre se fait après, lors de la projection.
        val globalBounds = RouteGeometry.mergedBounds(windows.map(RouteWindow::bounds))
        val pois = routePoiProvider.findPois(
            bounds = globalBounds,
            allowedCategories = allowedCategories,
        )

        pois.forEach { poi ->
            if (candidatesById.containsKey(poi.id)) return@forEach
            if (poi.category !in allowedCategories) return@forEach

            val projection = RouteGeometry.project(poi.point, parsedRoute.routePoints) ?: return@forEach
            if (projection.distanceToRouteMeters > request.routeBufferMeters) return@forEach

            val windowIndex = max(
                0,
                (projection.distanceAlongRouteMeters / WINDOW_SIZE_METERS.toDouble()).toInt(),
            )

            candidatesById[poi.id] = RoutePoiCandidateContext(
                poi = poi,
                projectedPoint = projection.projectedPoint,
                distanceAlongRouteMeters = projection.distanceAlongRouteMeters,
                distanceToRouteMeters = projection.distanceToRouteMeters,
                nearestSegmentIndex = projection.nearestSegmentIndex,
                windowIndex = windowIndex,
                deterministicScore = 0.0,
            )
        }

        return candidatesById.values.toList()
    }

    private suspend fun applyLlmReranking(
        request: RoutePoiDiscoveryRequest,
        routeLengthMeters: Int,
        candidates: List<RoutePoiCandidateContext>,
    ): List<RoutePoiCandidateContext> {
        if (llmScorer == null) return candidates

        val llmBonusById = mutableMapOf<String, Double>()
        candidates
            .groupBy(RoutePoiCandidateContext::windowIndex)
            .forEach { (windowIndex, windowCandidates) ->
                val sortedWindowCandidates = windowCandidates.sortedByDescending(RoutePoiCandidateContext::deterministicScore)
                if (!shouldUseLlm(sortedWindowCandidates, request.maxPoisPerKm)) {
                    return@forEach
                }

                // Le LLM n'est utilisé qu'en arbitrage local quand le score déterministe ne
                // suffit pas à départager proprement les POI d'un même segment.
                val shortlist = sortedWindowCandidates.take(max(request.maxPoisPerKm + ENRICHMENT_MARGIN, LLM_SHORTLIST_SIZE))
                val rerank = try {
                    llmScorer.rerank(
                        request = request,
                        windowIndex = windowIndex,
                        routeLengthMeters = routeLengthMeters,
                        candidates = shortlist,
                    )
                } catch (_: Exception) {
                    emptyMap()
                }
                llmBonusById.putAll(rerank)
            }

        return candidates.map { candidate ->
            candidate.copy(llmBonus = llmBonusById[candidate.poi.id] ?: 0.0)
        }
    }

    private fun scoreCandidate(
        poi: PoiContext,
        distanceToRouteMeters: Double,
        distanceAlongRouteMeters: Double,
        routeLengthMeters: Double,
        routeBufferMeters: Int,
        experiencePreferences: com.shift.ballad.hikecore.intervention.ExperiencePreferences,
    ): Double {
        val baseScore = poiRanker.scorePoi(
            poi = poi,
            distanceMeters = distanceToRouteMeters.roundToIntMeters(),
            radiusMeters = routeBufferMeters.coerceAtLeast(1),
            experiencePreferences = experiencePreferences,
        )
        val corridorRatio = (distanceToRouteMeters / routeBufferMeters.coerceAtLeast(1)).coerceIn(0.0, 1.0)
        val corridorBonus = (1.0 - corridorRatio) * 18.0
        val edgeDistance = minOf(distanceAlongRouteMeters, abs(routeLengthMeters - distanceAlongRouteMeters))
        val positionBonus = when {
            routeLengthMeters <= 300.0 -> 2.0
            edgeDistance < 60.0 -> 1.0
            edgeDistance < 200.0 -> 3.0
            else -> 4.5
        }
        return baseScore + corridorBonus + positionBonus
    }

    private fun shouldUseLlm(candidates: List<RoutePoiCandidateContext>, maxPoisPerKm: Int): Boolean {
        if (candidates.size <= 1) return false
        if (candidates.size > maxPoisPerKm) return true
        val relevant = candidates.take(minOf(candidates.size, maxPoisPerKm + 1))
        return relevant.zipWithNext().any { (left, right) ->
            abs(left.deterministicScore - right.deterministicScore) < LLM_AMBIGUITY_DELTA
        }
    }

    private fun applyDensityPolicy(
        candidates: List<RoutePoiCandidateContext>,
        maxPoisPerKm: Int,
    ): List<RoutePoiCandidateContext> {
        val selected = mutableListOf<RoutePoiCandidateContext>()
        // La sélection finale reste gloutonne mais la densité est contrôlée en fenêtre glissante
        // pour éviter des grappes de POI trop serrées sur un même kilomètre.
        candidates
            .sortedWith(
                compareByDescending<RoutePoiCandidateContext> { it.totalScore }
                    .thenBy(RoutePoiCandidateContext::distanceAlongRouteMeters),
            )
            .forEach { candidate ->
                if (selected.any { abs(it.distanceAlongRouteMeters - candidate.distanceAlongRouteMeters) < MIN_SPACING_METERS }) {
                    return@forEach
                }

                val projectedSelection = (selected + candidate).sortedBy(RoutePoiCandidateContext::distanceAlongRouteMeters)
                if (exceedsSlidingDensity(projectedSelection, maxPoisPerKm)) {
                    return@forEach
                }

                selected += candidate
            }

        return selected
    }

    private fun exceedsSlidingDensity(
        candidates: List<RoutePoiCandidateContext>,
        maxPoisPerKm: Int,
    ): Boolean {
        var left = 0
        for (right in candidates.indices) {
            while (
                candidates[right].distanceAlongRouteMeters - candidates[left].distanceAlongRouteMeters >
                WINDOW_SIZE_METERS
            ) {
                left += 1
            }
            if (right - left + 1 > maxPoisPerKm) {
                return true
            }
        }
        return false
    }

    private fun toDiscoveredPoi(candidate: RoutePoiCandidateContext): DiscoveredRoutePoi =
        DiscoveredRoutePoi(
            id = candidate.poi.id,
            name = candidate.poi.name,
            lat = candidate.projectedPoint.lat,
            lon = candidate.projectedPoint.lon,
            category = candidate.poi.category,
            tags = candidate.poi.tags,
            sourceRefs = candidate.poi.sourceRefs,
            sourceSummaries = candidate.poi.sourceSummaries,
            score = candidate.totalScore,
            distanceAlongRouteMeters = candidate.distanceAlongRouteMeters.roundToIntMeters(),
            distanceToRouteMeters = candidate.distanceToRouteMeters.roundToIntMeters(),
            nearestSegmentIndex = candidate.nearestSegmentIndex,
        )

    companion object {
        private const val WINDOW_SIZE_METERS = 1_000
        private const val BATCH_WINDOW_COUNT = 3
        private const val ENRICHMENT_MARGIN = 2
        private const val LLM_SHORTLIST_SIZE = 6
        private const val LLM_AMBIGUITY_DELTA = 6.0
        private const val MIN_SPACING_METERS = 150.0

        fun createDefault(
            config: HikeConfig = HikeConfig(),
            httpClient: HttpClient = defaultHttpClient(),
        ): RoutePoiDiscoveryService =
            RoutePoiDiscoveryService(
                gpxRouteParser = GpxRouteParser(),
                routePoiProvider = RouteOverpassPoiProvider(
                    httpClient = httpClient,
                    endpoints = System.getenv("OVERPASS_ENDPOINTS")
                        ?.split(',')
                        ?.map(String::trim)
                        ?.filter(String::isNotBlank)
                        ?.takeIf { it.isNotEmpty() }
                        ?: OverpassPoiProvider.DEFAULT_ENDPOINTS,
                ),
                poiEnricher = LightPoiEnricher(httpClient),
                poiRanker = DefaultPoiRanker(),
                llmScorer = config.openAiApiKey
                    ?.takeIf(String::isNotBlank)
                    ?.let { apiKey ->
                        OpenAiRoutePoiLlmScorer(
                            apiKey = apiKey,
                            model = config.openAiModel,
                            httpClient = httpClient,
                        )
                    },
            )
    }
}
