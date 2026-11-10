import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { useBrain } from '@/features/brain/store';
import { BANK_USE_MAX, questionCount, TOLL_MINUTES } from '@/features/brain/toll';
import { formatDuration, isShortScope } from '@/features/blocker/limits';
import { MUSCLE_TOLL_MINUTES, repsFor } from '@/features/muscle/toll';
import { scopeLabel, useBlocker } from '@/features/blocker/store';
import { colors, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';

/**
 * The Toll screen, opened by the blocker popup (mindmusclesync://toll?pkg=…&scope=…) when a
 * limit is reached. scope is the app ("pkg") or its Reels/Shorts ("pkg:short").
 * Ways to unlock: banked practice minutes, a Brain toll, a Muscle toll.
 */
export default function TollScreen() {
  const params = useLocalSearchParams<{ pkg?: string; scope?: string }>();
  const pkg = params.pkg ?? '';
  const scope = params.scope || pkg;
  const { apps, loadApps, refresh, today, targets, shortFormApps } = useBlocker();
  const bankMinutes = useBrain((s) => s.bankAvailable());
  const bankUse = useBrain((s) => s.bankUse);
  const name = scopeLabel(apps, shortFormApps, scope);
  const used = today?.usage[scope] ?? 0;
  const count = isShortScope(scope) ? (today?.counts[scope] ?? 0) : 0;
  const tollsToday = Object.values(today?.tolls ?? {}).reduce((a, b) => a + b, 0);
  const questions = questionCount(tollsToday);

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

  const unlock = (minutes: number, countToll: boolean) => {
    AppBlocker.grantMinutes(scope, minutes, countToll);
    refresh();
    if (pkg) AppBlocker.openApp(pkg);
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const useBank = () => {
    const minutes = bankUse(BANK_USE_MAX);
    if (minutes > 0) unlock(minutes, false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
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

        {bankMinutes > 0 && (
          <Card tint={colors.sparkSoft} style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="wallet" size={22} color={colors.sparkDark} />
              <AppText variant="label" color={colors.sparkDark}>
                {`BANKED · ${bankMinutes} MIN`}
              </AppText>
            </View>
            <AppText color={colors.text}>You earned these in practice. Use them instead of a toll.</AppText>
            <ChunkyButton label={`Use ${Math.min(bankMinutes, BANK_USE_MAX)} banked min`} tone="spark" onPress={useBank} />
          </Card>
        )}

        <Card tint={colors.brainSoft} style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="bulb" size={22} color={colors.brainDark} />
            <AppText variant="label" color={colors.brainDark}>
              {`BRAIN TOLL · ${questions} QUESTIONS`}
            </AppText>
          </View>
          <AppText color={colors.text}>
            Answer {questions} quick questions from your topics to unlock {TOLL_MINUTES} minutes. Keep going for bonus
            minutes.
          </AppText>
          <ChunkyButton
            label={`Start · +${TOLL_MINUTES} min`}
            tone="brain"
            size="lg"
            onPress={() => router.push({ pathname: '/brain', params: { mode: 'toll', pkg, scope } })}
          />
        </Card>

        <Card tint={colors.muscleSoft} style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="barbell" size={22} color={colors.muscleDark} />
            <AppText variant="label" color={colors.muscleDark}>
              MUSCLE TOLL
            </AppText>
          </View>
          <AppText color={colors.text}>
            {`${repsFor('squat', tollsToday)} squats, ${repsFor('jack', tollsToday)} jumping jacks or ${repsFor('raise', tollsToday)} arm raises, counted by your camera. Good form adds up to +5 min.`}
          </AppText>
          <ChunkyButton
            label={`Start · +${MUSCLE_TOLL_MINUTES} min`}
            tone="muscle"
            size="lg"
            onPress={() => router.push({ pathname: '/muscle', params: { mode: 'toll', pkg, scope } })}
          />
        </Card>

        <ChunkyButton label="Not now · go home" tone="neutral" onPress={leave} />
        {__DEV__ && (
          <Pressable accessibilityRole="button" onPress={() => unlock(5, true)} style={styles.dev}>
            <AppText variant="caption" color={colors.textMuted}>
              DEV ONLY · SKIP TOLL (+5 MIN)
            </AppText>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  top: { alignItems: 'center', gap: space.md, marginTop: space.md },
  mascot: {
    width: 96,
    height: 96,
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
  dev: { alignSelf: 'center', padding: space.sm },
});
