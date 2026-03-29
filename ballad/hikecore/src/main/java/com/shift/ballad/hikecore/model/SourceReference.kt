package com.shift.ballad.hikecore.model

enum class SourceKind { OSM, WIKIPEDIA, WIKIDATA, WIKIVOYAGE }

data class SourceReference(
    val kind: SourceKind,
    val label: String,
    val value: String,
    val url: String,
)
