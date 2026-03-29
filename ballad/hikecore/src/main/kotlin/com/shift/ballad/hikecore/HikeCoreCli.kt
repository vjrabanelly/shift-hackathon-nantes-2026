package com.shift.ballad.hikecore

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.api.Voice
import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.intervention.createDefaultAudioSynthesizer
import com.shift.ballad.hikecore.intervention.defaultHttpClient
import com.shift.ballad.hikecore.intervention.ExperiencePreferences
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.InterventionResult
import com.shift.ballad.hikecore.intervention.InterventionDetailLevel
import com.shift.ballad.hikecore.intervention.NearbyInterventionService
import com.shift.ballad.hikecore.intervention.PoiCategorySelection
import com.shift.ballad.hikecore.intervention.PoiDiscoveryPreferences
import com.shift.ballad.hikecore.intervention.PoiSelectionMode
import com.shift.ballad.hikecore.intervention.config.ExperiencePreferencesJson
import com.shift.ballad.hikecore.intervention.config.FileInterventionConfigProvider
import com.shift.ballad.hikecore.intervention.config.buildInterventionRequest
import com.shift.ballad.hikecore.route.DiscoveredRoutePoi
import com.shift.ballad.hikecore.route.GpxRouteEnrichmentState
import com.shift.ballad.hikecore.route.GpxRouteParser
import com.shift.ballad.hikecore.route.GpxWaypoint
import com.shift.ballad.hikecore.route.RoutePoiDiscoveryRequest
import com.shift.ballad.hikecore.route.RoutePoiDiscoveryResult
import com.shift.ballad.settings.serializedValue
import java.nio.file.Files
import java.nio.file.Path
import java.util.Base64
import kotlin.io.path.isRegularFile
import kotlin.io.path.name
import kotlin.io.path.pathString
import kotlin.io.path.readText
import kotlin.io.path.writeText
import kotlinx.coroutines.flow.toList
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

private val cliJson = Json { prettyPrint = true }
private val cliSecretResolver by lazy { CliSecretResolver() }

private data class TtsCommandOptions(
    val text: String,
    val voiceConfig: VoiceConfig,
    val outputFile: String,
)

private sealed interface TtsCommandParseResult {
    data class Success(val options: TtsCommandOptions) : TtsCommandParseResult
    data object Help : TtsCommandParseResult
    data class Error(val message: String) : TtsCommandParseResult
}

private data class GenerateCommandOptions(
    val lat: Double,
    val lon: Double,
    val radius: Int,
    val promptFile: String,
    val prefsFile: String,
    val voiceConfig: VoiceConfig,
    val maxCandidatePois: Int,
    val withAudio: Boolean,
)

private sealed interface GenerateCommandParseResult {
    data class Success(val options: GenerateCommandOptions) : GenerateCommandParseResult
    data object Help : GenerateCommandParseResult
    data class Error(val message: String) : GenerateCommandParseResult
}

private data class RoutePoisCommandOptions(
    val gpxFile: String,
    val language: Language,
    val maxPoisPerKm: Int,
    val routeBufferMeters: Int,
    val llmScoringEnabled: Boolean,
    val poiPreferences: PoiDiscoveryPreferences,
    val experiencePreferences: ExperiencePreferences,
)

private sealed interface RoutePoisCommandParseResult {
    data class Success(val options: RoutePoisCommandOptions) : RoutePoisCommandParseResult
    data object Help : RoutePoisCommandParseResult
    data class Error(val message: String) : RoutePoisCommandParseResult
}

private data class RouteEnrichCommandOptions(
    val gpxFile: String,
    val promptFile: String,
    val prefsFile: String,
    val voiceConfig: VoiceConfig,
    val poiPreferences: PoiDiscoveryPreferences,
    val experiencePreferencesOverride: ExperiencePreferences?,
    val audioCacheDir: String,
    val outputGpxFile: String?,
    val printGpx: Boolean,
)

private sealed interface RouteEnrichCommandParseResult {
    data class Success(val options: RouteEnrichCommandOptions) : RouteEnrichCommandParseResult
    data object Help : RouteEnrichCommandParseResult
    data class Error(val message: String) : RouteEnrichCommandParseResult
}

@Serializable
private data class CliCandidate(
    val name: String?,
    val category: String,
    val distanceMeters: Int,
    val score: Double,
)

@Serializable
private data class CliGenerateResult(
    val status: String,
    val poi: String? = null,
    val text: String? = null,
    val model: String? = null,
    val reason: String? = null,
    val stage: String? = null,
    val message: String? = null,
    val audioBase64: String? = null,
    val candidates: List<CliCandidate>,
)

@Serializable
private data class CliRoutePoi(
    val id: String,
    val name: String?,
    val category: String,
    val distanceAlongRouteMeters: Int,
    val distanceToRouteMeters: Int,
    val score: Double,
)

@Serializable
private data class CliWaypoint(
    val name: String?,
    val description: String?,
    val distanceAlongRouteMeters: Int?,
)

