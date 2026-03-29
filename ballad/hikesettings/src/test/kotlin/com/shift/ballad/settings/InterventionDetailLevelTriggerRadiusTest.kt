package com.shift.ballad.settings

import kotlin.test.Test
import kotlin.test.assertEquals

class InterventionDetailLevelTriggerRadiusTest {

    @Test
    fun `detail levels map to stable trigger distances`() {
        assertEquals(10, InterventionDetailLevel.SHORT.triggerRadiusMeters())
        assertEquals(20, InterventionDetailLevel.BALANCED.triggerRadiusMeters())
        assertEquals(35, InterventionDetailLevel.DETAILED.triggerRadiusMeters())
    }
}
