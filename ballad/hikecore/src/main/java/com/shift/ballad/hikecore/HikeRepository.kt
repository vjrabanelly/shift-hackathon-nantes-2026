package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.callback.GuideCallback
import com.shift.ballad.hikecore.model.AudioGuideResult
import com.shift.ballad.hikecore.model.PointOfInterest

/**
 * Interface that defines the core data operations for hike-related details based on coordinates.
 */
interface HikeRepository {

    /**
     * Fetch hike metadata based on GPS coordinates.
     */
    fun getHikeDetails(latitude: Double, longitude: Double): String

    /**
     * Fetch points of interest around the given coordinates.
     *
     * @param latitude GPS latitude
     * @param longitude GPS longitude
     * @param radiusMeters Search radius in meters (default 500)
     * @return List of nearby [PointOfInterest]
     */
    suspend fun getPOIs(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int = 500
    ): List<PointOfInterest>

    /**
     * Generate a full audio guide (POIs + text description + audio data) as a suspend function.
     * Suitable for use with coroutines (Android ViewModel, Ktor handler, etc.).
     *
     * @param latitude GPS latitude
     * @param longitude GPS longitude
     * @param radiusMeters Search radius in meters (default 500)
     * @param contextPrompt Optional additional context injected into the text generation prompt
     * @param locale Language for the generated description ("fr" or "en", default "fr")
     * @return [AudioGuideResult] containing POIs, description text and raw audio bytes
     */
    suspend fun generateAudioGuide(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int = 500,
        contextPrompt: String? = null,
        locale: Language = Language.FR
    ): AudioGuideResult

    /**
     * Generate a full audio guide via a callback. Suitable for platforms or contexts where
     * coroutines are not available (terminal scripts, Java interop, etc.).
     *
     * Progress steps reported via [GuideCallback.onProgress]:
     *   "fetching_pois" → "generating_text" → "generating_audio"
     *
     * @param latitude GPS latitude
     * @param longitude GPS longitude
     * @param radiusMeters Search radius in meters (default 500)
     * @param contextPrompt Optional additional context injected into the text generation prompt
     * @param locale Language for the generated description ("fr" or "en", default "fr")
     * @param callback Receives progress, success or error events
     */
    fun generateAudioGuide(
        latitude: Double,
        longitude: Double,
        radiusMeters: Int = 500,
        contextPrompt: String? = null,
        locale: Language = Language.FR,
        callback: GuideCallback
    )
}