@Serializable
private data class CliRouteDiscoveryResult(
    val routeLengthMeters: Int,
    val discoveredPois: List<CliRoutePoi>,
    val gpxWaypoints: List<CliWaypoint>,
)

@Serializable
private data class CliRouteEnrichmentResult(
    val status: String,
    val outputGpxFile: String? = null,
    val audioCacheDir: String? = null,
    val generatedWaypointNames: List<String> = emptyList(),
    val generatedAudioFiles: List<String> = emptyList(),
    val gpxXml: String? = null,
    val message: String? = null,
)

suspend fun runHikeCoreCli(args: Array<String>): Int {
    if (args.isEmpty()) {
        printRootUsage()
        return 0
    }

    return when (val command = args.first()) {
        "tts" -> runTtsCommand(args.drop(1))
        "generate" -> runGenerateCommand(args.drop(1))
        "route-pois" -> runRoutePoisCommand(args.drop(1))
        "route-enrich" -> runRouteEnrichCommand(args.drop(1))
        "details" -> runDetailsCommand(args.drop(1))
        "--help", "-h", "help" -> {
            printRootUsage()
            0
        }
        else -> {
            if (args.size <= 2 && args.all { it.toDoubleOrNull() != null }) {
                runDetailsCommand(args.toList())
            } else {
                System.err.println("Unknown command: $command")
                printRootUsage()
                1
            }
        }
    }
}

private suspend fun runRoutePoisCommand(args: List<String>): Int {
    return when (val parsed = parseRoutePoisCommand(args)) {
        is RoutePoisCommandParseResult.Help -> {
            printRoutePoisUsage()
            0
        }
        is RoutePoisCommandParseResult.Error -> {
            System.err.println(parsed.message)
            printRoutePoisUsage()
            1
        }
        is RoutePoisCommandParseResult.Success -> executeRoutePoisCommand(parsed.options)
    }
}

private suspend fun runRouteEnrichCommand(args: List<String>): Int {
    return when (val parsed = parseRouteEnrichCommand(args)) {
        is RouteEnrichCommandParseResult.Help -> {
            printRouteEnrichUsage()
            0
        }
        is RouteEnrichCommandParseResult.Error -> {
            System.err.println(parsed.message)
            printRouteEnrichUsage()
            1
        }
        is RouteEnrichCommandParseResult.Success -> executeRouteEnrichCommand(parsed.options)
    }
}

private fun runDetailsCommand(args: List<String>): Int {
    println("HikeCore ${HikeCore.version}")

    val lat = args.getOrNull(0)?.toDoubleOrNull() ?: 48.8566
    val lon = args.getOrNull(1)?.toDoubleOrNull() ?: 2.3522

    val config = cliHikeConfig()
    println("Mode: ${if (config.useMockAi) "OVERPASS-ONLY" else "REAL"}")

    val repository: HikeRepository = HikeCore.create(config)
    val details = repository.getHikeDetails(lat, lon)
    println("\n[HikeRepository Result for ($lat, $lon)]\n$details")
    return 0
}

private suspend fun runTtsCommand(args: List<String>): Int {
    return when (val parsed = parseTtsCommand(args)) {
        is TtsCommandParseResult.Help -> {
            printTtsUsage()
            0
        }
        is TtsCommandParseResult.Error -> {
            System.err.println(parsed.message)
            printTtsUsage()
            1
        }
        is TtsCommandParseResult.Success -> executeTtsCommand(parsed.options)
    }
}

private suspend fun executeTtsCommand(options: TtsCommandOptions): Int {
    val mistralApiKey = cliSecretResolver.resolve("MISTRAL_API_KEY", "mistral_api_key")
    if (mistralApiKey.isNullOrBlank()) {
        System.err.println("MISTRAL_API_KEY is required to run the tts command.")
        return 1
    }

    val synthesizer = createDefaultAudioSynthesizer(
        mistralApiKey = mistralApiKey,
        voice = options.voiceConfig.voice,
        httpClient = defaultHttpClient(),
    ) ?: run {
        System.err.println("No TTS provider available.")
        return 1
    }

    val audioData = synthesizer.synthesize(options.text)
    val outputPath = resolveOutputPath(options.outputFile)
    outputPath.parent?.let(Files::createDirectories)
    outputPath.toFile().writeBytes(audioData)
    println("Audio written to ${outputPath.toAbsolutePath()} (${audioData.size} bytes)")
    return 0
}

