package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.api.mock.MockAudioService
import com.shift.ballad.hikecore.api.mock.MockPoiService
import com.shift.ballad.hikecore.api.mock.MockTextGenerationService
import com.shift.ballad.hikecore.callback.GuideCallback
import com.shift.ballad.hikecore.internal.AudioGuideOrchestrator
import com.shift.ballad.hikecore.model.AudioGuideResult
import com.shift.ballad.hikecore.model.GpsCoordinates
import com.shift.ballad.hikecore.model.PointOfInterest
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Mock implementation of [HikeRepository] that returns deterministic fake data.
 * Used in tests, local development and when API keys are not configured.
 */
class FakeHikeRepository : HikeRepository {

    private val poiService = MockPoiService()
    private val textService = MockTextGenerationService()
    private val audioService = MockAudioService()
    private val orchestrator = AudioGuideOrchestrator(poiService, textService, audioService)

    override fun getHikeDetails(latitude: Double, longitude: Double): String {
        return """
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
        """.trimIndent()
    }

    override suspend fun getPOIs(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int
    ): List<PointOfInterest> {
        return poiService.fetchPois(GpsCoordinates(latitude, longitude), radiusMeters)
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
