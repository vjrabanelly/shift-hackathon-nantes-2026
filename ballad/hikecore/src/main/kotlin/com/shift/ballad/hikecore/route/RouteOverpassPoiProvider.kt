package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.OverpassElement
import com.shift.ballad.hikecore.intervention.OverpassPoiProvider
import com.shift.ballad.hikecore.intervention.OverpassRequestException
import com.shift.ballad.hikecore.intervention.OverpassResponse
import com.shift.ballad.hikecore.intervention.AllSelectablePoiCategories
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.PoiContext
import com.shift.ballad.hikecore.intervention.buildOverpassQuery
import com.shift.ballad.hikecore.intervention.mapOverpassElementsToPoiContexts
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.Parameters
import io.ktor.http.contentType
import io.ktor.http.formUrlEncode
import io.ktor.http.headers
import io.ktor.http.isSuccess
import java.io.IOException
import kotlinx.coroutines.delay

internal interface RoutePoiProvider {
    suspend fun findPois(
        bounds: RouteBounds,
        allowedCategories: Set<PoiCategory>,
    ): List<PoiContext>
}

internal class RouteOverpassPoiProvider(
    private val httpClient: HttpClient,
    private val endpoints: List<String> = OverpassPoiProvider.DEFAULT_ENDPOINTS,
    private val maxAttemptsPerEndpoint: Int = 2,
    private val retryBaseDelayMillis: Long = 350,
) : RoutePoiProvider {

    override suspend fun findPois(bounds: RouteBounds, allowedCategories: Set<PoiCategory>): List<PoiContext> {
        if (allowedCategories.isEmpty()) {
            return emptyList()
        }
        val query = buildQuery(bounds, allowedCategories)
        val endpointPool = endpoints
            .map(String::trim)
            .filter(String::isNotBlank)
            .ifEmpty { OverpassPoiProvider.DEFAULT_ENDPOINTS }
        val failures = mutableListOf<String>()

        endpointPool.forEach { endpoint ->
            repeat(maxAttemptsPerEndpoint) { attemptIndex ->
                val attemptNumber = attemptIndex + 1
                val result = runCatching { executeRequest(endpoint, query) }
                val payload = result.getOrNull()
                if (payload != null) {
                    return mapOverpassElementsToPoiContexts(payload.elements, allowedCategories)
                }

                val failure = result.exceptionOrNull() ?: IllegalStateException("Unknown Overpass error")
                failures += "${endpoint}#${attemptNumber}: ${failure.message ?: failure::class.simpleName.orEmpty()}"

                if (!isRetryable(failure)) {
                    throw failure
                }

                if (attemptNumber < maxAttemptsPerEndpoint) {
                    delay(retryBaseDelayMillis * attemptNumber)
                }
            }
        }

        throw IllegalStateException(
            "Route Overpass request failed after ${endpointPool.size} endpoint(s): ${failures.joinToString(" | ")}",
        )
    }

    private suspend fun executeRequest(endpoint: String, query: String): OverpassResponse {
        val response = httpClient.post(endpoint) {
            contentType(ContentType.Application.FormUrlEncoded)
            headers {
                append(HttpHeaders.Accept, ContentType.Application.Json.toString())
                append(HttpHeaders.UserAgent, "HikeBuddy/0.1")
            }
            setBody(Parameters.build { append("data", query) }.formUrlEncode())
        }

        if (!response.status.isSuccess()) {
            throw OverpassRequestException(
                endpoint = endpoint,
                statusCode = response.status.value,
                responseBody = response.bodyAsText(),
            )
        }

        return response.body()
    }

    private fun isRetryable(exception: Throwable): Boolean =
        when (exception) {
            is OverpassRequestException -> exception.statusCode == 429 || exception.statusCode in 500..599
            is IOException -> true
            else -> false
    }

    companion object {
        fun buildQuery(
            bounds: RouteBounds,
            allowedCategories: Set<PoiCategory> = AllSelectablePoiCategories,
        ): String =
            buildOverpassQuery(allowedCategories) { filter ->
                listOf(
                    "node(${bounds.south},${bounds.west},${bounds.north},${bounds.east})$filter;",
                    "way(${bounds.south},${bounds.west},${bounds.north},${bounds.east})$filter;",
                    "rel(${bounds.south},${bounds.west},${bounds.north},${bounds.east})$filter;",
                )
            }
    }
}
