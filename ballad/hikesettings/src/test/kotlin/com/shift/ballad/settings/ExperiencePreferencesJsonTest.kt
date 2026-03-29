package com.shift.ballad.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import java.nio.file.Files
import kotlin.io.path.writeText
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class ExperiencePreferencesJsonTest {

    @Test
    fun `parse reads typed fields when present`() {
        val parsed = ExperiencePreferencesJson.parse(
            """
            {
              "poi_selection_mode": "history",
              "intervention_detail_level": "detailed",
              "user_age_range": "12_14"
            }
            """.trimIndent(),
        )

        assertEquals(PoiSelectionMode.HISTORY, parsed.poiSelectionMode)
        assertEquals(InterventionDetailLevel.DETAILED, parsed.detailLevel)
        assertEquals(UserAgeRange.AGE_12_14, parsed.ageRange)
    }

    @Test
    fun `parse infers detail level from legacy max length`() {
        val parsed = ExperiencePreferencesJson.parse("""{"max_length_sentences": 2}""")

        assertEquals(PoiSelectionMode.BALANCED, parsed.poiSelectionMode)
        assertEquals(InterventionDetailLevel.SHORT, parsed.detailLevel)
        assertEquals(UserAgeRange.ADULT, parsed.ageRange)
    }

    @Test
    fun `parse falls back to adult when age range is invalid`() {
        val parsed = ExperiencePreferencesJson.parse("""{"user_age_range":"unknown"}""")

        assertEquals(UserAgeRange.ADULT, parsed.ageRange)
    }

    @Test
    fun `normalize adds typed fields to an existing object`() {
        val normalized = ExperiencePreferencesJson.normalize(
            rawJson = """{"tone":"warm"}""",
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.DETAILED,
                poiSelectionMode = PoiSelectionMode.ARCHITECTURE,
                ageRange = UserAgeRange.AGE_15_18,
            ),
        )
        val root = Json { ignoreUnknownKeys = true }.parseToJsonElement(normalized).jsonObject

        assertEquals("warm", root.getValue("tone").jsonPrimitive.content)
        assertEquals("architecture", root.getValue("poi_selection_mode").jsonPrimitive.content)
        assertEquals("detailed", root.getValue("intervention_detail_level").jsonPrimitive.content)
        assertEquals("15_18", root.getValue("user_age_range").jsonPrimitive.content)
        assertEquals(5, root.getValue("max_length_sentences").jsonPrimitive.intOrNull)
    }

    @Test
    fun `normalize preserves invalid legacy user preference text`() {
        val normalized = ExperiencePreferencesJson.normalize(
            rawJson = "tone=warm;energy=calm",
            experiencePreferences = ExperiencePreferences(),
        )
        val root = Json { ignoreUnknownKeys = true }.parseToJsonElement(normalized).jsonObject

        assertTrue(normalized.contains("tone=warm;energy=calm"))
        assertEquals("balanced", root.getValue("poi_selection_mode").jsonPrimitive.content)
        assertEquals("balanced", root.getValue("intervention_detail_level").jsonPrimitive.content)
        assertEquals("adult", root.getValue("user_age_range").jsonPrimitive.content)
        assertEquals(3, root.getValue("max_length_sentences").jsonPrimitive.intOrNull)
    }

    @Test
    fun `file config provider reads typed fields from preferences file`() {
        val promptFile = Files.createTempFile("prompt", ".txt")
        val prefsFile = Files.createTempFile("prefs", ".json")
        promptFile.writeText("Reste concise.")
        prefsFile.writeText(
            """
            {
              "tone": "warm",
              "poi_selection_mode": "panorama",
              "intervention_detail_level": "short",
              "user_age_range": "8_11"
            }
            """.trimIndent(),
        )

        val provider = FileInterventionConfigProvider(
            promptFile = promptFile,
            preferencesFile = prefsFile,
        )

        assertEquals(PoiSelectionMode.PANORAMA, provider.getExperiencePreferences().poiSelectionMode)
        assertEquals(InterventionDetailLevel.SHORT, provider.getExperiencePreferences().detailLevel)
        assertEquals(UserAgeRange.AGE_8_11, provider.getExperiencePreferences().ageRange)
        assertTrue(provider.getUserPreferencesJson().contains("\"poi_selection_mode\": \"panorama\""))
        assertTrue(provider.getUserPreferencesJson().contains("\"user_age_range\": \"8_11\""))
        assertTrue(provider.getUserPreferencesJson().contains("\"max_length_sentences\": 2"))
    }

    @Test
    fun `in memory config provider normalizes typed preferences into prompt json`() {
        val provider = InMemoryInterventionConfigProvider(
            promptInstructions = "Reste concise.",
            userPreferencesJson = """{"tone":"warm"}""",
            experiencePreferences = ExperiencePreferences(
                detailLevel = InterventionDetailLevel.DETAILED,
                poiSelectionMode = PoiSelectionMode.NATURE,
                ageRange = UserAgeRange.UNDER_8,
            ),
        )

        val normalized = provider.getUserPreferencesJson()
        assertTrue(normalized.contains("\"poi_selection_mode\": \"nature\""))
        assertTrue(normalized.contains("\"intervention_detail_level\": \"detailed\""))
        assertTrue(normalized.contains("\"user_age_range\": \"under_8\""))
        assertTrue(normalized.contains("\"max_length_sentences\": 5"))
    }
}
