package com.shift.ballad.hikeapikeys

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ApiKeysUiState(
    val openAiKey: String = "",
    val mistralKey: String = "",
    val isSaved: Boolean = false
)

@HiltViewModel
class ApiKeysViewModel @Inject constructor(
    private val repository: ApiKeyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ApiKeysUiState())
    val uiState: StateFlow<ApiKeysUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.openAiKey.collect { key ->
                _uiState.update { it.copy(openAiKey = key ?: "") }
            }
        }
        viewModelScope.launch {
            repository.mistralKey.collect { key ->
                _uiState.update { it.copy(mistralKey = key ?: "") }
            }
        }
    }

    fun onOpenAiKeyChanged(key: String) {
        _uiState.update { it.copy(openAiKey = key, isSaved = false) }
    }

    fun onMistralKeyChanged(key: String) {
        _uiState.update { it.copy(mistralKey = key, isSaved = false) }
    }

    fun saveKeys() {
        viewModelScope.launch {
            repository.saveKeys(_uiState.value.openAiKey, _uiState.value.mistralKey)
            _uiState.update { it.copy(isSaved = true) }
        }
    }

    fun clearKeys() {
        _uiState.update { it.copy(openAiKey = "", mistralKey = "", isSaved = false) }
    }
}
