package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.intervention.ExperiencePreferences
import com.shift.ballad.hikecore.intervention.PoiDiscoveryPreferences
import com.shift.ballad.hikecore.intervention.PoiCategory
import com.shift.ballad.hikecore.intervention.SourceReference
import com.shift.ballad.hikecore.intervention.SourceSummary
import kotlinx.serialization.Serializable

@Serializable
data class RoutePoiDiscoveryRequest(
    val gpxXml: String,
    val language: Language = Language.FR,
    val maxPoisPerKm: Int = 4,
    val routeBufferMeters: Int = 100,
    val llmScoringEnabled: Boolean = true,
    val poiPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
    val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
) {
    init {
        require(gpxXml.isNotBlank()) { "gpxXml must not be blank" }
        require(maxPoisPerKm > 0) { "maxPoisPerKm must be > 0" }
        require(routeBufferMeters > 0) { "routeBufferMeters must be > 0" }
    }
}

@Serializable
data class RouteBounds(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
)

@Serializable
data class GpxWaypoint(
    val lat: Double,
    val lon: Double,
    val elevationMeters: Double? = null,
    val name: String? = null,
    val description: String? = null,
    val comment: String? = null,
    val symbol: String? = null,
    val linkUrl: String? = null,
    val linkText: String? = null,
    val linkType: String? = null,
    val distanceAlongRouteMeters: Int? = null,
    val distanceToRouteMeters: Int? = null,
)

@Serializable
data class DiscoveredRoutePoi(
    val id: String,
    val name: String?,
    val lat: Double,
    val lon: Double,
    val category: PoiCategory,
    val tags: Map<String, String>,
    val sourceRefs: List<SourceReference>,
    val sourceSummaries: List<SourceSummary>,
    val score: Double,
    val distanceAlongRouteMeters: Int,
    val distanceToRouteMeters: Int,
    val nearestSegmentIndex: Int,
)

@Serializable
data class RoutePoiDiscoveryResult(
    val routeLengthMeters: Int,
    val routeBounds: RouteBounds,
    val discoveredPois: List<DiscoveredRoutePoi>,
    val gpxWaypoints: List<GpxWaypoint>,
)

@Serializable
data class RoutePoiMetadata(
    val assetId: String,
    val poiName: String?,
    val category: PoiCategory,
    val descriptionText: String,
    val lat: Double,
    val lon: Double,
)

@Serializable
data class RouteMetadata(
    val pois: List<RoutePoiMetadata>,
)
