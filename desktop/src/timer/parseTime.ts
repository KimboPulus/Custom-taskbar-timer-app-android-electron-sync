export function parseTime(value: string): number | null {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const parts = value.split(":");
  const [hours, minutes, seconds] = parts.map(Number);
  if (minutes > 59 || seconds > 59) {
    return null;
  }

  const milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;
  return milliseconds > 0 ? milliseconds : null;
}
