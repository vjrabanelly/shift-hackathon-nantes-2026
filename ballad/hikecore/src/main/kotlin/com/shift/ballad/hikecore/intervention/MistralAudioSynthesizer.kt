package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.api.AudioService
import com.shift.ballad.hikecore.api.Voice

internal class MistralAudioSynthesizer(
    private val audioService: AudioService,
    private val voice: Voice = Voice.DEFAULT,
) : AudioSynthesizer {
    override suspend fun synthesize(text: String): ByteArray =
        audioService.textToSpeech(text, voice)
}
