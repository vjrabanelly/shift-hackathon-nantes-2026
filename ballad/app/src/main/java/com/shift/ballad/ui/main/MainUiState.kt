package com.shift.ballad.ui.main

import android.net.Uri
import com.shift.ballad.settings.DefaultInterventionSettings
import com.shift.ballad.settings.InterventionSettingsSnapshot

data class MainUiState(
    val latitude: Double? = null,
    val longitude: Double? = null,
    val isLoading: Boolean = false,
    val lastSendResult: String? = null,
    val errorMessage: String? = null,
    val hikeDetails: String? = null,
    val logs: List<String> = emptyList(),
    val interventionSettings: InterventionSettingsSnapshot = DefaultInterventionSettings.snapshot,
)
