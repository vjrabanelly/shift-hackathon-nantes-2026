package com.shift.ballad.hikecore.api

import com.shift.ballad.hikecore.model.GpsCoordinates
import com.shift.ballad.hikecore.model.PointOfInterest

internal interface PoiService {
    suspend fun fetchPois(coordinates: GpsCoordinates, radiusMeters: Int): List<PointOfInterest>
}
