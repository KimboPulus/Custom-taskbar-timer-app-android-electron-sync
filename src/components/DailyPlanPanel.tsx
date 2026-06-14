import { useEffect, useMemo, useState } from "react";
import {
  formatDailyTarget,
  getDailyPlanDayStatus,
  getDailyPlanYearStats,
  getLocalDateKey,
} from "../dailyPlan/dailyPlan";
import type { DailyPlanSettings } from "../desktop/desktopTypes";

type DailyPlanPanelProps = {
  plan: DailyPlanSettings;
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

export function DailyPlanPanel({
  plan,
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

  useEffect(() => {
    setTitle(plan.title);
    setTargetHours(String(plan.targetMinutes / 60));
  }, [plan.targetMinutes, plan.title]);

  const configured = plan.startDate !== null;
  const todayStatus = getDailyPlanDayStatus(todayKey, plan, todayKey);
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
    if (todayStatus === "completed") {
      completedDates.delete(todayKey);
    } else {
      completedDates.add(todayKey);
    }

    setSaving(true);
    await onSave({
      ...plan,
      completedDates: [...completedDates].sort(),
    });
    setSaving(false);
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
            <span className="daily-plan-kicker">
              {fullDateFormatter.format(today)}
            </span>
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

          <div className="daily-plan-legend" aria-label="Calendar legend">
            <span className="daily-plan-legend__success">Successful</span>
            <span className="daily-plan-legend__failed">Failed</span>
            <span className="daily-plan-legend__pending">Today</span>
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
                    const label = `${fullDateFormatter.format(date)}: ${status}`;

                    return (
                      <span
                        className={`calendar-day calendar-day--${status} ${
                          isToday ? "calendar-day--today" : ""
                        }`}
                        aria-label={label}
                        title={label}
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
    </div>
  );
}
