package com.shift.ballad.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.shift.ballad.settings.ExperiencePreferences
import com.shift.ballad.settings.InterventionDetailLevel
import com.shift.ballad.settings.PoiCategorySelection
import com.shift.ballad.settings.PoiSelectionMode
import com.shift.ballad.settings.SelectablePoiCategory
import com.shift.ballad.settings.UserAgeRange

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val uiState by viewModel.uiState.collectAsState()
    SettingsContent(
        uiState = uiState,
        onNavigateBack = onNavigateBack,
        onDetailLevelChanged = viewModel::onDetailLevelChanged,
        onUserAgeRangeChanged = viewModel::onUserAgeRangeChanged,
        onPoiSelectionModeChanged = viewModel::onPoiSelectionModeChanged,
        onPoiCategoryToggled = viewModel::onPoiCategoryToggled,
        onAudioGuidanceEnabledChanged = viewModel::onAudioGuidanceEnabledChanged,
        modifier = modifier,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SettingsContent(
    uiState: SettingsUiState,
    onNavigateBack: () -> Unit,
    onDetailLevelChanged: (InterventionDetailLevel) -> Unit,
    onUserAgeRangeChanged: (UserAgeRange) -> Unit,
    onPoiSelectionModeChanged: (PoiSelectionMode) -> Unit,
    onPoiCategoryToggled: (SelectablePoiCategory, Boolean) -> Unit,
    onAudioGuidanceEnabledChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Paramètres") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Retour"
                        )
                    }
                }
            )
        }
    ) { paddingValues ->
        SettingsBody(
            uiState = uiState,
            onDetailLevelChanged = onDetailLevelChanged,
            onUserAgeRangeChanged = onUserAgeRangeChanged,
            onPoiSelectionModeChanged = onPoiSelectionModeChanged,
            onPoiCategoryToggled = onPoiCategoryToggled,
            onAudioGuidanceEnabledChanged = onAudioGuidanceEnabledChanged,
            modifier = modifier.padding(paddingValues),
        )
    }
}

@Composable
internal fun SettingsBody(
    uiState: SettingsUiState,
    onDetailLevelChanged: (InterventionDetailLevel) -> Unit,
    onUserAgeRangeChanged: (UserAgeRange) -> Unit,
    onPoiSelectionModeChanged: (PoiSelectionMode) -> Unit,
    onPoiCategoryToggled: (SelectablePoiCategory, Boolean) -> Unit,
    onAudioGuidanceEnabledChanged: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item {
            SettingsSectionHeader("Guidage audio")
        }
        item {
            SwitchSettingItem(
                label = "Activer le guidage audio",
                checked = uiState.audioGuidanceEnabled,
                onCheckedChange = onAudioGuidanceEnabledChanged,
            )
        }
        item {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
        }
        item {
            SettingsSectionHeader("Génération de Texte")
        }
        item {
            SegmentedSettingItem(
                label = "Niveau de détail",
                selected = uiState.experiencePreferences.detailLevel,
                options = InterventionDetailLevel.entries,
                labelFor = { it.toFrenchLabel() },
                onSelected = onDetailLevelChanged,
            )
        }
        item {
            DropdownSettingItem(
                label = "Tranche d'âge",
                selected = uiState.experiencePreferences.ageRange,
                options = UserAgeRange.entries,
                labelFor = { it.toFrenchLabel() },
                onSelected = onUserAgeRangeChanged,
            )
        }
        item {
            DropdownSettingItem(
                label = "Thème préféré",
                selected = uiState.experiencePreferences.poiSelectionMode,
                options = PoiSelectionMode.entries,
                labelFor = { it.toFrenchLabel() },
                onSelected = onPoiSelectionModeChanged,
            )
        }

        if (uiState.experiencePreferences.poiSelectionMode == PoiSelectionMode.CUSTOM) {
            item {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            item {
                SettingsSectionHeader("Génération de POI")
            }
            items(SelectablePoiCategory.entries) { category ->
                SwitchSettingItem(
                    label = category.toFrenchLabel(),
                    checked = uiState.poiCategorySelection.isEnabled(category),
                    onCheckedChange = { enabled -> onPoiCategoryToggled(category, enabled) },
                )
            }
        }
    }
}

