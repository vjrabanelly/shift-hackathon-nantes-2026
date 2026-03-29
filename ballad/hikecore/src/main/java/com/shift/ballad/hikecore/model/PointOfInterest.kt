package com.shift.ballad.hikecore.model

data class PointOfInterest(
    val name: String?,
    val type: String,
    val latitude: Double,
    val longitude: Double,
    val tags: Map<String, String> = emptyMap(),
    val category: PoiCategory,
    val sourceRefs: List<SourceReference> = emptyList(),
)
