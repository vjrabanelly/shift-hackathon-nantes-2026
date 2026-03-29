package com.shift.ballad.settings

import kotlinx.coroutines.flow.StateFlow

interface InterventionSettingsRepository {
    val snapshots: StateFlow<InterventionSettingsSnapshot>

    fun currentSnapshot(): InterventionSettingsSnapshot = snapshots.value

    suspend fun setPoiCategoryEnabled(category: SelectablePoiCategory, enabled: Boolean)

    suspend fun setPoiSelectionMode(mode: PoiSelectionMode)

    suspend fun setInterventionDetailLevel(level: InterventionDetailLevel)

    suspend fun setUserAgeRange(ageRange: UserAgeRange)

    suspend fun setAudioGuidanceEnabled(enabled: Boolean)

    suspend fun setPoiDiscoveryPreferences(preferences: PoiDiscoveryPreferences) {
        SelectablePoiCategory.entries.forEach { category ->
            setPoiCategoryEnabled(category, preferences.categories.isEnabled(category))
        }
    }

    suspend fun setExperiencePreferences(preferences: ExperiencePreferences) {
        setPoiSelectionMode(preferences.poiSelectionMode)
        setInterventionDetailLevel(preferences.detailLevel)
        setUserAgeRange(preferences.ageRange)
    }
}
