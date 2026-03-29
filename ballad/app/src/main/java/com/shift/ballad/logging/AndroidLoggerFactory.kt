package com.shift.ballad.logging

import org.slf4j.ILoggerFactory
import org.slf4j.Logger
import java.util.concurrent.ConcurrentHashMap

internal class AndroidLoggerFactory : ILoggerFactory {
    private val loggers = ConcurrentHashMap<String, AndroidLogger>()

    override fun getLogger(name: String): Logger =
        loggers.getOrPut(name) { AndroidLogger(name) }
}
