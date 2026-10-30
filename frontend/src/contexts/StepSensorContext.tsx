import { onboardingComplete } from '../lib/healthOnboarding';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { useAuth } from './AuthContext';
import { dataError } from '../lib/dataErrors';
import { toLocalDateKey } from '../lib/dateUtils';
import { addStepRecord, getStepsByDate, updateStepRecord } from '../services/stepsService';

export type StepSensorStatus = 'idle' | 'checking' | 'active' | 'unavailable' | 'denied' | 'error';

type StepSensorState = {
  ownerId: string | null;
  status: StepSensorStatus;
  error: string;
  recordDate: string | null;
  baseSteps: number;
  sessionSteps: number;
};

const initialState: StepSensorState = {
  ownerId: null,
  status: 'idle',
  error: '',
  recordDate: null,
  baseSteps: 0,
  sessionSteps: 0,
};

type StepSensorContextValue = StepSensorState & {
  retrying: boolean;
  requestPermission: () => Promise<void>;
  openSettings: () => Promise<void>;
};

const StepSensorContext = createContext<StepSensorContextValue | null>(null);

export function StepSensorProvider({ children }: React.PropsWithChildren) {
  const { user, isRecovery, profile, profileChecked } = useAuth();
  const userId = profileChecked && onboardingComplete(profile) ? user?.id : undefined;
  const [state, setState] = useState<StepSensorState>(initialState);
  const [retrying, setRetrying] = useState(false);
  const retryStart = useRef<(() => Promise<void>) | null>(null);

  const requestPermission = useCallback(async () => {
    const start = retryStart.current;
    if (!start) return;
    setRetrying(true);
    try {
      await start();
    } finally {
      setRetrying(false);
    }
  }, []);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  useEffect(() => {
    if (!userId || isRecovery) return;

    let alive = true;
    let subscription: { remove: () => void } | null = null;
    let recordDate = toLocalDateKey();
    let lastSensorValue: number | null = null;
    let baseSteps = 0;
    let sessionSteps = 0;
    let starting = false;
    let writeQueue: Promise<void> = Promise.resolve();
    const recordIds = new Map<string, string>();

    const setSensorError = (error: string) => {
      if (alive) setState((previous) => ({ ...previous, error }));
    };

    const readDaySteps = async (date: string) => {
      const rows = await getStepsByDate(date);
      return rows.reduce((total, row) => total + Number(row.steps || 0), 0);
    };

    const start = async () => {
      if (starting || subscription) return;
      starting = true;
      setState({ ...initialState, ownerId: userId, status: 'checking' });
      try {
        let permission = await Pedometer.getPermissionsAsync();
        if (!permission.granted) {
          permission = await Pedometer.requestPermissionsAsync();
        }
        if (!permission.granted) {
          if (alive) setState({ ...initialState, ownerId: userId, status: 'denied' });
          return;
        }

        if (!(await Pedometer.isAvailableAsync())) {
          if (alive) setState({ ...initialState, ownerId: userId, status: 'unavailable' });
          return;
        }

        baseSteps = await readDaySteps(recordDate);
        if (!alive) return;

        setState({ ownerId: userId, status: 'active', error: '', recordDate, baseSteps, sessionSteps: 0 });
        subscription = Pedometer.watchStepCount((result) => {
          if (!alive || !Number.isFinite(result.steps) || result.steps < 0) return;

          const eventDate = toLocalDateKey();
          if (eventDate !== recordDate) {
            recordDate = eventDate;
            lastSensorValue = result.steps;
            sessionSteps = 0;
            baseSteps = 0;
            setState({ ownerId: userId, status: 'active', error: '', recordDate, baseSteps: 0, sessionSteps: 0 });
            void readDaySteps(eventDate).then((total) => {
              if (!alive || recordDate !== eventDate) return;
              baseSteps = total;
              setState({ ownerId: userId, status: 'active', error: '', recordDate, baseSteps, sessionSteps });
            }).catch((error: unknown) => setSensorError(dataError(error).message));
            return;
          }

          const previousValue = lastSensorValue;
          lastSensorValue = result.steps;
          const delta = previousValue == null
            ? Math.floor(result.steps)
            : Math.floor(result.steps - previousValue);
          if (delta <= 0) return;

          sessionSteps += delta;
          const nextSessionSteps = sessionSteps;
          setState({ ownerId: userId, status: 'active', error: '', recordDate: eventDate, baseSteps, sessionSteps: nextSessionSteps });

          writeQueue = writeQueue.then(async () => {
            const records = await getStepsByDate(eventDate);
            const record = records.find(item => item.id === recordIds.get(eventDate)) ?? records[0];
            if (record) {
              recordIds.set(eventDate,record.id);
              await updateStepRecord(record.id, { steps: record.steps + delta });
            } else {
              const created = await addStepRecord({ record_date: eventDate, steps: delta });
              recordIds.set(eventDate, created.id);
            }
          }).catch((error: unknown) => setSensorError(dataError(error).message));
        });
      } catch (error) {
        if (alive) setState({ ...initialState, ownerId: userId, status: 'error', error: dataError(error).message });
      } finally {
        starting = false;
      }
    };

    retryStart.current = start;
    void start();
    return () => {
      alive = false;
      if (retryStart.current === start) retryStart.current = null;
      subscription?.remove();
    };
  }, [isRecovery, userId]);

  const visibleState = state.ownerId === userId && !isRecovery ? state : initialState;
  return <StepSensorContext.Provider value={{ ...visibleState, retrying, requestPermission, openSettings }}>{children}</StepSensorContext.Provider>;
}

export function useStepSensor() {
  const context = useContext(StepSensorContext);
  if (!context) throw new Error('useStepSensor must be used inside StepSensorProvider');
  return context;
}
