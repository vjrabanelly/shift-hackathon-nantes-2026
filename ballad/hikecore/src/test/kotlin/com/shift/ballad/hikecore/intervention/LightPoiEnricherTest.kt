package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.Language
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.MockRequestHandleScope
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

class LightPoiEnricherTest {

    @Test
    fun `short detail keeps only one source and truncates aggressively`() = runTest {
        val enricher = LightPoiEnricher(
            httpClient = mockJsonClient(body = "{}"),
            sourceProviders = listOf(
                fakeProvider(
                    narrativeMaterial(
                        title = "wiki-1",
                        snippet = longSnippet("A"),
                        materialType = PoiSourceMaterialType.WIKIPEDIA_SUMMARY,
                    ),
                ),
                fakeProvider(
                    narrativeMaterial(
                        title = "wiki-2",
                        snippet = longSnippet("B"),
                        materialType = PoiSourceMaterialType.WIKIDATA_DESCRIPTION,
                    ),
                ),
            ),
        )

        val enriched = enricher.enrich(
            poi = samplePoi(),
            request = PoiEnrichmentRequest(
                language = Language.FR,
                experiencePreferences = ExperiencePreferences(
                    detailLevel = InterventionDetailLevel.SHORT,
                ),
            ),
        )

        assertEquals(1, enriched.sourceSummaries.size)
        assertEquals("wiki-1", enriched.sourceSummaries.first().title)
        assertTrue(enriched.sourceSummaries.first().snippet.length <= 163)
        assertTrue(enriched.sourceSummaries.first().snippet.endsWith("..."))
    }

    @Test
    fun `detailed mode keeps wikipedia wikivoyage and facts with dedicated caps`() = runTest {
        val enricher = LightPoiEnricher(
            httpClient = mockJsonClient(body = "{}"),
            sourceProviders = listOf(
                fakeProvider(
                    narrativeMaterial(
                        title = "Description",
                        snippet = longSnippet("D"),
                        materialType = PoiSourceMaterialType.WIKIDATA_DESCRIPTION,
                    ),
                    factsMaterial(
                        title = "Facts",
                        snippet = longSnippet("F"),
                    ),
                    narrativeMaterial(
                        title = "Wikivoyage",
                        snippet = longSnippet("V"),
                        materialType = PoiSourceMaterialType.WIKIVOYAGE_SUMMARY,
                        sourceRefs = listOf(
                            SourceReference(
                                kind = SourceKind.WIKIVOYAGE,
                                label = "Wikivoyage",
                                value = "fr:Belvedere",
                            ),
                        ),
                    ),
                    narrativeMaterial(
                        title = "Wikipedia",
                        snippet = longSnippet("W"),
                        materialType = PoiSourceMaterialType.WIKIPEDIA_SUMMARY,
                    ),
                ),
            ),
        )

        val enriched = enricher.enrich(
            poi = samplePoi(),
            request = PoiEnrichmentRequest(
                language = Language.FR,
                experiencePreferences = ExperiencePreferences(
                    detailLevel = InterventionDetailLevel.DETAILED,
                ),
            ),
        )

        assertEquals(listOf("Wikipedia", "Wikivoyage", "Facts"), enriched.sourceSummaries.map(SourceSummary::title))
        assertEquals(listOf(SourceKind.WIKIPEDIA, SourceKind.WIKIVOYAGE, SourceKind.WIKIDATA), enriched.sourceSummaries.map(SourceSummary::kind))
        assertTrue(enriched.sourceSummaries[0].snippet.length <= 523)
        assertTrue(enriched.sourceSummaries[1].snippet.length <= 523)
        assertTrue(enriched.sourceSummaries[2].snippet.length <= 263)
        assertTrue(enriched.sourceRefs.any { it.kind == SourceKind.WIKIVOYAGE && it.value == "fr:Belvedere" })
    }

