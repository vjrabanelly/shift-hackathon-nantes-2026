package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.GeoPoint
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class RouteGeometryTest {

    @Test
    fun `project returns the closest point on the route for an off-route POI`() {
        val routePoints = RouteGeometry.withChainage(
            listOf(
                RouteNode(point = pointOnRoute(0.0)),
                RouteNode(point = pointOnRoute(1_000.0)),
            ),
        )

        val projection = assertNotNull(
            RouteGeometry.project(
                point = pointOffRoute(distanceMetersAlong = 500.0, offsetMeters = 35.0),
                routePoints = routePoints,
            ),
        )

        assertEquals(pointOnRoute(500.0).lat, projection.projectedPoint.lat, absoluteTolerance = 0.00001)
        assertEquals(BASE_LON, projection.projectedPoint.lon, absoluteTolerance = 0.000001)
        assertTrue(projection.distanceToRouteMeters >= 30.0)
        assertTrue(projection.distanceAlongRouteMeters in 490.0..510.0)
    }

    @Test
    fun `project keeps the same point when the POI is already on the route`() {
        val routePoint = pointOnRoute(320.0)
        val routePoints = RouteGeometry.withChainage(
            listOf(
                RouteNode(point = pointOnRoute(0.0)),
                RouteNode(point = pointOnRoute(1_000.0)),
            ),
        )

        val projection = assertNotNull(RouteGeometry.project(routePoint, routePoints))

        assertEquals(routePoint.lat, projection.projectedPoint.lat, absoluteTolerance = 0.0000001)
        assertEquals(routePoint.lon, projection.projectedPoint.lon, absoluteTolerance = 0.0000001)
        assertTrue(projection.distanceToRouteMeters <= 0.1)
        assertTrue(projection.distanceAlongRouteMeters in 315.0..325.0)
    }

    private fun pointOnRoute(distanceMeters: Double): GeoPoint =
        GeoPoint(
            lat = BASE_LAT + distanceMeters / METERS_PER_DEGREE_LAT,
            lon = BASE_LON,
        )

    private fun pointOffRoute(distanceMetersAlong: Double, offsetMeters: Double): GeoPoint =
        GeoPoint(
            lat = BASE_LAT + distanceMetersAlong / METERS_PER_DEGREE_LAT,
            lon = BASE_LON + offsetMeters / METERS_PER_DEGREE_LON,
        )

    companion object {
        private const val BASE_LAT = 47.0
        private const val BASE_LON = -1.0
        private const val METERS_PER_DEGREE_LAT = 111_320.0
        private const val METERS_PER_DEGREE_LON = 75_918.64
    }
}
