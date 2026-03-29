package com.shift.ballad.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SnapshotInterventionConfigProviderTest {

    @Test
    fun `snapshot provider replays a frozen settings snapshot`() {
        val snapshot = InterventionSettingsSnapshot(
            promptInstructions = "Reste très concise.",
            userPreferencesJson = """{"tone":"warm"}""",
            poiDiscoveryPreferences = PoiDiscoveryPreferences(
                categories = PoiCategorySelection(
                    viewpoint = true,
                    peak = false,
                    waterfall = true,
                    cave = false,
                    historic = true,
                    attraction = false,
                    information = false,
                ),
            ),
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.SHORT,
                poiSelectionMode = PoiSelectionMode.PANORAMA,
                ageRange = UserAgeRange.AGE_15_18,
            ),
        )

        val provider = SnapshotInterventionConfigProvider(snapshot)

        assertEquals(snapshot.promptInstructions, provider.getPromptInstructions())
        assertEquals(snapshot.userPreferencesJson, provider.getUserPreferencesJson())
        assertEquals(snapshot.poiDiscoveryPreferences, provider.getPoiDiscoveryPreferences())
        assertEquals(snapshot.experiencePreferences, provider.getExperiencePreferences())
    }

    @Test
    fun `snapshot provider can be created from another config provider`() {
        val provider = InMemoryInterventionConfigProvider(
            promptInstructions = "Sois factuelle.",
            userPreferencesJson = """{"tone":"calm"}""",
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.DETAILED,
                poiSelectionMode = PoiSelectionMode.HISTORY,
                ageRange = UserAgeRange.AGE_12_14,
            ),
        )

        val snapshotProvider = SnapshotInterventionConfigProvider.from(provider)

        assertEquals("Sois factuelle.", snapshotProvider.getPromptInstructions())
        assertTrue(snapshotProvider.getUserPreferencesJson().contains("\"poi_selection_mode\": \"history\""))
        assertEquals(PoiSelectionMode.HISTORY, snapshotProvider.getExperiencePreferences().poiSelectionMode)
        assertEquals(UserAgeRange.AGE_12_14, snapshotProvider.getExperiencePreferences().ageRange)
    }
}
