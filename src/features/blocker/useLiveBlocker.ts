import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { useBlocker } from './store';

/**
 * While the screen using this hook is focused, re-read blocker data every few seconds and
 * whenever the app comes back to the foreground (e.g. after turning on Accessibility).
 */
export function useLiveBlocker(intervalMs = 3000) {
  const refresh = useBlocker((s) => s.refresh);
  const loadApps = useBlocker((s) => s.loadApps);

  useFocusEffect(
    useCallback(() => {
      refresh();
      loadApps().catch(() => {});
      const timer = setInterval(refresh, intervalMs);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [refresh, loadApps, intervalMs])
  );
}
