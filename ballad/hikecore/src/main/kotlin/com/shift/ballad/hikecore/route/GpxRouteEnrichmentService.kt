package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.api.Voice
import com.shift.ballad.hikecore.language
import com.shift.ballad.hikecore.voice
import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.intervention.AudioSynthesizer
import com.shift.ballad.hikecore.intervention.DefaultPromptBuilder
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.LlmClient
import com.shift.ballad.hikecore.intervention.PoiCandidate
import com.shift.ballad.hikecore.intervention.PreparedInterventionContext
import com.shift.ballad.hikecore.intervention.PromptBuilder
import com.shift.ballad.hikecore.intervention.createDefaultAudioSynthesizer
import com.shift.ballad.hikecore.intervention.createDefaultLlmClient
import com.shift.ballad.hikecore.intervention.defaultHttpClient
import com.shift.ballad.hikecore.intervention.config.InterventionConfigProvider
import com.shift.ballad.hikecore.intervention.config.buildInterventionRequest
import io.ktor.client.HttpClient
import java.nio.file.Path
import java.util.UUID
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

/** Étapes de progression du pipeline d'enrichissement GPX. */
enum class EnrichmentStep {
    ParseGpx,          // Chargement du GPX
    DiscoveringPois,   // Récupération des endpoints (Overpass)
    RankingPois,       // Ranking
    GeneratingTexts,   // Génération des descriptions via OpenAI
    GeneratingAudio,   // Génération des audios via Mistral
}

/** États de progression émis par [GpxRouteEnrichmentService.enrich]. */
sealed class GpxRouteEnrichmentState {
    /** Le flux vient d'être créé mais aucun travail n'a encore commencé. */
    data object Init : GpxRouteEnrichmentState()

    /** Le GPX est en cours d'enrichissement à l'étape donnée. */
    data class Loading(val step: EnrichmentStep) : GpxRouteEnrichmentState()

    /** Le pipeline s'est arrêté avant de produire un GPX enrichi utilisable. */
    data class Error(val message: String) : GpxRouteEnrichmentState()

    /** Le GPX final a été produit ; les fichiers audio ont déjà été écrits dans le cache local. */
    data class Success(val gpxXml: String) : GpxRouteEnrichmentState()
}

/**
 * Transforme un GPX brut en GPX enrichi avec waypoints audio.
 *
 * Le service combine trois responsabilités :
 *
 * - découvrir les POI pertinents le long du parcours
 * - générer un texte et un audio pour chaque POI retenu
 * - réinjecter dans le GPX des waypoints dont le nom sert aussi d'identifiant d'asset
 *
 * Le format d'identifiant `hb_at_<uuid>_<lat>_<lon>` est volontairement conservé car il
 * sert aujourd'hui de contrat avec le prototype Android. Les coordonnées encodées sont
 * celles du point de déclenchement projeté sur le tracé.
 */
