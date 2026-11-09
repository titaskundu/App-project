import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { formatDuration, isShortScope, TOLL_MINUTES } from '@/features/blocker/limits';
import { scopeLabel, useBlocker } from '@/features/blocker/store';
import { colors, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';

/**
 * The Toll screen, opened by the blocker (mindmusclesync://toll?pkg=...&scope=...) when a limit
 * is reached. scope is the app ("pkg") or its Reels/Shorts ("pkg:short").
 * Phase 1 uses a test toll button; Brain and Muscle tolls replace it in Phases 2–3.
 */
export default function TollScreen() {
  const params = useLocalSearchParams<{ pkg?: string; scope?: string }>();
  const pkg = params.pkg ?? '';
  const scope = params.scope || pkg;
  const { apps, loadApps, refresh, today, targets, shortFormApps } = useBlocker();
  const name = scopeLabel(apps, shortFormApps, scope);
  const used = today?.usage[scope] ?? 0;
  const tollsToday = today?.tolls[scope] ?? 0;
  const count = isShortScope(scope) ? (today?.counts[scope] ?? 0) : 0;

  useEffect(() => {
    refresh();
    loadApps().catch(() => {});
  }, [refresh, loadApps, scope]);

  const leave = useCallback(() => {
    AppBlocker.goHome();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);

  // Android back button: go to the home screen rather than back into the blocked app.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave])
  );

  const payTestToll = () => {
    AppBlocker.grantMinutes(scope, TOLL_MINUTES);
    refresh();
    AppBlocker.openApp(pkg);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <View style={styles.mascot}>
          <AppText variant="display">🐼</AppText>
        </View>
        <View style={styles.bubble}>
          <AppText variant="title" center>
            Time for a quick break!
          </AppText>
          <AppText center color={colors.textMuted}>
            You&apos;ve used {formatDuration(used)} of {name} today
            {count > 0 ? ` (${count} watched)` : ''}
            {targets[scope] ? `. Your limit is ${targets[scope]} min.` : '.'}
          </AppText>
        </View>
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="flask" size={20} color={colors.primary} />
          <AppText variant="label" color={colors.primary}>
            TEST TOLL · PHASE 1
          </AppText>
        </View>
        <AppText color={colors.textMuted}>
          Brain puzzles and Muscle reps arrive in the next phases. For now, this button stands in for a toll.
        </AppText>
        {tollsToday > 0 && (
          <AppText variant="caption" color={colors.textMuted}>
            Tolls paid for {name} today: {tollsToday}
          </AppText>
        )}
        <ChunkyButton label={`Pay toll · +${TOLL_MINUTES} min`} size="lg" onPress={payTestToll} />
      </Card>

      <ChunkyButton label="Not now · go home" tone="neutral" onPress={leave} style={styles.secondary} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, padding: space.md, justifyContent: 'center', gap: space.lg },
  top: { alignItems: 'center', gap: space.md },
  mascot: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
    alignSelf: 'stretch',
  },
  card: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  secondary: { marginTop: space.xs },
});
