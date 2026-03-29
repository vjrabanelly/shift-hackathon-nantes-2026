package com.shift.ballad.hikecore.api.mock

import com.shift.ballad.hikecore.api.AudioService
import com.shift.ballad.hikecore.api.Voice

internal class MockAudioService : AudioService {
    override suspend fun textToSpeech(text: String, voice: Voice): ByteArray =
        byteArrayOf(0x49, 0x44, 0x33, 0x00, 0x00)
}
