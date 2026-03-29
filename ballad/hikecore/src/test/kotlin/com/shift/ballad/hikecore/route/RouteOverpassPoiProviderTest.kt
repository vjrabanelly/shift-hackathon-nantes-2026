package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.DefaultJson
import com.shift.ballad.hikecore.intervention.PoiCategory
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class RouteOverpassPoiProviderTest {

    @Test
    fun `buildQuery uses a bbox instead of around`() {
        val query = RouteOverpassPoiProvider.buildQuery(
            RouteBounds(
                south = 47.20,
                west = -1.57,
                north = 47.22,
                east = -1.55,
            ),
        )

        assertTrue(query.contains("node(47.2,-1.57,47.22,-1.55)[tourism=viewpoint];"))
        assertTrue(!query.contains("around:"))
    }

    @Test
    fun `buildQuery only includes enabled categories`() {
        val query = RouteOverpassPoiProvider.buildQuery(
            bounds = RouteBounds(
                south = 47.20,
                west = -1.57,
                north = 47.22,
                east = -1.55,
            ),
            allowedCategories = setOf(PoiCategory.HISTORIC),
        )

        assertTrue(query.contains("[historic]"))
        assertTrue(!query.contains("[tourism=viewpoint]"))
        assertTrue(!query.contains("[tourism=information]"))
    }

    @Test
    fun `falls back to the next endpoint after a retryable failure`() = runTest {
        var callCount = 0
        val httpClient = HttpClient(MockEngine) {
            install(ContentNegotiation) {
                json(DefaultJson)
            }
            engine {
                addHandler { request ->
                    callCount += 1
                    if (request.url.host == "overpass-api.de") {
                        respond(
                            content = """{"error":"busy"}""",
                            status = HttpStatusCode.GatewayTimeout,
                            headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
                        )
                    } else {
                        respond(
                            content = """
                            {
                              "elements": [
                                {
                                  "type": "node",
                                  "id": 42,
                                  "lat": 47.21268,
                                  "lon": -1.56369,
                                  "tags": {
                                    "name": "Muséum d'Histoire Naturelle",
                                    "historic": "museum"
                                  }
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
        }

        val provider = RouteOverpassPoiProvider(
            httpClient = httpClient,
            endpoints = listOf(
                "https://overpass-api.de/api/interpreter",
                "https://overpass.kumi.systems/api/interpreter",
            ),
            maxAttemptsPerEndpoint = 1,
        )

        val result = provider.findPois(
            bounds = RouteBounds(
                south = 47.20,
                west = -1.57,
                north = 47.22,
                east = -1.55,
            ),
            allowedCategories = setOf(PoiCategory.HISTORIC),
        )

        assertEquals(2, callCount)
        assertEquals(listOf("node/42"), result.map { it.id })
    }
}
