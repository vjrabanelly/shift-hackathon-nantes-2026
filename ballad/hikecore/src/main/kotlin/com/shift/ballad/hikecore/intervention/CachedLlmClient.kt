package com.shift.ballad.hikecore.intervention

import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.nio.file.Path

internal class CachedLlmClient(
    private val delegate: LlmClient,
    cacheFile: Path = projectRoot().resolve("cache/openai.json"),
) : LlmClient {

    private val log = LoggerFactory.getLogger(CachedLlmClient::class.java)
    private val cache = FileCache(cacheFile)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun generate(context: PreparedInterventionContext): LlmGeneration {
        val key = cacheKey(context.prompt)
        val cached = cache.get(key)
        if (cached != null) {
            log.info("[cache] openai HIT key=$key poi=\"${context.selectedPoi.name}\"")
            return json.decodeFromJsonElement(LlmGeneration.serializer(), cached)
        }

        log.info("[cache] openai MISS key=$key — calling OpenAI")
        val result = delegate.generate(context)
        cache.put(key, json.encodeToJsonElement(LlmGeneration.serializer(), result))
        return result
    }

    override suspend fun generateBatch(contexts: List<PreparedInterventionContext>): List<LlmGeneration> {
        val results = arrayOfNulls<LlmGeneration>(contexts.size)
        val misses = mutableListOf<IndexedValue<PreparedInterventionContext>>()

        contexts.forEachIndexed { index, context ->
            val key = cacheKey(context.prompt)
            val cached = cache.get(key)
            if (cached != null) {
                log.info("[cache] openai batch HIT key=$key poi=\"${context.selectedPoi.name}\"")
                results[index] = json.decodeFromJsonElement(LlmGeneration.serializer(), cached)
            } else {
                log.info("[cache] openai batch MISS key=$key poi=\"${context.selectedPoi.name}\"")
                misses += IndexedValue(index, context)
            }
        }

        if (misses.isNotEmpty()) {
            val batchResults = delegate.generateBatch(misses.map { it.value })
            misses.zip(batchResults).forEach { (indexedContext, result) ->
                results[indexedContext.index] = result
                val key = cacheKey(indexedContext.value.prompt)
                cache.put(key, json.encodeToJsonElement(LlmGeneration.serializer(), result))
            }
        }

        @Suppress("UNCHECKED_CAST")
        return (results as Array<LlmGeneration>).toList()
    }
}
