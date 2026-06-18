const editablePositions = [0, 1, 3, 4, 6, 7];

export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`;
}

export function nextEditablePosition(position: number): number {
  return editablePositions.find((candidate) => candidate >= position) ?? 7;
}

export function previousEditablePosition(position: number): number {
  return (
    [...editablePositions].reverse().find((candidate) => candidate < position) ??
    0
  );
}

type TimeDigitUpdate = {
  value: string;
  caretPosition: number;
  changed: boolean;
};

export function getTimeDigitUpdate(
  value: string,
  position: number,
  digit: string,
  caretPosition = position === 7 ? 8 : nextEditablePosition(position + 1),
): TimeDigitUpdate | null {
  const currentValue = normalizeTimeInput(value);
  const characters = currentValue.split("");
  characters[position] = digit;
  const candidate = characters.join("");
  const minutes = Number(candidate.slice(3, 5));
  const seconds = Number(candidate.slice(6, 8));

  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return {
    value: candidate,
    caretPosition,
    changed: candidate !== currentValue,
  };
}
