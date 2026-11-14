import {
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import * as Linking from 'expo-linking';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { pendingPath } from '@/features/account/gate';
import { useAccount } from '@/features/account/store';
import { useAuthGate } from '@/features/account/useAuthGate';
import { startSync } from '@/features/sync/sync';
import { colors } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

// Start reading the saved session right away (before the first render).
startSync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  const gate = useAuthGate();
  const pending = useAccount((s) => s.pendingPath);

  const fontsReady = loaded || !!error;
  useEffect(() => {
    if (fontsReady && gate !== 'loading') SplashScreen.hideAsync();
  }, [fontsReady, gate]);

  // A toll link that arrives while signed out (the blocker's "Pay toll") opens after login.
  const url = Linking.useLinkingURL();
  useEffect(() => {
    const path = pendingPath(url);
    if (path && gate !== 'ready') useAccount.getState().setPendingPath(path);
  }, [url, gate]);
  useEffect(() => {
    if (gate === 'ready' && pending) {
      useAccount.getState().setPendingPath(null);
      router.push(pending as Parameters<typeof router.push>[0]);
    }
  }, [gate, pending]);

  if (!fontsReady || gate === 'loading') return null;

  const ready = gate === 'ready';
  // Where each state lives. A screen whose guard is false redirects here (e.g. "/" while
  // signed out → welcome; welcome right after login → setup or the app).
  const home = ready
    ? '/'
    : gate === 'signedOut'
      ? '/welcome'
      : gate === 'needsProfile'
        ? '/complete-profile'
        : '/setup';
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* The app: only with a signed-in account that has a profile. */}
        <Stack.Protected guard={ready} redirectTo={home}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="toll" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="pick-apps" options={{ presentation: 'modal' }} />
          <Stack.Screen name="brain" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="muscle" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="interests" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="blocked-apps" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>

        {/* Signed out (or mid sign-up): welcome, email sign-up, log-in. */}
        <Stack.Protected guard={gate === 'signedOut'} redirectTo={home}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>

        {/* First time on this phone: restoring the backup and loading the profile. */}
        <Stack.Protected guard={gate === 'checking' || gate === 'offline'} redirectTo={home}>
          <Stack.Screen name="setup" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={gate === 'needsProfile'} redirectTo={home}>
          <Stack.Screen name="complete-profile" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
