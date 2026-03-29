package com.shift.ballad.intervention

import com.shift.ballad.settings.ExperiencePreferences
import com.shift.ballad.settings.InterventionConfigProvider
import com.shift.ballad.settings.InterventionSettingsRepository
import com.shift.ballad.settings.PoiDiscoveryPreferences

/**
 * Adaptateur Android qui expose les réglages persistés de l'application
 * sous la forme attendue par le pipeline hikecore.
 *
 * L'UI ne doit plus écrire directement dans ce composant : elle passe désormais
 * par [InterventionSettingsRepository], puis ce provider relit le snapshot courant.
 */
class AndroidInterventionConfigProvider(
    private val settingsRepository: InterventionSettingsRepository,
) : InterventionConfigProvider {

    override fun getPromptInstructions(): String = settingsRepository.currentSnapshot().promptInstructions

    override fun getUserPreferencesJson(): String = settingsRepository.currentSnapshot().userPreferencesJson

    override fun getPoiDiscoveryPreferences(): PoiDiscoveryPreferences =
        settingsRepository.currentSnapshot().poiDiscoveryPreferences

    override fun getExperiencePreferences(): ExperiencePreferences =
        settingsRepository.currentSnapshot().experiencePreferences
}
