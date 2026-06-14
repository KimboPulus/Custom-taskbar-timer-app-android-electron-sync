import type { TimerStatus } from "../timer/timerTypes";
import { TimerDisplay } from "./TimerDisplay";

type TimerRingProps = {
  durationMs: number;
  remainingMs: number;
  status: TimerStatus;
  onSetDuration: (durationMs: number) => void;
};

export function TimerRing({
  durationMs,
  remainingMs,
  status,
  onSetDuration,
}: TimerRingProps) {
  const radius = 132;
  const circumference = 2 * Math.PI * radius;
  const progress = durationMs > 0 ? remainingMs / durationMs : 0;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <div className="timer-ring">
      <svg viewBox="0 0 300 300" className="timer-ring__svg" aria-hidden="true">
        <circle className="timer-ring__track" cx="150" cy="150" r={radius} />
        <circle
          className="timer-ring__progress"
          cx="150"
          cy="150"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="timer-ring__content">
        <TimerDisplay
          remainingMs={remainingMs}
          onSetDuration={onSetDuration}
        />
        <span className={`status-label status-label--${status}`}>
          {status === "running" ? "Focusing" : status}
        </span>
      </div>
    </div>
  );
}
