package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.api.OverpassClient
import com.shift.ballad.hikecore.api.mock.MockAudioService
import com.shift.ballad.hikecore.api.mock.MockTextGenerationService
import com.shift.ballad.hikecore.callback.GuideCallback
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
 * Repository that uses real Overpass data for POIs but mock services for AI features.
 * Used when OpenAI/Mistral keys are absent.
 */
internal class OverpassOnlyRepository : HikeRepository {

    private val poiService = OverpassClient()
    private val orchestrator = AudioGuideOrchestrator(poiService, MockTextGenerationService(), MockAudioService())

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
                override fun onProgress(step: String) {}
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
