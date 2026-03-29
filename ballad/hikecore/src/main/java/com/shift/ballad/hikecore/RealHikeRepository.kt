package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.api.MistralTtsClient
import com.shift.ballad.hikecore.api.OpenAiClient
import com.shift.ballad.hikecore.api.OverpassClient
import com.shift.ballad.hikecore.callback.GuideCallback
import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.internal.AudioGuideOrchestrator
import com.shift.ballad.hikecore.model.AudioGuideResult
import com.shift.ballad.hikecore.model.GpsCoordinates
import com.shift.ballad.hikecore.model.PointOfInterest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Production implementation of [HikeRepository] backed by real external APIs:
 * OpenStreetMap/Overpass for POIs, OpenAI for text generation, Mistral for TTS.
 */
internal class RealHikeRepository(private val config: HikeConfig) : HikeRepository {

    private val poiService = OverpassClient()
    private val textService = OpenAiClient(apiKey = config.openAiApiKey!!, model = config.openAiModel)
    private val audioService = MistralTtsClient(apiKey = config.mistralApiKey!!)
    private val orchestrator = AudioGuideOrchestrator(poiService, textService, audioService)

    override fun getHikeDetails(latitude: Double, longitude: Double): String {
        val pois = runBlocking { poiService.fetchPois(GpsCoordinates(latitude, longitude), 500) }
        return if (pois.isEmpty()) {
            "No points of interest found near ($latitude, $longitude)."
        } else {
            pois.joinToString("\n") { "• ${it.name ?: it.type} (${it.type})" }
        }
    }

    override suspend fun getPOIs(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int
    ): List<PointOfInterest> = withContext(Dispatchers.IO) {
        poiService.fetchPois(GpsCoordinates(latitude, longitude), radiusMeters)
    }

    override suspend fun generateAudioGuide(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int,
        contextPrompt: String?,
        locale: Language
    ): AudioGuideResult = suspendCancellableCoroutine { continuation ->
        orchestrator.generateGuide(
            coordinates = GpsCoordinates(latitude, longitude),
            radiusMeters = radiusMeters,
            contextPrompt = contextPrompt,
            locale = locale,
            callback = object : GuideCallback {
                override fun onProgress(step: String) { /* ignored in suspend variant */ }
                override fun onSuccess(result: AudioGuideResult) { continuation.resume(result) }
                override fun onError(error: Exception) { continuation.resumeWithException(error) }
            }
        )
    }

    override fun generateAudioGuide(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int,
        contextPrompt: String?,
        locale: Language,
        callback: GuideCallback
    ) {
        orchestrator.generateGuide(
            coordinates = GpsCoordinates(latitude, longitude),
            radiusMeters = radiusMeters,
            contextPrompt = contextPrompt,
            locale = locale,
            callback = callback
        )
    }
}
