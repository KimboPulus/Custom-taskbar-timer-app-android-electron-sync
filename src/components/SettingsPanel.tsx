import { useEffect, useMemo, useState } from "react";
import { playAlarm, stopAlarm } from "../desktop/alarmPlayer";
import { electronApi } from "../desktop/electronApi";
import type {
  AlarmSound,
  AppSettings,
  ShortcutLabels,
  SystemSoundOption,
  ThemePreference,
} from "../desktop/desktopTypes";

type SettingsPanelProps = {
  settings: AppSettings;
  shortcutWarnings: string[];
  onClose: () => void;
  onSave: (patch: Partial<AppSettings>) => Promise<void>;
};

const shortcutFields: Array<{
  key: keyof ShortcutLabels;
  label: string;
}> = [
  { key: "togglePlayPause", label: "Play / pause" },
  { key: "toggleCompact", label: "Cycle window mode" },
  { key: "reset", label: "Reset" },
  { key: "addMinute", label: "Add one minute" },
  { key: "subtractMinute", label: "Subtract one minute" },
];

const builtInSound: AlarmSound = {
  kind: "built-in",
  id: "gentle-chime",
  label: "Gentle chime",
};

function soundValue(sound: AlarmSound): string {
  if (sound.kind === "built-in") {
    return "built-in:gentle-chime";
  }
  if (sound.kind === "system") {
    return `system:${sound.id}`;
  }
  return "custom:current";
}

export function SettingsPanel({
  settings,
  shortcutWarnings,
  onClose,
  onSave,
}: SettingsPanelProps) {
  const [shortcuts, setShortcuts] = useState(settings.shortcutLabels);
  const [systemSounds, setSystemSounds] = useState<SystemSoundOption[]>([]);
  const [saved, setSaved] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [soundError, setSoundError] = useState("");

  useEffect(() => setShortcuts(settings.shortcutLabels), [settings.shortcutLabels]);

  useEffect(() => {
    void electronApi.listSystemSounds().then(setSystemSounds);
    return stopAlarm;
  }, []);

  const selectedSoundValue = useMemo(
    () => soundValue(settings.alarmSound),
    [settings.alarmSound],
  );

  const saveShortcuts = async () => {
    await onSave({ shortcutLabels: shortcuts });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  const chooseCustomMedia = async () => {
    const selected = await electronApi.chooseCustomMedia();
    if (selected) {
      setSoundError("");
      await onSave({
        alarmSound: selected,
        soundEnabled: true,
      });
    }
  };

  const previewSound = async () => {
    setSoundError("");
    const played = await playAlarm(settings.alarmSound, settings.alarmVolume);
    setPreviewing(played);
    if (!played) {
      setSoundError("That media file is unavailable or could not be played.");
    }
  };

  const stopPreview = () => {
    stopAlarm();
    setPreviewing(false);
  };

  const selectSound = async (value: string) => {
    setSoundError("");
    stopPreview();

    if (value === "built-in:gentle-chime") {
      await onSave({ alarmSound: builtInSound, soundEnabled: true });
      return;
    }

    if (value === "custom:current") {
      return;
    }

    const id = value.slice("system:".length);
    const selected = systemSounds.find((sound) => sound.id === id);
    if (selected) {
      await onSave({
        alarmSound: {
          kind: "system",
          id: selected.id,
          label: selected.label,
        },
        soundEnabled: true,
      });
    }
  };

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-header">
          <div>
            <span className="eyebrow">Preferences</span>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            className="settings-close"
            type="button"
            onClick={onClose}
            aria-label="Close settings"
          >
            Close
          </button>
        </div>

        <div className="setting-row">
          <div>
            <strong>Finish alarm</strong>
            <p>Play the selected sound when the timer reaches zero.</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(event) => {
                if (!event.target.checked) {
                  stopPreview();
                }
                void onSave({ soundEnabled: event.target.checked });
              }}
            />
            <span />
          </label>
        </div>

        <div className="setting-block alarm-settings">
          <label htmlFor="alarm-sound">Alarm sound</label>
          <select
            id="alarm-sound"
            value={selectedSoundValue}
            onChange={(event) => void selectSound(event.target.value)}
          >
            <optgroup label="Built in">
              <option value="built-in:gentle-chime">Gentle chime</option>
            </optgroup>
            {systemSounds.length > 0 && (
              <optgroup label="Windows sounds">
                {systemSounds.map((sound) => (
                  <option value={`system:${sound.id}`} key={sound.id}>
                    {sound.label}
                  </option>
                ))}
              </optgroup>
            )}
            {settings.alarmSound.kind === "custom" && (
              <optgroup label="Custom">
                <option value="custom:current">
                  {settings.alarmSound.label}
                </option>
              </optgroup>
            )}
          </select>

          <div className="alarm-file-row">
            <button type="button" onClick={() => void chooseCustomMedia()}>
              Choose MP4 or audio
            </button>
            <span title={settings.alarmSound.label}>
              {settings.alarmSound.kind === "custom"
                ? settings.alarmSound.label
                : "No custom file selected"}
            </span>
          </div>

          <div className="volume-heading">
            <label htmlFor="alarm-volume">Volume</label>
            <span>{Math.round(settings.alarmVolume * 100)}%</span>
          </div>
          <input
            id="alarm-volume"
            className="volume-slider"
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.alarmVolume * 100)}
            onChange={(event) =>
              void onSave({ alarmVolume: Number(event.target.value) / 100 })
            }
          />

          <div className="alarm-preview-row">
            <button
              type="button"
              disabled={!settings.soundEnabled}
              onClick={() => void previewSound()}
            >
              Preview
            </button>
            <button
              type="button"
              className="secondary-setting-button"
              disabled={!previewing}
              onClick={stopPreview}
            >
              Stop
            </button>
            <span>Media plays for at most 30 seconds.</span>
          </div>
          {soundError && <p className="sound-error">{soundError}</p>}
        </div>

        <div className="setting-block">
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            value={settings.theme}
            onChange={(event) =>
              void onSave({
                theme: event.target.value as ThemePreference,
              })
            }
          >
            <option value="system">Use system setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        <div className="setting-row setting-row--taskbar">
          <div>
            <strong>Taskbar timer mode</strong>
            <p>
              Include the taskbar overlay in the Ctrl+Alt+T mode cycle.
            </p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              aria-label="Enable taskbar timer mode"
              checked={settings.taskbarModeEnabled}
              onChange={(event) =>
                void onSave({ taskbarModeEnabled: event.target.checked })
              }
            />
            <span />
          </label>
        </div>

        <div className="setting-block">
          <div className="setting-block__heading">
            <div>
              <label>Global shortcuts</label>
              <p>Electron accelerator format, active across Windows.</p>
            </div>
            <button type="button" onClick={saveShortcuts}>
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          <div className="shortcut-list">
            {shortcutFields.map((field) => (
              <label className="shortcut-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  value={shortcuts[field.key]}
                  onChange={(event) =>
                    setShortcuts((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>

        {shortcutWarnings.length > 0 && (
          <div className="shortcut-warnings">
            <strong>Shortcut warning</strong>
            {shortcutWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