    @Test
    fun `detailed mode reuses one wikidata entity payload and derives exact wikivoyage source`() = runTest {
        val requestCounts = linkedMapOf<String, Int>()
        val httpClient = HttpClient(MockEngine) {
            install(ContentNegotiation) {
                json(DefaultJson)
            }
            engine {
                addHandler { request ->
                    val key = "${request.url.host}${request.url.encodedPath}"
                    requestCounts[key] = requestCounts.getOrDefault(key, 0) + 1
                    when {
                        request.url.host == "fr.wikipedia.org" &&
                            request.url.encodedPath == "/api/rest_v1/page/summary/Abbaye_du_Test" -> respondJson(
                            """
                            {
                              "title": "Abbaye du Test",
                              "extract": "Résumé Wikipédia sur le lieu.",
                              "content_urls": {
                                "desktop": {
                                  "page": "https://fr.wikipedia.org/wiki/Abbaye_du_Test"
                                }
                              }
                            }
                            """.trimIndent(),
                        )
                        request.url.host == "www.wikidata.org" &&
                            request.url.encodedPath == "/wiki/Special:EntityData/Q123.json" -> respondJson(
                            """
                            {
                              "entities": {
                                "Q123": {
                                  "labels": {
                                    "fr": {
                                      "language": "fr",
                                      "value": "Abbaye du Test"
                                    }
                                  },
                                  "descriptions": {
                                    "fr": {
                                      "language": "fr",
                                      "value": "Ancienne abbaye médiévale"
                                    }
                                  },
                                  "sitelinks": {
                                    "frwiki": {
                                      "site": "frwiki",
                                      "title": "Abbaye_du_Test"
                                    },
                                    "frwikivoyage": {
                                      "site": "frwikivoyage",
                                      "title": "Abbaye_du_Test"
                                    }
                                  },
                                  "claims": {
                                    "P31": [
                                      {
                                        "mainsnak": {
                                          "datavalue": {
                                            "value": {
                                              "id": "Q16970"
                                            }
                                          }
                                        }
                                      }
                                    ],
                                    "P571": [
                                      {
                                        "mainsnak": {
                                          "datavalue": {
                                            "value": {
                                              "time": "+1142-01-01T00:00:00Z"
                                            }
                                          }
                                        }
                                      }
                                    ],
                                    "P131": [
                                      {
                                        "mainsnak": {
                                          "datavalue": {
                                            "value": {
                                              "id": "Q142"
                                            }
                                          }
                                        }
                                      }
                                    ]
                                  }
                                }
                              }
                            }
                            """.trimIndent(),
                        )
                        request.url.host == "www.wikidata.org" &&
                            request.url.encodedPath == "/w/api.php" -> {
                            assertEquals("wbgetentities", request.url.parameters["action"])
                            assertEquals(setOf("Q16970", "Q142"), request.url.parameters.getAll("ids").orEmpty().flatMap { it.split("|") }.toSet())
                            respondJson(
                                """
                                {
                                  "entities": {
                                    "Q16970": {
                                      "labels": {
                                        "fr": {
                                          "language": "fr",
                                          "value": "abbaye"
                                        }
                                      }
                                    },
                                    "Q142": {
                                      "labels": {
                                        "fr": {
                                          "language": "fr",
                                          "value": "France"
                                        }
                                      }
                                    }
                                  }
                                }
                                """.trimIndent(),
                            )
                        }
                        request.url.host == "fr.wikivoyage.org" &&
                            request.url.encodedPath == "/api/rest_v1/page/summary/Abbaye_du_Test" -> respondJson(
                            """
                            {
                              "title": "Abbaye du Test",
                              "extract": "Résumé Wikivoyage utile pour la visite.",
                              "content_urls": {
                                "desktop": {
                                  "page": "https://fr.wikivoyage.org/wiki/Abbaye_du_Test"
                                }
                              }
                            }
                            """.trimIndent(),
                        )
                        else -> error("Unexpected request ${request.url}")
                    }
                }
            }
        }

        val poi = samplePoi(
            category = PoiCategory.HISTORIC,
            tags = mapOf(
                "wikipedia" to "fr:Abbaye_du_Test",
                "wikidata" to "Q123",
                "historic" to "monastery",
            ),
        )
        val request = PoiEnrichmentRequest(
            language = Language.FR,
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.DETAILED,
            ),
        )
        val wikipediaMaterials = WikipediaPoiSourceProvider(httpClient).fetchAll(
            poi = poi,
            request = request,
        )
        val wikidataMaterials = WikidataPoiSourceProvider(httpClient).fetchAll(
            poi = poi,
            request = request,
        )
        val materials = wikipediaMaterials + wikidataMaterials

