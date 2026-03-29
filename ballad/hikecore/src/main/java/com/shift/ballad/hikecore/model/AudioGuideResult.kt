package com.shift.ballad.hikecore.model

data class AudioGuideResult(
    val pois: List<PointOfInterest>,
    val description: String,
    val audioData: ByteArray
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AudioGuideResult) return false
        return pois == other.pois &&
                description == other.description &&
                audioData.contentEquals(other.audioData)
    }

    override fun hashCode(): Int {
        var result = pois.hashCode()
        result = 31 * result + description.hashCode()
        result = 31 * result + audioData.contentHashCode()
        return result
    }
}
