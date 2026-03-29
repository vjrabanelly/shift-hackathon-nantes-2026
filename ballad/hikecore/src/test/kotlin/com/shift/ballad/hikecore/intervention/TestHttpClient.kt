package com.shift.ballad.hikecore.intervention

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json

internal fun mockJsonClient(
    status: HttpStatusCode = HttpStatusCode.OK,
    body: String,
): HttpClient =
    HttpClient(MockEngine) {
        install(ContentNegotiation) {
            json(DefaultJson)
        }
        engine {
            addHandler { request ->
                respond(
                    content = body,
                    status = status,
                    headers = headersOf("Content-Type", ContentType.Application.Json.toString()),
                )
            }
        }
    }
