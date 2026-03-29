package com.shift.ballad.ui.settings

import com.shift.ballad.settings.ExperiencePreferences
import com.shift.ballad.settings.PoiCategorySelection

data class SettingsUiState(
    val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
    val poiCategorySelection: PoiCategorySelection = PoiCategorySelection(),
    val audioGuidanceEnabled: Boolean = true,
)