private fun parseTtsCommand(args: List<String>): TtsCommandParseResult {
    var text: String? = null
    var langRaw: String? = null
    var voiceRaw: String? = null
    var outputFile = "output/tts.mp3"

    var index = 0
    while (index < args.size) {
        when (val arg = args[index]) {
            "--text" -> {
                text = args.getOrNull(++index)
                    ?: return TtsCommandParseResult.Error("Missing value for --text")
            }
            "--lang" -> {
                langRaw = args.getOrNull(++index)
                    ?: return TtsCommandParseResult.Error("Missing value for --lang")
            }
            "--voice" -> {
                voiceRaw = args.getOrNull(++index)
                    ?: return TtsCommandParseResult.Error("Missing value for --voice")
            }
            "--output" -> {
                outputFile = args.getOrNull(++index)
                    ?: return TtsCommandParseResult.Error("Missing value for --output")
            }
            "--help", "-h" -> return TtsCommandParseResult.Help
            else -> return TtsCommandParseResult.Error("Unknown option: $arg")
        }
        index++
    }

    if (text.isNullOrBlank()) return TtsCommandParseResult.Error("--text is required")
    if (langRaw != null && voiceRaw != null)
        return TtsCommandParseResult.Error("Use either --lang or --voice, not both.")

    val voiceConfig = parseVoiceConfig(langRaw, voiceRaw)
        ?: return TtsCommandParseResult.Error(
            if (voiceRaw != null) "Invalid --voice value: $voiceRaw. Expected one of: ${Voice.entries.joinToString(",") { it.slug }}."
            else "Invalid --lang value: $langRaw. Expected one of: ${Language.entries.joinToString(",") { it.code }}.",
        )

    return TtsCommandParseResult.Success(
        TtsCommandOptions(text = text, voiceConfig = voiceConfig, outputFile = outputFile)
    )
}

private suspend fun runGenerateCommand(args: List<String>): Int {
    return when (val parsed = parseGenerateCommand(args)) {
        is GenerateCommandParseResult.Help -> {
            printGenerateUsage()
            0
        }
        is GenerateCommandParseResult.Error -> {
            System.err.println(parsed.message)
            printGenerateUsage()
            1
        }
        is GenerateCommandParseResult.Success -> executeGenerateCommand(parsed.options)
    }
}

private suspend fun executeGenerateCommand(options: GenerateCommandOptions): Int {
    val openAiApiKey = cliSecretResolver.resolve("OPENAI_API_KEY", "openai_api_key")
    if (openAiApiKey.isNullOrBlank()) {
        System.err.println("OPENAI_API_KEY is required to run the generate command.")
        return 1
    }

    val mistralApiKey = cliSecretResolver.resolve("MISTRAL_API_KEY", "mistral_api_key")
    if (options.withAudio && mistralApiKey.isNullOrBlank()) {
        System.err.println("MISTRAL_API_KEY is required when --with-audio is used.")
        return 1
    }

    val promptPath = resolveInputPath(options.promptFile)
        ?: return failWithMissingFile("prompt", options.promptFile)
    val prefsPath = resolveInputPath(options.prefsFile)
        ?: return failWithMissingFile("preferences", options.prefsFile)

    val request = buildInterventionRequest(
        configProvider = FileInterventionConfigProvider(
            promptFile = promptPath,
            preferencesFile = prefsPath,
        ),
        point = GeoPoint(options.lat, options.lon),
        radiusMeters = options.radius,
        voiceConfig = options.voiceConfig,
        maxCandidatePois = options.maxCandidatePois,
    )

    val interventionService = NearbyInterventionService.createDefault(
        apiKey = openAiApiKey,
        mistralApiKey = if (options.withAudio) mistralApiKey else null,
    )

    val result = if (options.withAudio) {
        interventionService.generateWithAudio(request)
    } else {
        interventionService.generate(request)
    }

    println(
        cliJson.encodeToString(
            when (result) {
                is InterventionResult.Generated -> CliGenerateResult(
                    status = "generated",
                    poi = result.selectedPoi.name,
                    text = result.text,
                    model = result.modelInfo.model,
                    audioBase64 = result.audioData?.let { Base64.getEncoder().encodeToString(it) },
                    candidates = result.candidatePois.map(::toCliCandidate),
                )
                is InterventionResult.NoIntervention -> CliGenerateResult(
                    status = "no_intervention",
                    reason = result.reason,
                    candidates = result.candidatePois.map(::toCliCandidate),
                )
                is InterventionResult.GenerationFailed -> CliGenerateResult(
                    status = "generation_failed",
                    stage = result.stage,
                    message = result.message,
                    candidates = result.candidatePois.map(::toCliCandidate),
                )
            }
        )
    )

    return if (result is InterventionResult.GenerationFailed) 1 else 0
}

private fun toCliCandidate(candidate: com.shift.ballad.hikecore.intervention.PoiCandidate): CliCandidate =
    CliCandidate(
        name = candidate.name,
        category = candidate.category.name,
        distanceMeters = candidate.distanceMeters,
        score = candidate.score,
    )

