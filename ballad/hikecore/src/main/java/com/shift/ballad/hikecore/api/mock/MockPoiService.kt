package com.shift.ballad.hikecore.api.mock

import com.shift.ballad.hikecore.api.PoiService
import com.shift.ballad.hikecore.model.GpsCoordinates
import com.shift.ballad.hikecore.model.PoiCategory
import com.shift.ballad.hikecore.model.PointOfInterest
import com.shift.ballad.hikecore.model.SourceKind
import com.shift.ballad.hikecore.model.SourceReference

internal class MockPoiService : PoiService {
    override suspend fun fetchPois(coordinates: GpsCoordinates, radiusMeters: Int): List<PointOfInterest> =
        listOf(
            PointOfInterest(
                name = "Notre-Dame de Paris",
                type = "historic",
                latitude = coordinates.latitude + 0.001,
                longitude = coordinates.longitude + 0.001,
                tags = mapOf("historic" to "cathedral", "wikipedia" to "fr:Cathédrale Notre-Dame de Paris"),
                category = PoiCategory.HISTORIC,
                sourceRefs = listOf(
                    SourceReference(SourceKind.OSM, "Notre-Dame de Paris", "node/123456", "https://www.openstreetmap.org/node/123456"),
                    SourceReference(SourceKind.WIKIPEDIA, "Cathédrale Notre-Dame de Paris", "fr:Cathédrale Notre-Dame de Paris", "https://fr.wikipedia.org/wiki/Cathédrale_Notre-Dame_de_Paris"),
                ),
            ),
            PointOfInterest(
                name = "Tour Eiffel",
                type = "attraction",
                latitude = coordinates.latitude - 0.002,
                longitude = coordinates.longitude - 0.002,
                tags = mapOf("tourism" to "attraction"),
                category = PoiCategory.ATTRACTION,
                sourceRefs = listOf(
                    SourceReference(SourceKind.OSM, "Tour Eiffel", "node/234567", "https://www.openstreetmap.org/node/234567"),
                ),
            ),
            PointOfInterest(
                name = "Musée du Louvre",
                type = "attraction",
                latitude = coordinates.latitude + 0.003,
                longitude = coordinates.longitude - 0.001,
                tags = mapOf("tourism" to "museum"),
                category = PoiCategory.ATTRACTION,
                sourceRefs = listOf(
                    SourceReference(SourceKind.OSM, "Musée du Louvre", "node/345678", "https://www.openstreetmap.org/node/345678"),
                ),
            ),
        )
}
