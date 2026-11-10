import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { areaTitle } from '@/features/brain/areas';
import { useBrain } from '@/features/brain/store';
import { AccessibilityCard } from '@/features/blocker/components/AccessibilityCard';
import { LimitStepper } from '@/features/blocker/components/LimitStepper';
import { ScopeLimitRow } from '@/features/blocker/components/ScopeLimitRow';
import { shortScope, trackedPackages } from '@/features/blocker/limits';
import { appLabel, useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, radius, space } from '@/theme/tokens';

export default function SettingsScreen() {
  useLiveBlocker(4000);
  const { apps, targets, today, accessibilityOn, shortFormApps, setLimit, removeApp } = useBlocker();
  const pkgs = trackedPackages(targets);
  const brainAreas = useBrain((s) => s.areas);

  return (
    <Screen>
      <AppText variant="title">Settings</AppText>

      <AccessibilityCard enabled={accessibilityOn} />

      <View style={styles.sectionHead}>
        <AppText variant="heading">Blocked apps</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Daily limits
        </AppText>
      </View>

      {pkgs.length === 0 && (
        <Card>
          <AppText color={colors.textMuted}>No apps yet. Add the ones you scroll too much.</AppText>
        </Card>
      )}

      {pkgs.map((pkg) => {
        const name = appLabel(apps, pkg);
        const feed = shortFormApps[pkg];
        const short = shortScope(pkg);
        const hasApp = targets[pkg] !== undefined;
        const hasShort = targets[short] !== undefined;

        return (
          <Card key={pkg} style={styles.appCard}>
            <View style={styles.appRow}>
              <AppText variant="bodyLg" numberOfLines={1} style={styles.flex}>
                {name}
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Stop blocking ${name}`}
                hitSlop={12}
                onPress={() => removeApp(pkg)}>
                <Ionicons name="close-circle" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            {feed ? (
              <>
                <ScopeLimitRow
                  title={`${feed} only`}
                  hint={`Time in ${feed}. The rest of ${name} stays open.`}
                  value={targets[short]}
                  onChange={(m) => setLimit(short, m)}
                  canTurnOff={hasApp}
                />
                <View style={styles.divider} />
                <ScopeLimitRow
                  title="Whole app"
                  hint={`All time in ${name}, ${feed} included.`}
                  value={targets[pkg]}
                  onChange={(m) => setLimit(pkg, m)}
                  canTurnOff={hasShort}
                />
                {today?.stale.includes(pkg) && hasShort && (
                  <View style={styles.warning}>
                    <Ionicons name="alert-circle" size={18} color={colors.muscleDark} />
                    <AppText variant="caption" color={colors.muscleDark} style={styles.flex}>
                      Can&apos;t spot {feed} right now (maybe after a {name} update). Counting all of {name}{' '}
                      against your {feed} limit until it&apos;s fixed.
                    </AppText>
                  </View>
                )}
              </>
            ) : (
              <LimitStepper value={targets[pkg]} onChange={(m) => setLimit(pkg, m)} />
            )}
          </Card>
        );
      })}

      <View style={styles.sectionHead}>
        <AppText variant="heading">Brain topics</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Used in tolls
        </AppText>
      </View>
      <Card style={styles.appCard}>
        <View style={styles.chips}>
          {brainAreas.map((a) => (
            <View key={a} style={styles.chip}>
              <AppText variant="caption" color={colors.brainDark}>
                {areaTitle(a).toUpperCase()}
              </AppText>
            </View>
          ))}
        </View>
        <ChunkyButton label="Change topics" tone="brain" onPress={() => router.push('/interests')} />
        <ChunkyButton label="Redo level check" tone="neutral" onPress={() => router.push('/brain?mode=calibration')} />
      </Card>

      <ChunkyButton
        label={pkgs.length ? 'Add or remove apps' : 'Pick apps'}
        tone="neutral"
        icon={<Ionicons name="add-circle" size={20} color={colors.primary} />}
        onPress={() => router.push('/pick-apps')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: space.sm },
  appCard: { gap: space.md },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  divider: { height: 2, backgroundColor: colors.surfaceMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.full, backgroundColor: colors.brainSoft },
  warning: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.muscleSoft,
  },
});
