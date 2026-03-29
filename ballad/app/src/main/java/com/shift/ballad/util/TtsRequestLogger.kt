package com.shift.ballad.util

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TtsRequestLogger @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val timeFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    private val logFile: File = File(context.filesDir, "tts_requests.log")

    fun log(text: String) {
        val timestamp = timeFormat.format(Date())
        logFile.appendText("[$timestamp] $text\n")
    }

    fun getLogFile(): File = logFile
}