private suspend fun executeRoutePoisCommand(options: RoutePoisCommandOptions): Int {
    val gpxPath = resolveInputPath(options.gpxFile)
        ?: return failWithMissingFile("GPX", options.gpxFile)
    val discoveryService = HikeCore.createRoutePoiDiscoveryService(cliHikeConfig())
    val result = discoveryService.discover(
        RoutePoiDiscoveryRequest(
            gpxXml = gpxPath.readText(),
            language = options.language,
            maxPoisPerKm = options.maxPoisPerKm,
            routeBufferMeters = options.routeBufferMeters,
            llmScoringEnabled = options.llmScoringEnabled,
            poiPreferences = options.poiPreferences,
            experiencePreferences = options.experiencePreferences,
        ),
    )

    println(cliJson.encodeToString(result.toCli()))
    return 0
}

private suspend fun executeRouteEnrichCommand(options: RouteEnrichCommandOptions): Int {
    val openAiApiKey = cliSecretResolver.resolve("OPENAI_API_KEY", "openai_api_key")
    if (openAiApiKey.isNullOrBlank()) {
        System.err.println("OPENAI_API_KEY is required to run the route-enrich command.")
        return 1
    }

    val mistralApiKey = cliSecretResolver.resolve("MISTRAL_API_KEY", "mistral_api_key")
    if (mistralApiKey.isNullOrBlank()) {
        System.err.println("MISTRAL_API_KEY is required to run the route-enrich command.")
        return 1
    }

    val gpxPath = resolveInputPath(options.gpxFile)
        ?: return failWithMissingFile("GPX", options.gpxFile)
    val promptPath = resolveInputPath(options.promptFile)
        ?: return failWithMissingFile("prompt", options.promptFile)
    val prefsPath = resolveInputPath(options.prefsFile)
        ?: return failWithMissingFile("preferences", options.prefsFile)

    val audioCacheDir = resolveOutputPath(options.audioCacheDir)
    val outputGpxPath = options.outputGpxFile
        ?.let(::resolveOutputPath)
        ?: defaultEnrichedGpxPath(gpxPath)
    Files.createDirectories(audioCacheDir)
    outputGpxPath.parent?.let(Files::createDirectories)

    val originalGpx = gpxPath.readText()
    val originalWaypointNames = extractGeneratedWaypointNames(originalGpx).toSet()
    val experiencePreferencesOverride = options.experiencePreferencesOverride?.let { override ->
        val filePreferences = ExperiencePreferencesJson.parse(prefsPath.readText())
        override.copy(ageRange = filePreferences.ageRange)
    }
    val configProvider = FileInterventionConfigProvider(
        promptFile = promptPath,
        preferencesFile = prefsPath,
        poiDiscoveryPreferences = options.poiPreferences,
        experiencePreferencesOverride = experiencePreferencesOverride,
    )
    val service = HikeCore.createGpxRouteEnrichmentService(
        config = HikeConfig(
            openAiApiKey = openAiApiKey,
            mistralApiKey = mistralApiKey,
            voiceConfig = options.voiceConfig,
        ),
        configProvider = configProvider,
        audioCacheDirectory = audioCacheDir,
    )

    val terminalState = service.enrich(originalGpx).toList().lastOrNull()
    return when (terminalState) {
        is GpxRouteEnrichmentState.Success -> {
            outputGpxPath.writeText(terminalState.gpxXml)
            val generatedWaypointNames = extractGeneratedWaypointNames(terminalState.gpxXml)
                .filterNot { it in originalWaypointNames }
            val generatedAudioFiles = generatedWaypointNames.filter { name ->
                Files.isRegularFile(audioCacheDir.resolve(name))
            }
            println(
                cliJson.encodeToString(
                    CliRouteEnrichmentResult(
                        status = "success",
                        outputGpxFile = outputGpxPath.toAbsolutePath().pathString,
                        audioCacheDir = audioCacheDir.toAbsolutePath().pathString,
                        generatedWaypointNames = generatedWaypointNames,
                        generatedAudioFiles = generatedAudioFiles,
                        gpxXml = if (options.printGpx) terminalState.gpxXml else null,
                    ),
                ),
            )
            0
        }
        is GpxRouteEnrichmentState.Error -> {
            println(
                cliJson.encodeToString(
                    CliRouteEnrichmentResult(
                        status = "error",
                        message = terminalState.message,
                    ),
                ),
            )
            1
        }
        else -> {
            println(
                cliJson.encodeToString(
                    CliRouteEnrichmentResult(
                        status = "error",
                        message = "route-enrich terminated without a final state",
                    ),
                ),
            )
            1
        }
    }
}

private fun cliHikeConfig(): HikeConfig =
    HikeConfig(
        openAiApiKey = cliSecretResolver.resolve("OPENAI_API_KEY", "openai_api_key"),
        mistralApiKey = cliSecretResolver.resolve("MISTRAL_API_KEY", "mistral_api_key"),
    )

