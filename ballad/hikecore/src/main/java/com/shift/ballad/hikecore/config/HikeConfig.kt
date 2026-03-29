package com.shift.ballad.hikecore.config

import com.shift.ballad.hikecore.VoiceConfig

/**
 * Configuration for HikeCore services.
 *
 * API keys can be provided explicitly or via environment variables:
 *  - OPENAI_API_KEY
 *  - MISTRAL_API_KEY
 *
 * POI fetching via Overpass is always real (no key required).
 * AI features (text generation, TTS) fall back to mock when keys are absent.
 */
data class HikeConfig(
    val openAiApiKey: String? = System.getenv("OPENAI_API_KEY"),
    val mistralApiKey: String? = System.getenv("MISTRAL_API_KEY"),
    val openAiModel: String = "gpt-4o-mini",
    val voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
) {
    /** True when AI keys are missing — POIs still use real Overpass. */
    val useMockAi: Boolean
        get() = openAiApiKey.isNullOrBlank() || mistralApiKey.isNullOrBlank()
}
