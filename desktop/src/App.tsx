import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { CompactTimer } from "./components/CompactTimer";
import { DailyPlanPanel } from "./components/DailyPlanPanel";
import { FullTimer } from "./components/FullTimer";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskbarTimer } from "./components/TaskbarTimer";
import { WindowChrome } from "./components/WindowChrome";
import { playAlarm, playTimerClick } from "./desktop/alarmPlayer";
import { electronApi } from "./desktop/electronApi";
import type {
  AppSettings,
  ShortcutAction,
  WindowMode,
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
  focusPresets: [],
  windowMode: "full",
  taskbarModeEnabled: true,
  launchAtStartup: false,
  proModeEnabled: false,
  compactPosition: null,
  soundEnabled: true,
  pauseSoundEnabled: true,
  resumeSoundEnabled: true,
  clickSoundVolume: 0.18,
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
    failedDates: [],
    neutralDates: [],
    remainingTimes: [],
  },
};

export default function App() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyPlanOpen, setDailyPlanOpen] = useState(false);
  const [shortcutWarnings, setShortcutWarnings] = useState<string[]>([]);
  const [windowMode, setWindowMode] = useState<WindowMode>("full");
  const [modeTransitionId, setModeTransitionId] = useState<number>();
  const timer = useTimerStore(fallbackSettings.selectedDurationMs);
  const previousStatus = useRef(timer.state.status);
  const settingsSaveSequence = useRef(0);

  const saveSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const saveSequence = ++settingsSaveSequence.current;
    setSettings((current) => ({
      ...current,
      ...patch,
      shortcutLabels: patch.shortcutLabels
        ? { ...current.shortcutLabels, ...patch.shortcutLabels }
        : current.shortcutLabels,
      dailyPlan: patch.dailyPlan ?? current.dailyPlan,
    }));
    const saved = await electronApi.saveSettings(patch);
    if (saveSequence === settingsSaveSequence.current) {
      setSettings(saved);
    }
    setShortcutWarnings(await electronApi.getShortcutWarnings());
  }, []);

  useEffect(() => {
    void Promise.all([
      electronApi.loadSettings(),
      electronApi.getShortcutWarnings(),
    ]).then(([loaded, warnings]) => {
      setSettings(loaded);
      setWindowMode(loaded.windowMode);
      setModeTransitionId(undefined);
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

  useEffect(
    () =>
      electronApi.onRemoteSettingsApplied((remoteSettings) => {
        settingsSaveSequence.current += 1;
        setSettings(remoteSettings);
        setWindowMode(remoteSettings.windowMode);
        setModeTransitionId(undefined);
        previousStatus.current = remoteSettings.timerState.status;
        timer.restore(remoteSettings.timerState);
      }),
    [timer.restore],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
  }, [settings.theme]);

  useEffect(
    () =>
      electronApi.onWindowModeChanged((mode, transitionId) => {
        setWindowMode(mode);
        setModeTransitionId(transitionId);
        setSettings((current) => ({ ...current, windowMode: mode }));
      }),
    [],
  );

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    if (modeTransitionId === undefined) {
      const timeout = window.setTimeout(() => {
        electronApi.notifyWindowModeRendered(windowMode);
      }, 0);

      return () => window.clearTimeout(timeout);
    }

    const firstFrame = requestAnimationFrame(() => {
      electronApi.notifyWindowModeRendered(windowMode, modeTransitionId);
    });

    return () => {
      cancelAnimationFrame(firstFrame);
    };
  }, [modeTransitionId, settingsReady, windowMode]);

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

  const toggleTimer = useCallback(() => {
    const transition = timer.toggle();
    if (
      transition.previousStatus === "running" &&
      transition.nextStatus === "paused" &&
      settings.pauseSoundEnabled
    ) {
      void playTimerClick("pause", settings.clickSoundVolume);
    } else if (
      transition.previousStatus === "paused" &&
      transition.nextStatus === "running" &&
      settings.resumeSoundEnabled
    ) {
      void playTimerClick("resume", settings.clickSoundVolume);
    }
  }, [
    settings.clickSoundVolume,
    settings.pauseSoundEnabled,
    settings.resumeSoundEnabled,
    timer.toggle,
  ]);

  const cycleWindowMode = useCallback(async () => {
    const appliedMode = await electronApi.cycleWindowMode();
    setWindowMode(appliedMode);
    setSettings((current) => ({
      ...current,
      windowMode: appliedMode,
    }));
  }, []);

  const exitCompactMode = useCallback(async () => {
    const appliedMode = await electronApi.setWindowMode("full");
    setWindowMode(appliedMode);
    setSettings((current) => ({
      ...current,
      windowMode: appliedMode,
    }));
  }, []);

  useEffect(() => {
    const handleShortcut = (action: ShortcutAction) => {
      if (settingsOpen || dailyPlanOpen) {
        return;
      }
      switch (action) {
        case "toggle-play-pause":
          toggleTimer();
          break;
        case "toggle-compact":
          void cycleWindowMode();
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
  }, [
    dailyPlanOpen,
    settingsOpen,
    toggleTimer,
    timer.reset,
    timer.changeTime,
    cycleWindowMode,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      if (settingsOpen) {
        event.preventDefault();
        setSettingsOpen(false);
        return;
      }

      if (dailyPlanOpen) {
        event.preventDefault();
        setDailyPlanOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dailyPlanOpen, settingsOpen]);

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

  const compactMode = windowMode === "compact";
  const taskbarMode = windowMode === "taskbar";

  return (
    <div
      className={`app-shell ${
        compactMode
          ? "app-shell--compact"
          : taskbarMode
            ? "app-shell--taskbar"
            : ""
      }`}
    >
      {!taskbarMode && !compactMode && <WindowChrome compact={false} />}
      {taskbarMode ? (
        <TaskbarTimer timer={timer.state} />
      ) : compactMode ? (
        <CompactTimer
          timer={timer.state}
          onExitCompact={() => void exitCompactMode()}
        />
      ) : (
        <FullTimer
          timer={timer.state}
          settings={settings}
          onToggle={toggleTimer}
          onReset={timer.reset}
          onDurationChange={selectDuration}
          onAddCustomPreset={addCustomPreset}
          onDeletePreset={deletePreset}
          onEnterCompact={() => void cycleWindowMode()}
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
      {settingsOpen && windowMode === "full" && (
        <SettingsPanel
          settings={settings}
          shortcutWarnings={shortcutWarnings}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
        />
      )}
      {dailyPlanOpen && windowMode === "full" && (
        <DailyPlanPanel
          plan={settings.dailyPlan}
          proModeEnabled={settings.proModeEnabled}
          onClose={() => setDailyPlanOpen(false)}
          onSave={(dailyPlan) => saveSettings({ dailyPlan })}
        />
      )}
    </div>
  );
}
