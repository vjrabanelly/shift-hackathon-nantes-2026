package com.shift.ballad.logging

import android.util.Log
import org.slf4j.Marker
import org.slf4j.event.Level
import org.slf4j.helpers.AbstractLogger
import org.slf4j.helpers.MessageFormatter

internal class AndroidLogger(name: String) : AbstractLogger() {

    // Android tag limit is 23 chars; use the simple class name
    private val tag = name.substringAfterLast('.').take(23)

    init {
        this.name = name
    }

    override fun isTraceEnabled(): Boolean = false
    override fun isTraceEnabled(marker: Marker?): Boolean = false
    override fun isDebugEnabled(): Boolean = Log.isLoggable(tag, Log.DEBUG)
    override fun isDebugEnabled(marker: Marker?): Boolean = isDebugEnabled
    override fun isInfoEnabled(): Boolean = Log.isLoggable(tag, Log.INFO)
    override fun isInfoEnabled(marker: Marker?): Boolean = isInfoEnabled
    override fun isWarnEnabled(): Boolean = true
    override fun isWarnEnabled(marker: Marker?): Boolean = true
    override fun isErrorEnabled(): Boolean = true
    override fun isErrorEnabled(marker: Marker?): Boolean = true

    override fun getFullyQualifiedCallerName(): String? = null

    override fun handleNormalizedLoggingCall(
        level: Level,
        marker: Marker?,
        msg: String,
        arguments: Array<out Any?>?,
        throwable: Throwable?,
    ) {
        val formatted = if (arguments != null) {
            MessageFormatter.basicArrayFormat(msg, arguments)
        } else {
            msg
        }
        when (level) {
            Level.TRACE, Level.DEBUG -> Log.d(tag, formatted, throwable)
            Level.INFO               -> Log.i(tag, formatted, throwable)
            Level.WARN               -> Log.w(tag, formatted, throwable)
            Level.ERROR              -> Log.e(tag, formatted, throwable)
        }
    }
}
