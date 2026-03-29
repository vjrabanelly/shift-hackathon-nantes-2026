package com.shift.ballad.settings

import java.nio.file.Path
import kotlin.io.path.readText

class SnapshotInterventionConfigProvider(
    private val settingsSnapshot: InterventionSettingsSnapshot,
) : InterventionConfigProvider {

    override fun getPromptInstructions(): String = settingsSnapshot.promptInstructions

    override fun getUserPreferencesJson(): String = settingsSnapshot.userPreferencesJson

    override fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences = settingsSnapshot.poiDiscoveryPreferences

    override fun getExperiencePreferences(): ExperiencePreferences = settingsSnapshot.experiencePreferences

    companion object {
        fun from(configProvider: InterventionConfigProvider): SnapshotInterventionConfigProvider =
            SnapshotInterventionConfigProvider(configProvider.toSettingsSnapshot())
    }
}

class FileInterventionConfigProvider(
    private val promptFile: Path,
    private val preferencesFile: Path,
    private val poiDiscoveryPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
    private val experiencePreferencesOverride: ExperiencePreferences? = null,
) : InterventionConfigProvider {

    override fun getPromptInstructions(): String = promptFile.readText().trim()

    override fun getUserPreferencesJson(): String =
        ExperiencePreferencesJson.normalize(
            rawJson = preferencesFile.readText().trim(),
            experiencePreferences = getExperiencePreferences(),
        )

    override fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences = poiDiscoveryPreferences

    override fun getExperiencePreferences(): ExperiencePreferences =
        experiencePreferencesOverride ?: ExperiencePreferencesJson.parse(preferencesFile.readText().trim())
}

class InMemoryInterventionConfigProvider(
    private val promptInstructions: String,
    private val userPreferencesJson: String,
    private val poiDiscoveryPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
    private val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
) : InterventionConfigProvider {

    override fun getPromptInstructions(): String = promptInstructions

    override fun getUserPreferencesJson(): String =
        ExperiencePreferencesJson.normalize(
            rawJson = userPreferencesJson,
            experiencePreferences = experiencePreferences,
        )

    override fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences = poiDiscoveryPreferences

    override fun getExperiencePreferences(): ExperiencePreferences = experiencePreferences
}