private fun parseGenerateCommand(args: List<String>): GenerateCommandParseResult {
    var lat: Double? = null
    var lon: Double? = null
    var radius = 500
    var promptFile = "examples/prompt.txt"
    var prefsFile = "examples/preferences.json"
    var langRaw: String? = null
    var voiceRaw: String? = null
    var maxCandidatePois = 5
    var withAudio = false

    var index = 0
    while (index < args.size) {
        when (val arg = args[index]) {
            "--lat" -> {
                val raw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --lat")
                lat = raw.toDoubleOrNull()
                    ?: return GenerateCommandParseResult.Error("Invalid latitude: $raw")
            }
            "--lon" -> {
                val raw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --lon")
                lon = raw.toDoubleOrNull()
                    ?: return GenerateCommandParseResult.Error("Invalid longitude: $raw")
            }
            "--radius" -> {
                val raw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --radius")
                radius = raw.toIntOrNull()
                    ?: return GenerateCommandParseResult.Error("Invalid radius: $raw")
            }
            "--prompt-file" -> {
                promptFile = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --prompt-file")
            }
            "--prefs-file", "--preferences-file" -> {
                prefsFile = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for $arg")
            }
            "--lang" -> {
                langRaw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --lang")
            }
            "--voice" -> {
                voiceRaw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --voice")
            }
            "--max-candidate-pois" -> {
                val raw = args.getOrNull(++index)
                    ?: return GenerateCommandParseResult.Error("Missing value for --max-candidate-pois")
                maxCandidatePois = raw.toIntOrNull()
                    ?: return GenerateCommandParseResult.Error("Invalid max candidate POIs: $raw")
            }
            "--with-audio" -> withAudio = true
            "--help", "-h" -> return GenerateCommandParseResult.Help
            else -> return GenerateCommandParseResult.Error("Unknown option: $arg")
        }
        index++
    }

    if (lat == null) return GenerateCommandParseResult.Error("--lat is required")
    if (lon == null) return GenerateCommandParseResult.Error("--lon is required")
    if (radius <= 0) return GenerateCommandParseResult.Error("--radius must be > 0")
    if (maxCandidatePois <= 0) return GenerateCommandParseResult.Error("--max-candidate-pois must be > 0")
    if (langRaw != null && voiceRaw != null)
        return GenerateCommandParseResult.Error("Use either --lang or --voice, not both.")

    val voiceConfig = parseVoiceConfig(langRaw, voiceRaw)
        ?: return GenerateCommandParseResult.Error(
            if (voiceRaw != null) "Invalid --voice value: $voiceRaw. Expected one of: ${Voice.entries.joinToString(",") { it.slug }}."
            else "Invalid --lang value: $langRaw. Expected one of: ${Language.entries.joinToString(",") { it.code }}.",
        )

    return GenerateCommandParseResult.Success(
        GenerateCommandOptions(
            lat = lat,
            lon = lon,
            radius = radius,
            promptFile = promptFile,
            prefsFile = prefsFile,
            voiceConfig = voiceConfig,
            maxCandidatePois = maxCandidatePois,
            withAudio = withAudio,
        )
    )
}

private fun parseRoutePoisCommand(args: List<String>): RoutePoisCommandParseResult {
    var gpxFile = "samples/nantes-graslin-commerce.gpx"
    var language: Language = Language.FR
    var maxPoisPerKm = 4
    var routeBufferMeters = 100
    var llmScoringEnabled = true
    var poiPreferences = PoiDiscoveryPreferences()
    var poiSelectionMode: PoiSelectionMode? = null
    var detailLevel: InterventionDetailLevel? = null

    var index = 0
    while (index < args.size) {
        when (val arg = args[index]) {
            "--gpx-file" -> {
                gpxFile = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --gpx-file")
            }
            "--lang" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --lang")
                language = Language.fromCode(raw)
                    ?: return RoutePoisCommandParseResult.Error(
                        "Invalid --lang value: $raw. Expected one of: ${Language.entries.joinToString(",") { it.code }}.",
                    )
            }
            "--max-pois-per-km" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --max-pois-per-km")
                maxPoisPerKm = raw.toIntOrNull()
                    ?: return RoutePoisCommandParseResult.Error("Invalid max POIs per km: $raw")
            }
            "--route-buffer", "--route-buffer-meters" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for $arg")
                routeBufferMeters = raw.toIntOrNull()
                    ?: return RoutePoisCommandParseResult.Error("Invalid route buffer: $raw")
            }
            "--poi-categories" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --poi-categories")
                poiPreferences = parsePoiDiscoveryPreferences(raw)
                    ?: return RoutePoisCommandParseResult.Error(
                        "Invalid --poi-categories value: $raw. Expected a comma-separated list among " +
                            "viewpoint,peak,waterfall,cave,historic,attraction,information, or 'all'/'none'.",
                    )
            }
            "--disable-llm-scoring" -> llmScoringEnabled = false
            "--poi-selection-mode" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --poi-selection-mode")
                poiSelectionMode = parsePoiSelectionMode(raw)
                    ?: return RoutePoisCommandParseResult.Error(
                        "Invalid --poi-selection-mode value: $raw. Expected one of balanced,nature,history,architecture,panorama.",
                    )
            }
            "--detail-level" -> {
                val raw = args.getOrNull(++index)
                    ?: return RoutePoisCommandParseResult.Error("Missing value for --detail-level")
                detailLevel = parseDetailLevel(raw)
                    ?: return RoutePoisCommandParseResult.Error(
                        "Invalid --detail-level value: $raw. Expected one of short,balanced,detailed.",
                    )
            }
            "--help", "-h" -> return RoutePoisCommandParseResult.Help
            else -> return RoutePoisCommandParseResult.Error("Unknown option: $arg")
        }
        index++
    }

    if (maxPoisPerKm <= 0) {
        return RoutePoisCommandParseResult.Error("--max-pois-per-km must be > 0")
    }
    if (routeBufferMeters <= 0) {
        return RoutePoisCommandParseResult.Error("--route-buffer must be > 0")
    }

    return RoutePoisCommandParseResult.Success(
        RoutePoisCommandOptions(
            gpxFile = gpxFile,
            language = language,
            maxPoisPerKm = maxPoisPerKm,
            routeBufferMeters = routeBufferMeters,
            llmScoringEnabled = llmScoringEnabled,
            poiPreferences = poiPreferences,
            experiencePreferences = ExperiencePreferences(
                detailLevel = detailLevel ?: InterventionDetailLevel.BALANCED,
                poiSelectionMode = poiSelectionMode ?: PoiSelectionMode.BALANCED,
            ),
        ),
    )
}

