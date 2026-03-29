package com.shift.ballad.settings

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class SelectablePoiCategory {
    VIEWPOINT,
    PEAK,
    WATERFALL,
    CAVE,
    HISTORIC,
    ATTRACTION,
    INFORMATION,
}

@Serializable
enum class PoiSelectionMode {
    @SerialName("balanced")
    BALANCED,

    @SerialName("nature")
    NATURE,

    @SerialName("history")
    HISTORY,

    @SerialName("architecture")
    ARCHITECTURE,

    @SerialName("panorama")
    PANORAMA,

    @SerialName("custom")
    CUSTOM,
}

@Serializable
enum class InterventionDetailLevel {
    @SerialName("short")
    SHORT,

    @SerialName("balanced")
    BALANCED,

    @SerialName("detailed")
    DETAILED,
}

@Serializable
enum class UserAgeRange {
    @SerialName("adult")
    ADULT,

    @SerialName("15_18")
    AGE_15_18,

    @SerialName("12_14")
    AGE_12_14,

    @SerialName("8_11")
    AGE_8_11,

    @SerialName("under_8")
    UNDER_8,
}

fun PoiSelectionMode.defaultCategorySelection(): PoiCategorySelection? =
    when (this) {
        PoiSelectionMode.BALANCED -> PoiCategorySelection()
        PoiSelectionMode.NATURE -> PoiCategorySelection(
            viewpoint = true, waterfall = true, peak = true, cave = true,
            historic = false, attraction = false, information = false,
        )
        PoiSelectionMode.HISTORY -> PoiCategorySelection(
            viewpoint = false, waterfall = false, peak = false, cave = false,
            historic = true, attraction = true, information = false,
        )
        PoiSelectionMode.ARCHITECTURE -> PoiCategorySelection(
            viewpoint = false, waterfall = false, peak = false, cave = false,
            historic = true, attraction = true, information = true,
        )
        PoiSelectionMode.PANORAMA -> PoiCategorySelection(
            viewpoint = true, waterfall = false, peak = true, cave = false,
            historic = false, attraction = false, information = false,
        )
        PoiSelectionMode.CUSTOM -> null
    }

fun InterventionDetailLevel.triggerRadiusMeters(): Int =
    when (this) {
        InterventionDetailLevel.SHORT -> 10
        InterventionDetailLevel.BALANCED -> 20
        InterventionDetailLevel.DETAILED -> 35
    }

@Serializable
data class ExperiencePreferences(
    val detailLevel: InterventionDetailLevel = InterventionDetailLevel.BALANCED,
    val poiSelectionMode: PoiSelectionMode = PoiSelectionMode.BALANCED,
    val ageRange: UserAgeRange = UserAgeRange.ADULT,
)

@Serializable
data class PoiCategorySelection(
    val viewpoint: Boolean = true,
    val peak: Boolean = true,
    val waterfall: Boolean = true,
    val cave: Boolean = true,
    val historic: Boolean = true,
    val attraction: Boolean = true,
    val information: Boolean = true,
) {
    fun isEnabled(category: SelectablePoiCategory): Boolean =
        when (category) {
            SelectablePoiCategory.VIEWPOINT -> viewpoint
            SelectablePoiCategory.PEAK -> peak
            SelectablePoiCategory.WATERFALL -> waterfall
            SelectablePoiCategory.CAVE -> cave
            SelectablePoiCategory.HISTORIC -> historic
            SelectablePoiCategory.ATTRACTION -> attraction
            SelectablePoiCategory.INFORMATION -> information
        }

    fun withCategory(category: SelectablePoiCategory, enabled: Boolean): PoiCategorySelection =
        when (category) {
            SelectablePoiCategory.VIEWPOINT -> copy(viewpoint = enabled)
            SelectablePoiCategory.PEAK -> copy(peak = enabled)
            SelectablePoiCategory.WATERFALL -> copy(waterfall = enabled)
            SelectablePoiCategory.CAVE -> copy(cave = enabled)
            SelectablePoiCategory.HISTORIC -> copy(historic = enabled)
            SelectablePoiCategory.ATTRACTION -> copy(attraction = enabled)
            SelectablePoiCategory.INFORMATION -> copy(information = enabled)
        }

    fun enabledCategories(): Set<SelectablePoiCategory> =
        buildSet {
            if (viewpoint) add(SelectablePoiCategory.VIEWPOINT)
            if (peak) add(SelectablePoiCategory.PEAK)
            if (waterfall) add(SelectablePoiCategory.WATERFALL)
            if (cave) add(SelectablePoiCategory.CAVE)
            if (historic) add(SelectablePoiCategory.HISTORIC)
            if (attraction) add(SelectablePoiCategory.ATTRACTION)
            if (information) add(SelectablePoiCategory.INFORMATION)
        }
}

@Serializable
data class PoiDiscoveryPreferences(
    val categories: PoiCategorySelection = PoiCategorySelection(),
) {
    fun enabledCategories(): Set<SelectablePoiCategory> = categories.enabledCategories()

    fun hasEnabledCategories(): Boolean = enabledCategories().isNotEmpty()

    fun withCategory(category: SelectablePoiCategory, enabled: Boolean): PoiDiscoveryPreferences =
        copy(categories = categories.withCategory(category, enabled))
}

@Serializable
data class InterventionSettingsSnapshot(
    val promptInstructions: String = DefaultInterventionSettings.promptInstructions,
    val userPreferencesJson: String = DefaultInterventionSettings.userPreferencesJson,
    val poiDiscoveryPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
    val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
    val audioGuidanceEnabled: Boolean = true,
)

object DefaultInterventionSettings {
    val promptInstructions: String = """
        Tu es Hike Buddy. Génère une intervention audio adaptée au niveau de détail demandé, concrète et agréable à entendre pendant une randonnée.
        Privilégie ce qui aide à vivre le lieu maintenant : effort, point de vue, repère proche, ou anecdote locale si elle est solidement appuyée par les sources.
        Évite les formulations trop marketing ou théâtrales.
    """.trimIndent()

    val userPreferencesJson: String = """
        {
          "tone": "warm",
          "energy": "calm",
          "likes_history": true,
          "likes_nature": true,
          "max_length_sentences": 3,
          "poi_selection_mode": "balanced",
          "intervention_detail_level": "balanced",
          "user_age_range": "adult"
        }
    """.trimIndent()

    val snapshot: InterventionSettingsSnapshot = InterventionSettingsSnapshot(
        promptInstructions = promptInstructions,
        userPreferencesJson = userPreferencesJson,
        poiDiscoveryPreferences = PoiDiscoveryPreferences(),
        experiencePreferences = ExperiencePreferences(),
    )
}
