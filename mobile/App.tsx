import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

type TimerStatus = 'Idle' | 'Running' | 'Paused' | 'Finished';
type DailyPlanStatus = 'Completed' | 'Failed' | 'Neutral';

type TimerSyncState = {
  durationMs: number;
  remainingMs: number;
  status: TimerStatus;
  startedAt: string | null;
  pausedRemainingMs: number | null;
  modifiedAt: string;
  modifiedBy: string;
};

type DailyPlanDateStatus = {
  date: string;
  status: DailyPlanStatus;
  modifiedAt: string;
  modifiedBy: string;
};

type DailyPlanSyncState = {
  title: string;
  targetMinutes: number;
  startDate: string | null;
  dates: DailyPlanDateStatus[];
  modifiedAt: string;
  modifiedBy: string;
};

type FocusPresetSyncItem = {
  durationMs: number;
  modifiedAt: string;
  modifiedBy: string;
};

type AppSyncSettings = {
  soundEnabled: boolean;
  pauseSoundEnabled?: boolean;
  resumeSoundEnabled?: boolean;
  alarmVolume: number;
  modifiedAt: string;
  modifiedBy: string;
};

type SyncSnapshot = {
  version: number;
  timer: TimerSyncState;
  dailyPlan: DailyPlanSyncState;
  focusPresets: FocusPresetSyncItem[];
  settings: AppSyncSettings;
};

type SyncPushResponse = {
  version: number;
  serverHadNewerChanges: boolean;
  snapshot: SyncSnapshot;
};

type FocusTimerSharedCapabilities = {
  logic: string;
  activeTarget: string;
};

type FocusTimerSharedNative = {
  formatDuration: (milliseconds: number) => Promise<string>;
  normalizeServerUrl: (value: string) => Promise<string>;
  isDateKey: (value: string) => Promise<boolean>;
  nextManualDailyPlanStatus: (
    currentStatus: DailyPlanStatus | null,
  ) => Promise<DailyPlanStatus>;
  calculateStreak: (
    todayKey: string,
    completedDates: string[],
  ) => Promise<number>;
  getCapabilities: () => Promise<FocusTimerSharedCapabilities>;
};

const snapshotKey = 'focus-timer:snapshot';
const knownVersionKey = 'focus-timer:known-version';
const deviceIdKey = 'focus-timer:device-id';
const serverUrlKey = 'focus-timer:server-url';
const defaultServerUrl = 'http://10.0.2.2:5278';
const defaultDurationMs = 25 * 60 * 1000;
const focusTimerShared = NativeModules.FocusTimerShared as
  | FocusTimerSharedNative
  | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return localDateKey(new Date(year, month - 1, day - 1));
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

function currentRemainingMs(timer: TimerSyncState): number {
  if (timer.status !== 'Running' || !timer.startedAt) {
    return Math.max(0, timer.remainingMs);
  }

  return Math.max(0, timer.remainingMs - (Date.now() - Date.parse(timer.startedAt)));
}

function createDefaultSnapshot(deviceId: string): SyncSnapshot {
  const modifiedAt = nowIso();
  return {
    version: 0,
    timer: {
      durationMs: defaultDurationMs,
      remainingMs: defaultDurationMs,
      status: 'Idle',
      startedAt: null,
      pausedRemainingMs: defaultDurationMs,
      modifiedAt,
      modifiedBy: deviceId,
    },
    dailyPlan: {
      title: 'Reading',
      targetMinutes: 270,
      startDate: null,
      dates: [],
      modifiedAt,
      modifiedBy: deviceId,
    },
    focusPresets: [
      5 * 60 * 1000,
      25 * 60 * 1000,
      50 * 60 * 1000,
      2 * 60 * 60 * 1000,
    ].map(durationMs => ({durationMs, modifiedAt, modifiedBy: deviceId})),
    settings: {
      soundEnabled: true,
      pauseSoundEnabled: true,
      resumeSoundEnabled: true,
      alarmVolume: 0.7,
      modifiedAt,
      modifiedBy: deviceId,
    },
  };
}

