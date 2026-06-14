type IconProps = {
  size?: number;
};

export function PlayIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M8 5v14l11-7z" fill="currentColor" />
    </svg>
  );
}

export function PauseIcon({ size = 22 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor" />
    </svg>
  );
}

export function ResetIcon({ size = 20 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M12 5a7 7 0 1 1-6.32 4H9V7H2v7h2V10.7A9 9 0 1 0 12 3v2z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CompactIcon({ size = 19 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 7h8v3H8v-3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ExpandIcon({ size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M4 4h7v2H6v5H4V4zm9 0h7v7h-2V6h-5V4zM4 13h2v5h5v2H4v-7zm14 0h2v7h-7v-2h5v-5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 19 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58-1.92-3.32-2.39.96a7.1 7.1 0 0 0-1.63-.94L14.86 3h-3.84l-.36 3.18c-.58.24-1.12.55-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58c-.05.31-.07.64-.07.94 0 .31.02.63.07.94l-2.03 1.58 1.92 3.32 2.39-.96c.5.39 1.05.71 1.63.94l.36 3.18h3.84l.36-3.18a7.1 7.1 0 0 0 1.63-.94l2.39.96 1.92-3.32-2.02-1.58zM12.94 15A3 3 0 1 1 12.93 9a3 3 0 0 1 .01 6z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm11 8H6v10h12V10zM6 6v2h12V6h-2v1h-2V6H9v1H7V6H6zm2 7h3v3H8v-3z"
        fill="currentColor"
      />
    </svg>
  );
}
