package com.shift.ballad.hikeride

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.shift.ballad.hikecore.HikeCore
import com.shift.ballad.hikecore.route.EnrichmentStep
import com.shift.ballad.hikecore.route.GpxRouteEnrichmentService
import com.shift.ballad.hikecore.route.GpxRouteEnrichmentState
import com.shift.ballad.hikecore.route.RouteMetadata
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.InterventionSettingsSnapshot
import com.shift.ballad.settings.SnapshotInterventionConfigProvider
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import java.io.File
import javax.inject.Inject

data class RideUiState(
    val isEnriching: Boolean = false,
    val enrichmentStep: EnrichmentStep? = null,
    val enrichmentError: String? = null,
    val routes: List<String> = emptyList(),
    val openOsmAndUri: Uri? = null,
    val launchGpxPicker: Boolean = false,
    val selectedRoute: String? = null,
    val selectedRouteMetadata: RouteMetadata? = null,
)

@HiltViewModel
class RideViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val interventionSettingsRepository: InterventionSettingsRepository,
    private val apiKeyProvider: com.shift.ballad.hikeapikeys.ApiKeyProvider,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RideUiState())
    val uiState: StateFlow<RideUiState> = _uiState.asStateFlow()

    private var enrichmentJob: Job? = null

    private val routesDir: File
        get() = context.filesDir.resolve("routes")

    init {
        loadRoutes()
    }

    private fun loadRoutes() {
        val dirs = routesDir.listFiles()?.filter { it.isDirectory }?.map { it.name } ?: emptyList()
        _uiState.update { it.copy(routes = dirs.sorted()) }
    }

    fun deleteRoute(name: String) {
        val dir = routesDir.resolve(name)
        if (dir.exists()) {
            dir.deleteRecursively()
            loadRoutes()
        }
    }

    fun openRoute(name: String) {
        val dir = routesDir.resolve(name)
        val gpxFile = dir.listFiles()?.firstOrNull { it.name.endsWith(".gpx", ignoreCase = true) }
        if (gpxFile != null) {
            val uri = androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.provider", gpxFile)
            _uiState.update { it.copy(openOsmAndUri = uri) }
        }
    }

    fun onOsmAndOpened() {
        _uiState.update { it.copy(openOsmAndUri = null) }
    }

    fun selectRoute(name: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val metadata = loadMetadata(name)
            _uiState.update { it.copy(selectedRoute = name, selectedRouteMetadata = metadata) }
        }
    }

    fun clearSelectedRoute() {
        _uiState.update { it.copy(selectedRoute = null, selectedRouteMetadata = null) }
    }

    private fun loadMetadata(routeName: String): RouteMetadata? {
        val file = routesDir.resolve(routeName).resolve("metadata.json")
        if (!file.exists()) return null
        return runCatching {
            Json { ignoreUnknownKeys = true }.decodeFromString<RouteMetadata>(file.readText())
        }.getOrElse {
            Log.w("RideViewModel", "Failed to load metadata for $routeName", it)
            null
        }
    }

    fun checkKeysAndLaunchGpxPicker() {
        viewModelScope.launch {
            if (apiKeyProvider.hasAllRequiredKeys()) {
                _uiState.update { it.copy(launchGpxPicker = true, enrichmentError = null) }
            } else {
                _uiState.update { it.copy(enrichmentError = "Veuillez configurer les clés OpenAI et Mistral dans l'écran Clés API.") }
            }
        }
    }

    fun onGpxPickerLaunched() {
        _uiState.update { it.copy(launchGpxPicker = false) }
    }

    fun cancelEnrichment() {
        enrichmentJob?.cancel()
        enrichmentJob = null
        _uiState.update { it.copy(isEnriching = false, enrichmentStep = null) }
    }

    fun onGpxFileSelected(uri: Uri) {
        enrichmentJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                val settingsSnapshot = interventionSettingsRepository.currentSnapshot()
                val fileName = context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                    val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                    cursor.moveToFirst()
                    cursor.getString(nameIndex)
                }
                if (fileName == null || !fileName.endsWith(".gpx", ignoreCase = true)) {
                    Log.w("RideViewModel", "Rejected file: $fileName (not a .gpx)")
                    _uiState.update { it.copy(enrichmentError = "Fichier invalide : attendu un fichier .gpx") }
                    return@launch
                }
                val gpxContent = context.contentResolver.openInputStream(uri)
                    ?.bufferedReader()
                    ?.use { it.readText() }
                if (gpxContent.isNullOrBlank()) {
                    _uiState.update { it.copy(enrichmentError = "Le fichier GPX est vide") }
                    return@launch
                }

                val baseName = fileName.removeSuffix(".gpx")
                val routeDir = routesDir.resolve(baseName)
                routeDir.mkdirs()

                createGpxRouteEnrichmentService(settingsSnapshot, routeDir).enrich(gpxContent).collect { state ->
                    when (state) {
                        is GpxRouteEnrichmentState.Init -> Unit
                        is GpxRouteEnrichmentState.Loading ->
                            _uiState.update { it.copy(isEnriching = true, enrichmentError = null, enrichmentStep = state.step) }
                        is GpxRouteEnrichmentState.Success -> {
                            val gpxFile = routeDir.resolve(fileName)
                            gpxFile.writeText(state.gpxXml)
                            loadRoutes()
                            val metadata = loadMetadata(baseName)
                            _uiState.update { it.copy(isEnriching = false, enrichmentStep = null, selectedRoute = baseName, selectedRouteMetadata = metadata) }
                        }
                        is GpxRouteEnrichmentState.Error ->
                            _uiState.update { it.copy(isEnriching = false, enrichmentStep = null, enrichmentError = state.message) }
                    }
                }
            } catch (e: CancellationException) {
                _uiState.update { it.copy(isEnriching = false, enrichmentStep = null) }
                throw e
            } catch (e: Exception) {
                Log.e("RideViewModel", "Failed to enrich GPX file", e)
                _uiState.update { it.copy(isEnriching = false, enrichmentStep = null, enrichmentError = e.message ?: "Erreur inattendue") }
            }
        }
    }

    private suspend fun createGpxRouteEnrichmentService(
        settingsSnapshot: InterventionSettingsSnapshot,
        routeDir: File,
    ): GpxRouteEnrichmentService = HikeCore.createGpxRouteEnrichmentService(
        config = com.shift.ballad.hikecore.config.HikeConfig(
            openAiApiKey = apiKeyProvider.getOpenAiKey(),
            mistralApiKey = apiKeyProvider.getMistralKey()
        ),
        configProvider = SnapshotInterventionConfigProvider(settingsSnapshot),
        audioCacheDirectory = routeDir.toPath(),
    )
}
