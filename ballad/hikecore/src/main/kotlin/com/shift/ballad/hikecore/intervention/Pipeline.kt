package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.Language
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.logging.LogLevel
import io.ktor.client.plugins.logging.Logger
import io.ktor.client.plugins.logging.Logging
import io.ktor.client.statement.HttpResponse
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

internal val DefaultJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    prettyPrint = true
}

@kotlinx.serialization.Serializable
internal data class PoiContext(
    val id: String,
    val name: String?,
    val point: GeoPoint,
    val category: PoiCategory,
    val tags: Map<String, String>,
    val sourceRefs: List<SourceReference>,
    val sourceSummaries: List<SourceSummary> = emptyList(),
)

@kotlinx.serialization.Serializable
internal data class LlmGeneration(
    val text: String,
    val modelInfo: ModelInfo,
)

internal interface PoiProvider {
    suspend fun findNearbyPois(
        point: GeoPoint,
        radiusMeters: Int,
        allowedCategories: Set<PoiCategory>,
    ): List<PoiContext>
}

internal data class PoiEnrichmentRequest(
    val language: Language,
    val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
)

internal interface PoiEnricher {
    suspend fun enrich(poi: PoiContext, request: PoiEnrichmentRequest): PoiContext
}

internal interface PoiRanker {
    fun rank(pois: List<PoiContext>, request: InterventionRequest): List<PoiCandidate>
}

internal interface PoiSourceProvider {
    suspend fun fetchAll(poi: PoiContext, request: PoiEnrichmentRequest): List<PoiSourceMaterial>
}

internal enum class PoiSourceBlockType {
    NARRATIVE,
    FACTS,
}

internal enum class PoiSourceMaterialType {
    WIKIPEDIA_SUMMARY,
    WIKIDATA_DESCRIPTION,
    WIKIDATA_FACTS,
    WIKIVOYAGE_SUMMARY,
}

internal data class PoiSourceMaterial(
    val summary: SourceSummary,
    val sourceRefs: List<SourceReference> = emptyList(),
    val priority: Int = 0,
    val blockType: PoiSourceBlockType = PoiSourceBlockType.NARRATIVE,
    val materialType: PoiSourceMaterialType,
)

internal interface LlmClient {
    suspend fun generate(context: PreparedInterventionContext): LlmGeneration

    /** Generates texts for multiple POIs in a single LLM call when possible. */
    suspend fun generateBatch(contexts: List<PreparedInterventionContext>): List<LlmGeneration> =
        contexts.map { generate(it) }
}

internal interface AudioSynthesizer {
    suspend fun synthesize(text: String): ByteArray
}

internal interface PromptBuilder {
    fun build(
        request: InterventionRequest,
        selectedPoi: PoiCandidate,
        candidatePois: List<PoiCandidate>,
        sourceSummaries: List<SourceSummary>,
    ): String
}

private val httpLog = LoggerFactory.getLogger("hikebuddy.http")

internal fun defaultHttpClient(json: Json = DefaultJson): HttpClient =
    HttpClient(OkHttp) {
        engine {
            config {
                connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
                writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            }
        }
        install(ContentNegotiation) {
            json(json)
        }
        install(Logging) {
            logger = object : Logger {
                override fun log(message: String) = httpLog.info(message)
            }
            level = LogLevel.INFO
        }
        expectSuccess = false
    }

private val retryLog = LoggerFactory.getLogger("hikebuddy.retry")

/**
 * Retries an HTTP call on 429 (rate-limit) and 5xx errors with exponential backoff.
 * Reads the `Retry-After` header when present, otherwise uses [baseDelayMs] × attempt.
 */
internal suspend fun <T> retryOnRateLimit(
    maxAttempts: Int = 3,
    baseDelayMs: Long = 1_000,
    action: suspend () -> Pair<HttpResponse, T>,
): T {
    var lastException: Throwable? = null
    repeat(maxAttempts) { attempt ->
        val attemptNumber = attempt + 1
        try {
            val (response, result) = action()
            val status = response.status.value
            if (status == 429 || status in 500..599) {
                val retryAfter = response.headers["Retry-After"]?.toLongOrNull()
                val delayMs = retryAfter?.times(1_000) ?: (baseDelayMs * attemptNumber)
                retryLog.warn("[retry] HTTP {} on attempt {}/{}, waiting {}ms", status, attemptNumber, maxAttempts, delayMs)
                if (attemptNumber < maxAttempts) {
                    delay(delayMs)
                    return@repeat
                }
                throw java.io.IOException("HTTP $status after $maxAttempts attempts")
            }
            return result
        } catch (e: java.io.IOException) {
            lastException = e
            if (attemptNumber < maxAttempts) {
                val delayMs = baseDelayMs * attemptNumber
                retryLog.warn("[retry] IOException on attempt {}/{}: {}, waiting {}ms", attemptNumber, maxAttempts, e.message, delayMs)
                delay(delayMs)
            }
        }
    }
    throw lastException ?: java.io.IOException("retryOnRateLimit exhausted after $maxAttempts attempts")
}
