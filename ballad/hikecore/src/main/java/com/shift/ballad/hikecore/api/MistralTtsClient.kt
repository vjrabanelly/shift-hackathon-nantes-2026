package com.shift.ballad.hikecore.api

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import com.shift.ballad.hikecore.intervention.retryOnRateLimit
import java.io.IOException
import java.util.Base64

internal class MistralTtsClient(
    private val apiKey: String,
    private val httpClient: HttpClient = HttpClient(OkHttp) {
        install(ContentNegotiation) {
            json(Json { ignoreUnknownKeys = true })
        }
        expectSuccess = false
    },
    private val baseUrl: String = "https://api.mistral.ai",
    private val model: String = "voxtral-mini-tts-latest",
) : AudioService {

    override suspend fun textToSpeech(text: String, voice: Voice): ByteArray {
        require(text.isNotBlank()) { "Text cannot be empty." }

        val requestBody = buildJsonObject {
            put("input", JsonPrimitive(text))
            put("model", JsonPrimitive(model))
            put("voice_id", JsonPrimitive(voice.slug))
            put("response_format", JsonPrimitive("mp3"))
        }.toString()

        return retryOnRateLimit(maxAttempts = 3, baseDelayMs = 1_000) {
            val response = httpClient.post("$baseUrl/v1/audio/speech") {
                header("Authorization", "Bearer $apiKey")
                contentType(ContentType.Application.Json)
                setBody(requestBody)
            }

            if (response.status.value !in 200..299 && response.status.value != 429 && response.status.value !in 500..599) {
                throw IOException("Mistral TTS API error: ${response.status.value} ${response.bodyAsText().take(200)}")
            }

            val body = response.bodyAsText()
            val jsonObj = Json.decodeFromString<JsonObject>(body)
            val audioBase64 = jsonObj["audio_data"]?.jsonPrimitive?.content
                ?: throw IOException("Mistral TTS response missing 'audio_data' field")

            response to Base64.getDecoder().decode(audioBase64)
        }
    }
}
