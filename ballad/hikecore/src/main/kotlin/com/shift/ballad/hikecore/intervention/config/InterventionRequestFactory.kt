package com.shift.ballad.hikecore.intervention.config

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.intervention.GeoPoint
import com.shift.ballad.hikecore.intervention.InterventionRequest
import com.shift.ballad.settings.InterventionSettingsSnapshot

/**
 * Crée un [InterventionRequest] en lisant les instructions de prompt et les préférences
 * depuis un [InterventionConfigProvider].
 *
 * Exemple (Android) :
 * ```kotlin
 * val request = buildInterventionRequest(
 *     configProvider = androidConfigProvider,
 *     point = GeoPoint(lat, lon),
 *     radiusMeters = 500,
 * )
 * ```
 *
 * Exemple (fichiers) :
 * ```kotlin
 * val request = buildInterventionRequest(
 *     configProvider = FileInterventionConfigProvider(
 *         promptFile = Path.of("hikecore/examples/prompt.txt"),
 *         preferencesFile = Path.of("hikecore/examples/preferences.json"),
 *     ),
 *     point = GeoPoint(45.83, 6.86),
 *     radiusMeters = 750,
 * )
 * ```
 */
fun buildInterventionRequest(
    configProvider: InterventionConfigProvider,
    point: GeoPoint,
    radiusMeters: Int,
    voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    maxCandidatePois: Int = 5,
): InterventionRequest = InterventionRequest(
    point = point,
    radiusMeters = radiusMeters,
    promptInstructions = configProvider.getPromptInstructions(),
    userPreferencesJson = configProvider.getUserPreferencesJson(),
    voiceConfig = voiceConfig,
    maxCandidatePois = maxCandidatePois,
    poiPreferences = configProvider.getPoiDiscoveryPreferences(),
    experiencePreferences = configProvider.getExperiencePreferences(),
)

fun buildInterventionRequest(
    settingsSnapshot: InterventionSettingsSnapshot,
    point: GeoPoint,
    radiusMeters: Int,
    voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    maxCandidatePois: Int = 5,
): InterventionRequest = buildInterventionRequest(
    configProvider = SnapshotInterventionConfigProvider(settingsSnapshot),
    point = point,
    radiusMeters = radiusMeters,
    voiceConfig = voiceConfig,
    maxCandidatePois = maxCandidatePois,
)