private fun parseRouteEnrichCommand(args: List<String>): RouteEnrichCommandParseResult {
    var gpxFile = "samples/nantes-graslin-commerce.gpx"
    var promptFile = "examples/prompt.txt"
    var prefsFile = "examples/preferences.json"
    var langRaw: String? = null
    var voiceRaw: String? = null
    var poiPreferences = PoiDiscoveryPreferences()
    var poiSelectionMode: PoiSelectionMode? = null
    var detailLevel: InterventionDetailLevel? = null
    var audioCacheDir = "output/route-audio"
    var outputGpxFile: String? = null
    var printGpx = false

    var index = 0
    while (index < args.size) {
        when (val arg = args[index]) {
            "--gpx-file" -> {
                gpxFile = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --gpx-file")
            }
            "--prompt-file" -> {
                promptFile = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --prompt-file")
            }
            "--prefs-file", "--preferences-file" -> {
                prefsFile = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for $arg")
            }
            "--lang" -> {
                langRaw = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --lang")
            }
            "--voice" -> {
                voiceRaw = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --voice")
            }
            "--poi-categories" -> {
                val raw = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --poi-categories")
                poiPreferences = parsePoiDiscoveryPreferences(raw)
                    ?: return RouteEnrichCommandParseResult.Error(
                        "Invalid --poi-categories value: $raw. Expected a comma-separated list among " +
                            "viewpoint,peak,waterfall,cave,historic,attraction,information, or 'all'/'none'.",
                    )
            }
            "--poi-selection-mode" -> {
                val raw = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --poi-selection-mode")
                poiSelectionMode = parsePoiSelectionMode(raw)
                    ?: return RouteEnrichCommandParseResult.Error(
                        "Invalid --poi-selection-mode value: $raw. Expected one of balanced,nature,history,architecture,panorama.",
                    )
            }
            "--detail-level" -> {
                val raw = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --detail-level")
                detailLevel = parseDetailLevel(raw)
                    ?: return RouteEnrichCommandParseResult.Error(
                        "Invalid --detail-level value: $raw. Expected one of short,balanced,detailed.",
                    )
            }
            "--audio-cache-dir" -> {
                audioCacheDir = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --audio-cache-dir")
            }
            "--output-gpx-file" -> {
                outputGpxFile = args.getOrNull(++index)
                    ?: return RouteEnrichCommandParseResult.Error("Missing value for --output-gpx-file")
            }
            "--print-gpx" -> printGpx = true
            "--help", "-h" -> return RouteEnrichCommandParseResult.Help
            else -> return RouteEnrichCommandParseResult.Error("Unknown option: $arg")
        }
        index++
    }

    if (langRaw != null && voiceRaw != null)
        return RouteEnrichCommandParseResult.Error("Use either --lang or --voice, not both.")

    val voiceConfig = parseVoiceConfig(langRaw, voiceRaw)
        ?: return RouteEnrichCommandParseResult.Error(
            if (voiceRaw != null) "Invalid --voice value: $voiceRaw. Expected one of: ${Voice.entries.joinToString(",") { it.slug }}."
            else "Invalid --lang value: $langRaw. Expected one of: ${Language.entries.joinToString(",") { it.code }}.",
        )

    return RouteEnrichCommandParseResult.Success(
        RouteEnrichCommandOptions(
            gpxFile = gpxFile,
            promptFile = promptFile,
            prefsFile = prefsFile,
            voiceConfig = voiceConfig,
            poiPreferences = poiPreferences,
            experiencePreferencesOverride = when {
                poiSelectionMode != null || detailLevel != null -> ExperiencePreferences(
                    detailLevel = detailLevel ?: InterventionDetailLevel.BALANCED,
                    poiSelectionMode = poiSelectionMode ?: PoiSelectionMode.BALANCED,
                )
                else -> null
            },
            audioCacheDir = audioCacheDir,
            outputGpxFile = outputGpxFile,
            printGpx = printGpx,
        ),
    )
}

