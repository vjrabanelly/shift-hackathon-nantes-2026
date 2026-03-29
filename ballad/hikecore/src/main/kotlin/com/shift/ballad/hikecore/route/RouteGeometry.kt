package com.shift.ballad.hikecore.route

import com.shift.ballad.hikecore.intervention.GeoPoint
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

internal data class RouteNode(
    val point: GeoPoint,
    val elevationMeters: Double? = null,
)

internal data class RoutePoint(
    val point: GeoPoint,
    val elevationMeters: Double? = null,
    val distanceAlongRouteMeters: Double,
)

internal data class RouteProjection(
    val projectedPoint: GeoPoint,
    val distanceAlongRouteMeters: Double,
    val distanceToRouteMeters: Double,
    val nearestSegmentIndex: Int,
)

internal data class RouteWindow(
    val index: Int,
    val startMeters: Double,
    val endMeters: Double,
    val bounds: RouteBounds,
)

internal object RouteGeometry {
    private const val EarthRadiusMeters = 6_371_000.0

    fun simplify(nodes: List<RouteNode>, toleranceMeters: Double = 15.0): List<RouteNode> {
        if (nodes.size <= 2) return nodes.distinctBy { "${it.point.lat},${it.point.lon}" }

        val simplified = mutableListOf(nodes.first())
        for (index in 1 until nodes.lastIndex) {
            val previous = simplified.last()
            val current = nodes[index]
            val next = nodes[index + 1]
            val distanceFromPrevious = distanceMeters(previous.point, current.point)
            val turnAngle = turnAngleDegrees(previous.point, current.point, next.point)
            if (distanceFromPrevious >= toleranceMeters || turnAngle >= 22.5) {
                simplified += current
            }
        }

        val last = nodes.last()
        if (simplified.last().point != last.point) {
            simplified += last
        }

        return simplified
    }

    fun withChainage(nodes: List<RouteNode>): List<RoutePoint> {
        if (nodes.isEmpty()) return emptyList()

        var cumulative = 0.0
        val result = mutableListOf<RoutePoint>()
        nodes.forEachIndexed { index, node ->
            if (index > 0) {
                cumulative += distanceMeters(nodes[index - 1].point, node.point)
            }
            result += RoutePoint(
                point = node.point,
                elevationMeters = node.elevationMeters,
                distanceAlongRouteMeters = cumulative,
            )
        }
        return result
    }

    fun bounds(points: List<GeoPoint>, paddingMeters: Int = 0): RouteBounds {
        require(points.isNotEmpty()) { "points must not be empty" }

        val south = points.minOf { it.lat }
        val north = points.maxOf { it.lat }
        val west = points.minOf { it.lon }
        val east = points.maxOf { it.lon }

        if (paddingMeters <= 0) {
            return RouteBounds(south = south, west = west, north = north, east = east)
        }

        val referenceLat = (south + north) / 2.0
        val latPad = paddingMeters / 111_320.0
        val lonPad = paddingMeters / max(111_320.0 * cos(Math.toRadians(referenceLat)), 1.0)
        return RouteBounds(
            south = south - latPad,
            west = west - lonPad,
            north = north + latPad,
            east = east + lonPad,
        )
    }

    fun mergedBounds(bounds: List<RouteBounds>): RouteBounds {
        require(bounds.isNotEmpty()) { "bounds must not be empty" }
        return RouteBounds(
            south = bounds.minOf { it.south },
            west = bounds.minOf { it.west },
            north = bounds.maxOf { it.north },
            east = bounds.maxOf { it.east },
        )
    }

    fun windows(
        routePoints: List<RoutePoint>,
        windowSizeMeters: Int,
        paddingMeters: Int,
    ): List<RouteWindow> {
        require(routePoints.isNotEmpty()) { "routePoints must not be empty" }
        val routeLengthMeters = routePoints.last().distanceAlongRouteMeters
        val windowCount = max(1, ceil(routeLengthMeters / windowSizeMeters.toDouble()).toInt())

        return List(windowCount) { index ->
            val startMeters = index * windowSizeMeters.toDouble()
            val endMeters = min(routeLengthMeters, startMeters + windowSizeMeters)
            val slice = slice(routePoints, startMeters, endMeters).map { it.point }
            RouteWindow(
                index = index,
                startMeters = startMeters,
                endMeters = endMeters,
                bounds = bounds(slice, paddingMeters),
            )
        }
    }

    fun slice(routePoints: List<RoutePoint>, startMeters: Double, endMeters: Double): List<RoutePoint> {
        if (routePoints.isEmpty()) return emptyList()
        val startIndex = routePoints.indexOfLast { it.distanceAlongRouteMeters <= startMeters }.coerceAtLeast(0)
        val endIndex = routePoints.indexOfFirst { it.distanceAlongRouteMeters >= endMeters }
            .let { if (it == -1) routePoints.lastIndex else it }
            .coerceAtLeast(startIndex)
        return routePoints.subList(startIndex, endIndex + 1)
    }

