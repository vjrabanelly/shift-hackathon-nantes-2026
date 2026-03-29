package com.shift.ballad.settings

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.encodeToString

/**
 * Helper public pour lire et normaliser les préférences métier ajoutées progressivement
 * au JSON libre de préférences utilisateur.
 */
object ExperiencePreferencesJson {

    fun parse(rawJson: String?): ExperiencePreferences {
        val root = parseObjectOrNull(rawJson) ?: return ExperiencePreferences()
        return ExperiencePreferences(
            detailLevel = parseDetailLevel(root)
                ?: inferDetailLevelFromLegacyLength(root)
                ?: InterventionDetailLevel.BALANCED,
            poiSelectionMode = parsePoiSelectionMode(root) ?: PoiSelectionMode.BALANCED,
            ageRange = parseUserAgeRange(root) ?: UserAgeRange.ADULT,
        )
    }

    fun normalize(
        rawJson: String?,
        experiencePreferences: ExperiencePreferences,
    ): String {
        val rawValue = rawJson?.takeIf(String::isNotBlank)
        val root = parseElementOrNull(rawValue)
        val normalized = when (root) {
            is JsonObject -> buildJsonObject {
                root.forEach { (key, value) -> put(key, value) }
                put("poi_selection_mode", JsonPrimitive(experiencePreferences.poiSelectionMode.serializedValue))
                put("intervention_detail_level", JsonPrimitive(experiencePreferences.detailLevel.serializedValue))
                put("user_age_range", JsonPrimitive(experiencePreferences.ageRange.serializedValue))
                put("max_length_sentences", JsonPrimitive(experiencePreferences.detailLevel.legacyMaxLengthSentences()))
            }
            null -> buildDefaultObject(experiencePreferences)
                .withLegacyRawPreferences(rawValue)
            else -> buildJsonObject {
                put("legacy_user_preferences", root)
                put("poi_selection_mode", JsonPrimitive(experiencePreferences.poiSelectionMode.serializedValue))
                put("intervention_detail_level", JsonPrimitive(experiencePreferences.detailLevel.serializedValue))
                put("user_age_range", JsonPrimitive(experiencePreferences.ageRange.serializedValue))
                put("max_length_sentences", JsonPrimitive(experiencePreferences.detailLevel.legacyMaxLengthSentences()))
            }
        }

        return SettingsJson.encodeToString(JsonObject.serializer(), normalized)
    }

    private fun buildDefaultObject(experiencePreferences: ExperiencePreferences): JsonObject =
        buildJsonObject {
            put("poi_selection_mode", JsonPrimitive(experiencePreferences.poiSelectionMode.serializedValue))
            put("intervention_detail_level", JsonPrimitive(experiencePreferences.detailLevel.serializedValue))
            put("user_age_range", JsonPrimitive(experiencePreferences.ageRange.serializedValue))
            put("max_length_sentences", JsonPrimitive(experiencePreferences.detailLevel.legacyMaxLengthSentences()))
        }

    private fun JsonObject.withLegacyRawPreferences(rawValue: String?): JsonObject {
        if (rawValue.isNullOrBlank()) {
            return this
        }

        return buildJsonObject {
            this@withLegacyRawPreferences.forEach { (key, value) -> put(key, value) }
            put("legacy_user_preferences_text", JsonPrimitive(rawValue))
        }
    }

    private fun parseObjectOrNull(rawJson: String?): JsonObject? =
        parseElementOrNull(rawJson) as? JsonObject

    private fun parseElementOrNull(rawJson: String?): JsonElement? =
        rawJson
            ?.takeIf(String::isNotBlank)
            ?.let { runCatching { SettingsJson.parseToJsonElement(it) }.getOrNull() }

    private fun parseDetailLevel(root: JsonObject): InterventionDetailLevel? =
        interventionDetailLevelFromSerializedValue(
            root["intervention_detail_level"]
                ?.jsonPrimitive
                ?.contentOrNull
                ?.trim()
                ?.lowercase(),
        )

    private fun parsePoiSelectionMode(root: JsonObject): PoiSelectionMode? =
        poiSelectionModeFromSerializedValue(
            root["poi_selection_mode"]
                ?.jsonPrimitive
                ?.contentOrNull
                ?.trim()
                ?.lowercase(),
        )