        val observedRequests = requestCounts.toMap()
        assertEquals(
            1,
            requestCounts.filterKeys { it.contains("Special:EntityData/Q123.json") }.values.singleOrNull(),
            "Observed requests: $observedRequests",
        )
        assertEquals(
            1,
            requestCounts.filterKeys { it.endsWith("/w/api.php") }.values.singleOrNull(),
            "Observed requests: $observedRequests",
        )
        assertEquals(
            1,
            requestCounts.filterKeys { it.contains("fr.wikivoyage.org") && it.contains("page/summary/Abbaye_du_Test") }.values.singleOrNull(),
            "Observed requests: $observedRequests",
        )
        assertEquals(
            listOf(
                PoiSourceMaterialType.WIKIPEDIA_SUMMARY,
                PoiSourceMaterialType.WIKIDATA_DESCRIPTION,
                PoiSourceMaterialType.WIKIDATA_FACTS,
                PoiSourceMaterialType.WIKIVOYAGE_SUMMARY,
            ),
            materials.map(PoiSourceMaterial::materialType),
        )
        assertTrue(materials.any { it.summary.kind == SourceKind.WIKIVOYAGE })
        assertTrue(materials.any { it.summary.kind == SourceKind.WIKIDATA && it.summary.snippet.contains("Type : abbaye") })
        assertTrue(materials.flatMap(PoiSourceMaterial::sourceRefs).any { it.kind == SourceKind.WIKIVOYAGE && it.value == "fr:Abbaye_du_Test" })
    }

    private fun samplePoi(
        category: PoiCategory = PoiCategory.VIEWPOINT,
        tags: Map<String, String> = mapOf("wikipedia" to "fr:Belvedere"),
    ): PoiContext =
        PoiContext(
            id = "node/1",
            name = "Belvédère",
            point = GeoPoint(45.0, 6.0),
            category = category,
            tags = tags,
            sourceRefs = emptyList(),
        )

    private fun longSnippet(prefix: String): String =
        buildString {
            repeat(120) { append(prefix) }
            append(" rich context about the place and why it matters for the hike. ")
            repeat(120) { append(prefix) }
        }

    private fun narrativeMaterial(
        title: String,
        snippet: String,
        materialType: PoiSourceMaterialType,
        sourceRefs: List<SourceReference> = emptyList(),
    ): PoiSourceMaterial =
        PoiSourceMaterial(
            summary = SourceSummary(
                kind = when (materialType) {
                    PoiSourceMaterialType.WIKIPEDIA_SUMMARY -> SourceKind.WIKIPEDIA
                    PoiSourceMaterialType.WIKIVOYAGE_SUMMARY -> SourceKind.WIKIVOYAGE
                    PoiSourceMaterialType.WIKIDATA_DESCRIPTION,
                    PoiSourceMaterialType.WIKIDATA_FACTS -> SourceKind.WIKIDATA
                },
                title = title,
                snippet = snippet,
            ),
            sourceRefs = sourceRefs,
            materialType = materialType,
        )

    private fun factsMaterial(
        title: String,
        snippet: String,
    ): PoiSourceMaterial =
        PoiSourceMaterial(
            summary = SourceSummary(
                kind = SourceKind.WIKIDATA,
                title = title,
                snippet = snippet,
            ),
            blockType = PoiSourceBlockType.FACTS,
            materialType = PoiSourceMaterialType.WIKIDATA_FACTS,
        )

    private fun fakeProvider(vararg materials: PoiSourceMaterial): PoiSourceProvider =
        object : PoiSourceProvider {
            override suspend fun fetchAll(poi: PoiContext, request: PoiEnrichmentRequest): List<PoiSourceMaterial> = materials.toList()
        }
}

private fun MockRequestHandleScope.respondJson(body: String) =
    respond(
        content = body,
        status = HttpStatusCode.OK,
        headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
    )
