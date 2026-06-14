import { useState } from "react";
import type { AppSettings } from "../desktop/desktopTypes";
import { parseTime } from "../timer/parseTime";
import type { TimerState } from "../timer/timerTypes";
import { CalendarIcon, CompactIcon, SettingsIcon } from "./icons";
import { FixedTimeInput } from "./FixedTimeInput";
import { PresetButtons } from "./PresetButtons";
import { TimerControls } from "./TimerControls";
import { TimerRing } from "./TimerRing";

type FullTimerProps = {
  timer: TimerState;
  settings: AppSettings;
  onToggle: () => void;
  onReset: () => void;
  onDurationChange: (durationMs: number) => void;
  onAddCustomPreset: (durationMs: number) => void;
  onDeletePreset: (durationMs: number) => void;
  onEnterCompact: () => void;
  onOpenSettings: () => void;
  onOpenDailyPlan: () => void;
};

export function FullTimer({
  timer,
  settings,
  onToggle,
  onReset,
  onDurationChange,
  onAddCustomPreset,
  onDeletePreset,
  onEnterCompact,
  onOpenSettings,
  onOpenDailyPlan,
}: FullTimerProps) {
  const [customTime, setCustomTime] = useState("00:25:00");
  const [customTimeInvalid, setCustomTimeInvalid] = useState(false);

  const applyCustomTimer = () => {
    const durationMs = parseTime(customTime);
    setCustomTimeInvalid(!durationMs);
    if (durationMs) {
      onDurationChange(durationMs);
    }
  };

  const saveCustomPreset = () => {
    const durationMs = parseTime(customTime);
    setCustomTimeInvalid(!durationMs);
    if (durationMs) {
      onAddCustomPreset(durationMs);
    }
  };

  return (
    <main className="full-layout">
      <section className="timer-column">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Today&apos;s session</span>
            <h1>Make the next block count.</h1>
          </div>
          <div className="top-actions">
            <button
              className="icon-text-button"
              type="button"
              onClick={onOpenDailyPlan}
            >
              <CalendarIcon />
              Plan
            </button>
            <button
              className="icon-text-button"
              type="button"
              onClick={onEnterCompact}
              title="Compact mode (Ctrl+Alt+T)"
            >
              <CompactIcon />
              Compact
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onOpenSettings}
              aria-label="Open settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>

        <div className="timer-card">
          <TimerRing
            durationMs={timer.durationMs}
            remainingMs={timer.remainingMs}
            status={timer.status}
            onSetDuration={onDurationChange}
          />
          <TimerControls
            status={timer.status}
            onToggle={onToggle}
            onReset={onReset}
          />
          <p className="shortcut-hint">
            Ctrl + Alt + Space to play or pause
          </p>
        </div>
      </section>

      <aside className="duration-panel">
        <span className="eyebrow">Duration</span>
        <h2>Choose a focus block</h2>
        <PresetButtons
          selectedDurationMs={timer.durationMs}
          focusPresets={settings.focusPresets}
          onSelect={onDurationChange}
          onDelete={onDeletePreset}
        />

        <div className="custom-duration">
          <label htmlFor="custom-time">Exact time (HH:MM:SS)</label>
          <div className="custom-duration__row">
            <FixedTimeInput
              id="custom-time"
              value={customTime}
              ariaLabel="Exact time (HH:MM:SS)"
              invalid={customTimeInvalid}
              onChange={(nextValue) => {
                setCustomTime(nextValue);
                setCustomTimeInvalid(false);
              }}
              onCommit={applyCustomTimer}
            />
            <button type="button" onClick={applyCustomTimer}>
              Set
            </button>
          </div>
          <button
            className="save-preset-button"
            type="button"
            onClick={saveCustomPreset}
          >
            Save as preset
          </button>
        </div>

      </aside>
    </main>
  );
}
