package com.focustimermobile.shared

import kotlin.math.max

object FocusTimerCore {
    const val DEFAULT_DURATION_MS: Long = 25 * 60 * 1000L

    fun formatDuration(milliseconds: Long): String {
        val totalSeconds = max(0L, milliseconds) / 1000L
        val hours = totalSeconds / 3600L
        val minutes = (totalSeconds % 3600L) / 60L
        val seconds = totalSeconds % 60L
        return "${hours.twoDigits()}:${minutes.twoDigits()}:${seconds.twoDigits()}"
    }

    fun normalizeServerUrl(value: String): String {
        val trimmed = value.trim().ifEmpty { "http://10.0.2.2:5278" }
        return trimmed.trimEnd('/')
    }

    fun isDateKey(value: String): Boolean {
        if (!Regex("""^\d{4}-\d{2}-\d{2}$""").matches(value)) {
            return false
        }

        val parts = value.split("-").mapNotNull { it.toIntOrNull() }
        if (parts.size != 3) {
            return false
        }

        val year = parts[0]
        val month = parts[1]
        val day = parts[2]
        return month in 1..12 && day in 1..daysInMonth(year, month)
    }

    fun dailyPlanStatusForDate(
        dateKey: String,
        completedDates: List<String>,
        failedDates: List<String>,
        neutralDates: List<String>,
        startDate: String?,
        todayKey: String,
    ): String {
        return when {
            completedDates.contains(dateKey) -> "Completed"
            failedDates.contains(dateKey) -> "Failed"
            neutralDates.contains(dateKey) -> "Neutral"
            startDate == null || dateKey < startDate -> "Inactive"
            dateKey < todayKey -> "Failed"
            dateKey == todayKey -> "Pending"
            else -> "Upcoming"
        }
    }

    fun nextManualDailyPlanStatus(currentStatus: String?): String {
        return when (currentStatus) {
            "Completed" -> "Failed"
            "Failed" -> "Neutral"
            else -> "Completed"
        }
    }

    fun calculateStreak(
        todayKey: String,
        completedDates: List<String>,
    ): Int {
        val completed = completedDates.toSet()
        var cursor = todayKey
        var streak = 0

        while (completed.contains(cursor)) {
            streak += 1
            cursor = previousDateKey(cursor)
        }

        return streak
    }

    fun previousDateKey(dateKey: String): String {
        val parts = dateKey.split("-").map { it.toInt() }
        var year = parts[0]
        var month = parts[1]
        var day = parts[2] - 1

        if (day >= 1) {
            return dateKey(year, month, day)
        }

        month -= 1
        if (month < 1) {
            year -= 1
            month = 12
        }
        day = daysInMonth(year, month)
        return dateKey(year, month, day)
    }

    private fun daysInMonth(year: Int, month: Int): Int {
        return when (month) {
            1, 3, 5, 7, 8, 10, 12 -> 31
            4, 6, 9, 11 -> 30
            2 -> if (isLeapYear(year)) 29 else 28
            else -> 0
        }
    }

    private fun isLeapYear(year: Int): Boolean {
        return year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
    }

    private fun dateKey(year: Int, month: Int, day: Int): String {
        return "${year}-${month.twoDigits()}-${day.twoDigits()}"
    }

    private fun Long.twoDigits(): String = toString().padStart(2, '0')

    private fun Int.twoDigits(): String = toString().padStart(2, '0')
}
