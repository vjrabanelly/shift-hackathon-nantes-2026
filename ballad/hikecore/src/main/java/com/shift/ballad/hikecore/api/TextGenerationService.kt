package com.shift.ballad.hikecore.api

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.model.PointOfInterest

internal interface TextGenerationService {
    fun generateDescription(
        pois: List<PointOfInterest>,
        locale: Language = Language.FR,
        contextPrompt: String? = null
    ): String
}
