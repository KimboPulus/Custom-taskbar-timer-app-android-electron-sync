import {
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  getTimeDigitUpdate,
  nextEditablePosition,
  normalizeTimeInput,
  previousEditablePosition,
} from "./fixedTimeInputLogic";

type FixedTimeInputProps = {
  id?: string;
  value: string;
  className?: string;
  ariaLabel: string;
  autoFocus?: boolean;
  invalid?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
};

export function FixedTimeInput({
  id,
  value,
  className = "",
  ariaLabel,
  autoFocus = false,
  invalid = false,
  onChange,
  onBlur,
  onCommit,
  onCancel,
}: FixedTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(autoFocus ? 0 : null);

  useLayoutEffect(() => {
    if (!autoFocus) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(0, 0);
  }, [autoFocus]);

  useLayoutEffect(() => {
    if (pendingCaret.current === null) {
      return;
    }

    inputRef.current?.setSelectionRange(
      pendingCaret.current,
      pendingCaret.current,
    );
    pendingCaret.current = null;
  }, [value]);

  useLayoutEffect(() => {
    if (invalid) {
      inputRef.current?.focus();
    }
  }, [invalid]);

  const replaceDigit = (
    position: number,
    digit: string,
    caretPosition?: number,
  ) => {
    const update = getTimeDigitUpdate(value, position, digit, caretPosition);
    if (!update) {
      return;
    }

    if (!update.changed) {
      pendingCaret.current = null;
      inputRef.current?.setSelectionRange(
        update.caretPosition,
        update.caretPosition,
      );
      return;
    }

    pendingCaret.current = update.caretPosition;
    onChange(update.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      const position =
        selectionEnd - selectionStart > 1
          ? 0
          : nextEditablePosition(selectionStart);
      replaceDigit(position, event.key);
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const position =
        event.key === "Backspace"
          ? previousEditablePosition(selectionStart)
          : nextEditablePosition(selectionStart);
      replaceDigit(position, "0", position);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const position =
        event.key === "ArrowLeft"
          ? previousEditablePosition(selectionStart)
          : nextEditablePosition(selectionStart + 1);
      input.setSelectionRange(position, position);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      input.setSelectionRange(0, 0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      input.setSelectionRange(8, 8);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onCommit?.();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel?.();
      return;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) {
      return;
    }

    const candidate = normalizeTimeInput(digits);
    if (Number(candidate.slice(3, 5)) > 59 || Number(candidate.slice(6, 8)) > 59) {
      return;
    }

    onChange(candidate);
    pendingCaret.current = 8;
  };

  return (
    <input
      ref={inputRef}
      id={id}
      className={`fixed-time-input ${className} ${
        invalid ? "fixed-time-input--invalid" : ""
      }`}
      type="text"
      inputMode="numeric"
      value={normalizeTimeInput(value)}
      aria-label={ariaLabel}
      aria-invalid={invalid}
      autoComplete="off"
      spellCheck={false}
      maxLength={8}
      onChange={(event) => {
        const candidate = normalizeTimeInput(event.target.value);
        if (
          Number(candidate.slice(3, 5)) <= 59 &&
          Number(candidate.slice(6, 8)) <= 59
        ) {
          onChange(candidate);
        }
      }}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={onBlur}
    />
  );
}
