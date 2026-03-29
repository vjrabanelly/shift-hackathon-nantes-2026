package com.shift.ballad.intervention

import android.content.SharedPreferences
import androidx.core.content.edit
import com.shift.ballad.settings.DefaultInterventionSettings
import com.shift.ballad.settings.ExperiencePreferences
import com.shift.ballad.settings.ExperiencePreferencesJson
import com.shift.ballad.settings.InterventionDetailLevel
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.InterventionSettingsSnapshot
import com.shift.ballad.settings.PoiCategorySelection
import com.shift.ballad.settings.PoiDiscoveryPreferences
import com.shift.ballad.settings.PoiSelectionMode
import com.shift.ballad.settings.defaultCategorySelection
import com.shift.ballad.settings.SelectablePoiCategory
import com.shift.ballad.settings.interventionDetailLevelFromSerializedValue
import com.shift.ballad.settings.poiSelectionModeFromSerializedValue
import com.shift.ballad.settings.serializedValue
import com.shift.ballad.settings.userAgeRangeFromSerializedValue
import com.shift.ballad.settings.UserAgeRange
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SharedPreferencesInterventionSettingsRepository(
    private val sharedPreferences: SharedPreferences,
) : InterventionSettingsRepository {

    private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        _snapshots.value = readSnapshot()
    }

    private val _snapshots = MutableStateFlow(readSnapshot())
    override val snapshots: StateFlow<InterventionSettingsSnapshot> = _snapshots.asStateFlow()

    init {
        sharedPreferences.registerOnSharedPreferenceChangeListener(listener)
    }

    override suspend fun setPoiCategoryEnabled(category: SelectablePoiCategory, enabled: Boolean) {
        sharedPreferences.edit {
            putBoolean(storageKey(category), enabled)
        }
        _snapshots.value = readSnapshot()
    }

    override suspend fun setPoiSelectionMode(mode: PoiSelectionMode) {
        val defaultSelection = mode.defaultCategorySelection()
        sharedPreferences.edit {
            putString(AndroidInterventionSettingsStorage.KEY_POI_SELECTION_MODE, mode.serializedValue)
            if (defaultSelection != null) {
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_VIEWPOINT, defaultSelection.viewpoint)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_PEAK, defaultSelection.peak)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_WATERFALL, defaultSelection.waterfall)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_CAVE, defaultSelection.cave)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_HISTORIC, defaultSelection.historic)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_ATTRACTION, defaultSelection.attraction)
                putBoolean(AndroidInterventionSettingsStorage.KEY_POI_INFORMATION, defaultSelection.information)
            }
        }
        _snapshots.value = readSnapshot()
    }

    override suspend fun setInterventionDetailLevel(level: InterventionDetailLevel) {
        sharedPreferences.edit {
            putString(AndroidInterventionSettingsStorage.KEY_INTERVENTION_DETAIL_LEVEL, level.serializedValue)
        }
        _snapshots.value = readSnapshot()
    }

    override suspend fun setUserAgeRange(ageRange: UserAgeRange) {
        sharedPreferences.edit {
            putString(AndroidInterventionSettingsStorage.KEY_USER_AGE_RANGE, ageRange.serializedValue)
        }
        _snapshots.value = readSnapshot()
    }

    override suspend fun setAudioGuidanceEnabled(enabled: Boolean) {
        sharedPreferences.edit {
            putBoolean(AndroidInterventionSettingsStorage.KEY_AUDIO_GUIDANCE_ENABLED, enabled)
        }
        _snapshots.value = readSnapshot()
    }

    private fun readSnapshot(): InterventionSettingsSnapshot {
        val rawPreferencesJson = sharedPreferences.getString(
            AndroidInterventionSettingsStorage.KEY_USER_PREFERENCES_JSON,
            DefaultInterventionSettings.userPreferencesJson,
        ) ?: DefaultInterventionSettings.userPreferencesJson
        val inferredExperience = ExperiencePreferencesJson.parse(rawPreferencesJson)
        val experiencePreferences = ExperiencePreferences(
            detailLevel = interventionDetailLevelFromSerializedValue(
                sharedPreferences.getString(
                    AndroidInterventionSettingsStorage.KEY_INTERVENTION_DETAIL_LEVEL,
                    null,
                ),
            ) ?: inferredExperience.detailLevel,
            poiSelectionMode = poiSelectionModeFromSerializedValue(
                sharedPreferences.getString(
                    AndroidInterventionSettingsStorage.KEY_POI_SELECTION_MODE,
                    null,
                ),
            ) ?: inferredExperience.poiSelectionMode,
            ageRange = userAgeRangeFromSerializedValue(
                sharedPreferences.getString(
                    AndroidInterventionSettingsStorage.KEY_USER_AGE_RANGE,
                    null,
                ),
            ) ?: inferredExperience.ageRange,
        )

        return InterventionSettingsSnapshot(
            promptInstructions = sharedPreferences.getString(
                AndroidInterventionSettingsStorage.KEY_PROMPT_INSTRUCTIONS,
                DefaultInterventionSettings.promptInstructions,
            ) ?: DefaultInterventionSettings.promptInstructions,
            userPreferencesJson = ExperiencePreferencesJson.normalize(
                rawJson = rawPreferencesJson,
                experiencePreferences = experiencePreferences,
            ),
            audioGuidanceEnabled = sharedPreferences.getBoolean(
                AndroidInterventionSettingsStorage.KEY_AUDIO_GUIDANCE_ENABLED,
                true,
            ),
            poiDiscoveryPreferences = PoiDiscoveryPreferences(
                categories = PoiCategorySelection(
                    viewpoint = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_VIEWPOINT,
                        true,
                    ),
                    peak = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_PEAK,
                        true,
                    ),
                    waterfall = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_WATERFALL,
                        true,
                    ),
                    cave = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_CAVE,
                        true,
                    ),
                    historic = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_HISTORIC,
                        true,
                    ),
                    attraction = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_ATTRACTION,
                        true,
                    ),
                    information = sharedPreferences.getBoolean(
                        AndroidInterventionSettingsStorage.KEY_POI_INFORMATION,
                        true,
                    ),
                ),
            ),
            experiencePreferences = experiencePreferences,
        )
    }

    private fun storageKey(category: SelectablePoiCategory): String =
        when (category) {
            SelectablePoiCategory.VIEWPOINT -> AndroidInterventionSettingsStorage.KEY_POI_VIEWPOINT
            SelectablePoiCategory.PEAK -> AndroidInterventionSettingsStorage.KEY_POI_PEAK
            SelectablePoiCategory.WATERFALL -> AndroidInterventionSettingsStorage.KEY_POI_WATERFALL
            SelectablePoiCategory.CAVE -> AndroidInterventionSettingsStorage.KEY_POI_CAVE
            SelectablePoiCategory.HISTORIC -> AndroidInterventionSettingsStorage.KEY_POI_HISTORIC
            SelectablePoiCategory.ATTRACTION -> AndroidInterventionSettingsStorage.KEY_POI_ATTRACTION
            SelectablePoiCategory.INFORMATION -> AndroidInterventionSettingsStorage.KEY_POI_INFORMATION
        }
}
