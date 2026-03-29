package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.DefaultJson
import com.shift.ballad.hikecore.intervention.JsonSchemaFormat
import com.shift.ballad.hikecore.intervention.OpenAiOutputContent
import com.shift.ballad.hikecore.intervention.OpenAiOutputMessage
import com.shift.ballad.hikecore.intervention.OpenAiResponsesRequest
import com.shift.ballad.hikecore.intervention.OpenAiResponsesResponse
import com.shift.ballad.hikecore.intervention.OpenAiResponsesLlmClient
import com.shift.ballad.hikecore.intervention.ResponseMessage
import com.shift.ballad.hikecore.intervention.ResponseText
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
import java.util.Locale
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

internal interface RoutePoiLlmScorer {
    suspend fun rerank(
        request: RoutePoiDiscoveryRequest,
        windowIndex: Int,
        routeLengthMeters: Int,
        candidates: List<RoutePoiCandidateContext>,
    ): Map<String, Double>
}

internal class OpenAiRoutePoiLlmScorer(
    private val apiKey: String,
    private val model: String = OpenAiResponsesLlmClient.DEFAULT_MODEL,
    private val httpClient: HttpClient,
    private val endpoint: String = OpenAiResponsesLlmClient.DEFAULT_ENDPOINT,
) : RoutePoiLlmScorer {

    override suspend fun rerank(
        request: RoutePoiDiscoveryRequest,
        windowIndex: Int,
        routeLengthMeters: Int,
        candidates: List<RoutePoiCandidateContext>,
    ): Map<String, Double> {
        val prompt = buildPrompt(request, windowIndex, routeLengthMeters, candidates)
        val response = httpClient.post(endpoint) {
            contentType(ContentType.Application.Json)
            header(HttpHeaders.Authorization, "Bearer $apiKey")
            setBody(
                OpenAiResponsesRequest(
                    model = model,
                    input = listOf(
                        ResponseMessage(
                            role = "system",
                            content = "Tu aides a prioriser des points d'interet sur un trajet. Respecte strictement le schema JSON fourni.",
                        ),
                        ResponseMessage(
                            role = "user",
                            content = prompt,
                        ),
                    ),
                    text = ResponseText(
                        format = JsonSchemaFormat(
                            type = "json_schema",
                            name = "route_poi_ranking",
                            schema = rankingSchema(),
                        ),
                    ),
                ),
            )
        }

        if (!response.status.isSuccess()) {
            throw IllegalStateException(
                "OpenAI route rerank request failed with ${response.status.value}: ${response.bodyAsText()}",
            )
        }

        val payload = response.body<OpenAiResponsesResponse>()
        val outputText = payload.outputText?.takeIf { it.isNotBlank() }
            ?: payload.output.asSequence()
                .flatMap { it.content.asSequence() }
                .firstOrNull { it.type == "output_text" }
                ?.text
            ?: throw IllegalStateException("OpenAI route rerank response did not include output_text")

        val structured = DefaultJson.decodeFromString(RoutePoiRerankResponse.serializer(), outputText)
        return structured.recommendations.associate { recommendation ->
            recommendation.id to recommendation.bonus.coerceIn(-10.0, 12.0)
        }
    }

    private fun buildPrompt(
        request: RoutePoiDiscoveryRequest,
        windowIndex: Int,
        routeLengthMeters: Int,
        candidates: List<RoutePoiCandidateContext>,
    ): String =
        buildString {
            appendLine("Locale: ${request.language.code}")
            appendLine("Route length meters: $routeLengthMeters")
            appendLine("Window index: $windowIndex")
            appendLine("Active POI selection mode: ${request.experiencePreferences.poiSelectionMode}")
            appendLine("Goal: assign a small score bonus to the POIs that are the most interesting for a hiker on this segment.")
            appendLine("Do not invent facts. Prefer named, distinctive POIs with trustworthy sources and useful context.")
            appendLine("Stay faithful to the exact identity of each place. Use OSM ids, coordinates and exact source refs to avoid confusing two locations with the same name.")
            appendLine("Favor candidates that match the active POI selection mode when the evidence supports it.")
            appendLine("Return a bonus between -5 and 10 for each candidate id.")
            appendLine()
            appendLine("Candidates:")
            candidates.forEach { candidate ->
                val sourceRefs = candidate.poi.sourceRefs.joinToString(separator = " | ") { ref ->
                    "${ref.kind}:${ref.value}"
                }
                val sourceEvidence = candidate.poi.sourceSummaries.joinToString(separator = " | ") { summary ->
                    "${summary.title}: ${summary.snippet}"
                }
                appendLine(
                    "- id=${candidate.poi.id}; name=${candidate.poi.name ?: "unknown"}; category=${candidate.poi.category}; " +
                        "lat=${String.format(Locale.US, "%.6f", candidate.poi.point.lat)}; " +
                        "lon=${String.format(Locale.US, "%.6f", candidate.poi.point.lon)}; " +
                        "distance_to_route_m=${candidate.distanceToRouteMeters.roundToIntMeters()}; " +
                        "distance_along_route_m=${candidate.distanceAlongRouteMeters.roundToIntMeters()}; " +
                        "base_score=${String.format(Locale.US, "%.1f", candidate.deterministicScore)}; " +
                        "tags=${candidate.poi.tags.entries.sortedBy { it.key }.joinToString { "${it.key}=${it.value}" }}; " +
                        "source_refs=$sourceRefs; " +
                        "source_evidence=$sourceEvidence",
                )
            }
        }

    private fun rankingSchema(): JsonObject =
        buildJsonObject {
            put("type", JsonPrimitive("object"))
            put(
                "properties",
                buildJsonObject {
                    put(
                        "recommendations",
                        buildJsonObject {
                            put("type", JsonPrimitive("array"))
                            put(
                                "items",
                                buildJsonObject {
                                    put("type", JsonPrimitive("object"))
                                    put(
                                        "properties",
                                        buildJsonObject {
                                            put("id", buildJsonObject { put("type", JsonPrimitive("string")) })
                                            put("bonus", buildJsonObject { put("type", JsonPrimitive("number")) })
                                        },
                                    )
                                    put("required", JsonArray(listOf(JsonPrimitive("id"), JsonPrimitive("bonus"))))
                                    put("additionalProperties", JsonPrimitive(false))
                                },
                            )
                        },
                    )
                },
            )
            put("required", JsonArray(listOf(JsonPrimitive("recommendations"))))
            put("additionalProperties", JsonPrimitive(false))
        }
}

@Serializable
internal data class RoutePoiRerankResponse(
    val recommendations: List<RoutePoiRecommendation> = emptyList(),
)

@Serializable
internal data class RoutePoiRecommendation(
    val id: String,
    val bonus: Double,
)