/**
 * Resolves CLI --lang / --voice args into a [VoiceConfig].
 * Exactly one of [langRaw] or [voiceRaw] should be non-null (or both null for default).
 * Returns null if the provided raw value is invalid.
 */
private fun parseVoiceConfig(langRaw: String?, voiceRaw: String?): VoiceConfig? = when {
    voiceRaw != null -> Voice.fromSlug(voiceRaw)?.let { VoiceConfig.Custom(it) }
    langRaw != null -> Language.fromCode(langRaw)?.let { VoiceConfig.Auto(it) }
    else -> VoiceConfig.DEFAULT
}

private fun parsePoiSelectionMode(raw: String): PoiSelectionMode? =
    when (raw.trim().lowercase()) {
        PoiSelectionMode.BALANCED.serializedValue -> PoiSelectionMode.BALANCED
        PoiSelectionMode.NATURE.serializedValue -> PoiSelectionMode.NATURE
        PoiSelectionMode.HISTORY.serializedValue -> PoiSelectionMode.HISTORY
        PoiSelectionMode.ARCHITECTURE.serializedValue -> PoiSelectionMode.ARCHITECTURE
        PoiSelectionMode.PANORAMA.serializedValue -> PoiSelectionMode.PANORAMA
        PoiSelectionMode.CUSTOM.serializedValue -> PoiSelectionMode.CUSTOM
        else -> null
    }

private fun parseDetailLevel(raw: String): InterventionDetailLevel? =
    when (raw.trim().lowercase()) {
        InterventionDetailLevel.SHORT.serializedValue -> InterventionDetailLevel.SHORT
        InterventionDetailLevel.BALANCED.serializedValue -> InterventionDetailLevel.BALANCED
        InterventionDetailLevel.DETAILED.serializedValue -> InterventionDetailLevel.DETAILED
        else -> null
    }

private fun parsePoiDiscoveryPreferences(raw: String): PoiDiscoveryPreferences? {
    val normalized = raw.trim()
    if (normalized.isEmpty()) {
        return null
    }

    if (normalized.equals("all", ignoreCase = true)) {
        return PoiDiscoveryPreferences()
    }

    if (normalized.equals("none", ignoreCase = true)) {
        return PoiDiscoveryPreferences(
            categories = PoiCategorySelection(
                viewpoint = false,
                peak = false,
                waterfall = false,
                cave = false,
                historic = false,
                attraction = false,
                information = false,
            ),
        )
    }

    val tokens = normalized
        .split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotEmpty() }
        .toSet()

    if (tokens.isEmpty()) {
        return null
    }

    val supported = setOf(
        "viewpoint",
        "peak",
        "waterfall",
        "cave",
        "historic",
        "attraction",
        "information",
    )
    if (!tokens.all { it in supported }) {
        return null
    }

    return PoiDiscoveryPreferences(
        categories = PoiCategorySelection(
            viewpoint = "viewpoint" in tokens,
            peak = "peak" in tokens,
            waterfall = "waterfall" in tokens,
            cave = "cave" in tokens,
            historic = "historic" in tokens,
            attraction = "attraction" in tokens,
            information = "information" in tokens,
        ),
    )
}

private fun resolveInputPath(rawPath: String): Path? {
    val candidates = listOf(
        Path.of(rawPath),
        Path.of("..").resolve(rawPath).normalize(),
        Path.of("hikecore").resolve(rawPath).normalize(),
    ).distinct()

    return candidates.firstOrNull(Path::isRegularFile)
}

private fun resolveOutputPath(rawPath: String): Path {
    val path = Path.of(rawPath)
    return if (path.isAbsolute()) path else Path.of("").resolve(path).normalize()
}

private fun defaultEnrichedGpxPath(gpxPath: Path): Path {
    val fileName = gpxPath.name
    val stem = if (fileName.endsWith(".gpx", ignoreCase = true)) {
        fileName.dropLast(4)
    } else {
        fileName
    }
    return gpxPath.parent?.resolve("${stem}.enriched.gpx")
        ?: Path.of("${stem}.enriched.gpx")
}

private fun extractGeneratedWaypointNames(gpxXml: String): List<String> =
    GpxRouteParser().parse(gpxXml).gpxWaypoints
        .mapNotNull(GpxWaypoint::name)
        .filter { it.startsWith("hb_at_") }

private fun failWithMissingFile(kind: String, rawPath: String): Int {
    System.err.println("Could not find $kind file: $rawPath")
    return 1
}

