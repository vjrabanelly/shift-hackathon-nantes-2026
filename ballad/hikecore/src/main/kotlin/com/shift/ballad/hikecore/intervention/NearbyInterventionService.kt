package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.language
import com.shift.ballad.hikecore.api.Voice
import io.ktor.client.HttpClient
import org.slf4j.LoggerFactory

/**
 * Point d'entrée principal du pipeline "intervention à proximité".
 *
 * Le service enchaîne toujours les mêmes étapes :
 *
 * 1. récupérer les POI autour d'un point
 * 2. enrichir un sous-ensemble des meilleurs candidats
 * 3. reranker et sélectionner le meilleur POI final
 * 4. construire le prompt final
 * 5. appeler le LLM, puis éventuellement la synthèse audio
 *
 * Ce flux est réutilisé par les endpoints serveur et par les commandes CLI centrées
 * sur une position GPS plutôt que sur un GPX complet.
 */
class NearbyInterventionService internal constructor(
    private val poiProvider: PoiProvider,
    private val poiEnricher: PoiEnricher,
    private val poiRanker: PoiRanker,
    private val promptBuilder: PromptBuilder,
    private val llmClient: LlmClient,
    private val audioSynthesizer: AudioSynthesizer? = null,
) {
    private val log = LoggerFactory.getLogger(NearbyInterventionService::class.java)

    /**
     * Prépare tout le contexte nécessaire à une génération sans appeler le LLM.
     *
     * Cette séparation est utile pour :
     *
     * - inspecter les candidats retenus
     * - partager le même pipeline de préparation entre plusieurs sorties
     * - isoler les erreurs de lookup/ranking des erreurs de génération
     */
    suspend fun prepare(request: InterventionRequest): PromptPreparationResult {
        val allowedCategories = request.poiPreferences.enabledPoiCategories()
        if (allowedCategories.isEmpty()) {
            return PromptPreparationResult.NoIntervention(
                reason = "No POI category is enabled in preferences",
                candidatePois = emptyList(),
            )
        }

        val rawPois = try {
            poiProvider.findNearbyPois(
                point = request.point,
                radiusMeters = request.radiusMeters,
                allowedCategories = allowedCategories,
            )
        } catch (exception: Exception) {
            return PromptPreparationResult.Failed(
                stage = "poi_lookup",
                message = exception.message ?: "POI lookup failed",
                candidatePois = emptyList(),
            )
        }.filter { it.category in allowedCategories }

        if (rawPois.isEmpty()) {
            return PromptPreparationResult.NoIntervention(
                reason = "No nearby POI matched the V1 whitelist",
                candidatePois = emptyList(),
            )
        }

        val shortlistSize = maxOf(request.maxCandidatePois, 5)
        val preliminaryCandidates = poiRanker.rank(rawPois, request)
        val shortlistedIds = preliminaryCandidates.take(shortlistSize).map { it.id }.toSet()

        // On n'enrichit qu'une shortlist pour limiter le coût réseau tout en gardant
        // assez de contexte pour la sélection finale et la construction du prompt.
        val enrichedPois = rawPois.map { poi ->
            if (poi.id in shortlistedIds) {
                poiEnricher.enrich(
                    poi = poi,
                    request = PoiEnrichmentRequest(
                        language = request.language,
                        experiencePreferences = request.experiencePreferences,
                    ),
                )
            } else {
                poi
            }
        }

        val finalCandidates = poiRanker.rank(enrichedPois, request).take(request.maxCandidatePois)
        if (finalCandidates.isEmpty()) {
            return PromptPreparationResult.NoIntervention(
                reason = "No relevant POI candidate remained after ranking",
                candidatePois = preliminaryCandidates.take(request.maxCandidatePois),
            )
        }

        val selectedPoi = finalCandidates.first()
        val selectedContext = enrichedPois.firstOrNull { it.id == selectedPoi.id }
            ?: return PromptPreparationResult.Failed(
                stage = "poi_lookup",
                message = "Selected POI context could not be recovered",
                candidatePois = finalCandidates,
            )
        val prompt = promptBuilder.build(
            request = request,
            selectedPoi = selectedPoi,
            candidatePois = finalCandidates,
            sourceSummaries = selectedContext.sourceSummaries,
        )

        return PromptPreparationResult.Ready(
            PreparedInterventionContext(
                request = request,
                selectedPoi = selectedPoi,
                candidatePois = finalCandidates,
                sourceSummaries = selectedContext.sourceSummaries,
                prompt = prompt,
            ),
        )
    }

    /** Variante pratique de [generate] qui ajoute la synthèse audio si elle est configurée. */
    suspend fun generateWithAudio(request: InterventionRequest): InterventionResult {
        val result = generate(request)
        if (result !is InterventionResult.Generated || audioSynthesizer == null) return result
        val audio = audioSynthesizer.synthesize(result.text)
        return result.copy(audioData = audio)
    }

    /** Exécute le pipeline complet et retourne soit une intervention générée, soit une erreur structurée. */
    suspend fun generate(request: InterventionRequest): InterventionResult =
        when (val preparation = prepare(request)) {
            is PromptPreparationResult.Ready -> {
                try {
                    val generation = llmClient.generate(preparation.context)
                    InterventionResult.Generated(
                        text = generation.text,
                        selectedPoi = preparation.context.selectedPoi,
                        candidatePois = preparation.context.candidatePois,
                        sourceSummaries = preparation.context.sourceSummaries,
                        modelInfo = generation.modelInfo,
                    )
                } catch (exception: Exception) {
                    InterventionResult.GenerationFailed(
                        stage = "llm_generation",
                        message = exception.message ?: "LLM generation failed",
                        candidatePois = preparation.context.candidatePois,
                    )
                }
            }
            is PromptPreparationResult.NoIntervention -> {
                InterventionResult.NoIntervention(
                    reason = preparation.reason,
                    candidatePois = preparation.candidatePois,
                )
            }
            is PromptPreparationResult.Failed -> {
                InterventionResult.GenerationFailed(
                    stage = preparation.stage,
                    message = preparation.message,
                    candidatePois = preparation.candidatePois,
                )
            }
        }

    /**
     * Variante utilitaire pour les démonstrations et endpoints qui partent d'un POI manuel
     * au lieu d'un contexte de découverte réel.
     */
    suspend fun generateFromPoiWithAudio(
        poi: ManualPoi,
        promptInstructions: String = "",
        voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    ): InterventionResult {
        log.info("[poi-audio] start — poi=\"${poi.name}\" lat=${poi.lat} lon=${poi.lon} lang=${voiceConfig.language.code}")
        val result = generateFromPoi(poi, promptInstructions, voiceConfig)
        if (result !is InterventionResult.Generated) return result
        if (audioSynthesizer == null) {
            log.warn("[poi-audio] no audio synthesizer configured, skipping audio synthesis")
            return result
        }
        log.info("[poi-audio] synthesizing audio — text=\"${result.text}\"")
        return try {
            val audio = audioSynthesizer.synthesize(result.text)
            log.info("[poi-audio] audio ready — ${audio.size} bytes")
            result.copy(audioData = audio)
        } catch (exception: Exception) {
            log.error("[poi-audio] audio synthesis failed — ${exception::class.simpleName}: ${exception.message}")
            result
        }
    }

    /**
     * Réutilise la construction de prompt et la génération LLM pour un POI saisi manuellement.
     *
     * Ici, on bypass volontairement la découverte et le ranking : le POI reçu est traité
     * comme l'unique candidat afin de faciliter les tests manuels côté serveur/extension.
     */
    suspend fun generateFromPoi(
        poi: ManualPoi,
        promptInstructions: String = "",
        voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    ): InterventionResult {
        val candidate = PoiCandidate(
            id = "manual",
            name = poi.name,
            lat = poi.lat,
            lon = poi.lon,
            distanceMeters = 0,
            category = PoiCategory.OTHER,
            tags = poi.tags,
            sourceRefs = emptyList(),
            score = 1.0,
        )
        val request = InterventionRequest(
            point = GeoPoint(poi.lat, poi.lon),
            radiusMeters = 50,
            promptInstructions = promptInstructions,
            userPreferencesJson = "{}",
            voiceConfig = voiceConfig,
        )
        val prompt = promptBuilder.build(
            request = request,
            selectedPoi = candidate,
            candidatePois = listOf(candidate),
            sourceSummaries = emptyList(),
        )
        val context = PreparedInterventionContext(
            request = request,
            selectedPoi = candidate,
            candidatePois = listOf(candidate),
            sourceSummaries = emptyList(),
            prompt = prompt,
        )
        log.info("[poi-audio] calling OpenAI — model=${llmClient::class.simpleName}")
        return try {
            val generation = llmClient.generate(context)
            log.info("[poi-audio] OpenAI response — model=${generation.modelInfo.model} text=\"${generation.text}\"")
            InterventionResult.Generated(
                text = generation.text,
                selectedPoi = candidate,
                candidatePois = listOf(candidate),
                sourceSummaries = emptyList(),
                modelInfo = generation.modelInfo,
            )
        } catch (exception: Exception) {
            log.error("[poi-audio] OpenAI failed — ${exception.message}")
            InterventionResult.GenerationFailed(
                stage = "llm_generation",
                message = exception.message ?: "LLM generation failed",
                candidatePois = listOf(candidate),
            )
        }
    }

    companion object {
        private fun mask(key: String?): String =
            if (key.isNullOrBlank()) "<not set>"
            else "${key.take(4)}…${key.takeLast(4)} (${key.length} chars)"

        fun createDefault(
            apiKey: String,
            model: String = System.getProperty("OPENAI_MODEL") ?: OpenAiResponsesLlmClient.DEFAULT_MODEL,
            httpClient: HttpClient = defaultHttpClient(),
            mistralApiKey: String? = null,
            voice: Voice = Voice.DEFAULT,
        ): NearbyInterventionService {
            return NearbyInterventionService(
                poiProvider = CachedPoiProvider(
                    OverpassPoiProvider(
                        httpClient = httpClient,
                        endpoints = overpassEndpointsFromEnv(),
                    )
                ),
                poiEnricher = LightPoiEnricher(httpClient),
                poiRanker = DefaultPoiRanker(),
                promptBuilder = DefaultPromptBuilder(),
                llmClient = createDefaultLlmClient(
                    apiKey = apiKey,
                    model = model,
                    httpClient = httpClient,
                ),
                audioSynthesizer = createDefaultAudioSynthesizer(
                    mistralApiKey = mistralApiKey,
                    voice = voice,
                    httpClient = httpClient,
                ),
            )
        }

        private fun overpassEndpointsFromEnv(): List<String> =
            System.getProperty("OVERPASS_ENDPOINTS")
                ?.split(',')
                ?.map(String::trim)
                ?.filter(String::isNotBlank)
                ?.takeIf { it.isNotEmpty() }
                ?: OverpassPoiProvider.DEFAULT_ENDPOINTS
    }
}
