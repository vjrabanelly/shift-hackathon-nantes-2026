package com.shift.ballad.server

import io.github.cdimascio.dotenv.dotenv
import com.shift.ballad.hikecore.HikeCore
import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.config.HikeConfig
import com.shift.ballad.hikecore.intervention.InterventionResult
import com.shift.ballad.hikecore.intervention.ManualPoi
import com.shift.ballad.hikecore.intervention.NearbyInterventionService
import com.shift.ballad.hikecore.intervention.config.buildInterventionRequest
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.settings.FileInterventionConfigProvider
import kotlin.math.pow
import java.nio.file.Path
import java.nio.file.Files
import java.nio.file.StandardOpenOption
import java.time.Instant
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.callloging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class PoiResponse(
    val name: String,
    val type: String,
    val latitude: Double,
    val longitude: Double,
    val tags: Map<String, String>
)

@Serializable
data class AudioGuideResponse(
    val pois: List<PoiResponse>,
    val description: String,
    val audioBase64: String
)

@Serializable
data class InterventionResponse(
    val text: String,
    val poi: String?,
    val audioBase64: String?,
    val model: String? = null,
)

fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val R = 6371000.0
    val toRad = Math.PI / 180
    val dLat = (lat2 - lat1) * toRad
    val dLon = (lon2 - lon1) * toRad
    val a = Math.sin(dLat / 2).pow(2) +
        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2).pow(2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

val outputDir = Path.of("output").also { Files.createDirectories(it) }
val outputFile = outputDir.resolve("poi-audio.jsonl")
val outputJson = Json { prettyPrint = false }

fun appendOutput(poi: ManualPoi, text: String, model: String, audioData: ByteArray?): String? {
    val timestamp = Instant.now()
    val slug = poi.name.lowercase()
        .replace(Regex("[^a-z0-9]+"), "_")
        .trimEnd('_')
        .take(40)
    val audioFileName = audioData?.let {
        val name = "${timestamp.toEpochMilli()}_${slug}.mp3"
        Files.write(outputDir.resolve(name), it)
        name
    }
    val line = outputJson.encodeToString(
        PoiAudioRecord.serializer(),
        PoiAudioRecord(
            timestamp = timestamp.toString(),
            poi = poi.name,
            lat = poi.lat,
            lon = poi.lon,
            text = text,
            model = model,
            audioFile = audioFileName,
        )
    )
    println("[poi-audio] $line")
    Files.writeString(outputFile, line + "\n", StandardOpenOption.CREATE, StandardOpenOption.APPEND)
    return audioFileName
}

@Serializable
data class PoiAudioRecord(
    val timestamp: String,
    val poi: String,
    val lat: Double,
    val lon: Double,
    val text: String,
    val model: String,
    val audioFile: String? = null,
)

fun main() {
    val env = dotenv {
        // Gradle lance le serveur depuis server/, on remonte à la racine du projet
        directory = System.getProperty("user.dir").let { cwd ->
            if (java.io.File(cwd, ".env").exists()) cwd
            else java.io.File(cwd).parentFile?.absolutePath ?: cwd
        }
        ignoreIfMissing = true
        systemProperties = true
    }

    val repository = HikeCore.create(HikeConfig())

    val openAiKey = env.get("OPENAI_API_KEY", "")
    val mistralKey = env.get("MISTRAL_API_KEY", null)
    val interventionService = NearbyInterventionService.createDefault(
        apiKey = openAiKey,
        mistralApiKey = mistralKey,
    )

    val port = 8081

    embeddedServer(Netty, port = port) {
        install(ContentNegotiation) { json(Json { prettyPrint = true }) }
        install(CallLogging)
        install(CORS) {
            anyHost()
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowHeader(io.ktor.http.HttpHeaders.ContentType)
        }

        routing {
            get("/pois") {
                val lat = call.request.queryParameters["lat"]?.toDoubleOrNull() ?: 48.8566
                val lon = call.request.queryParameters["lon"]?.toDoubleOrNull() ?: 2.3522
                val radius = call.request.queryParameters["radius"]?.toIntOrNull() ?: 50
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 10
                val pois = repository.getPOIs(lat, lon, radius)
                    .sortedBy { haversine(lat, lon, it.latitude, it.longitude) }
                    .take(limit)
                call.respond(pois.map { PoiResponse(it.name ?: "", it.type, it.latitude, it.longitude, it.tags) })
            }

            get("/intervention") {
                val lat = call.request.queryParameters["lat"]?.toDoubleOrNull() ?: 48.8566
                val lon = call.request.queryParameters["lon"]?.toDoubleOrNull() ?: 2.3522
                val radius = call.request.queryParameters["radius"]?.toIntOrNull() ?: 500
                val lang = call.request.queryParameters["lang"] ?: "fr"
                val voiceConfig = VoiceConfig.Auto(Language.fromCode(lang) ?: Language.FR)
                val request = buildInterventionRequest(
                    configProvider = FileInterventionConfigProvider(
                        promptFile = Path.of("hikecore/examples/prompt.txt"),
                        preferencesFile = Path.of("hikecore/examples/preferences.json"),
                    ),
                    point = GeoPoint(lat, lon),
                    radiusMeters = radius,
                    voiceConfig = voiceConfig,
                )
                when (val result = interventionService.generateWithAudio(request)) {
                    is InterventionResult.Generated -> call.respond(
                        InterventionResponse(
                            text = result.text,
                            poi = result.selectedPoi.name,
                            audioBase64 = result.audioData?.let { java.util.Base64.getEncoder().encodeToString(it) },
                        )
                    )
                    is InterventionResult.NoIntervention -> call.respond(
                        HttpStatusCode.NotFound,
                        mapOf("reason" to result.reason),
                    )
                    is InterventionResult.GenerationFailed -> call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("stage" to result.stage, "message" to result.message),
                    )
                }
            }

            post("/poi-audio") {
                val poi = call.receive<ManualPoi>()
                val lang = call.request.queryParameters["lang"] ?: "fr"
                val promptInstructions = call.request.queryParameters["prompt"] ?: ""
                val voiceConfig = VoiceConfig.Auto(Language.fromCode(lang) ?: Language.FR)
                when (
                    val result = interventionService.generateFromPoiWithAudio(
                        poi = poi,
                        promptInstructions = promptInstructions,
                        voiceConfig = voiceConfig,
                    )
                ) {
                    is InterventionResult.Generated -> {
                        val audioFile = appendOutput(poi, result.text, result.modelInfo.model, result.audioData)
                        call.respond(
                            InterventionResponse(
                                text = result.text,
                                poi = result.selectedPoi.name,
                                audioBase64 = result.audioData?.let { java.util.Base64.getEncoder().encodeToString(it) },
                                model = result.modelInfo.model,
                            )
                        )
                    }
                    is InterventionResult.NoIntervention -> call.respond(
                        HttpStatusCode.NotFound,
                        mapOf("reason" to result.reason),
                    )
                    is InterventionResult.GenerationFailed -> call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf("stage" to result.stage, "message" to result.message),
                    )
                }
            }

            get("/guide") {
                val lat = call.request.queryParameters["lat"]?.toDoubleOrNull() ?: 48.8566
                val lon = call.request.queryParameters["lon"]?.toDoubleOrNull() ?: 2.3522
                val radius = call.request.queryParameters["radius"]?.toIntOrNull() ?: 500
                val locale = call.request.queryParameters["locale"] ?: "fr"
                val result = repository.generateAudioGuide(
                    lat,
                    lon,
                    radius,
                    locale = Language.fromCode(locale) ?: Language.FR,
                )
                call.respond(AudioGuideResponse(
                    pois = result.pois.map { PoiResponse(it.name ?: "", it.type, it.latitude, it.longitude, it.tags) },
                    description = result.description,
                    audioBase64 = java.util.Base64.getEncoder().encodeToString(result.audioData)
                ))
            }
        }
    }.start(wait = true)
}
