import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { useBrain } from '@/features/brain/store';
import { TodayAppsCard } from '@/features/blocker/components/TodayAppsCard';
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

  // First launch: pick Brain topics (then the level check) before anything else.
  if (!hasTopics) return <Redirect href="/interests?first=1" />;

  return (
    <Screen>
      {/* Top HUD */}
      <View style={styles.hud}>
        <View style={styles.hudItem}>
          <Ionicons name="time" size={20} color={colors.primary} />
          <View>
            <AppText variant="heading">0h 0m</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Hours reclaimed
            </AppText>
          </View>
        </View>
        <View style={[styles.hudItem, styles.sparkPill]}>
          <Ionicons name="flash" size={18} color={colors.sparkDark} />
          <AppText variant="heading">0</AppText>
        </View>
      </View>

      {/* Companion placeholder — red panda arrives in Phase 6 */}
      <Card style={styles.companion}>
        <View style={styles.mascotPlaceholder}>
          <AppText variant="display">🐼</AppText>
        </View>
        <AppText variant="title" center>
          Hey there!
        </AppText>
        <AppText center color={colors.textMuted}>
          Your companion is getting ready.
        </AppText>
      </Card>

      {/* Live time used per blocked app */}
      <TodayAppsCard />

      {/* Practice: rounds that bank minutes for later (Muscle arrives in Phase 3) */}
      <View style={styles.practiceHead}>
        <AppText variant="label" uppercase color={colors.textMuted}>
          Practice
        </AppText>
        <View style={styles.bankPill}>
          <Ionicons name="wallet" size={14} color={colors.sparkDark} />
          <AppText variant="caption" color={colors.sparkDark}>
            {`${banked} MIN BANKED`}
          </AppText>
        </View>
      </View>
      <View style={styles.row}>
        <ChunkyButton
          label="Brain"
          tone="brain"
          style={styles.flex}
          icon={<Ionicons name="bulb" size={20} color="#fff" />}
          onPress={() => router.push('/brain?mode=practice')}
        />
        <ChunkyButton
          label="Muscle"
          tone="muscle"
          style={styles.flex}
          disabled
          icon={<Ionicons name="barbell" size={20} color="#fff" />}
        />
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        Get 4 of 5 right to bank 5 minutes (up to 20 a day). Use them when a limit hits.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hudItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sparkPill: {
    backgroundColor: colors.sparkSoft,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
  },
  companion: { alignItems: 'center', paddingVertical: space.xl },
  mascotPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  row: { flexDirection: 'row', gap: space.md },
  practiceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.sparkSoft,
  },
  flex: { flex: 1 },
});
