package com.shift.ballad.hikecore.intervention

import com.shift.ballad.hikecore.Language
import com.shift.ballad.hikecore.VoiceConfig
import com.shift.ballad.hikecore.language
import kotlinx.serialization.Serializable

@Serializable
data class GeoPoint(
    val lat: Double,
    val lon: Double,
)

@Serializable
data class InterventionRequest(
    val point: GeoPoint,
    val radiusMeters: Int,
    val promptInstructions: String,
    val userPreferencesJson: String,
    val voiceConfig: VoiceConfig = VoiceConfig.DEFAULT,
    val maxCandidatePois: Int = 5,
    val poiPreferences: PoiDiscoveryPreferences = PoiDiscoveryPreferences(),
    val experiencePreferences: ExperiencePreferences = ExperiencePreferences(),
) {
    val language: Language get() = voiceConfig.language

    init {
        require(radiusMeters > 0) { "radiusMeters must be > 0" }
        require(maxCandidatePois > 0) { "maxCandidatePois must be > 0" }
    }
}

@Serializable
enum class PoiCategory {
    VIEWPOINT,
    PEAK,
    WATERFALL,
    CAVE,
    HISTORIC,
    ATTRACTION,
    INFORMATION,
    OTHER,
}

@Serializable
enum class SourceKind {
    OSM,
    WIKIPEDIA,
    WIKIDATA,
    WIKIVOYAGE,
}

@Serializable
data class SourceReference(
    val kind: SourceKind,
    val label: String,
    val value: String,
    val url: String? = null,
)

@Serializable
data class SourceSummary(
    val kind: SourceKind,
    val title: String,
    val snippet: String,
    val url: String? = null,
)

@Serializable
data class PoiCandidate(
    val id: String,
    val name: String?,
    val lat: Double,
    val lon: Double,
    val distanceMeters: Int,
    val category: PoiCategory,
    val tags: Map<String, String>,
    val sourceRefs: List<SourceReference>,
    val score: Double,
)

@Serializable
data class ModelInfo(
    val provider: String,
    val model: String,
    val responseId: String? = null,
)

@Serializable
data class PreparedInterventionContext(
    val request: InterventionRequest,
    val selectedPoi: PoiCandidate,
    val candidatePois: List<PoiCandidate>,
    val sourceSummaries: List<SourceSummary>,
    val prompt: String,
)

sealed interface PromptPreparationResult {
    data class Ready(val context: PreparedInterventionContext) : PromptPreparationResult

    data class NoIntervention(
        val reason: String,
        val candidatePois: List<PoiCandidate>,
    ) : PromptPreparationResult

    data class Failed(
        val stage: String,
        val message: String,
        val candidatePois: List<PoiCandidate>,
    ) : PromptPreparationResult
}

@Serializable
data class ManualPoi(
    val name: String,
    val lat: Double,
    val lon: Double,
    val tags: Map<String, String> = emptyMap(),
)

sealed interface InterventionResult {
    data class Generated(
        val text: String,
        val selectedPoi: PoiCandidate,
        val candidatePois: List<PoiCandidate>,
        val sourceSummaries: List<SourceSummary>,
        val modelInfo: ModelInfo,
        val audioData: ByteArray? = null,
    ) : InterventionResult

    data class NoIntervention(
        val reason: String,
        val candidatePois: List<PoiCandidate>,
    ) : InterventionResult

    data class GenerationFailed(
        val stage: String,
        val message: String,
        val candidatePois: List<PoiCandidate>,
    ) : InterventionResult
}
