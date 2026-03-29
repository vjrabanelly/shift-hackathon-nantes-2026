package com.shift.ballad.hikecore.api

import com.shift.ballad.hikecore.Language

enum class Voice(
    val slug: String,
    val displayName: String,
    val gender: Gender,
    val languages: List<String>,
) {
    // French — Marie
    FR_MARIE_NEUTRAL("fr_marie_neutral", "Marie - Neutral", Gender.FEMALE, listOf("fr_fr")),
    FR_MARIE_CURIOUS("fr_marie_curious", "Marie - Curious", Gender.FEMALE, listOf("fr_fr")),
    FR_MARIE_HAPPY("fr_marie_happy", "Marie - Happy", Gender.FEMALE, listOf("fr_fr")),
    FR_MARIE_EXCITED("fr_marie_excited", "Marie - Excited", Gender.FEMALE, listOf("fr_fr")),
    FR_MARIE_SAD("fr_marie_sad", "Marie - Sad", Gender.FEMALE, listOf("fr_fr")),
    FR_MARIE_ANGRY("fr_marie_angry", "Marie - Angry", Gender.FEMALE, listOf("fr_fr")),

    // English US — Paul
    EN_PAUL_NEUTRAL("en_paul_neutral", "Paul - Neutral", Gender.MALE, listOf("en_us")),
    EN_PAUL_HAPPY("en_paul_happy", "Paul - Happy", Gender.MALE, listOf("en_us")),
    EN_PAUL_EXCITED("en_paul_excited", "Paul - Excited", Gender.MALE, listOf("en_us")),
    EN_PAUL_CONFIDENT("en_paul_confident", "Paul - Confident", Gender.MALE, listOf("en_us")),
    EN_PAUL_CHEERFUL("en_paul_cheerful", "Paul - Cheerful", Gender.MALE, listOf("en_us")),
    EN_PAUL_SAD("en_paul_sad", "Paul - Sad", Gender.MALE, listOf("en_us")),
    EN_PAUL_FRUSTRATED("en_paul_frustrated", "Paul - Frustrated", Gender.MALE, listOf("en_us")),
    EN_PAUL_ANGRY("en_paul_angry", "Paul - Angry", Gender.MALE, listOf("en_us")),

    // English GB — Oliver
    EN_OLIVER_NEUTRAL("gb_oliver_neutral", "Oliver - Neutral", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_CURIOUS("gb_oliver_curious", "Oliver - Curious", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_EXCITED("gb_oliver_excited", "Oliver - Excited", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_CONFIDENT("gb_oliver_confident", "Oliver - Confident", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_CHEERFUL("gb_oliver_cheerful", "Oliver - Cheerful", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_SAD("gb_oliver_sad", "Oliver - Sad", Gender.MALE, listOf("en_gb")),
    EN_OLIVER_ANGRY("gb_oliver_angry", "Oliver - Angry", Gender.MALE, listOf("en_gb")),

    // English GB — Jane
    EN_JANE_NEUTRAL("gb_jane_neutral", "Jane - Neutral", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_CURIOUS("gb_jane_curious", "Jane - Curious", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_CONFIDENT("gb_jane_confident", "Jane - Confident", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_SAD("gb_jane_sad", "Jane - Sad", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_FRUSTRATED("gb_jane_frustrated", "Jane - Frustrated", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_SARCASM("gb_jane_sarcasm", "Jane - Sarcasm", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_SHAMEFUL("gb_jane_shameful", "Jane - Shameful", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_JEALOUSY("gb_jane_jealousy", "Jane - Jealousy", Gender.FEMALE, listOf("en_gb")),
    EN_JANE_CONFUSED("gb_jane_confused", "Jane - Confused", Gender.FEMALE, listOf("en_gb"));

    val language: Language
        get() = if (languages.any { it.startsWith("fr") }) Language.FR else Language.EN

    val tone: String
        get() = slug.substringAfterLast("_")

    enum class Gender { MALE, FEMALE }

    companion object {
        val DEFAULT = FR_MARIE_NEUTRAL

        fun fromSlug(slug: String): Voice? =
            entries.firstOrNull { it.slug == slug }

        fun defaultForLanguage(language: Language): Voice = when (language) {
            Language.FR -> FR_MARIE_NEUTRAL
            Language.EN -> EN_PAUL_NEUTRAL
        }
    }
}
