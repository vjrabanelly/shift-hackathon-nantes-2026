package com.shift.ballad.hikecore

import java.nio.file.Path
import java.util.Properties
import kotlin.io.path.inputStream
import kotlin.io.path.isRegularFile
import kotlin.io.path.readText

internal class CliSecretResolver(
    private val env: Map<String, String> = System.getenv(),
    currentDirectory: Path = Path.of("").toAbsolutePath().normalize(),
) {
    private val fileValues: Map<String, String> = loadFileValues(currentDirectory)

    fun resolve(vararg names: String): String? =
        names.asSequence()
            .mapNotNull { name -> env[name].normalizedSecretOrNull() }
            .firstOrNull()
            ?: names.asSequence()
                .mapNotNull { name -> fileValues[name].normalizedSecretOrNull() }
                .firstOrNull()

    private fun loadFileValues(currentDirectory: Path): Map<String, String> {
        val values = linkedMapOf<String, String>()
        for (directory in currentDirectory.selfAndParents()) {
            loadDotEnv(directory.resolve(".env"), values)
            loadLocalProperties(directory.resolve("local.properties"), values)
        }
        return values
    }

    private fun loadDotEnv(path: Path, values: MutableMap<String, String>) {
        if (!path.isRegularFile()) return
        path.readText()
            .lineSequence()
            .map(String::trim)
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .forEach { line ->
                val normalizedLine = line.removePrefix("export ").trim()
                val separatorIndex = normalizedLine.indexOf('=')
                if (separatorIndex <= 0) return@forEach
                val name = normalizedLine.substring(0, separatorIndex).trim()
                val rawValue = normalizedLine.substring(separatorIndex + 1)
                val value = rawValue.normalizedSecretOrNull() ?: return@forEach
                values.putIfAbsent(name, value)
            }
    }

    private fun loadLocalProperties(path: Path, values: MutableMap<String, String>) {
        if (!path.isRegularFile()) return
        val properties = Properties()
        path.inputStream().use(properties::load)
        properties.stringPropertyNames().forEach { name ->
            val value = properties.getProperty(name).normalizedSecretOrNull() ?: return@forEach
            values.putIfAbsent(name, value)
        }
    }
}

private fun Path.selfAndParents(): Sequence<Path> =
    generateSequence(this) { current -> current.parent }

private fun String?.normalizedSecretOrNull(): String? =
    this
        ?.trim()
        ?.removeSurrounding("\"")
        ?.removeSurrounding("'")
        ?.takeIf(String::isNotBlank)