private fun printRootUsage() {
    println(
        """
        Usage:
          ./gradlew :hikecore:run --args='generate --lat <value> --lon <value> [options]'
          ./gradlew :hikecore:run --args='route-pois [options]'
          ./gradlew :hikecore:run --args='route-enrich [options]'
          ./gradlew :hikecore:run --args='details [lat] [lon]'

        Commands:
          tts       Synthesize a text string to an MP3 file.
          generate  Generate an intervention from nearby POIs and the file-based prompt/preferences.
          route-pois Discover curated POIs along a GPX route.
          route-enrich Generate audio assets for a GPX route and write an enriched GPX file.
          details   Keep the legacy repository smoke test.
        """.trimIndent()
    )
}

private fun printTtsUsage() {
    println(
        """
        Usage:
          ./gradlew :hikecore:run --args='tts --text "<text>" [options]'

        Options:
          --text <value>    Required. Text to synthesize.
          --lang <value>    Language of the text. Default: fr. Values: ${Language.entries.joinToString(",") { it.code }}.
          --voice <slug>    Voice slug. Default: ${Voice.DEFAULT.slug}. Values: ${Voice.entries.joinToString(",") { it.slug }}.
          --output <path>   Output MP3 file path. Default: output/tts.mp3.
        """.trimIndent()
    )
}

private fun printGenerateUsage() {
    println(
        """
        Usage:
          ./gradlew :hikecore:run --args='generate --lat <value> --lon <value> [options]'

        Options:
          --lat <value>                  Required latitude.
          --lon <value>                  Required longitude.
          --radius <value>               Search radius in meters. Default: 500.
          --prompt-file <path>           Prompt text file. Default: examples/prompt.txt.
          --prefs-file <path>            Preferences JSON file. Default: examples/preferences.json.
          --lang <value>                 Output language. Default: fr.
          --max-candidate-pois <value>   Maximum POIs kept after ranking. Default: 5.
          --with-audio                   Also synthesize audio with Mistral TTS.
        """.trimIndent()
    )
}

private fun printRoutePoisUsage() {
    println(
        """
        Usage:
          ./gradlew :hikecore:run --args='route-pois [options]'

        Options:
          --gpx-file <path>              GPX file to analyze. Default: samples/nantes-graslin-commerce.gpx.
          --lang <value>                 Locale for enrichment and scoring hints. Default: fr.
          --max-pois-per-km <value>      Density cap per sliding kilometer. Default: 4.
          --route-buffer <value>         Corridor buffer in meters around the route. Default: 100.
          --poi-categories <list>        Comma-separated categories: viewpoint,peak,waterfall,cave,historic,attraction,information. Use 'all' or 'none'. Default: all.
          --poi-selection-mode <value>   Preset to bias selection: balanced,nature,history,architecture,panorama.
          --detail-level <value>         Detail policy: short,balanced,detailed.
          --disable-llm-scoring          Force deterministic reranking only.
        """.trimIndent()
    )
}

private fun printRouteEnrichUsage() {
    println(
        """
        Usage:
          ./gradlew :hikecore:run --args='route-enrich [options]'

        Options:
          --gpx-file <path>              GPX file to enrich. Default: samples/nantes-graslin-commerce.gpx.
          --prompt-file <path>           Prompt text file. Default: examples/prompt.txt.
          --prefs-file <path>            Preferences JSON file. Default: examples/preferences.json.
          --lang <value>                 Output language. Default: fr.
          --poi-categories <list>        Comma-separated categories: viewpoint,peak,waterfall,cave,historic,attraction,information. Use 'all' or 'none'. Default: all.
          --poi-selection-mode <value>   Override the POI preset: balanced,nature,history,architecture,panorama.
          --detail-level <value>         Override the intervention detail level: short,balanced,detailed.
          --audio-cache-dir <path>       Directory where audio files are written. Default: output/route-audio.
          --output-gpx-file <path>       Path for the enriched GPX. Default: <input>.enriched.gpx.
          --print-gpx                    Also embed the enriched GPX XML in the JSON output.
        """.trimIndent()
    )
}

private fun RoutePoiDiscoveryResult.toCli(): CliRouteDiscoveryResult =
    CliRouteDiscoveryResult(
        routeLengthMeters = routeLengthMeters,
        discoveredPois = discoveredPois.map(DiscoveredRoutePoi::toCli),
        gpxWaypoints = gpxWaypoints.map(GpxWaypoint::toCli),
    )

private fun DiscoveredRoutePoi.toCli(): CliRoutePoi =
    CliRoutePoi(
        id = id,
        name = name,
        category = category.name,
        distanceAlongRouteMeters = distanceAlongRouteMeters,
        distanceToRouteMeters = distanceToRouteMeters,
        score = score,
    )

private fun GpxWaypoint.toCli(): CliWaypoint =
    CliWaypoint(
        name = name,
        description = description,
        distanceAlongRouteMeters = distanceAlongRouteMeters,
    )