    fun project(point: GeoPoint, routePoints: List<RoutePoint>): RouteProjection? {
        if (routePoints.isEmpty()) return null
        if (routePoints.size == 1) {
            return RouteProjection(
                projectedPoint = routePoints.first().point,
                distanceAlongRouteMeters = 0.0,
                distanceToRouteMeters = distanceMeters(point, routePoints.first().point),
                nearestSegmentIndex = 0,
            )
        }

        var bestDistance = Double.MAX_VALUE
        var bestProjectedPoint = routePoints.first().point
        var bestAlongRoute = 0.0
        var bestSegmentIndex = 0

        for (segmentIndex in 0 until routePoints.lastIndex) {
            val start = routePoints[segmentIndex]
            val end = routePoints[segmentIndex + 1]
            val segmentLength = distanceMeters(start.point, end.point)
            if (segmentLength <= 0.0) continue

            val referenceLat = Math.toRadians((start.point.lat + end.point.lat + point.lat) / 3.0)
            val startVector = projectedMeters(start.point, start.point, referenceLat)
            val endVector = projectedMeters(end.point, start.point, referenceLat)
            val pointVector = projectedMeters(point, start.point, referenceLat)

            val segmentX = endVector.first - startVector.first
            val segmentY = endVector.second - startVector.second
            val pointX = pointVector.first - startVector.first
            val pointY = pointVector.second - startVector.second
            val dot = pointX * segmentX + pointY * segmentY
            val segmentNorm = segmentX * segmentX + segmentY * segmentY
            val projectionRatio = if (segmentNorm == 0.0) 0.0 else (dot / segmentNorm).coerceIn(0.0, 1.0)
            val projectedX = startVector.first + projectionRatio * segmentX
            val projectedY = startVector.second + projectionRatio * segmentY
            val deltaX = pointVector.first - projectedX
            val deltaY = pointVector.second - projectedY
            val distanceToSegment = sqrt(deltaX * deltaX + deltaY * deltaY)

            if (distanceToSegment < bestDistance) {
                bestDistance = distanceToSegment
                bestProjectedPoint = GeoPoint(
                    lat = start.point.lat + projectionRatio * (end.point.lat - start.point.lat),
                    lon = start.point.lon + projectionRatio * (end.point.lon - start.point.lon),
                )
                bestAlongRoute = start.distanceAlongRouteMeters + projectionRatio * segmentLength
                bestSegmentIndex = segmentIndex
            }
        }

        return RouteProjection(
            projectedPoint = bestProjectedPoint,
            distanceAlongRouteMeters = bestAlongRoute,
            distanceToRouteMeters = bestDistance,
            nearestSegmentIndex = bestSegmentIndex,
        )
    }

    fun distanceMeters(from: GeoPoint, to: GeoPoint): Double {
        val latitudeDelta = Math.toRadians(to.lat - from.lat)
        val longitudeDelta = Math.toRadians(to.lon - from.lon)
        val fromLat = Math.toRadians(from.lat)
        val toLat = Math.toRadians(to.lat)
        val a = sin(latitudeDelta / 2.0) * sin(latitudeDelta / 2.0) +
            cos(fromLat) * cos(toLat) * sin(longitudeDelta / 2.0) * sin(longitudeDelta / 2.0)
        val c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
        return EarthRadiusMeters * c
    }

    private fun projectedMeters(
        point: GeoPoint,
        origin: GeoPoint,
        referenceLatRadians: Double,
    ): Pair<Double, Double> {
        val x = Math.toRadians(point.lon - origin.lon) * EarthRadiusMeters * cos(referenceLatRadians)
        val y = Math.toRadians(point.lat - origin.lat) * EarthRadiusMeters
        return x to y
    }

    private fun turnAngleDegrees(previous: GeoPoint, current: GeoPoint, next: GeoPoint): Double {
        val inbound = bearingRadians(previous, current)
        val outbound = bearingRadians(current, next)
        val delta = abs(inbound - outbound)
        val normalized = min(delta, (2.0 * PI) - delta)
        return Math.toDegrees(normalized)
    }

    private fun bearingRadians(from: GeoPoint, to: GeoPoint): Double {
        val fromLat = Math.toRadians(from.lat)
        val toLat = Math.toRadians(to.lat)
        val deltaLon = Math.toRadians(to.lon - from.lon)
        val y = sin(deltaLon) * cos(toLat)
        val x = cos(fromLat) * sin(toLat) - sin(fromLat) * cos(toLat) * cos(deltaLon)
        return atan2(y, x)
    }
}

internal fun Double.roundToIntMeters(): Int = roundToInt()
