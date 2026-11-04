import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { dataError } from '../lib/dataErrors';
import { subscribeSharingChanges } from '../services/sharingService';

const refreshIntervalMs = 15_000;

type State<T> = { scope: string; data: T | null; isLoading: boolean; error: string | null };

export function useSharingFeed<T>(owner: string, side: 'sender' | 'recipient', scope: string, load: () => Promise<T>, retainListOnPoll = false) {
  const [state, setState] = useState<State<T>>({ scope, data: null, isLoading: true, error: null });
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useFocusEffect(useCallback(() => {
    let alive = true;
    let foreground = AppState.currentState !== 'background';
    let generation = 0;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const invalidate = (delay = 0, keepList = false) => {
      if (!alive) return;
      clearTimeout(scheduled);
      const request = ++generation;
      setState(previous => ({
        scope, data: keepList && previous.scope === scope ? previous.data : null, isLoading: true, error: null,
      }));
      if (!foreground) return;
      scheduled = setTimeout(async () => {
        try {
          const data = await load();
          if (alive && generation === request) setState({ scope, data, isLoading: false, error: null });
        } catch (error) {
          if (alive && generation === request) setState({ scope, data: null, isLoading: false, error: dataError(error).message });
        }
      }, delay);
    };

    refreshRef.current = invalidate;
    const unsubscribe = subscribeSharingChanges(owner, side, () => invalidate(180));
    const appState = AppState.addEventListener('change', next => {
      foreground = next === 'active';
      invalidate();
    });
    const poll = setInterval(() => {
      if (foreground) invalidate(0, retainListOnPoll);
    }, refreshIntervalMs);
    invalidate();

    return () => {
      alive = false;
      refreshRef.current = () => {};
      clearTimeout(scheduled);
      clearInterval(poll);
      unsubscribe();
      appState.remove();
      setState({ scope, data: null, isLoading: true, error: null });
    };
  }, [load, owner, scope, side, retainListOnPoll]));

  return {
    ...(state.scope === scope ? state : { data: null, isLoading: true, error: null }),
    refresh,
  };
}
