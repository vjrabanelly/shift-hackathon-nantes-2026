package com.shift.ballad.hikecore.intervention

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OpenAiResponsesLlmClientTest {

    @Test
    fun `structured output request includes json schema type`() {
        val request = OpenAiResponsesRequest(
            model = "gpt-4.1-mini",
            input = listOf(
                ResponseMessage(
                    role = "system",
                    content = "System prompt",
                ),
                ResponseMessage(
                    role = "user",
                    content = "User prompt",
                ),
            ),
            text = ResponseText(
                format = JsonSchemaFormat(
                    type = "json_schema",
                    name = "hike_buddy_intervention",
                    schema = kotlinx.serialization.json.buildJsonObject {
                        put("type", kotlinx.serialization.json.JsonPrimitive("object"))
                    },
                ),
            ),
        )

        val encoded = DefaultJson.encodeToString(request)
        val parsed = DefaultJson.parseToJsonElement(encoded).jsonObject
        val formatType = parsed
            .getValue("text")
            .jsonObject
            .getValue("format")
            .jsonObject
            .getValue("type")
            .jsonPrimitive
            .content

        assertEquals("json_schema", formatType)
    }

    @Test
    fun `generate parses structured intervention text from responses api`() = runTest {
        val client = mockJsonClient(
            body =
                """
                {
                  "id": "resp_123",
                  "model": "gpt-4.1-mini",
                  "output": [
                    {
                      "type": "message",
                      "content": [
                        {
                          "type": "output_text",
                          "text": "{\"intervention_text\":\"Encore quelques mètres jusqu'au belvédère, puis la vue va s'ouvrir sur la vallée.\"}"
                        }
                      ]
                    }
                  ]
                }
                """.trimIndent(),
        )
        val llmClient = OpenAiResponsesLlmClient(
            apiKey = "test-key",
            httpClient = client,
        )

        val generation = llmClient.generate(
            PreparedInterventionContext(
                request = InterventionRequest(
                    point = GeoPoint(45.0, 6.0),
                    radiusMeters = 800,
                    promptInstructions = "Reste bref.",
                    userPreferencesJson = """{"tone":"warm"}""",
                ),
                selectedPoi = PoiCandidate(
                    id = "node/1",
                    name = "Belvédère",
                    lat = 45.0,
                    lon = 6.0,
                    distanceMeters = 120,
                    category = PoiCategory.VIEWPOINT,
                    tags = mapOf("tourism" to "viewpoint"),
                    sourceRefs = emptyList(),
                    score = 90.0,
                ),
                candidatePois = emptyList(),
                sourceSummaries = emptyList(),
                prompt = "Prompt",
            ),
        )

        assertEquals(
            "Encore quelques mètres jusqu'au belvédère, puis la vue va s'ouvrir sur la vallée.",
            generation.text,
        )
        assertEquals("gpt-4.1-mini", generation.modelInfo.model)
        assertEquals("resp_123", generation.modelInfo.responseId)
    }
}
