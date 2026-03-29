package com.shift.ballad.intervention

import android.content.SharedPreferences
import com.shift.ballad.settings.InterventionDetailLevel
import com.shift.ballad.settings.PoiSelectionMode
import com.shift.ballad.settings.SelectablePoiCategory
import com.shift.ballad.settings.UserAgeRange
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlinx.coroutines.test.runTest

class SharedPreferencesInterventionSettingsRepositoryTest {

    @Test
    fun `repository exposes defaults when preferences are empty`() {
        val repository = SharedPreferencesInterventionSettingsRepository(FakeSharedPreferences())

        val snapshot = repository.currentSnapshot()

        assertEquals(PoiSelectionMode.BALANCED, snapshot.experiencePreferences.poiSelectionMode)
        assertEquals(InterventionDetailLevel.BALANCED, snapshot.experiencePreferences.detailLevel)
        assertEquals(UserAgeRange.ADULT, snapshot.experiencePreferences.ageRange)
        assertEquals(true, snapshot.poiDiscoveryPreferences.categories.viewpoint)
    }

    @Test
    fun `repository updates category mode and detail level`() = runTest {
        val repository = SharedPreferencesInterventionSettingsRepository(FakeSharedPreferences())

        repository.setPoiCategoryEnabled(SelectablePoiCategory.VIEWPOINT, false)
        repository.setPoiSelectionMode(PoiSelectionMode.HISTORY)
        repository.setInterventionDetailLevel(InterventionDetailLevel.DETAILED)
        repository.setUserAgeRange(UserAgeRange.AGE_12_14)

        val snapshot = repository.currentSnapshot()
        assertFalse(snapshot.poiDiscoveryPreferences.categories.viewpoint)
        assertEquals(PoiSelectionMode.HISTORY, snapshot.experiencePreferences.poiSelectionMode)
        assertEquals(InterventionDetailLevel.DETAILED, snapshot.experiencePreferences.detailLevel)
        assertEquals(UserAgeRange.AGE_12_14, snapshot.experiencePreferences.ageRange)
        assertTrue(snapshot.userPreferencesJson.contains("\"user_age_range\": \"12_14\""))
    }

    @Test
    fun `repository falls back to age range from raw preferences json`() {
        val repository = SharedPreferencesInterventionSettingsRepository(
            FakeSharedPreferences(
                initialValues = mapOf(
                    AndroidInterventionSettingsStorage.KEY_USER_PREFERENCES_JSON to """{"user_age_range":"8_11"}""",
                ),
            ),
        )

        val snapshot = repository.currentSnapshot()

        assertEquals(UserAgeRange.AGE_8_11, snapshot.experiencePreferences.ageRange)
    }

    private class FakeSharedPreferences(
        initialValues: Map<String, Any?> = emptyMap(),
    ) : SharedPreferences {
        private val values = linkedMapOf<String, Any?>().apply { putAll(initialValues) }
        private val listeners = linkedSetOf<SharedPreferences.OnSharedPreferenceChangeListener>()

        override fun getAll(): MutableMap<String, *> = values.toMutableMap()

        override fun getString(key: String?, defValue: String?): String? =
            values[key] as? String ?: defValue

        @Suppress("UNCHECKED_CAST")
        override fun getStringSet(key: String?, defValues: MutableSet<String>?): MutableSet<String>? =
            values[key] as? MutableSet<String> ?: defValues

        override fun getInt(key: String?, defValue: Int): Int =
            values[key] as? Int ?: defValue

        override fun getLong(key: String?, defValue: Long): Long =
            values[key] as? Long ?: defValue

        override fun getFloat(key: String?, defValue: Float): Float =
            values[key] as? Float ?: defValue

        override fun getBoolean(key: String?, defValue: Boolean): Boolean =
            values[key] as? Boolean ?: defValue

        override fun contains(key: String?): Boolean = values.containsKey(key)

        override fun edit(): SharedPreferences.Editor = Editor()

        override fun registerOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {
            if (listener != null) listeners += listener
        }

        override fun unregisterOnSharedPreferenceChangeListener(listener: SharedPreferences.OnSharedPreferenceChangeListener?) {
            if (listener != null) listeners -= listener
        }

        private inner class Editor : SharedPreferences.Editor {
            private val stagedValues = linkedMapOf<String, Any?>()
            private var clearRequested = false

            override fun putString(key: String?, value: String?): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = value
            }

            override fun putStringSet(key: String?, values: MutableSet<String>?): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = values
            }

            override fun putInt(key: String?, value: Int): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = value
            }

            override fun putLong(key: String?, value: Long): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = value
            }

            override fun putFloat(key: String?, value: Float): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = value
            }

            override fun putBoolean(key: String?, value: Boolean): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = value
            }

            override fun remove(key: String?): SharedPreferences.Editor = apply {
                stagedValues[key.orEmpty()] = REMOVED
            }

            override fun clear(): SharedPreferences.Editor = apply {
                clearRequested = true
            }

            override fun commit(): Boolean {
                apply()
                return true
            }

            override fun apply() {
                if (clearRequested) values.clear()
                stagedValues.forEach { (key, value) ->
                    if (value === REMOVED) {
                        values.remove(key)
                    } else {
                        values[key] = value
                    }
                    listeners.forEach { it.onSharedPreferenceChanged(this@FakeSharedPreferences, key) }
                }
            }
        }

        private companion object {
            val REMOVED = Any()
        }
    }
}
