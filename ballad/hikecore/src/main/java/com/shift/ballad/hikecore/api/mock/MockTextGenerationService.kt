package com.shift.ballad.hikecore.api.mock

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.api.TextGenerationService
import com.shift.ballad.hikecore.model.PointOfInterest

internal class MockTextGenerationService : TextGenerationService {
    override fun generateDescription(pois: List<PointOfInterest>, locale: Language, contextPrompt: String?): String {
        val names = pois.joinToString(", ") { it.name ?: it.type }
        val base = when (locale) {
            Language.FR -> "Bienvenue dans ce quartier remarquable. À proximité : $names."
            Language.EN -> "Welcome to this remarkable area. Nearby: $names."
        }
        return if (contextPrompt != null) "$base [$contextPrompt]" else base
    }
}
