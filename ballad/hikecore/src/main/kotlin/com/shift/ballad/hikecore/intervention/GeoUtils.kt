package com.shift.ballad.hikecore.intervention

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

internal object GeoUtils {
    private const val EarthRadiusMeters = 6_371_000.0

    fun distanceMeters(from: GeoPoint, to: GeoPoint): Int {
        val dLat = Math.toRadians(to.lat - from.lat)
        val dLon = Math.toRadians(to.lon - from.lon)
        val lat1 = Math.toRadians(from.lat)
        val lat2 = Math.toRadians(to.lat)

        val a = sin(dLat / 2).pow(2.0) +
            cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2.0)
        val c = 2 * asin(min(1.0, sqrt(a)))
        return (EarthRadiusMeters * c).roundToInt()
    }
}
