package com.shift.ballad.hikeapikeys

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "api_keys")

@Singleton
class ApiKeyRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        val OPENAI_KEY = stringPreferencesKey("openai_api_key")
        val MISTRAL_KEY = stringPreferencesKey("mistral_api_key")
    }

    val openAiKey: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[OPENAI_KEY]?.takeIf { it.isNotBlank() }
    }

    val mistralKey: Flow<String?> = context.dataStore.data.map { prefs ->
        prefs[MISTRAL_KEY]?.takeIf { it.isNotBlank() }
    }

    // Sauvegarde atomique des deux clés en une seule transaction DataStore.
    // Évite que le collector de l'une des clés réinitialise le champ de l'autre
    // entre deux appels edit() séquentiels.
    suspend fun saveKeys(openAiKey: String, mistralKey: String) {
        context.dataStore.edit { prefs ->
            prefs[OPENAI_KEY] = openAiKey
            prefs[MISTRAL_KEY] = mistralKey
        }
    }
}
