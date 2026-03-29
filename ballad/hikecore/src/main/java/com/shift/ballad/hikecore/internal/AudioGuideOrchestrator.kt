package com.shift.ballad.hikecore.internal

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.api.AudioService
import com.shift.ballad.hikecore.api.PoiService
import com.shift.ballad.hikecore.api.TextGenerationService
import com.shift.ballad.hikecore.callback.GuideCallback
import com.shift.ballad.hikecore.model.AudioGuideResult
import com.shift.ballad.hikecore.model.GpsCoordinates
import kotlinx.coroutines.runBlocking

/**
 * Orchestrates the three-step pipeline: POI fetching → text generation → audio synthesis.
 * Runs on a background thread and reports progress via [GuideCallback].
 */
internal class AudioGuideOrchestrator(
    private val poiService: PoiService,
    private val textGenerationService: TextGenerationService,
    private val audioService: AudioService
) {

    fun generateGuide(
        coordinates: GpsCoordinates,
        radiusMeters: Int,
        contextPrompt: String?,
        locale: Language,
        callback: GuideCallback
    ) {
        Thread {
            try {
                callback.onProgress("fetching_pois")
                val pois = runBlocking { poiService.fetchPois(coordinates, radiusMeters) }

                if (pois.isEmpty()) {
                    callback.onError(IllegalStateException("No points of interest found in the area"))
                    return@Thread
                }

                callback.onProgress("generating_text")
                val description = textGenerationService.generateDescription(pois, locale, contextPrompt)

                callback.onProgress("generating_audio")
                val audioData = runBlocking { audioService.textToSpeech(description) }

                callback.onSuccess(
                    AudioGuideResult(pois = pois, description = description, audioData = audioData)
                )
            } catch (e: Exception) {
                callback.onError(e)
            }
        }.start()
    }
}
