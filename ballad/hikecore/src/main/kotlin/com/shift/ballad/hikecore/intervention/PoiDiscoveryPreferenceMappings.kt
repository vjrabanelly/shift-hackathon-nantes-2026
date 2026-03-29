package com.shift.ballad.hikecore.intervention

internal fun PoiDiscoveryPreferences.enabledPoiCategories(): Set<PoiCategory> =
    categories.enabledCategories().mapTo(linkedSetOf(), ::toPoiCategory)

internal fun PoiCategorySelection.enabledPoiCategories(): Set<PoiCategory> =
    enabledCategories().mapTo(linkedSetOf(), ::toPoiCategory)

private fun toPoiCategory(category: SelectablePoiCategory): PoiCategory =
    when (category) {
        SelectablePoiCategory.VIEWPOINT -> PoiCategory.VIEWPOINT
        SelectablePoiCategory.PEAK -> PoiCategory.PEAK
        SelectablePoiCategory.WATERFALL -> PoiCategory.WATERFALL
        SelectablePoiCategory.CAVE -> PoiCategory.CAVE
        SelectablePoiCategory.HISTORIC -> PoiCategory.HISTORIC
        SelectablePoiCategory.ATTRACTION -> PoiCategory.ATTRACTION
        SelectablePoiCategory.INFORMATION -> PoiCategory.INFORMATION
    }
