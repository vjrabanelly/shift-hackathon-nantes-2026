package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.intervention.DefaultJson
import com.shift.ballad.hikecore.intervention.ExperiencePreferences
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.PoiContext
import com.shift.ballad.hikecore.intervention.PoiSelectionMode
import com.shift.ballad.hikecore.intervention.SourceKind
import com.shift.ballad.hikecore.intervention.SourceReference
import com.shift.ballad.hikecore.intervention.SourceSummary
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.TextContent
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class OpenAiRoutePoiLlmScorerTest {

    @Test
    fun `rerank prompt includes mode identity and source evidence`() = runTest {
        var capturedRequestBody: String? = null
        val httpClient = HttpClient(MockEngine) {
            install(ContentNegotiation) {
                json(DefaultJson)
            }
            engine {
                addHandler { request ->
                    capturedRequestBody = (request.body as TextContent).text
                    respond(
                        content =
                            """
                            {
                              "id": "resp_route_1",
                              "model": "gpt-4.1-mini",
                              "output": [
                                {
                                  "type": "message",
                                  "content": [
                                    {
                                      "type": "output_text",
                                      "text": "{\"recommendations\":[{\"id\":\"node/1\",\"bonus\":4.5}]}"
                                    }
                                  ]
                                }
                              ]
                            }
                            """.trimIndent(),
                        status = HttpStatusCode.OK,
                        headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
                    )
                }
            }
        }
        val scorer = OpenAiRoutePoiLlmScorer(
            apiKey = "test-key",
            httpClient = httpClient,
        )

        val rerank = scorer.rerank(
            request = RoutePoiDiscoveryRequest(
                gpxXml = straightTrackGpx(),
                language = Language.FR,
                experiencePreferences = ExperiencePreferences(
                    poiSelectionMode = PoiSelectionMode.HISTORY,
                ),
            ),
            windowIndex = 2,
            routeLengthMeters = 2_400,
            candidates = listOf(
                RoutePoiCandidateContext(
                    poi = PoiContext(
                        id = "node/1",
                        name = "Abbaye",
                        point = GeoPoint(47.212345, -1.56321),
                        category = PoiCategory.HISTORIC,
                        tags = mapOf(
                            "name" to "Abbaye",
                            "historic" to "monastery",
                            "wikidata" to "Q123",
                        ),
                        sourceRefs = listOf(
                            SourceReference(
                                kind = SourceKind.WIKIDATA,
                                label = "Abbaye",
                                value = "Q123",
                            ),
                        ),
                        sourceSummaries = listOf(
                            SourceSummary(
                                kind = SourceKind.WIKIDATA,
                                title = "Abbaye",
                                snippet = "Monastère médiéval bien identifié.",
                            ),
                        ),
                    ),
                    projectedPoint = GeoPoint(47.21212, -1.56300),
                    distanceAlongRouteMeters = 640.0,
                    distanceToRouteMeters = 23.0,
                    nearestSegmentIndex = 1,
                    windowIndex = 2,
                    deterministicScore = 77.2,
                ),
            ),
        )

        assertEquals(4.5, rerank.getValue("node/1"))

        val body = assertNotNull(capturedRequestBody)
        val parsed = DefaultJson.parseToJsonElement(body).jsonObject
        val userPrompt = parsed
            .getValue("input")
            .jsonArray[1]
            .jsonObject
            .getValue("content")
            .jsonPrimitive
            .content

        assertTrue(userPrompt.contains("Active POI selection mode: HISTORY"))
        assertTrue(userPrompt.contains("Stay faithful to the exact identity of each place."))
        assertTrue(userPrompt.contains("lat=47.212345"))
        assertTrue(userPrompt.contains("lon=-1.563210"))
        assertTrue(userPrompt.contains("source_refs=WIKIDATA:Q123"))
        assertTrue(userPrompt.contains("source_evidence=Abbaye: Monastère médiéval bien identifié."))
    }

    private fun straightTrackGpx(): String =
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <trkseg>
              <trkpt lat="47.21" lon="-1.56" />
              <trkpt lat="47.22" lon="-1.57" />
            </trkseg>
          </trk>
        </gpx>
        """.trimIndent()
}
