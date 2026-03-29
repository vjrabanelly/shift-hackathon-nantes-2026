package com.shift.ballad.hikecore.intervention

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

internal class OpenAiResponsesLlmClient(
    private val apiKey: String,
    private val model: String = DEFAULT_MODEL,
    private val httpClient: HttpClient,
    private val endpoint: String = DEFAULT_ENDPOINT,
) : LlmClient {

    override suspend fun generate(context: PreparedInterventionContext): LlmGeneration {
        val request = OpenAiResponsesRequest(
            model = model,
            input = listOf(
                ResponseMessage(
                    role = "system",
                    content = "Tu crées des interventions textuelles de randonnée. Respecte strictement le schéma JSON fourni.",
                ),
                ResponseMessage(
                    role = "user",
                    content = context.prompt,
                ),
            ),
            text = ResponseText(
                format = JsonSchemaFormat(
                    type = "json_schema",
                    name = "hike_buddy_intervention",
                    schema = interventionSchema(),
                ),
            ),
        )

        return retryOnRateLimit(maxAttempts = 3, baseDelayMs = 1_000) {
            val response = httpClient.post(endpoint) {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $apiKey")
                setBody(request)
            }

            if (!response.status.isSuccess() && response.status.value != 429 && response.status.value !in 500..599) {
                throw IllegalStateException(
                    "OpenAI request failed with ${response.status.value}: ${response.bodyAsText()}",
                )
            }

            val payload = response.body<OpenAiResponsesResponse>()
            val outputText = payload.outputText?.takeIf { it.isNotBlank() }
                ?: payload.output.asSequence()
                    .flatMap { it.content.asSequence() }
                    .firstOrNull { it.type == "output_text" }
                    ?.text
                ?: throw IllegalStateException("OpenAI response did not include output_text")
            val structured = DefaultJson.decodeFromString(StructuredIntervention.serializer(), outputText)

            response to LlmGeneration(
                text = structured.interventionText.trim(),
                modelInfo = ModelInfo(
                    provider = "openai",
                    model = payload.model ?: model,
                    responseId = payload.id,
                ),
            )
        }
    }

    override suspend fun generateBatch(contexts: List<PreparedInterventionContext>): List<LlmGeneration> {
        if (contexts.isEmpty()) return emptyList()
        if (contexts.size == 1) return listOf(generate(contexts.single()))

        val batchPrompt = buildString {
            appendLine("Tu crées des interventions textuelles de randonnée.")
            appendLine("Pour chaque POI ci-dessous, génère un texte d'intervention distinct.")
            appendLine("Respecte strictement le schéma JSON fourni.")
            appendLine()
            contexts.forEachIndexed { index, ctx ->
                appendLine("--- POI ${index + 1} (id=\"${ctx.selectedPoi.id}\") ---")
                appendLine(ctx.prompt)
                appendLine()
            }
        }

        val request = OpenAiResponsesRequest(
            model = model,
            input = listOf(
                ResponseMessage(
                    role = "system",
                    content = "Tu crées des interventions textuelles de randonnée. Respecte strictement le schéma JSON fourni.",
                ),
                ResponseMessage(
                    role = "user",
                    content = batchPrompt,
                ),
            ),
            text = ResponseText(
                format = JsonSchemaFormat(
                    type = "json_schema",
                    name = "hike_buddy_batch_intervention",
                    schema = batchInterventionSchema(),
                ),
            ),
        )

        return retryOnRateLimit(maxAttempts = 3, baseDelayMs = 1_000) {
            val response = httpClient.post(endpoint) {
                contentType(ContentType.Application.Json)
                header(HttpHeaders.Authorization, "Bearer $apiKey")
                setBody(request)
            }

            if (!response.status.isSuccess() && response.status.value != 429 && response.status.value !in 500..599) {
                throw IllegalStateException(
                    "OpenAI batch request failed with ${response.status.value}: ${response.bodyAsText()}",
                )
            }

            val payload = response.body<OpenAiResponsesResponse>()
            val outputText = payload.outputText?.takeIf { it.isNotBlank() }
                ?: payload.output.asSequence()
                    .flatMap { it.content.asSequence() }
                    .firstOrNull { it.type == "output_text" }
                    ?.text
                ?: throw IllegalStateException("OpenAI batch response did not include output_text")

            val structured = DefaultJson.decodeFromString(StructuredBatchIntervention.serializer(), outputText)
            val modelInfo = ModelInfo(
                provider = "openai",
                model = payload.model ?: model,
                responseId = payload.id,
            )

            response to structured.interventions.map { entry ->
                LlmGeneration(
                    text = entry.interventionText.trim(),
                    modelInfo = modelInfo,
                )
            }
        }
    }

    private fun interventionSchema(): JsonObject =
        buildJsonObject {
            put("type", JsonPrimitive("object"))
            put(
                "properties",
                buildJsonObject {
                    put(
                        "intervention_text",
                        buildJsonObject {
                            put("type", JsonPrimitive("string"))
                        },
                    )
                },
            )
            put("required", JsonArray(listOf(JsonPrimitive("intervention_text"))))
            put("additionalProperties", JsonPrimitive(false))
        }

    private fun batchInterventionSchema(): JsonObject =
        buildJsonObject {
            put("type", JsonPrimitive("object"))
            put(
                "properties",
                buildJsonObject {
                    put(
                        "interventions",
                        buildJsonObject {
                            put("type", JsonPrimitive("array"))
                            put(
                                "items",
                                buildJsonObject {
                                    put("type", JsonPrimitive("object"))
                                    put(
                                        "properties",
                                        buildJsonObject {
                                            put(
                                                "intervention_text",
                                                buildJsonObject {
                                                    put("type", JsonPrimitive("string"))
                                                },
                                            )
                                        },
                                    )
                                    put("required", JsonArray(listOf(JsonPrimitive("intervention_text"))))
                                    put("additionalProperties", JsonPrimitive(false))
                                },
                            )
                        },
                    )
                },
            )
            put("required", JsonArray(listOf(JsonPrimitive("interventions"))))
            put("additionalProperties", JsonPrimitive(false))
        }

    companion object {
        const val DEFAULT_ENDPOINT = "https://api.openai.com/v1/responses"
        const val DEFAULT_MODEL = "gpt-4.1-mini"
    }
}

@Serializable
internal data class OpenAiResponsesRequest(
    val model: String,
    val input: List<ResponseMessage>,
    val text: ResponseText,
)

@Serializable
internal data class ResponseMessage(
    val role: String,
    val content: String,
)

@Serializable
internal data class ResponseText(
    val format: JsonSchemaFormat,
)

@Serializable
internal data class JsonSchemaFormat(
    val type: String,
    val name: String,
    val schema: JsonObject,
    val strict: Boolean = true,
)

@Serializable
internal data class OpenAiResponsesResponse(
    val id: String? = null,
    val model: String? = null,
    @SerialName("output_text") val outputText: String? = null,
    val output: List<OpenAiOutputMessage> = emptyList(),
)

@Serializable
internal data class StructuredIntervention(
    @SerialName("intervention_text") val interventionText: String,
)

@Serializable
internal data class StructuredBatchIntervention(
    val interventions: List<StructuredIntervention>,
)

@Serializable
internal data class OpenAiOutputMessage(
    val type: String? = null,
    val content: List<OpenAiOutputContent> = emptyList(),
)

@Serializable
internal data class OpenAiOutputContent(
    val type: String? = null,
    val text: String? = null,
)
