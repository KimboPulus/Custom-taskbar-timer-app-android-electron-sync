import { useEffect, useRef, useState } from "react";
import { formatTime } from "../timer/formatTime";
import { parseTime } from "../timer/parseTime";
import { FixedTimeInput } from "./FixedTimeInput";

type TimerDisplayProps = {
  remainingMs: number;
  compact?: boolean;
  onSetDuration?: (durationMs: number) => void;
};

export function TimerDisplay({
  remainingMs,
  compact = false,
  onSetDuration,
}: TimerDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(formatTime(remainingMs));
  const [invalid, setInvalid] = useState(false);
  const originalValue = useRef(formatTime(remainingMs));

  useEffect(() => {
    if (!editing) {
      setValue(formatTime(remainingMs));
    }
  }, [editing, remainingMs]);

  const commit = () => {
    const durationMs = parseTime(value);
    if (!durationMs) {
      setInvalid(true);
      return;
    }

    onSetDuration?.(durationMs);
    setInvalid(false);
    setEditing(false);
  };

  const cancel = () => {
    setValue(originalValue.current);
    setInvalid(false);
    setEditing(false);
  };

  if (editing && onSetDuration) {
    return (
      <FixedTimeInput
        className={`timer-display timer-display__input ${
          compact ? "timer-display--compact" : ""
        }`}
        value={value}
        ariaLabel="Timer duration in hours, minutes, and seconds"
        autoFocus
        invalid={invalid}
        onChange={(nextValue) => {
          setValue(nextValue);
          setInvalid(false);
        }}
        onBlur={commit}
        onCommit={commit}
        onCancel={cancel}
      />
    );
  }

  return (
    <button
      className={`timer-display ${
        onSetDuration ? "timer-display--editable" : ""
      } ${compact ? "timer-display--compact" : ""}`}
      type="button"
      title={onSetDuration ? "Click to type HH:MM:SS" : undefined}
      onClick={() => {
        if (onSetDuration) {
          const currentValue = formatTime(remainingMs);
          originalValue.current = currentValue;
          setValue(currentValue);
          setEditing(true);
        }
      }}
    >
      {formatTime(remainingMs)}
    </button>
  );
}
