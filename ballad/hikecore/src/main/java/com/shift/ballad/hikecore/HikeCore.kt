package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.intervention.defaultHttpClient
import com.shift.ballad.hikecore.route.GpxRouteEnrichmentService
import com.shift.ballad.hikecore.route.RoutePoiDiscoveryService
import com.shift.ballad.settings.InterventionConfigProvider
import io.ktor.client.HttpClient
import kotlinx.coroutines.runBlocking
import java.nio.file.Path
import kotlin.system.exitProcess

/**
 * Entry point for the HikeCore module.
 *
 * Usage:
 * ```kotlin
 * // Mock mode (no API keys required)
 * val repo: HikeRepository = HikeCore.mock()
 *
 * // Auto mode: reads OPENAI_API_KEY and MISTRAL_API_KEY from env vars,
 * // falls back to mock if any key is missing.
 * val repo: HikeRepository = HikeCore.create()
 *
 * // Explicit config
 * val repo: HikeRepository = HikeCore.create(
 *     HikeConfig(openAiApiKey = "sk-...", mistralApiKey = "mistral-...")
 * )
 * ```
 */
object HikeCore {
    val version = "1.0.0"

    /**
     * Creates a [HikeRepository] based on [config].
     * - Full keys → [RealHikeRepository] (Overpass + OpenAI + Mistral)
     * - No AI keys → [OverpassOnlyRepository] (Overpass real POIs, mock audio)
     * - Explicit mock → [FakeHikeRepository] via [mock()]
     */
    fun create(config: HikeConfig = HikeConfig()): HikeRepository {
        return if (config.useMockAi) OverpassOnlyRepository() else RealHikeRepository(config)
    }

    fun createRoutePoiDiscoveryService(config: HikeConfig = HikeConfig()): RoutePoiDiscoveryService =
        RoutePoiDiscoveryService.createDefault(config)

    fun createGpxRouteEnrichmentService(
        config: HikeConfig = HikeConfig(),
        configProvider: InterventionConfigProvider,
        audioCacheDirectory: Path,
        httpClient: HttpClient = defaultHttpClient(),
    ): GpxRouteEnrichmentService =
        GpxRouteEnrichmentService.createDefault(
            config = config,
            configProvider = configProvider,
            audioCacheDirectory = audioCacheDirectory,
            httpClient = httpClient,
        )

    /** Returns a [HikeRepository] backed by mock data, regardless of environment. */
    fun mock(): HikeRepository = FakeHikeRepository()
}

fun main(args: Array<String>) {
    exitProcess(runBlocking { runHikeCoreCli(args) })
}
