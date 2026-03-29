package com.shift.ballad.util

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import javax.inject.Singleton
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Singleton
class AppLogger @Inject constructor() {

    private val _logs = MutableStateFlow<List<String>>(emptyList())
    val logs: StateFlow<List<String>> = _logs.asStateFlow()

    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun log(tag: String, message: String) {
        val timestamp = timeFormat.format(Date())
        val logLine = "[$timestamp] $tag: $message"
        
        // Console output as usual
        Log.d(tag, message)
        
        // Update the StateFlow for UI consumption, keeping max 100 lines
        _logs.update { currentLogs ->
            val newLogs = currentLogs + logLine
            if (newLogs.size > 100) newLogs.takeLast(100) else newLogs
        }
    }
}