@Composable
internal fun SettingsSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleSmall,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    )
}

@Composable
internal fun SwitchSettingItem(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun <T> DropdownSettingItem(
    label: String,
    selected: T,
    options: List<T>,
    labelFor: (T) -> String,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(4.dp))
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
        ) {
            OutlinedTextField(
                value = labelFor(selected),
                onValueChange = {},
                readOnly = true,
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
            )
            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                options.forEach { option ->
                    DropdownMenuItem(
                        text = { Text(labelFor(option)) },
                        onClick = {
                            onSelected(option)
                            expanded = false
                        },
                        contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun <T> SegmentedSettingItem(
    label: String,
    selected: T,
    options: List<T>,
    labelFor: (T) -> String,
    onSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            options.forEachIndexed { index, option ->
                SegmentedButton(
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = options.size,
                    ),
                    onClick = { onSelected(option) },
                    selected = option == selected,
                    label = { Text(labelFor(option), maxLines = 1) },
                )
            }
        }
    }
}

private fun InterventionDetailLevel.toFrenchLabel(): String = when (this) {
    InterventionDetailLevel.SHORT -> "Court"
    InterventionDetailLevel.BALANCED -> "Équilibré"
    InterventionDetailLevel.DETAILED -> "Détaillé"
}

private fun PoiSelectionMode.toFrenchLabel(): String = when (this) {
    PoiSelectionMode.BALANCED -> "Équilibré"
    PoiSelectionMode.NATURE -> "Nature"
    PoiSelectionMode.HISTORY -> "Histoire"
    PoiSelectionMode.ARCHITECTURE -> "Architecture"
    PoiSelectionMode.PANORAMA -> "Panorama"
    PoiSelectionMode.CUSTOM -> "Personnalisé"
}

private fun UserAgeRange.toFrenchLabel(): String = when (this) {
    UserAgeRange.ADULT -> "Adulte"
    UserAgeRange.AGE_15_18 -> "15-18"
    UserAgeRange.AGE_12_14 -> "12-14"
    UserAgeRange.AGE_8_11 -> "8-11"
    UserAgeRange.UNDER_8 -> "Moins de 8 ans"
}

private fun SelectablePoiCategory.toFrenchLabel(): String = when (this) {
    SelectablePoiCategory.VIEWPOINT -> "Points de vue"
    SelectablePoiCategory.PEAK -> "Sommets"
    SelectablePoiCategory.WATERFALL -> "Cascades"
    SelectablePoiCategory.CAVE -> "Grottes"
    SelectablePoiCategory.HISTORIC -> "Sites historiques"
    SelectablePoiCategory.ATTRACTION -> "Attractions"
    SelectablePoiCategory.INFORMATION -> "Information"
}

@Preview(showBackground = true)
@Composable
private fun SettingsScreenPreview() {
    MaterialTheme {
        SettingsContent(
            uiState = SettingsUiState(
                experiencePreferences = ExperiencePreferences(
                    detailLevel = InterventionDetailLevel.BALANCED,
                    poiSelectionMode = PoiSelectionMode.NATURE,
                    ageRange = UserAgeRange.ADULT,
                ),
                poiCategorySelection = PoiCategorySelection(
                    viewpoint = true,
                    peak = false,
                    waterfall = true,
                    cave = false,
                    historic = true,
                    attraction = true,
                    information = false,
                ),
            ),
            onNavigateBack = {},
            onDetailLevelChanged = {},
            onUserAgeRangeChanged = {},
            onPoiSelectionModeChanged = {},
            onPoiCategoryToggled = { _, _ -> },
            onAudioGuidanceEnabledChanged = {},
        )
    }
}
