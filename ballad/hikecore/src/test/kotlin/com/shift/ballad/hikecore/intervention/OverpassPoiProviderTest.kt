package com.shift.ballad.hikecore.intervention

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OverpassPoiProviderTest {

    @Test
    fun `buildQuery includes radius coordinates and whitelist tags`() {
        val query = OverpassPoiProvider.buildQuery(
            point = GeoPoint(45.8326, 6.8652),
            radiusMeters = 750,
        )

        assertTrue(query.contains("around:750,45.8326,6.8652"))
        assertTrue(query.contains("[tourism=viewpoint]"))
        assertTrue(query.contains("[historic]"))
        assertTrue(query.contains("out center tags;"))
    }

    @Test
    fun `buildQuery only includes enabled categories`() {
        val query = OverpassPoiProvider.buildQuery(
            point = GeoPoint(45.8326, 6.8652),
            radiusMeters = 750,
            allowedCategories = setOf(PoiCategory.VIEWPOINT, PoiCategory.WATERFALL),
        )

        assertTrue(query.contains("[tourism=viewpoint]"))
        assertTrue(query.contains("[waterway=waterfall]"))
        assertFalse(query.contains("[historic]"))
        assertFalse(query.contains("[tourism=information]"))
    }

    @Test
    fun `findNearbyPois maps overpass elements into poi contexts`() = runTest {
        val client = mockJsonClient(
            body =
                """
                {
                  "elements": [
                    {
                      "type": "node",
                      "id": 123,
                      "lat": 45.83,
                      "lon": 6.86,
                      "tags": {
                        "name": "Belvédère du Test",
                        "tourism": "viewpoint",
                        "wikipedia": "fr:Belvédère_du_Test"
                      }
                    },
                    {
                      "type": "way",
                      "id": 456,
                      "center": {
                        "lat": 45.831,
                        "lon": 6.861
                      },
                      "tags": {
                        "historic": "ruins"
                      }
                    }
                  ]
                }
                """.trimIndent(),
        )

        val provider = OverpassPoiProvider(client)

        val pois = provider.findNearbyPois(
            point = GeoPoint(45.8326, 6.8652),
            radiusMeters = 750,
            allowedCategories = setOf(PoiCategory.VIEWPOINT),
        )

        assertEquals(1, pois.size)
        assertEquals("node/123", pois.first().id)
        assertEquals(PoiCategory.VIEWPOINT, pois.first().category)
        assertEquals("Belvédère du Test", pois.first().name)
        assertNotNull(pois.first().sourceRefs.firstOrNull { it.kind == SourceKind.WIKIPEDIA })
    }

    @Test
    fun `findNearbyPois falls back to secondary endpoint after gateway timeout`() = runTest {
        val attempts = mutableListOf<String>()
        val client = HttpClient(MockEngine) {
            install(ContentNegotiation) {
                json(DefaultJson)
            }
            engine {
                addHandler { request ->
                    attempts += request.url.host
                    when (request.url.host) {
                        "primary.example" -> respond(
                            content = "busy",
                            status = HttpStatusCode.GatewayTimeout,
                            headers = headersOf("Content-Type", ContentType.Text.Html.toString()),
                        )
                        "secondary.example" -> respond(
                            content =
                                """
                                {
                                  "elements": [
                                    {
                                      "type": "node",
                                      "id": 789,
                                      "lat": 47.2127,
                                      "lon": -1.5637,
                                      "tags": {
                                        "name": "Belvédère de secours",
                                        "tourism": "viewpoint"
                                      }
                                    }
                                  ]
                                }
                                """.trimIndent(),
                            status = HttpStatusCode.OK,
                            headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
                        )
                        else -> error("Unexpected host ${request.url.host}")
                    }
                }
            }
        }

        val provider = OverpassPoiProvider(
            httpClient = client,
            endpoints = listOf(
                "https://primary.example/api/interpreter",
                "https://secondary.example/api/interpreter",
            ),
            maxAttemptsPerEndpoint = 1,
        )

        val pois = provider.findNearbyPois(
            point = GeoPoint(47.21268, -1.56369),
            radiusMeters = 100,
            allowedCategories = AllSelectablePoiCategories,
        )

        assertEquals(listOf("primary.example", "secondary.example"), attempts)
        assertEquals(1, pois.size)
        assertEquals("Belvédère de secours", pois.first().name)
    }
}
