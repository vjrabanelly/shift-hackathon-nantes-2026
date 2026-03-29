package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.api.Voice
import kotlinx.serialization.Serializable

/**
 * Unified voice + language configuration for HikeBuddy.
 *
 * Use [Auto] to select a language and let hikecore pick the default neutral voice.
 * Use [Custom] to pick an explicit voice — language is derived automatically.
 *
 * This design makes it impossible to express an incoherent combination
 * (e.g. language=EN + voice=FR_MARIE) at the API level.
 */
@Serializable
sealed class VoiceConfig {
    /** Choose a language; hikecore selects the default neutral voice for it. */
    @Serializable
    data class Auto(val language: Language) : VoiceConfig()

    /** Choose an explicit voice; language is derived from the voice. */
    @Serializable
    data class Custom(val voice: Voice) : VoiceConfig()

    companion object {
        val DEFAULT: VoiceConfig = Auto(Language.FR)
    }
}

val VoiceConfig.language: Language
    get() = when (this) {
        is VoiceConfig.Auto -> language
        is VoiceConfig.Custom -> voice.language
    }

val VoiceConfig.voice: Voice
    get() = when (this) {
        is VoiceConfig.Auto -> Voice.defaultForLanguage(language)
        is VoiceConfig.Custom -> voice
    }

val VoiceConfig.tone: String
    get() = voice.tone
