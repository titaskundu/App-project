import { Stack } from 'expo-router';

import { colors } from '@/theme/tokens';

/** Signed out, the group opens on the welcome screen. */
export const unstable_settings = { anchor: 'welcome' };

/** Signed-out screens: welcome, email sign-up, log-in. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      <Stack.Screen name="email" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
