package com.shift.ballad.hikecore

enum class Language(val code: String) {
    FR("fr"),
    EN("en");

    companion object {
        fun fromCode(code: String): Language? =
            entries.firstOrNull { it.code == code.trim().lowercase() }
    }
}
