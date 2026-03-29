package com.shift.ballad.hikeapikeys

import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

data class FallbackApiKeys(
    val openAiKey: String?,
    val mistralKey: String?
)

@Singleton
class ApiKeyProvider @Inject constructor(
    private val repository: ApiKeyRepository,
    private val fallbacks: FallbackApiKeys
) {
    suspend fun getOpenAiKey(): String? {
        return repository.openAiKey.firstOrNull() ?: fallbacks.openAiKey
    }

    suspend fun getMistralKey(): String? {
        return repository.mistralKey.firstOrNull() ?: fallbacks.mistralKey
    }
    
    suspend fun hasAllRequiredKeys(): Boolean {
        return !getOpenAiKey().isNullOrBlank() && !getMistralKey().isNullOrBlank()
    }
}
