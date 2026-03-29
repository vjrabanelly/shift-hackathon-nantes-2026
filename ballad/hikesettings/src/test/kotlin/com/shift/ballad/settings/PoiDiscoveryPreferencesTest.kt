package com.shift.ballad.settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PoiDiscoveryPreferencesTest {

    @Test
    fun `default preferences enable all supported user selectable categories`() {
        val preferences = PoiDiscoveryPreferences()

        assertEquals(SelectablePoiCategory.entries.toSet(), preferences.enabledCategories())
        assertTrue(preferences.hasEnabledCategories())
    }

    @Test
    fun `selection converts enabled toggles into a category set`() {
        val preferences = PoiDiscoveryPreferences(
            categories = PoiCategorySelection(
                viewpoint = true,
                peak = false,
                waterfall = true,
                cave = false,
                historic = true,
                attraction = false,
                information = false,
            ),
        )

        assertEquals(
            setOf(
                SelectablePoiCategory.VIEWPOINT,
                SelectablePoiCategory.WATERFALL,
                SelectablePoiCategory.HISTORIC,
            ),
            preferences.enabledCategories(),
        )
    }

    @Test
    fun `preferences report no enabled categories when everything is disabled`() {
        val preferences = PoiDiscoveryPreferences(
            categories = PoiCategorySelection(
                viewpoint = false,
                peak = false,
                waterfall = false,
                cave = false,
                historic = false,
                attraction = false,
                information = false,
            ),
        )

        assertTrue(preferences.enabledCategories().isEmpty())
        assertFalse(preferences.hasEnabledCategories())
    }
}
