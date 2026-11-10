import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { useBrain } from '@/features/brain/store';
import { BANK_DAILY_CAP, PRACTICE_BANK_MINUTES, PRACTICE_PASS, PRACTICE_QUESTIONS } from '@/features/brain/toll';
import { TodayAppsCard } from '@/features/blocker/components/TodayAppsCard';
import { MUSCLE_PRACTICE_BANK_MINUTES } from '@/features/muscle/toll';
import { byUrgency, scopeStatuses, worstLevel } from '@/features/blocker/limits';
import { appLabel, useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Home hub. "Today's apps" is live (Phase 1); Hours Reclaimed and Sparks are
 * placeholders until the economy (Phase 5) feeds real data.
 */
export default function HomeScreen() {
  useLiveBlocker();
  const hasTopics = useBrain((s) => s.areas.length > 0);
  const banked = useBrain((s) => s.bankAvailable());
  const line = useCompanionLine(banked);

  // First launch: pick Brain topics (then the level check) before anything else.
  if (!hasTopics) return <Redirect href="/interests?first=1" />;

  return (
    <Screen>
      {/* Stat tiles */}
      <View style={styles.stats}>
        <StatTile icon="time" value="0h 0m" label="Reclaimed" color={colors.primary} soft={colors.primarySoft} />
        <StatTile icon="flash" value="0" label="Sparks" color={colors.sparkDark} soft={colors.sparkSoft} />
        <StatTile icon="wallet" value={`${banked}m`} label="Banked" color={colors.brainDark} soft={colors.brainSoft} />
      </View>

      {/* Companion: red panda arrives in Phase 6 */}
      <View style={styles.companion}>
        <View style={styles.mascot}>
          <AppText variant="display">🐼</AppText>
        </View>
        <View style={styles.bubbleWrap}>
          <View style={styles.bubbleTail} />
          <View style={[styles.bubble, { borderColor: line.color }]}>
            <AppText variant="bodyLg">{line.text}</AppText>
          </View>
        </View>
      </View>

      {/* Live time used per blocked app */}
      <TodayAppsCard />

      {/* Practice: rounds that bank minutes for later */}
      <AppText variant="micro" uppercase color={colors.textMuted} style={styles.sectionLabel}>
        Practice · bank minutes for later
      </AppText>
      <PracticeCard
        title="Brain"
        icon="bulb"
        description={`${PRACTICE_QUESTIONS} quick questions. Get ${PRACTICE_PASS} right to bank time (up to ${BANK_DAILY_CAP} min a day).`}
        reward={`+${PRACTICE_BANK_MINUTES} min`}
        color={colors.brain}
        dark={colors.brainDark}
        soft={colors.brainSoft}
        tone="brain"
        onPress={() => router.push('/brain?mode=practice')}
      />
      <PracticeCard
        title="Muscle"
        icon="barbell"
        description="5 squats, 10 jumping jacks or 8 arm raises, counted by your camera."
        reward={`+${MUSCLE_PRACTICE_BANK_MINUTES} min`}
        color={colors.muscle}
        dark={colors.muscleDark}
        soft={colors.muscleSoft}
        tone="muscle"
        onPress={() => router.push('/muscle?mode=practice')}
      />
    </Screen>
  );
}

/** What the companion says, from today's state (most important thing first). */
function useCompanionLine(banked: number): { text: string; color: string } {
  const { apps, targets, today, accessibilityOn } = useBlocker();
  const pkgs = byUrgency(targets, today);
  if (pkgs.length === 0) return { text: "Pick the apps you scroll too much. I'll keep watch.", color: colors.primary };
  if (!accessibilityOn) return { text: 'Blocking is off! Turn it on in Settings so I can guard your apps.', color: colors.danger };
  const top = pkgs[0];
  const level = worstLevel(scopeStatuses(targets, today, top));
  const name = appLabel(apps, top);
  if (level === 'over') return { text: `${name} is out of time. Pay a quick toll to get back in.`, color: colors.danger };
  if (level === 'near') return { text: `Careful, ${name} is almost out of time.`, color: colors.warn };
  if (banked > 0) return { text: `All within limits, and ${banked} min banked. Nice!`, color: colors.brain };
  return { text: 'All within limits. A practice round banks minutes for later.', color: colors.brain };
}

function StatTile({
  icon,
  value,
  label,
  color,
  soft,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
  soft: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <AppText variant="heading" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="micro" uppercase color={colors.textMuted} numberOfLines={1} style={styles.noShrink}>
        {label}
      </AppText>
    </View>
  );
}

/** Big colored practice card. Without onPress it's shown dimmed as "coming soon". */
function PracticeCard({
  title,
  icon,
  description,
  reward,
  color,
  dark,
  soft,
  tone,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
  reward: string;
  color: string;
  dark: string;
  soft: string;
  tone: 'brain' | 'muscle';
  onPress?: () => void;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title} practice. ${description}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.practice,
        { backgroundColor: soft, borderColor: color, borderBottomColor: dark },
        disabled && styles.dimmed,
        pressed && styles.practicePressed,
      ]}>
      <View style={styles.practiceTop}>
        <View style={[styles.practiceIcon, { backgroundColor: color, borderBottomColor: dark }]}>
          <Ionicons name={icon} size={28} color={colors.textOnColor} />
        </View>
        <View style={styles.flex}>
          <View style={styles.practiceTitle}>
            <AppText variant="heading" color={dark}>
              {title}
            </AppText>
            <Chip
              label={reward}
              icon={disabled ? 'time' : 'wallet'}
              color={disabled ? dark : colors.sparkDark}
              bg={disabled ? colors.surface : colors.sparkSoft}
            />
          </View>
          <AppText variant="caption" color={colors.text}>
            {description}
          </AppText>
        </View>
      </View>
      {!disabled && (
        <ChunkyButton
          label="Start"
          tone={tone}
          icon={<Ionicons name="play" size={18} color={colors.textOnColor} />}
          onPress={onPress}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noShrink: { flexShrink: 0 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  companion: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mascot: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  // Little triangle pointing at the mascot.
  bubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.border,
  },
  bubble: {
    flex: 1,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  sectionLabel: { marginTop: space.xs },
  practice: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  practicePressed: { borderBottomWidth: 2, marginTop: 3 },
  dimmed: { opacity: 0.55 },
  practiceTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  practiceIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
