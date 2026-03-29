package com.shift.ballad.settings

/**
 * Abstraction permettant de fournir les instructions de prompt et les préférences utilisateur
 * pour la génération d'interventions audio.
 */
interface InterventionConfigProvider {
    fun getPromptInstructions(): String

    fun getUserPreferencesJson(): String

    fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences

    fun getExperiencePreferences(): ExperiencePreferences = ExperiencePreferences()
}

fun InterventionConfigProvider.toSettingsSnapshot(): InterventionSettingsSnapshot =
    InterventionSettingsSnapshot(
        promptInstructions = getPromptInstructions(),
        userPreferencesJson = getUserPreferencesJson(),
        poiDiscoveryPreferences = getPoiDiscoveryPreferences(),
        experiencePreferences = getExperiencePreferences(),
    )
