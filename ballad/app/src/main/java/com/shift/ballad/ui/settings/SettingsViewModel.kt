package com.shift.ballad.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shift.ballad.settings.InterventionDetailLevel
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.InterventionSettingsSnapshot
import com.shift.ballad.settings.PoiSelectionMode
import com.shift.ballad.settings.SelectablePoiCategory
import com.shift.ballad.settings.UserAgeRange
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val interventionSettingsRepository: InterventionSettingsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        interventionSettingsRepository.currentSnapshot().toSettingsUiState()
    )
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            interventionSettingsRepository.snapshots.collect { snapshot ->
                _uiState.update {
                    it.copy(
                        experiencePreferences = snapshot.experiencePreferences,
                        poiCategorySelection = snapshot.poiDiscoveryPreferences.categories,
                        audioGuidanceEnabled = snapshot.audioGuidanceEnabled,
                    )
                }
            }
        }
    }

    fun onDetailLevelChanged(level: InterventionDetailLevel) {
        viewModelScope.launch { interventionSettingsRepository.setInterventionDetailLevel(level) }
    }

    fun onPoiSelectionModeChanged(mode: PoiSelectionMode) {
        viewModelScope.launch { interventionSettingsRepository.setPoiSelectionMode(mode) }
    }

    fun onUserAgeRangeChanged(ageRange: UserAgeRange) {
        viewModelScope.launch { interventionSettingsRepository.setUserAgeRange(ageRange) }
    }

    fun onPoiCategoryToggled(category: SelectablePoiCategory, enabled: Boolean) {
        viewModelScope.launch { interventionSettingsRepository.setPoiCategoryEnabled(category, enabled) }
    }

    fun onAudioGuidanceEnabledChanged(enabled: Boolean) {
        viewModelScope.launch { interventionSettingsRepository.setAudioGuidanceEnabled(enabled) }
    }
}

private fun InterventionSettingsSnapshot.toSettingsUiState() = SettingsUiState(
    experiencePreferences = experiencePreferences,
    poiCategorySelection = poiDiscoveryPreferences.categories,
    audioGuidanceEnabled = audioGuidanceEnabled,
)
