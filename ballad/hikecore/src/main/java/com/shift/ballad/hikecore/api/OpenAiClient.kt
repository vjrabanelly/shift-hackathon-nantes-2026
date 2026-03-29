package com.shift.ballad.hikecore.api

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.model.PointOfInterest
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

internal class OpenAiClient(
    private val apiKey: String,
    private val model: String = "gpt-4o-mini",
    private val httpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build(),
    private val baseUrl: String = "https://api.openai.com"
) : TextGenerationService {

    override fun generateDescription(pois: List<PointOfInterest>, locale: Language, contextPrompt: String?): String {
        val poisText = pois.joinToString("\n") { poi ->
            "- ${poi.name} (${poi.type}): ${poi.tags.entries.joinToString(", ") { "${it.key}=${it.value}" }}"
        }

        val baseSystemPrompt = when (locale) {
            Language.FR -> "Tu es un guide touristique expert en histoire et culture. " +
                    "Tu fournis des descriptions riches et captivantes des points d'intérêt, " +
                    "en mettant en avant leur importance historique et culturelle. " +
                    "Tes réponses sont structurées, engageantes et adaptées à un audio guide."
            else -> "You are an expert tourist guide specialized in history and culture. " +
                    "You provide rich and captivating descriptions of points of interest, " +
                    "highlighting their historical and cultural significance. " +
                    "Your responses are structured, engaging and suited for an audio guide."
        }
        val systemPrompt = if (contextPrompt != null) "$baseSystemPrompt\n\nContexte additionnel : $contextPrompt" else baseSystemPrompt

        val userPrompt = when (locale) {
            Language.FR -> "Voici les points d'intérêt à proximité. Génère un texte audio guide " +
                    "historique et culturel pour ces lieux :\n\n$poisText"
            else -> "Here are the nearby points of interest. Generate an audio guide text " +
                    "with historical and cultural information for these places:\n\n$poisText"
        }

        val requestBody = buildJsonObject {
            put("model", model)
            putJsonArray("messages") {
                addJsonObject {
                    put("role", "system")
                    put("content", systemPrompt)
                }
                addJsonObject {
                    put("role", "user")
                    put("content", userPrompt)
                }
            }
            put("temperature", 0.7)
        }.toString()

        val request = Request.Builder()
            .url("$baseUrl/v1/chat/completions")
            .header("Authorization", "Bearer $apiKey")
            .header("Content-Type", "application/json")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .build()

        val response = httpClient.newCall(request).execute()
        if (!response.isSuccessful) {
            throw IOException("OpenAI API error: ${response.code} ${response.message}")
        }

        val body = response.body?.string() ?: throw IOException("Empty response from OpenAI API")
        return parseResponse(body)
    }

    private fun parseResponse(jsonString: String): String {
        val json = Json { ignoreUnknownKeys = true }
        val root = json.parseToJsonElement(jsonString).jsonObject
        val choices = root["choices"]?.jsonArray
            ?: throw IOException("No choices in OpenAI response")
        val firstChoice = choices.firstOrNull()?.jsonObject
            ?: throw IOException("Empty choices in OpenAI response")
        val message = firstChoice["message"]?.jsonObject
            ?: throw IOException("No message in OpenAI response")
        return message["content"]?.jsonPrimitive?.content
            ?: throw IOException("No content in OpenAI response")
    }
}