class GpxRouteEnrichmentService internal constructor(
    private val routePoiDiscoveryService: RoutePoiDiscoveryService,
    private val configProvider: InterventionConfigProvider,
    private val promptBuilder: PromptBuilder = DefaultPromptBuilder(),
    private val llmClient: LlmClient?,
    private val audioSynthesizer: AudioSynthesizer?,
    private val gpxWaypointAppender: GpxWaypointAppender = GpxWaypointAppender(),
    private val audioCacheDirectory: Path,
    private val voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    private val uuidProvider: () -> String = { UUID.randomUUID().toString() },
) {
    private val log = LoggerFactory.getLogger(GpxRouteEnrichmentService::class.java)

    /**
     * Lance un enrichissement best-effort.
     *
     * Tant qu'au moins un waypoint audio peut être produit, le service continue même si
     * certains POI individuels échouent en cours de génération.
     */
    fun enrich(gpxXml: String): Flow<GpxRouteEnrichmentState> =
        flow {
            emit(GpxRouteEnrichmentState.Init)
            emit(GpxRouteEnrichmentState.Success(enrichInternal(gpxXml) { step ->
                emit(GpxRouteEnrichmentState.Loading(step))
            }))
        }.catch { exception ->
            emit(
                GpxRouteEnrichmentState.Error(
                    exception.message ?: "GPX route enrichment failed",
                ),
            )
        }

    private suspend fun enrichInternal(
        gpxXml: String,
        onStep: suspend (EnrichmentStep) -> Unit,
    ): String {
        require(gpxXml.isNotBlank()) { "GPX input must not be blank" }
        val generationClient = requireNotNull(llmClient) {
            "OPENAI_API_KEY is required to enrich a GPX route"
        }
        val audioGenerator = requireNotNull(audioSynthesizer) {
            "A Mistral API key is required to enrich a GPX route"
        }

        onStep(EnrichmentStep.ParseGpx)
        // La découverte parse le GPX et interroge Overpass pour trouver les POI.
        onStep(EnrichmentStep.DiscoveringPois)
        val discoveryResult = routePoiDiscoveryService.discover(
            RoutePoiDiscoveryRequest(
                gpxXml = gpxXml,
                language = voiceConfig.language,
                maxPoisPerKm = MAX_POIS_PER_KM,
                routeBufferMeters = DEFAULT_ROUTE_BUFFER_METERS,
                poiPreferences = configProvider.getPoiDiscoveryPreferences(),
                experiencePreferences = configProvider.getExperiencePreferences(),
            ),
        )
        val discoveredPois = discoveryResult.discoveredPois.sortedBy(DiscoveredRoutePoi::distanceAlongRouteMeters)
        require(discoveredPois.isNotEmpty()) { "No route POI matched the GPX and current preferences" }

        onStep(EnrichmentStep.RankingPois)
        audioCacheDirectory.toFile().mkdirs()
        val candidatePois = discoveredPois.map(::toPoiCandidate)

        // Passe 1 : génération LLM (texte) en parallèle pour tous les POI.
        var firstFailure: Throwable? = null
        onStep(EnrichmentStep.GeneratingTexts)
        data class PoiText(val poi: DiscoveredRoutePoi, val text: String)
        val generatedTexts = coroutineScope {
            discoveredPois.map { poi ->
                async {
                    runCatching {
                        val context = buildContext(poi, candidatePois)
                        val generation = generationClient.generate(context)
                        PoiText(poi, generation.text)
                    }.onFailure { exception ->
                        if (firstFailure == null) firstFailure = exception
                        log.warn(
                            "[route-enrichment] skipped poi={} name=\"{}\" (text): {}",
                            poi.id,
                            poi.name,
                            exception.message ?: exception::class.simpleName,
                        )
                    }.getOrNull()
                }
            }.awaitAll().filterNotNull()
        }

        // Passe 2 : synthèse audio en parallèle pour tous les textes générés.
        data class EnrichedWaypoint(
            val waypoint: GpxWaypoint,
            val poi: DiscoveredRoutePoi,
            val text: String,
            val assetId: String,
        )

        onStep(EnrichmentStep.GeneratingAudio)
        val enrichedWaypoints = coroutineScope {
            generatedTexts.map { (poi, text) ->
                async {
                    runCatching {
                        val assetId = buildAssetId(
                            uuid = uuidProvider(),
                            lat = poi.lat,
                            lon = poi.lon,
                        )
                        val audioData = audioGenerator.synthesize(text)
                        audioCacheDirectory.resolve(assetId).toFile().writeBytes(audioData)
                        EnrichedWaypoint(
                            waypoint = GpxWaypoint(lat = poi.lat, lon = poi.lon, name = assetId),
                            poi = poi,
                            text = text,
                            assetId = assetId,
                        )
                    }.onFailure { exception ->
                        if (firstFailure == null) firstFailure = exception
                        log.warn(
                            "[route-enrichment] skipped poi={} name=\"{}\" (audio): {}",
                            poi.id,
                            poi.name,
                            exception.message ?: exception::class.simpleName,
                        )
                    }.getOrNull()
                }
            }.awaitAll().filterNotNull()
        }

        require(enrichedWaypoints.isNotEmpty()) {
            val reason = firstFailure?.let { ": ${it::class.simpleName}: ${it.message}" }.orEmpty()
            "No waypoint audio could be generated for the provided GPX$reason"
        }

        saveMetadata(enrichedWaypoints.map { ew ->
            RoutePoiMetadata(
                assetId = ew.assetId,
                poiName = ew.poi.name,
                category = ew.poi.category,
                descriptionText = ew.text,
                lat = ew.poi.lat,
                lon = ew.poi.lon,
            )
        })

        return gpxWaypointAppender.appendWaypoints(gpxXml, enrichedWaypoints.map { it.waypoint })
    }

    private fun saveMetadata(pois: List<RoutePoiMetadata>) {
        runCatching {
            val metadataFile = audioCacheDirectory.resolve("metadata.json").toFile()
            metadataFile.writeText(Json { prettyPrint = true }.encodeToString(RouteMetadata(pois)))
        }.onFailure { log.warn("[route-enrichment] failed to save metadata.json: ${it.message}") }
    }

    private fun buildContext(
        poi: DiscoveredRoutePoi,
        candidatePois: List<PoiCandidate>,
    ): PreparedInterventionContext {
        val request = buildInterventionRequest(
            configProvider = configProvider,
            point = GeoPoint(lat = poi.lat, lon = poi.lon),
            radiusMeters = DEFAULT_ROUTE_BUFFER_METERS,
            voiceConfig = voiceConfig,
            maxCandidatePois = candidatePois.size.coerceAtLeast(1),
        )
        val selectedPoi = candidatePois.firstOrNull { it.id == poi.id }
            ?: error("Selected POI ${poi.id} could not be recovered for prompt generation")
        return PreparedInterventionContext(
            request = request,
            selectedPoi = selectedPoi,
            candidatePois = candidatePois,
            sourceSummaries = poi.sourceSummaries,
            prompt = promptBuilder.build(
                request = request,
                selectedPoi = selectedPoi,
                candidatePois = candidatePois,
                sourceSummaries = poi.sourceSummaries,
            ),
        )
    }

    private fun toPoiCandidate(poi: DiscoveredRoutePoi): PoiCandidate =
        PoiCandidate(
            id = poi.id,
            name = poi.name,
            lat = poi.lat,
            lon = poi.lon,
            distanceMeters = poi.distanceToRouteMeters,
            category = poi.category,
            tags = poi.tags,
            sourceRefs = poi.sourceRefs,
            score = poi.score,
        )

    companion object {
        private const val MAX_POIS_PER_KM = 4
        private const val DEFAULT_ROUTE_BUFFER_METERS = 100
        private const val ASSET_PREFIX = "hb_at_"

        /** Construit l'identifiant partagé entre waypoint GPX et fichier audio local. */
        internal fun buildAssetId(uuid: String, lat: Double, lon: Double): String =
            "$ASSET_PREFIX${uuid}_${lat}_${lon}"

        fun createDefault(
            config: HikeConfig = HikeConfig(),
            configProvider: InterventionConfigProvider,
            audioCacheDirectory: Path,
            httpClient: HttpClient = defaultHttpClient(),
        ): GpxRouteEnrichmentService =
            GpxRouteEnrichmentService(
                routePoiDiscoveryService = RoutePoiDiscoveryService.createDefault(
                    config = config,
                    httpClient = httpClient,
                ),
                configProvider = configProvider,
                llmClient = config.openAiApiKey
                    ?.takeIf(String::isNotBlank)
                    ?.let { apiKey ->
                        createDefaultLlmClient(
                            apiKey = apiKey,
                            model = config.openAiModel,
                            httpClient = httpClient,
                            cacheFile = audioCacheDirectory.resolve("openai-cache.json"),
                        )
                    },
                audioSynthesizer = createDefaultAudioSynthesizer(
                    mistralApiKey = config.mistralApiKey,
                    voice = config.voiceConfig.voice,
                    httpClient = httpClient,
                ),
                audioCacheDirectory = audioCacheDirectory,
                voiceConfig = config.voiceConfig,
            )
    }
}
