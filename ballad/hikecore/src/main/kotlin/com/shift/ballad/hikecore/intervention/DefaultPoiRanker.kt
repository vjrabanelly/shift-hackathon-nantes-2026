package com.shift.ballad.hikecore.intervention

import kotlin.math.min

internal class DefaultPoiRanker : PoiRanker {

    override fun rank(pois: List<PoiContext>, request: InterventionRequest): List<PoiCandidate> =
        pois.map { poi ->
            val distance = GeoUtils.distanceMeters(request.point, poi.point)
            val score = scorePoi(
                poi = poi,
                distanceMeters = distance,
                radiusMeters = request.radiusMeters,
                experiencePreferences = request.experiencePreferences,
            )
            PoiCandidate(
                id = poi.id,
                name = poi.name,
                lat = poi.point.lat,
                lon = poi.point.lon,
                distanceMeters = distance,
                category = poi.category,
                tags = poi.tags,
                sourceRefs = poi.sourceRefs,
                score = score,
            )
        }.sortedByDescending { it.score }

    internal fun scorePoi(
        poi: PoiContext,
        distanceMeters: Int,
        radiusMeters: Int,
        experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
    ): Double {
        val boundedRadius = radiusMeters.coerceAtLeast(1)
        val distanceRatio = (distanceMeters.toDouble() / boundedRadius.toDouble()).coerceIn(0.0, 1.0)
        val distanceScore = (1.0 - distanceRatio) * 40.0
        val nameScore = if (!poi.name.isNullOrBlank()) 20.0 else 0.0
        val descriptiveKeys = listOf(
            "description",
            "ele",
            "historic",
            "tourism",
            "natural",
            "waterway",
            "heritage",
            "wikipedia",
            "wikidata",
        )
        val richnessScore = min(
            descriptiveKeys.count { key -> !poi.tags[key].isNullOrBlank() } * 4.0,
            20.0,
        )
        val categoryScore = when (poi.category) {
            PoiCategory.VIEWPOINT -> 18.0
            PoiCategory.WATERFALL -> 18.0
            PoiCategory.PEAK -> 16.0
            PoiCategory.CAVE -> 14.0
            PoiCategory.HISTORIC -> 12.0
            PoiCategory.ATTRACTION -> 10.0
            PoiCategory.INFORMATION -> 8.0
            PoiCategory.OTHER -> 4.0
        }
        val hasExactExternalSource = poi.sourceRefs.any { it.kind.isExactExternalSource() } ||
            poi.tags.containsKey("wikipedia") ||
            poi.tags.containsKey("wikidata")
        val sourceBonus = if (hasExactExternalSource) 8.0 else 0.0
        val enrichmentBonus = if (poi.sourceSummaries.isNotEmpty()) 6.0 else 0.0
        val exactSourcePenalty = if (hasExactExternalSource) 0.0 else -4.0
        val modeBonus = scoreModeBonus(
            poi = poi,
            mode = experiencePreferences.poiSelectionMode,
            hasExactExternalSource = hasExactExternalSource,
        )

        return distanceScore + nameScore + richnessScore + categoryScore + sourceBonus + enrichmentBonus + exactSourcePenalty + modeBonus
    }

    private fun scoreModeBonus(
        poi: PoiContext,
        mode: PoiSelectionMode,
        hasExactExternalSource: Boolean,
    ): Double {
        if (mode == PoiSelectionMode.BALANCED) {
            return 0.0
        }

        val bonus = when (mode) {
            PoiSelectionMode.BALANCED -> 0.0
            PoiSelectionMode.NATURE -> {
                categoryWeight(
                    poi = poi,
                    primary = mapOf(
                        PoiCategory.VIEWPOINT to 8.0,
                        PoiCategory.WATERFALL to 8.0,
                        PoiCategory.PEAK to 7.0,
                        PoiCategory.CAVE to 6.0,
                    ),
                ) +
                    tagPresenceBonus(poi, "natural", "waterway", "ele", "geological", "river", "ridge") +
                    sourceKeywordBonus(poi, "nature", "waterfall", "peak", "mountain", "valley", "forest", "lake")
            }
            PoiSelectionMode.HISTORY -> {
                categoryWeight(
                    poi = poi,
                    primary = mapOf(PoiCategory.HISTORIC to 9.0),
                ) +
                    tagPresenceBonus(poi, "historic", "heritage", "start_date", "wikidata", "wikipedia") +
                    sourceKeywordBonus(poi, "history", "historic", "monument", "heritage", "century", "battle", "church")
            }
            PoiSelectionMode.ARCHITECTURE -> {
                categoryWeight(
                    poi = poi,
                    primary = mapOf(
                        PoiCategory.HISTORIC to 7.0,
                        PoiCategory.ATTRACTION to 5.0,
                        PoiCategory.INFORMATION to 4.0,
                    ),
                ) +
                    tagPresenceBonus(poi, "building", "architect", "architecture", "heritage", "historic", "wikidata", "wikipedia") +
                    sourceKeywordBonus(poi, "architecture", "architect", "facade", "building", "cathedral", "bridge")
            }
            PoiSelectionMode.PANORAMA -> {
                categoryWeight(
                    poi = poi,
                    primary = mapOf(
                        PoiCategory.VIEWPOINT to 10.0,
                        PoiCategory.PEAK to 7.0,
                    ),
                ) +
                    tagPresenceBonus(poi, "tourism", "ele", "natural") +
                    sourceKeywordBonus(poi, "view", "viewpoint", "panorama", "belvedere", "summit", "ridge")
            }
            PoiSelectionMode.CUSTOM -> 0.0
        }

        return bonus + if (hasExactExternalSource) 1.5 else 0.0
    }

    private fun categoryWeight(
        poi: PoiContext,
        primary: Map<PoiCategory, Double>,
    ): Double = primary[poi.category] ?: 0.0

    private fun tagPresenceBonus(poi: PoiContext, vararg keys: String): Double =
        min(keys.count { key -> !poi.tags[key].isNullOrBlank() } * 1.5, 5.0)

    private fun sourceKeywordBonus(poi: PoiContext, vararg keywords: String): Double {
        val haystacks = buildList {
            addAll(poi.tags.values)
            addAll(poi.sourceSummaries.map(SourceSummary::title))
            addAll(poi.sourceSummaries.map(SourceSummary::snippet))
        }.joinToString(separator = " ").lowercase()

        return min(keywords.count { keyword -> keyword.lowercase() in haystacks } * 1.3, 5.0)
    }
}

private fun SourceKind.isExactExternalSource(): Boolean =
    this == SourceKind.WIKIPEDIA || this == SourceKind.WIKIDATA || this == SourceKind.WIKIVOYAGE
