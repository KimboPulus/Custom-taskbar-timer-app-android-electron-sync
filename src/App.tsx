import { useCallback, useEffect, useRef, useState } from "react";
import { CompactTimer } from "./components/CompactTimer";
import { DailyPlanPanel } from "./components/DailyPlanPanel";
import { FullTimer } from "./components/FullTimer";
import { SettingsPanel } from "./components/SettingsPanel";
import { WindowChrome } from "./components/WindowChrome";
import { playAlarm } from "./desktop/alarmPlayer";
import { electronApi } from "./desktop/electronApi";
import type {
  AppSettings,
  ShortcutAction,
} from "./desktop/desktopTypes";
import { useTimerStore } from "./timer/timerStore";

const fallbackSettings: AppSettings = {
  selectedDurationMs: 25 * 60 * 1000,
  timerState: {
    durationMs: 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    status: "idle",
    startedAt: null,
    pausedRemainingMs: null,
  },
  focusPresets: [
    5 * 60 * 1000,
    25 * 60 * 1000,
    50 * 60 * 1000,
    2 * 60 * 60 * 1000,
  ],
  compactMode: false,
  compactPosition: null,
  soundEnabled: true,
  alarmSound: {
    kind: "built-in",
    id: "gentle-chime",
    label: "Gentle chime",
  },
  alarmVolume: 0.7,
  theme: "system",
  shortcutLabels: {
    togglePlayPause: "Control+Alt+Space",
    toggleCompact: "Control+Alt+T",
    reset: "Control+Alt+R",
    addMinute: "Control+Alt+Up",
    subtractMinute: "Control+Alt+Down",
  },
  dailyPlan: {
    title: "Reading",
    targetMinutes: 270,
    startDate: null,
    completedDates: [],
  },
};

export default function App() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyPlanOpen, setDailyPlanOpen] = useState(false);
  const [shortcutWarnings, setShortcutWarnings] = useState<string[]>([]);
  const [compactMode, setCompactMode] = useState(false);
  const timer = useTimerStore(fallbackSettings.selectedDurationMs);
  const previousStatus = useRef(timer.state.status);

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const saved = await electronApi.saveSettings(patch);
    setSettings(saved);
    setShortcutWarnings(await electronApi.getShortcutWarnings());
  }, []);

  useEffect(() => {
    void Promise.all([
      electronApi.loadSettings(),
      electronApi.getShortcutWarnings(),
    ]).then(([loaded, warnings]) => {
      setSettings(loaded);
      setCompactMode(loaded.compactMode);
      previousStatus.current = loaded.timerState.status;
      timer.restore(loaded.timerState);
      setShortcutWarnings(warnings);
      setSettingsReady(true);
    });
  }, [timer.restore]);

  useEffect(() => {
    if (settingsReady) {
      electronApi.saveTimerState(timer.state);
    }
  }, [settingsReady, timer.state]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(() => {
    if (
      timer.state.status === "finished" &&
      previousStatus.current !== "finished"
    ) {
      if (settings.soundEnabled) {
        void playAlarm(settings.alarmSound, settings.alarmVolume);
      }
      electronApi.notifyTimerFinished();
    }
    previousStatus.current = timer.state.status;
  }, [
    settings.alarmSound,
    settings.alarmVolume,
    settings.soundEnabled,
    timer.state.status,
  ]);

  const enterCompact = useCallback(async () => {
    await electronApi.enterCompactMode();
    setCompactMode(true);
    setSettings((current) => ({ ...current, compactMode: true }));
  }, []);

  const exitCompact = useCallback(async () => {
    await electronApi.exitCompactMode();
    setCompactMode(false);
    setSettings((current) => ({ ...current, compactMode: false }));
  }, []);

  const toggleCompact = useCallback(async () => {
    await electronApi.toggleCompactMode();
    setCompactMode((current) => !current);
    setSettings((current) => ({
      ...current,
      compactMode: !current.compactMode,
    }));
  }, []);

  useEffect(() => {
    const handleShortcut = (action: ShortcutAction) => {
      switch (action) {
        case "toggle-play-pause":
          timer.toggle();
          break;
        case "toggle-compact":
          void toggleCompact();
          break;
        case "reset":
          timer.reset();
          break;
        case "add-minute":
          timer.changeTime(60_000);
          break;
        case "subtract-minute":
          timer.changeTime(-60_000);
          break;
      }
    };

    return electronApi.onShortcutAction(handleShortcut);
  }, [timer.toggle, timer.reset, timer.changeTime, toggleCompact]);

  const selectDuration = useCallback(
    (durationMs: number) => {
      timer.changeDuration(durationMs);
      void saveSettings({ selectedDurationMs: durationMs });
    },
    [saveSettings, timer.changeDuration],
  );

  const addCustomPreset = useCallback(
    (durationMs: number) => {
      const focusPresets = Array.from(
        new Set([...settings.focusPresets, durationMs]),
      ).slice(-12);
      void saveSettings({ focusPresets });
      selectDuration(durationMs);
    },
    [saveSettings, selectDuration, settings.focusPresets],
  );

  const deletePreset = useCallback(
    (durationMs: number) => {
      void saveSettings({
        focusPresets: settings.focusPresets.filter(
          (preset) => preset !== durationMs,
        ),
      });
    },
    [saveSettings, settings.focusPresets],
  );

  if (!settingsReady) {
    return <div className="app-loading">Loading timer...</div>;
  }

  return (
    <div className={`app-shell ${compactMode ? "app-shell--compact" : ""}`}>
      <WindowChrome compact={compactMode} />
      {compactMode ? (
        <CompactTimer
          timer={timer.state}
          onToggle={timer.toggle}
          onReset={timer.reset}
          onSetDuration={selectDuration}
          onExitCompact={exitCompact}
        />
      ) : (
        <FullTimer
          timer={timer.state}
          settings={settings}
          onToggle={timer.toggle}
          onReset={timer.reset}
          onDurationChange={selectDuration}
          onAddCustomPreset={addCustomPreset}
          onDeletePreset={deletePreset}
          onEnterCompact={enterCompact}
          onOpenSettings={() => {
            setDailyPlanOpen(false);
            setSettingsOpen(true);
          }}
          onOpenDailyPlan={() => {
            setSettingsOpen(false);
            setDailyPlanOpen(true);
          }}
        />
      )}
      {settingsOpen && !compactMode && (
        <SettingsPanel
          settings={settings}
          shortcutWarnings={shortcutWarnings}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />
      )}
      {dailyPlanOpen && !compactMode && (
        <DailyPlanPanel
          plan={settings.dailyPlan}
          onClose={() => setDailyPlanOpen(false)}
          onSave={(dailyPlan) => saveSettings({ dailyPlan })}
        />
      )}
    </div>
  );
}
