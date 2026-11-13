import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { useBrain } from '@/features/brain/store';
import { BANK_USE_MAX, BONUS_PER_EXTRA, questionCount, TOLL_MINUTES } from '@/features/brain/toll';
import { AppIcon, useAppIcons } from '@/features/blocker/components/AppIcon';
import { UsageRing } from '@/features/blocker/components/UsageRing';
import { formatDuration, isShortScope } from '@/features/blocker/limits';
import { FORM_BONUS, MUSCLE_TOLL_MINUTES, repsFor } from '@/features/muscle/toll';
import { scopeLabel, useBlocker } from '@/features/blocker/store';
import { recordTollEvent } from '@/features/sync/sync';
import { colors, modeTones, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';

const MAX_FORM_BONUS = Math.max(...FORM_BONUS.map((b) => b.minutes));

/**
 * The Toll screen, opened by the blocker popup (mindmusclesync://toll?pkg=…&scope=…) when a
 * limit is reached. scope is the app ("pkg") or its Reels/Shorts ("pkg:short").
 * Ways to unlock: banked practice minutes, a Brain toll, a Muscle toll.
 *
 * One fixed screen, no scrolling: a hero (the app inside its usage ring, with the panda) takes
 * the free space, and the two tolls sit below as identical rows, so neither looks like the
 * "main" option.
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
  const limit = targets[scope];
  const kind = isShortScope(scope) ? 'short' : 'app';
  const ratio = limit ? used / (limit * 60_000) : 1;
  useAppIcons(pkg ? [pkg] : []);

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
    if (minutes > 0) {
      recordTollEvent({ kind: 'bank', scope, minutes });
      unlock(minutes, false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <View>
            <UsageRing size={150} stroke={10} rings={[{ ratio, color: modeTones[kind].color }]}>
              <AppIcon pkg={pkg} label={name} size={68} />
            </UsageRing>
            <View style={styles.panda}>
              <AppText variant="heading">🐼</AppText>
            </View>
          </View>
          <AppText variant="title" center>
            Time for a quick break!
          </AppText>
          <View style={styles.chips}>
            <Chip
              label={limit ? `${formatDuration(used)} of ${limit} min` : formatDuration(used)}
              icon={kind === 'short' ? 'film' : 'phone-portrait'}
              color={modeTones[kind].dark}
              bg={modeTones[kind].soft}
            />
            {count > 0 && <Chip label={`${count} watched`} icon="eye" color={colors.textMuted} bg={colors.surfaceMuted} />}
            {tollsToday > 0 && (
              <Chip label={`Toll ${tollsToday + 1} today`} icon="trending-up" color={colors.textMuted} bg={colors.surfaceMuted} />
            )}
          </View>
          <AppText center color={colors.textMuted}>
            {`${name} is over its limit. Pay a quick toll to unlock more time.`}
          </AppText>
        </View>

        {bankMinutes > 0 && (
          <Card tint={colors.sparkSoft} style={styles.bank}>
            <Ionicons name="wallet" size={22} color={colors.sparkDark} />
            <View style={styles.flex}>
              <AppText variant="label" uppercase color={colors.sparkDark}>
                {`${bankMinutes} min banked`}
              </AppText>
              <AppText variant="caption" color={colors.text}>
                Earned in practice
              </AppText>
            </View>
            <ChunkyButton label={`Use ${Math.min(bankMinutes, BANK_USE_MAX)} min`} tone="spark" size="sm" onPress={useBank} />
          </Card>
        )}

        <View style={styles.options}>
          <AppText variant="micro" uppercase color={colors.textMuted}>
            Choose your toll
          </AppText>
          <TollRow
            tone="brain"
            icon="bulb"
            title="Brain"
            task={`${questions} quick questions from your topics`}
            bonus={`+${BONUS_PER_EXTRA} min per extra answer`}
            minutes={TOLL_MINUTES}
            onPress={() => router.push({ pathname: '/brain', params: { mode: 'toll', pkg, scope } })}
          />
          <TollRow
            tone="muscle"
            icon="barbell"
            title="Muscle"
            task={`${repsFor('squat', tollsToday)} squats, ${repsFor('jack', tollsToday)} jumping jacks or ${repsFor('raise', tollsToday)} arm raises`}
            bonus={`Up to +${MAX_FORM_BONUS} min for good form`}
            minutes={MUSCLE_TOLL_MINUTES}
            onPress={() => router.push({ pathname: '/muscle', params: { mode: 'toll', pkg, scope } })}
          />
        </View>

        <Pressable accessibilityRole="button" hitSlop={8} onPress={leave} style={styles.notNow}>
          <AppText variant="label" uppercase color={colors.textMuted}>
            Not now · go home
          </AppText>
        </Pressable>
        {__DEV__ && (
          <Pressable accessibilityRole="button" onPress={() => unlock(5, true)} style={styles.dev}>
            <AppText variant="caption" color={colors.textMuted}>
              DEV ONLY · SKIP TOLL (+5 MIN)
            </AppText>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** One way to pay the toll: a full-width chunky row. Brain and Muscle share it, so they match. */
function TollRow({
  tone,
  icon,
  title,
  task,
  bonus,
  minutes,
  onPress,
}: {
  tone: 'brain' | 'muscle';
  icon: 'bulb' | 'barbell';
  title: string;
  task: string;
  bonus: string;
  minutes: number;
  onPress: () => void;
}) {
  const c =
    tone === 'brain'
      ? { color: colors.brain, dark: colors.brainDark, soft: colors.brainSoft }
      : { color: colors.muscle, dark: colors.muscleDark, soft: colors.muscleSoft };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} toll: ${task}. Unlocks ${minutes} minutes`}
      onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.soft, borderColor: c.color, borderBottomColor: c.dark },
        pressed && styles.rowPressed,
      ]}>
      <View style={[styles.rowIcon, { backgroundColor: c.color, borderBottomColor: c.dark }]}>
        <Ionicons name={icon} size={30} color={colors.textOnColor} />
      </View>
      <View style={styles.flex}>
        <View style={styles.rowHead}>
          <AppText variant="heading" color={c.dark} style={styles.flex}>
            {title}
          </AppText>
          <View style={[styles.reward, { backgroundColor: c.color }]}>
            <AppText variant="label" color={colors.textOnColor}>{`+${minutes} min`}</AppText>
          </View>
        </View>
        <AppText color={colors.text}>{task}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {bonus}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={c.dark} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flex: 1, padding: space.md, gap: space.md },
  // The hero takes the free space, so the options sit low, within thumb reach.
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  panda: {
    position: 'absolute',
    right: -6,
    bottom: -2,
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  bank: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  options: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  rowPressed: { borderBottomWidth: 2, marginTop: 4 },
  rowIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  reward: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.full },
  notNow: { alignSelf: 'center', minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg },
  dev: { alignSelf: 'center', padding: space.xs },
});