function calculateStreak(plan: DailyPlanSyncState): number {
  const statuses = new Map(plan.dates.map(day => [day.date, day.status]));
  let cursor = localDateKey();
  let streak = 0;

  while (statuses.get(cursor) === 'Completed') {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

function normalizeServerUrl(value: string): string {
  const trimmed = value.trim() || defaultServerUrl;
  return trimmed.replace(/\/+$/, '');
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && localDateKey(parsed) === value;
}

async function formatDurationShared(milliseconds: number): Promise<string> {
  return focusTimerShared?.formatDuration(milliseconds) ?? formatDuration(milliseconds);
}

async function normalizeServerUrlShared(value: string): Promise<string> {
  return focusTimerShared?.normalizeServerUrl(value) ?? normalizeServerUrl(value);
}

async function isDateKeyShared(value: string): Promise<boolean> {
  return focusTimerShared?.isDateKey(value) ?? isDateKey(value);
}

async function nextManualDailyPlanStatusShared(
  currentStatus: DailyPlanStatus | null,
): Promise<DailyPlanStatus> {
  return (
    focusTimerShared?.nextManualDailyPlanStatus(currentStatus) ??
    (currentStatus === 'Completed'
      ? 'Failed'
      : currentStatus === 'Failed'
        ? 'Neutral'
        : 'Completed')
  );
}

async function calculateStreakShared(plan: DailyPlanSyncState): Promise<number> {
  const completedDates = plan.dates
    .filter(day => day.status === 'Completed')
    .map(day => day.date);
  return (
    focusTimerShared?.calculateStreak(localDateKey(), completedDates) ??
    calculateStreak(plan)
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [knownVersion, setKnownVersion] = useState(0);
  const [serverUrl, setServerUrl] = useState(defaultServerUrl);
  const [syncStatus, setSyncStatus] = useState('Not synced yet');
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() =>
    createDefaultSnapshot('android-pending'),
  );
  const [planTitle, setPlanTitle] = useState('Reading');
  const [targetMinutes, setTargetMinutes] = useState('270');
  const [selectedDate, setSelectedDate] = useState(localDateKey());
  const [now, setNow] = useState(Date.now());
  const [timerText, setTimerText] = useState(formatDuration(defaultDurationMs));
  const [streak, setStreak] = useState(0);
  const [logicLayer, setLogicLayer] = useState('React Native UI + JS fallback');
  const syncInFlight = useRef(false);

  const persist = useCallback(
    async (nextSnapshot: SyncSnapshot, nextKnownVersion = knownVersion) => {
      await AsyncStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));
      await AsyncStorage.setItem(knownVersionKey, String(nextKnownVersion));
    },
    [knownVersion],
  );

  useEffect(() => {
    let alive = true;

    async function load() {
      const [storedDeviceId, storedSnapshot, storedKnownVersion, storedServerUrl] =
        await Promise.all([
          AsyncStorage.getItem(deviceIdKey),
          AsyncStorage.getItem(snapshotKey),
          AsyncStorage.getItem(knownVersionKey),
          AsyncStorage.getItem(serverUrlKey),
        ]);

      const loadedDeviceId =
        storedDeviceId || `android-${Math.random().toString(16).slice(2)}-${Date.now()}`;
      let loadedSnapshot = createDefaultSnapshot(loadedDeviceId);

      if (storedSnapshot) {
        try {
          loadedSnapshot = JSON.parse(storedSnapshot) as SyncSnapshot;
        } catch {
          loadedSnapshot = createDefaultSnapshot(loadedDeviceId);
        }
      }

      if (!alive) {
        return;
      }

      setDeviceId(loadedDeviceId);
      setKnownVersion(Number(storedKnownVersion || 0));
      setServerUrl(storedServerUrl || defaultServerUrl);
      setSnapshot(loadedSnapshot);
      setPlanTitle(loadedSnapshot.dailyPlan.title);
      setTargetMinutes(String(loadedSnapshot.dailyPlan.targetMinutes));
      setReady(true);
      await AsyncStorage.setItem(deviceIdKey, loadedDeviceId);
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!focusTimerShared) {
      return;
    }

    void focusTimerShared.getCapabilities().then(capabilities => {
      setLogicLayer(
        `${capabilities.logic} core on ${capabilities.activeTarget}`,
      );
    });
  }, []);

  const syncNow = useCallback(
    async (auto = false) => {
      if (!ready || syncInFlight.current) {
        return;
      }

      syncInFlight.current = true;
      const baseUrl = await normalizeServerUrlShared(serverUrl);
      setServerUrl(baseUrl);
      await AsyncStorage.setItem(serverUrlKey, baseUrl);
      setSyncStatus(auto ? 'Auto syncing...' : 'Syncing...');

      try {
        const response = await fetch(`${baseUrl}/sync/push`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json; charset=utf-8'},
          body: JSON.stringify({
            deviceId,
            knownVersion,
            timer: snapshot.timer,
            dailyPlan: snapshot.dailyPlan,
            focusPresets: snapshot.focusPresets,
            settings: snapshot.settings,
          }),
        });

        const text = await response.text();
        if (!response.ok) {
          throw new Error(text || `HTTP ${response.status}`);
        }

        const result = JSON.parse(text) as SyncPushResponse;
        setSnapshot(result.snapshot);
        setKnownVersion(result.version);
        setPlanTitle(result.snapshot.dailyPlan.title);
        setTargetMinutes(String(result.snapshot.dailyPlan.targetMinutes));
        await persist(result.snapshot, result.version);
        setSyncStatus(`Synced v${result.version}`);
      } catch (error) {
        setSyncStatus(`Offline: ${error instanceof Error ? error.message : 'sync failed'}`);
      } finally {
        syncInFlight.current = false;
      }
    },
    [deviceId, knownVersion, persist, ready, serverUrl, snapshot],
  );

  useEffect(() => {
    if (!ready) {
      return;
    }

    const timeout = setTimeout(() => {
      void syncNow(true);
    }, 700);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void syncNow(true);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [ready, syncNow]);

  const updateSnapshot = useCallback(
    (updater: (draft: SyncSnapshot) => void) => {
      setSnapshot(current => {
        const draft = JSON.parse(JSON.stringify(current)) as SyncSnapshot;
        updater(draft);
        draft.version += 1;
        void persist(draft);
        return draft;
      });
    },
    [persist],
  );

  const remainingMs = useMemo(() => {
    void now;
    return currentRemainingMs(snapshot.timer);
  }, [now, snapshot.timer]);

  useEffect(() => {
    let alive = true;
    void formatDurationShared(remainingMs).then(text => {
      if (alive) {
        setTimerText(text);
      }
    });

    return () => {
      alive = false;
    };
  }, [remainingMs]);

  useEffect(() => {
    let alive = true;
    void calculateStreakShared(snapshot.dailyPlan).then(nextStreak => {
      if (alive) {
        setStreak(nextStreak);
      }
    });

    return () => {
      alive = false;
    };
  }, [snapshot.dailyPlan]);

  useEffect(() => {
    if (snapshot.timer.status === 'Running' && remainingMs === 0) {
      updateSnapshot(draft => {
        draft.timer.status = 'Finished';
        draft.timer.remainingMs = 0;
        draft.timer.startedAt = null;
        draft.timer.pausedRemainingMs = 0;
        draft.timer.modifiedAt = nowIso();
        draft.timer.modifiedBy = deviceId;
      });
    }
  }, [deviceId, remainingMs, snapshot.timer.status, updateSnapshot]);

  const toggleTimer = () => {
    updateSnapshot(draft => {
      const modifiedAt = nowIso();
      let remaining = currentRemainingMs(draft.timer);
      if (draft.timer.status === 'Running') {
        draft.timer.remainingMs = remaining;
        draft.timer.status = remaining === 0 ? 'Finished' : 'Paused';
        draft.timer.startedAt = null;
        draft.timer.pausedRemainingMs = remaining;
      } else {
        if (remaining === 0 || draft.timer.status === 'Finished') {
          remaining = draft.timer.durationMs;
        }
        draft.timer.remainingMs = remaining;
        draft.timer.status = 'Running';
        draft.timer.startedAt = modifiedAt;
        draft.timer.pausedRemainingMs = null;
      }
      draft.timer.modifiedAt = modifiedAt;
      draft.timer.modifiedBy = deviceId;
    });
  };

  const resetTimer = () => {
    updateSnapshot(draft => {
      draft.timer.remainingMs = draft.timer.durationMs;
      draft.timer.status = 'Idle';
      draft.timer.startedAt = null;
      draft.timer.pausedRemainingMs = draft.timer.durationMs;
      draft.timer.modifiedAt = nowIso();
      draft.timer.modifiedBy = deviceId;
    });
  };

  const savePlan = () => {
    updateSnapshot(draft => {
      draft.dailyPlan.title = planTitle.trim() || 'Reading';
      draft.dailyPlan.targetMinutes = Math.max(
        1,
        Math.min(24 * 60, Number.parseInt(targetMinutes, 10) || 270),
      );
      draft.dailyPlan.startDate ??= localDateKey();
      draft.dailyPlan.modifiedAt = nowIso();
      draft.dailyPlan.modifiedBy = deviceId;
    });
  };

  const setDayStatus = async (date: string, status: DailyPlanStatus) => {
    if (!(await isDateKeyShared(date))) {
      setSelectedDate(localDateKey());
      return;
    }

    updateSnapshot(draft => {
      draft.dailyPlan.dates = draft.dailyPlan.dates.filter(day => day.date !== date);
      draft.dailyPlan.dates.push({
        date,
        status,
        modifiedAt: nowIso(),
        modifiedBy: deviceId,
      });
      draft.dailyPlan.dates.sort((left, right) => left.date.localeCompare(right.date));
      if (!draft.dailyPlan.startDate || date < draft.dailyPlan.startDate) {
        draft.dailyPlan.startDate = date;
      }
      draft.dailyPlan.modifiedAt = nowIso();
      draft.dailyPlan.modifiedBy = deviceId;
    });
  };

  const selectedDay = snapshot.dailyPlan.dates.find(day => day.date === selectedDate);

  const cycleSelectedDate = async () => {
    const nextStatus = await nextManualDailyPlanStatusShared(
      selectedDay?.status ?? null,
    );
    await setDayStatus(selectedDate.trim(), nextStatus);
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loading}>
          <Text style={styles.title}>Loading Focus Timer...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Focus Timer</Text>
        <Text style={styles.subtitle}>React Native companion for your Electron timer</Text>
        <Text style={styles.logicLayer}>{logicLayer}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sync server</Text>
          <TextInput
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
          <View style={styles.row}>
            <ButtonLabel text="Sync now" onPress={() => void syncNow(false)} primary />
            <Text style={styles.syncText}>{syncStatus}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.timerCard]}>
          <Text style={styles.timer}>{timerText}</Text>
          <Text style={styles.timerStatus}>{snapshot.timer.status.toUpperCase()}</Text>
          <View style={styles.centerRow}>
            <ButtonLabel
              text={snapshot.timer.status === 'Running' ? 'Pause' : 'Start'}
              onPress={toggleTimer}
              primary
            />
            <ButtonLabel text="Reset" onPress={resetTimer} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.planHeader}>
            <Text style={styles.cardTitle}>Daily plan</Text>
            <Text style={styles.streak}>Streak: {streak}</Text>
          </View>
          <TextInput value={planTitle} onChangeText={setPlanTitle} style={styles.input} />
          <TextInput
            value={targetMinutes}
            onChangeText={setTargetMinutes}
            keyboardType="number-pad"
            style={styles.input}
          />
          <ButtonLabel text="Save plan" onPress={savePlan} primary />

          <View style={styles.row}>
            <ButtonLabel
              text="Today done"
              onPress={() => void setDayStatus(localDateKey(), 'Completed')}
              primary
            />
            <ButtonLabel
              text="Today failed"
              onPress={() => void setDayStatus(localDateKey(), 'Failed')}
            />
          </View>

          <Text style={styles.sectionLabel}>Change any date</Text>
          <TextInput value={selectedDate} onChangeText={setSelectedDate} style={styles.input} />
          <View style={styles.row}>
            <ButtonLabel
              text="Set done"
              onPress={() => void setDayStatus(selectedDate.trim(), 'Completed')}
              primary
            />
            <ButtonLabel
              text="Set failed"
              onPress={() => void setDayStatus(selectedDate.trim(), 'Failed')}
            />
            <ButtonLabel
              text="Set neutral"
              onPress={() => void setDayStatus(selectedDate.trim(), 'Neutral')}
            />
            <ButtonLabel
              text="Cycle"
              onPress={() => void cycleSelectedDate()}
            />
          </View>
          <Text style={styles.syncText}>
            {selectedDate}: {selectedDay ? selectedDay.status.toLowerCase() : 'not marked'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ButtonLabel({
  text,
  onPress,
  primary = false,
}: {
  text: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonSecondary]}>
      <Text style={[styles.buttonText, primary ? styles.buttonTextPrimary : null]}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F8F6',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 22,
    gap: 14,
  },
  title: {
    color: '#122020',
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#52706D',
    fontSize: 14,
    marginBottom: 4,
  },
  logicLayer: {
    color: '#6A7A78',
    fontSize: 12,
    fontWeight: '700',
    marginTop: -6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E7E3',
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  cardTitle: {
    color: '#0D5C5A',
    fontSize: 18,
    fontWeight: '800',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streak: {
    color: '#B05D00',
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    borderColor: '#D6E3DF',
    borderRadius: 14,
    borderWidth: 1,
    color: '#122020',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  centerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  syncText: {
    color: '#52706D',
    flexShrink: 1,
    fontSize: 14,
  },
  timer: {
    color: '#122020',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  timerStatus: {
    color: '#6A7A78',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  sectionLabel: {
    color: '#0D5C5A',
    fontSize: 16,
    fontWeight: '800',
  },
  button: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonPrimary: {
    backgroundColor: '#3E948E',
  },
  buttonSecondary: {
    backgroundColor: '#EAF1EF',
  },
  buttonText: {
    color: '#122020',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
});
