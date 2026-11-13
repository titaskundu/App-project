import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { useBrain } from '@/features/brain/store';
import { CompanionHero } from '@/features/companion/components/CompanionHero';
import { BANK_DAILY_CAP, PRACTICE_BANK_MINUTES, PRACTICE_PASS, PRACTICE_QUESTIONS } from '@/features/brain/toll';
import { TodayAppsCard } from '@/features/blocker/components/TodayAppsCard';
import { MUSCLE_PRACTICE_BANK_MINUTES } from '@/features/muscle/toll';
import { byUrgency, scopeStatuses, worstLevel } from '@/features/blocker/limits';
import { appLabel, useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Home hub: a slim stats bar, the companion hero (Phase 6's 3D panda goes in its stage), then
 * "Today's apps" and practice. Hours Reclaimed and Sparks are placeholders until the economy
 * (Phase 5) feeds real data.
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
      {/* Slim stats bar (icon + number, like a game's top bar) */}
      <View style={styles.stats}>
        <Stat icon="time" value="0h 0m" label="Hours reclaimed" color={colors.primary} />
        <Stat icon="flash" value="0" label="Sparks" color={colors.spark} />
        <Stat icon="wallet" value={`${banked}m`} label="Banked minutes" color={colors.brain} />
      </View>

      {/* Hero: the companion's stage (the 3D red panda drops in here in Phase 6) */}
      <CompanionHero text={line.text} color={line.color} />

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

/** One stat in the top bar: a colored icon and a bold number (its name is read out by screen readers). */
function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={24} color={color} />
      <AppText variant="heading" numberOfLines={1}>
        {value}
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
  stats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
  sectionLabel: { marginTop: space.xs },
  practice: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  practicePressed: { borderBottomWidth: 2, marginTop: 3 },
  // A disabled card sits flat (no thick lip), like a pressed one.
  dimmed: { opacity: 0.55, borderBottomWidth: 2, marginTop: 3 },
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
