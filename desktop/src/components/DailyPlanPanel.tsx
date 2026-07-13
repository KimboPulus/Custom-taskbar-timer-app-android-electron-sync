import { useEffect, useMemo, useState } from "react";
import {
  clearDailyPlanRemainingTime,
  formatDailyTarget,
  getCurrentDailyPlanStreak,
  getDailyPlanDayStatus,
  getDailyPlanRemainingTime,
  getDailyPlanYearStats,
  getLocalDateKey,
  getNextPastDailyPlanStatus,
  setDailyPlanRemainingTime,
  setPastDailyPlanDateStatus,
  togglePastDailyPlanDate,
} from "../dailyPlan/dailyPlan";
import { getRandomProQuote } from "../dailyPlan/proQuotes";
import type { DailyPlanSettings } from "../desktop/desktopTypes";
import { electronApi } from "../desktop/electronApi";
import { formatTime } from "../timer/formatTime";
import { parseTime } from "../timer/parseTime";
import flameIconUrl from "../assets/flame.webp?url";
import { FixedTimeInput } from "./FixedTimeInput";

type DailyPlanPanelProps = {
  plan: DailyPlanSettings;
  proModeEnabled: boolean;
  onClose: () => void;
  onSave: (plan: DailyPlanSettings) => Promise<void>;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdayNames = ["M", "T", "W", "T", "F", "S", "S"];

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function DailyPlanPanel({
  plan,
  proModeEnabled,
  onClose,
  onSave,
}: DailyPlanPanelProps) {
  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const currentYear = today.getFullYear();
  const [title, setTitle] = useState(plan.title);
  const [targetHours, setTargetHours] = useState(
    String(plan.targetMinutes / 60),
  );
  const [year, setYear] = useState(currentYear);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [streakPopup, setStreakPopup] = useState<number | null>(null);
  const [proQuote] = useState(getRandomProQuote);
  const [timeLeftDate, setTimeLeftDate] = useState(todayKey);
  const [timeLeftValue, setTimeLeftValue] = useState(
    formatTime(plan.targetMinutes * 60 * 1000),
  );
  const [timeLeftInvalid, setTimeLeftInvalid] = useState(false);

  useEffect(() => {
    setTitle(plan.title);
    setTargetHours(String(plan.targetMinutes / 60));
  }, [plan.targetMinutes, plan.title]);

  useEffect(() => {
    const savedRemainingMs = getDailyPlanRemainingTime(plan, timeLeftDate);
    setTimeLeftValue(
      formatTime(savedRemainingMs ?? plan.targetMinutes * 60 * 1000),
    );
    setTimeLeftInvalid(false);
  }, [plan, timeLeftDate]);

  const configured = plan.startDate !== null;
  const todayStatus = getDailyPlanDayStatus(todayKey, plan, todayKey);
  const currentStreak = getCurrentDailyPlanStreak(plan, todayKey);
  const yearStats = useMemo(
    () => getDailyPlanYearStats(year, plan, todayKey),
    [plan, todayKey, year],
  );

  const savePlan = async () => {
    const parsedHours = Number(targetHours);
    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("Give the plan a name.");
      return;
    }
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      setError("Enter a daily target between 0.25 and 24 hours.");
      return;
    }

    setSaving(true);
    setError("");
    await onSave({
      ...plan,
      title: cleanTitle,
      targetMinutes: Math.max(1, Math.round(parsedHours * 60)),
      startDate: plan.startDate ?? todayKey,
    });
    setSaving(false);
  };

  const toggleToday = async () => {
    if (!configured) {
      return;
    }

    const completedDates = new Set(plan.completedDates);
    const failedDates = new Set(plan.failedDates);
    const neutralDates = new Set(plan.neutralDates);
    if (todayStatus === "completed") {
      completedDates.delete(todayKey);
    } else {
      failedDates.delete(todayKey);
      neutralDates.delete(todayKey);
      completedDates.add(todayKey);
    }

    const nextPlan = {
      ...plan,
      completedDates: [...completedDates].sort(),
      failedDates: [...failedDates].sort(),
      neutralDates: [...neutralDates].sort(),
    };
    const nextStreak = getCurrentDailyPlanStreak(nextPlan, todayKey);

    await onSave(nextPlan);

    if (
      todayStatus !== "completed" &&
      nextStreak > 0 &&
      nextStreak % 10 === 0
    ) {
      setStreakPopup(nextStreak);
    }
  };

  const togglePastDate = async (dateKey: string) => {
    if (
      !configured ||
      dateKey >= todayKey
    ) {
      return;
    }

    await onSave(togglePastDailyPlanDate(plan, dateKey));
  };

  const neutralizePastDate = async (dateKey: string) => {
    if (!configured || dateKey >= todayKey) {
      return;
    }

    await onSave(setPastDailyPlanDateStatus(plan, dateKey, "neutral"));
  };

  const selectTimeLeftDate = (dateKey: string) => {
    setTimeLeftDate(dateKey);
    const savedRemainingMs = getDailyPlanRemainingTime(plan, dateKey);
    setTimeLeftValue(
      formatTime(savedRemainingMs ?? plan.targetMinutes * 60 * 1000),
    );
    setTimeLeftInvalid(false);
  };

  const saveTimeLeft = async () => {
    const dateKey = timeLeftDate.trim();
    const remainingMs = parseTime(timeLeftValue);

    if (!isDateKey(dateKey)) {
      setTimeLeftInvalid(true);
      setHistoryMessage("Pick a valid day for the saved time left.");
      return;
    }
    if (remainingMs === null) {
      setTimeLeftInvalid(true);
      setHistoryMessage("Enter time left as HH:MM:SS.");
      return;
    }

    setSaving(true);
    setTimeLeftInvalid(false);
    try {
      await onSave(setDailyPlanRemainingTime(plan, dateKey, remainingMs));
      setHistoryMessage(`Saved ${formatTime(remainingMs)} left for ${dateKey}.`);
    } finally {
      setSaving(false);
    }
  };

  const clearTimeLeft = async () => {
    const dateKey = timeLeftDate.trim();
    if (!isDateKey(dateKey)) {
      setTimeLeftInvalid(true);
      setHistoryMessage("Pick a valid day before clearing saved time.");
      return;
    }

    setSaving(true);
    setTimeLeftInvalid(false);
    try {
      await onSave(clearDailyPlanRemainingTime(plan, dateKey));
      setHistoryMessage(`Cleared saved time left for ${dateKey}.`);
    } finally {
      setSaving(false);
    }
  };

  const exportHistory = async () => {
    setHistoryMessage("");
    const result = await electronApi.exportDailyPlanHistory(plan);
    if (result.canceled) {
      return;
    }
    setHistoryMessage(
      result.error
        ? `Export failed: ${result.error}`
        : `Exported history to ${result.filePath}.`,
    );
  };

  const importHistory = async () => {
    setHistoryMessage("");
    const result = await electronApi.importDailyPlanHistory();
    if (result.canceled) {
      return;
    }
    if (result.error || !result.plan) {
      setHistoryMessage(
        `Import failed: ${result.error ?? "No daily plan found in file."}`,
      );
      return;
    }

    setSaving(true);
    try {
      await onSave(result.plan);
      setHistoryMessage("Imported daily plan history.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="daily-plan-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="daily-plan-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-plan-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="daily-plan-header">
          <div>
            <span className="eyebrow">Daily plan</span>
            <h2 id="daily-plan-title">Build the year, one day at a time.</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close daily plan">
            Close
          </button>
        </div>

        <div className="daily-plan-top">
          <section className="daily-plan-setup" aria-labelledby="plan-setup-title">
            <div>
              <span className="daily-plan-kicker">Your commitment</span>
              <h3 id="plan-setup-title">
                {configured ? plan.title : "Set a daily goal"}
              </h3>
              {configured && (
                <p>
                  Tracking since {plan.startDate}. Changing the goal keeps your
                  history.
                </p>
              )}
            </div>

            <label>
              Plan name
              <input
                value={title}
                maxLength={80}
                placeholder="Reading"
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
              />
            </label>
            <label>
              Daily target in hours
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={targetHours}
                onChange={(event) => {
                  setTargetHours(event.target.value);
                  setError("");
                }}
              />
            </label>
            <button
              className="daily-plan-set"
              type="button"
              disabled={saving}
              onClick={() => void savePlan()}
            >
              {configured ? "Update plan" : "Set plan"}
            </button>
            {error && <p className="daily-plan-error">{error}</p>}
          </section>

          <section
            className={`daily-plan-today daily-plan-today--${todayStatus}`}
            aria-labelledby="today-plan-title"
          >
            <div className="daily-plan-today__heading">
              <span className="daily-plan-kicker">
                {fullDateFormatter.format(today)}
              </span>
              <div
                className={`daily-plan-streak ${
                  currentStreak > 0 ? "daily-plan-streak--active" : ""
                }`}
                aria-label={`${currentStreak} day streak`}
                title={`${currentStreak} day streak`}
              >
                <img
                  className="daily-plan-streak__flame"
                  src={flameIconUrl}
                  alt=""
                  aria-hidden="true"
                />
                <strong>{currentStreak}</strong>
                <span>{currentStreak === 1 ? "day" : "days"}</span>
              </div>
            </div>
            <h3 id="today-plan-title">
              {configured ? plan.title : "No plan set yet"}
            </h3>
            <p>
              {configured
                ? `${formatDailyTarget(plan.targetMinutes)} planned for today.`
                : "Set your daily goal to begin tracking."}
            </p>
            <div className="daily-plan-today__status">
              <span aria-hidden="true" />
              {todayStatus === "completed"
                ? "Marked successful"
                : configured
                  ? "Waiting for completion"
                  : "Not tracking"}
            </div>
            <button
              type="button"
              disabled={!configured || saving}
              onClick={() => void toggleToday()}
            >
              {todayStatus === "completed" ? "Undo done" : "Done for today"}
            </button>
          </section>
        </div>

        <section className="daily-plan-history" aria-labelledby="history-title">
          {proModeEnabled && (
            <blockquote className="daily-plan-pro-quote">
              <span>Pro mode</span>
              <p>"{proQuote}"</p>
            </blockquote>
          )}
          <div className="daily-plan-history__header">
            <div>
              <span className="daily-plan-kicker">History</span>
              <h3 id="history-title">{year} calendar</h3>
            </div>
            <div className="daily-plan-stats" aria-label={`${year} summary`}>
              <span>
                <strong>{yearStats.completed}</strong> successful
              </span>
              <span>
                <strong>{yearStats.failed}</strong> failed
              </span>
            </div>
            <div className="daily-plan-year-controls">
              <button
                type="button"
                onClick={() => void exportHistory()}
                aria-label="Export daily plan history"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => void importHistory()}
                aria-label="Import daily plan history"
              >
                Import
              </button>
              <button
                type="button"
                onClick={() => setYear((current) => current - 1)}
                aria-label="Previous year"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={year === currentYear}
                onClick={() =>
                  setYear((current) => Math.min(current + 1, currentYear))
                }
                aria-label="Next year"
              >
                Next
              </button>
            </div>
          </div>

          {historyMessage && (
            <p className="daily-plan-history-message">{historyMessage}</p>
          )}

          <div className="daily-plan-time-left">
            <div>
              <span className="daily-plan-kicker">Time left note</span>
              <h4>Save unfinished time for a day</h4>
              <p>
                Example: save 02:30:00 for 2026-06-20 when that day still has
                2.5h left.
              </p>
            </div>
            <label>
              Day
              <input
                type="date"
                value={timeLeftDate}
                onChange={(event) => {
                  setTimeLeftDate(event.target.value);
                  setTimeLeftInvalid(false);
                }}
              />
            </label>
            <label>
              Time left (HH:MM:SS)
              <FixedTimeInput
                value={timeLeftValue}
                ariaLabel="Daily plan time left"
                invalid={timeLeftInvalid}
                onChange={(value) => {
                  setTimeLeftValue(value);
                  setTimeLeftInvalid(false);
                }}
                onCommit={() => void saveTimeLeft()}
              />
            </label>
            <div className="daily-plan-time-left__actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveTimeLeft()}
              >
                Save time left
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void clearTimeLeft()}
              >
                Clear
              </button>
            </div>
            <p className="daily-plan-time-left__saved">
              Saved for {timeLeftDate}:{" "}
              {getDailyPlanRemainingTime(plan, timeLeftDate) === null
                ? "none"
                : formatTime(getDailyPlanRemainingTime(plan, timeLeftDate)!)}
            </p>
          </div>

          <div className="daily-plan-legend" aria-label="Calendar legend">
            <span className="daily-plan-legend__success">Successful</span>
            <span className="daily-plan-legend__failed">Failed</span>
            <span className="daily-plan-legend__neutral">Neutral</span>
            <span className="daily-plan-legend__pending">Today</span>
            <span className="daily-plan-legend__hint">
              Left-click to cycle status. Right-click to mark neutral.
            </span>
          </div>

          <div className="year-calendar">
            {monthNames.map((monthName, month) => (
              <section className="calendar-month" key={monthName}>
                <h4>{monthName}</h4>
                <div className="calendar-weekdays" aria-hidden="true">
                  {weekdayNames.map((weekday, index) => (
                    <span key={`${weekday}-${index}`}>{weekday}</span>
                  ))}
                </div>
                <div className="calendar-days">
                  {getCalendarDays(year, month).map((day, index) => {
                    if (day === null) {
                      return (
                        <span
                          className="calendar-day calendar-day--blank"
                          key={`blank-${index}`}
                        />
                      );
                    }

                    const date = new Date(year, month, day);
                    const dateKey = getLocalDateKey(date);
                    const status = getDailyPlanDayStatus(
                      dateKey,
                      plan,
                      todayKey,
                    );
                    const isToday = dateKey === todayKey;
                    const remainingMs = getDailyPlanRemainingTime(
                      plan,
                      dateKey,
                    );
                    const timeLeftLabel =
                      remainingMs === null
                        ? ""
                        : ` Time left saved: ${formatTime(remainingMs)}.`;
                    const editable =
                      configured &&
                      dateKey < todayKey;
                    const nextStatus = getNextPastDailyPlanStatus(
                      plan,
                      dateKey,
                    );
                    const label = editable
                      ? `${fullDateFormatter.format(date)}: ${status}.${timeLeftLabel} Left-click to mark ${nextStatus}; right-click to mark neutral.`
                      : `${fullDateFormatter.format(date)}: ${status}.${timeLeftLabel}`;
                    const className = `calendar-day calendar-day--${status} ${
                      isToday ? "calendar-day--today" : ""
                    } ${editable ? "calendar-day--editable" : ""} ${
                      remainingMs !== null ? "calendar-day--has-time" : ""
                    }`;

                    return editable ? (
                      <button
                        type="button"
                        className={className}
                        aria-label={label}
                        title={label}
                        disabled={saving}
                        onClick={() => {
                          selectTimeLeftDate(dateKey);
                          void togglePastDate(dateKey);
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          selectTimeLeftDate(dateKey);
                          void neutralizePastDate(dateKey);
                        }}
                        key={dateKey}
                      >
                        {day}
                      </button>
                    ) : (
                      <span
                        className={className}
                        aria-label={label}
                        title={label}
                        onClick={() => selectTimeLeftDate(dateKey)}
                        key={dateKey}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
      {streakPopup !== null && (
        <div
          className="streak-popup"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="streak-popup-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <span className="streak-popup__kicker">{streakPopup} day streak</span>
          <h3 id="streak-popup-title">Who's gonna carry the boats?</h3>
          <p>Another 10-day block finished. Keep the chain alive.</p>
          <button type="button" onClick={() => setStreakPopup(null)}>
            Back to work
          </button>
        </div>
      )}
    </div>
  );
}
