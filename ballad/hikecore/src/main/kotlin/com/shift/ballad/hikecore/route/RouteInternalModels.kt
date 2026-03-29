package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.PoiContext

internal data class RoutePoiCandidateContext(
    val poi: PoiContext,
    val projectedPoint: GeoPoint,
    val distanceAlongRouteMeters: Double,
    val distanceToRouteMeters: Double,
    val nearestSegmentIndex: Int,
    val windowIndex: Int,
    val deterministicScore: Double,
    val llmBonus: Double = 0.0,
) {
    val totalScore: Double
        get() = deterministicScore + llmBonus
}
