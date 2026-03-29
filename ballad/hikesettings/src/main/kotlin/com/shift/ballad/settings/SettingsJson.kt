package com.shift.ballad.settings

import kotlinx.serialization.json.Json

internal val SettingsJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    prettyPrint = true
}
