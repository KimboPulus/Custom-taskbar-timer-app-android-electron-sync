package com.focustimermobile.shared

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class FocusTimerCoreTest {
    @Test
    fun formatsDurationAsFixedClockText() {
        assertEquals("00:00:00", FocusTimerCore.formatDuration(0))
        assertEquals("00:25:00", FocusTimerCore.formatDuration(25 * 60 * 1000L))
        assertEquals("01:02:03", FocusTimerCore.formatDuration(3_723_000))
    }

    @Test
    fun validatesDateKeysIncludingLeapYears() {
        assertTrue(FocusTimerCore.isDateKey("2028-02-29"))
        assertFalse(FocusTimerCore.isDateKey("2027-02-29"))
        assertFalse(FocusTimerCore.isDateKey("2027-13-01"))
    }

    @Test
    fun cyclesManualDailyPlanStatus() {
        assertEquals("Failed", FocusTimerCore.nextManualDailyPlanStatus("Completed"))
        assertEquals("Neutral", FocusTimerCore.nextManualDailyPlanStatus("Failed"))
        assertEquals("Completed", FocusTimerCore.nextManualDailyPlanStatus("Neutral"))
        assertEquals("Completed", FocusTimerCore.nextManualDailyPlanStatus(null))
    }

    @Test
    fun calculatesCompletedDayStreak() {
        assertEquals(
            3,
            FocusTimerCore.calculateStreak(
                todayKey = "2026-06-20",
                completedDates = listOf("2026-06-18", "2026-06-19", "2026-06-20"),
            ),
        )
    }
}
