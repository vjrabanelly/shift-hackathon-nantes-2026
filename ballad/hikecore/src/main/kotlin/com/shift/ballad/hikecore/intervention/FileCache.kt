package com.shift.ballad.hikecore.intervention

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import org.slf4j.LoggerFactory
import java.nio.file.Path
import java.security.MessageDigest

private val log = LoggerFactory.getLogger("hikebuddy.cache")

internal fun projectRoot(): Path {
    var dir = Path.of(System.getProperty("user.dir"))
    while (!dir.resolve("settings.gradle.kts").toFile().exists() && dir.parent != null) {
        dir = dir.parent
    }
    return dir
}

private val cacheJson = Json { ignoreUnknownKeys = true; prettyPrint = true }

@Serializable
private data class CacheFile(
    val entries: MutableMap<String, CacheEntry> = mutableMapOf(),
)

@Serializable
private data class CacheEntry(
    val key: String,
    val value: JsonElement,
    val cachedAt: String,
)

internal class FileCache(private val file: Path) {

    private val data: CacheFile by lazy { load() }

    fun get(key: String): JsonElement? = data.entries[key]?.value

    fun put(key: String, value: JsonElement) {
        data.entries[key] = CacheEntry(
            key = key,
            value = value,
            cachedAt = java.time.Instant.now().toString(),
        )
        save()
        log.info("[cache] stored key=$key in ${file.fileName}")
    }

    private fun load(): CacheFile {
        val f = file.toFile()
        if (!f.exists()) return CacheFile()
        return runCatching {
            cacheJson.decodeFromString(CacheFile.serializer(), f.readText())
        }.getOrElse {
            log.warn("[cache] failed to read ${file.fileName}, starting fresh: ${it.message}")
            CacheFile()
        }
    }

    private fun save() {
        file.parent?.toFile()?.mkdirs()
        file.toFile().writeText(cacheJson.encodeToString(data))
    }
}

internal fun cacheKey(vararg parts: Any): String {
    val input = parts.joinToString("|")
    val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
    return digest.take(8).joinToString("") { "%02x".format(it) }
}
