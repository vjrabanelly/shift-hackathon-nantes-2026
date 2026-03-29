package com.shift.ballad.hikecore.api

internal interface AudioService {
    suspend fun textToSpeech(
        text: String,
        voice: Voice = Voice.DEFAULT,
    ): ByteArray
}