    private fun parseUserAgeRange(root: JsonObject): UserAgeRange? =
        userAgeRangeFromSerializedValue(
            root["user_age_range"]
                ?.jsonPrimitive
                ?.contentOrNull
                ?.trim()
                ?.lowercase(),
        )

    private fun inferDetailLevelFromLegacyLength(root: JsonObject): InterventionDetailLevel? {
        val maxLengthSentences = root["max_length_sentences"]?.jsonPrimitive?.intOrNull ?: return null
        return when {
            maxLengthSentences <= 2 -> InterventionDetailLevel.SHORT
            maxLengthSentences >= 4 -> InterventionDetailLevel.DETAILED
            else -> InterventionDetailLevel.BALANCED
        }
    }
}

private fun InterventionDetailLevel.legacyMaxLengthSentences(): Int =
    when (this) {
        InterventionDetailLevel.SHORT -> 2
        InterventionDetailLevel.BALANCED -> 3
        InterventionDetailLevel.DETAILED -> 5
    }

val PoiSelectionMode.serializedValue: String
    get() = when (this) {
        PoiSelectionMode.BALANCED -> "balanced"
        PoiSelectionMode.NATURE -> "nature"
        PoiSelectionMode.HISTORY -> "history"
        PoiSelectionMode.ARCHITECTURE -> "architecture"
        PoiSelectionMode.PANORAMA -> "panorama"
        PoiSelectionMode.CUSTOM -> "custom"
    }

val InterventionDetailLevel.serializedValue: String
    get() = when (this) {
        InterventionDetailLevel.SHORT -> "short"
        InterventionDetailLevel.BALANCED -> "balanced"
        InterventionDetailLevel.DETAILED -> "detailed"
    }

val UserAgeRange.serializedValue: String
    get() = when (this) {
        UserAgeRange.ADULT -> "adult"
        UserAgeRange.AGE_15_18 -> "15_18"
        UserAgeRange.AGE_12_14 -> "12_14"
        UserAgeRange.AGE_8_11 -> "8_11"
        UserAgeRange.UNDER_8 -> "under_8"
    }

fun poiSelectionModeFromSerializedValue(value: String?): PoiSelectionMode? =
    when (value?.trim()?.lowercase()) {
        PoiSelectionMode.BALANCED.serializedValue -> PoiSelectionMode.BALANCED
        PoiSelectionMode.NATURE.serializedValue -> PoiSelectionMode.NATURE
        PoiSelectionMode.HISTORY.serializedValue -> PoiSelectionMode.HISTORY
        PoiSelectionMode.ARCHITECTURE.serializedValue -> PoiSelectionMode.ARCHITECTURE
        PoiSelectionMode.PANORAMA.serializedValue -> PoiSelectionMode.PANORAMA
        PoiSelectionMode.CUSTOM.serializedValue -> PoiSelectionMode.CUSTOM
        else -> null
    }

fun interventionDetailLevelFromSerializedValue(value: String?): InterventionDetailLevel? =
    when (value?.trim()?.lowercase()) {
        InterventionDetailLevel.SHORT.serializedValue -> InterventionDetailLevel.SHORT
        InterventionDetailLevel.BALANCED.serializedValue -> InterventionDetailLevel.BALANCED
        InterventionDetailLevel.DETAILED.serializedValue -> InterventionDetailLevel.DETAILED
        else -> null
    }

fun userAgeRangeFromSerializedValue(value: String?): UserAgeRange? =
    when (value?.trim()?.lowercase()) {
        UserAgeRange.ADULT.serializedValue -> UserAgeRange.ADULT
        UserAgeRange.AGE_15_18.serializedValue -> UserAgeRange.AGE_15_18
        UserAgeRange.AGE_12_14.serializedValue -> UserAgeRange.AGE_12_14
        UserAgeRange.AGE_8_11.serializedValue -> UserAgeRange.AGE_8_11
        UserAgeRange.UNDER_8.serializedValue -> UserAgeRange.UNDER_8
        else -> null
    }
