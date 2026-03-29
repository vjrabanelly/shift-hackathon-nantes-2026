package com.shift.ballad.ui.main

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shift.ballad.data.LocationProvider
import com.shift.ballad.domain.LocationSender
import com.shift.ballad.hikecore.HikeRepository
import com.shift.ballad.util.AppLogger
import com.shift.ballad.util.TtsRequestLogger
import com.shift.ballad.settings.InterventionDetailLevel
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.InterventionSettingsSnapshot
import com.shift.ballad.settings.PoiSelectionMode
import com.shift.ballad.settings.SelectablePoiCategory
import com.shift.ballad.settings.SnapshotInterventionConfigProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val locationProvider: LocationProvider,
    private val hikeRepository: HikeRepository,
    private val locationSender: LocationSender,
    private val interventionSettingsRepository: InterventionSettingsRepository,
    private val appLogger: AppLogger,
    private val ttsRequestLogger: TtsRequestLogger,
) : ViewModel() {

    private val _uiState = MutableStateFlow(
        MainUiState(
            interventionSettings = interventionSettingsRepository.currentSnapshot(),
        ),
    )
    val uiState: StateFlow<MainUiState> = _uiState.asStateFlow()

    init {
        appLogger.log("App", "HikeBuddy a démarré.")
        viewModelScope.launch {
            appLogger.logs.collect { newLogs ->
                _uiState.update { it.copy(logs = newLogs) }
            }
        }
        viewModelScope.launch {
            interventionSettingsRepository.snapshots.collect { snapshot ->
                _uiState.update { it.copy(interventionSettings = snapshot) }
            }
        }
    }

    fun getTtsLogFile(): File = ttsRequestLogger.getLogFile()

    fun onPoiCategoryToggled(category: SelectablePoiCategory, enabled: Boolean) {
        viewModelScope.launch {
            interventionSettingsRepository.setPoiCategoryEnabled(category, enabled)
        }
    }

    fun onPoiSelectionModeChanged(mode: PoiSelectionMode) {
        viewModelScope.launch {
            interventionSettingsRepository.setPoiSelectionMode(mode)
        }
    }

    fun onInterventionDetailLevelChanged(level: InterventionDetailLevel) {
        viewModelScope.launch {
            interventionSettingsRepository.setInterventionDetailLevel(level)
        }
    }


    fun sendLocation() {
        viewModelScope.launch(Dispatchers.IO) {
            _uiState.update { it.copy(isLoading = true, errorMessage = null, lastSendResult = null) }
            
            try {
                val locationResult = locationProvider.getLastLocation()
                
                locationResult.fold(
                    onSuccess = { location ->
                        appLogger.log("MainViewModel", "Position obtenue: ${location.latitude}, ${location.longitude}")
                        val details = hikeRepository.getHikeDetails(location.latitude, location.longitude)
                        _uiState.update { it.copy(latitude = location.latitude, longitude = location.longitude, hikeDetails = details) }
                        
                        val sendResult = locationSender.send(location.latitude, location.longitude)
                        
                        sendResult.fold(
                            onSuccess = { resultString ->
                                _uiState.update { 
                                    it.copy(isLoading = false, lastSendResult = resultString)
                                }
                            },
                            onFailure = { error ->
                                _uiState.update { 
                                    it.copy(isLoading = false, errorMessage = error.message ?: "Failed to send location")
                                }
                            }
                        )
                    },
                    onFailure = { error ->
                        _uiState.update { 
                            it.copy(isLoading = false, errorMessage = error.message ?: "Failed to get location")
                        }
                    }
                )
            } catch (e: Exception) {
                _uiState.update { 
                    it.copy(isLoading = false, errorMessage = e.message ?: "An unexpected error occurred")
                }
            }
        }
    }
}
