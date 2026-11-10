import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { AREAS } from '@/features/brain/areas';
import { useBrain } from '@/features/brain/store';
import { AccessibilityCard } from '@/features/blocker/components/AccessibilityCard';
import { useAppIcons } from '@/features/blocker/components/AppIcon';
import { AppIconStack } from '@/features/blocker/components/AppIconStack';
import { byUrgency, scopeStatuses, worstLevel } from '@/features/blocker/limits';
import { useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, radius, space } from '@/theme/tokens';

const MAX_TOPIC_CHIPS = 3;

/**
 * Settings hub: one short row per area, so it never turns into a long scroll. Each row opens
 * its own screen (Blocked apps, Brain topics).
 */
export default function SettingsScreen() {
  useLiveBlocker(4000);
  const { targets, today, accessibilityOn } = useBlocker();
  const pkgs = byUrgency(targets, today);
  useAppIcons(pkgs.slice(0, 3));
  const brainAreas = useBrain((s) => s.areas);

  const levels = pkgs.map((p) => worstLevel(scopeStatuses(targets, today, p)));
  const over = levels.filter((l) => l === 'over').length;
  const near = levels.filter((l) => l === 'near').length;
  const status =
    over > 0
      ? { text: `${over} over limit today`, color: colors.danger, icon: 'lock-closed' as const }
      : near > 0
        ? { text: `${near} almost out of time`, color: colors.sparkDark, icon: 'hourglass' as const }
        : { text: 'All within limits', color: colors.brainDark, icon: 'checkmark-circle' as const };

  const topics = AREAS.filter((a) => brainAreas.includes(a.id));
  const shownTopics = topics.slice(0, MAX_TOPIC_CHIPS);

  return (
    <Screen>
      <AppText variant="title">Settings</AppText>

      <AccessibilityCard enabled={accessibilityOn} />

      <HubRow
        title="Blocked apps"
        accent={colors.primary}
        a11y={`Blocked apps: ${pkgs.length}. ${pkgs.length ? status.text : 'None yet'}`}
        onPress={() => router.push(pkgs.length ? '/blocked-apps' : '/pick-apps')}>
        {pkgs.length === 0 ? (
          <View style={styles.inline}>
            <View style={styles.addCircle}>
              <Ionicons name="add" size={26} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading">No apps yet</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                Pick the ones you scroll too much
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.inline}>
            <AppIconStack pkgs={pkgs} />
            <View style={styles.flex}>
              <AppText variant="heading">{`${pkgs.length} ${pkgs.length === 1 ? 'app' : 'apps'}`}</AppText>
              <View style={styles.statusLine}>
                <Ionicons name={status.icon} size={14} color={status.color} />
                <AppText variant="caption" color={status.color} numberOfLines={1}>
                  {status.text}
                </AppText>
              </View>
            </View>
          </View>
        )}
      </HubRow>

      <HubRow
        title="Brain topics"
        accent={colors.brain}
        a11y={`Brain topics: ${topics.map((t) => t.title).join(', ')}. Change topics`}
        onPress={() => router.push('/interests')}>
        <View style={styles.chips}>
          {shownTopics.map((t) => (
            <Chip key={t.id} label={t.title} icon={t.icon} color={colors.brainDark} bg={colors.brainSoft} />
          ))}
          {topics.length > shownTopics.length && (
            <Chip label={`+${topics.length - shownTopics.length}`} color={colors.brainDark} bg={colors.brainSoft} />
          )}
          {topics.length === 0 && <AppText color={colors.textMuted}>None picked yet</AppText>}
        </View>
        <View style={styles.levelRow}>
          <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
            Questions match your level
          </AppText>
          <ChunkyButton
            label="Redo level check"
            tone="neutral"
            size="sm"
            icon={<Ionicons name="refresh" size={14} color={colors.primary} />}
            onPress={() => router.push('/brain?mode=calibration')}
          />
        </View>
      </HubRow>
    </Screen>
  );
}

/** A tappable settings card: colored dot + micro-title, and a chevron. */
function HubRow({
  title,
  accent,
  a11y,
  onPress,
  children,
}: {
  title: string;
  accent: string;
  a11y: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowHead}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <AppText variant="micro" uppercase color={colors.textMuted} style={styles.flex}>
          {title}
        </AppText>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  rowPressed: { borderBottomWidth: 2, marginTop: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
