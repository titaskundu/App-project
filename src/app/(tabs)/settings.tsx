import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { Screen } from '@/components/ui/Screen';
import { AccessibilityCard } from '@/features/blocker/components/AccessibilityCard';
import { LimitStepper } from '@/features/blocker/components/LimitStepper';
import { appLabel, useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, space } from '@/theme/tokens';

export default function SettingsScreen() {
  useLiveBlocker(4000);
  const { apps, targets, accessibilityOn, setLimit, removeTarget } = useBlocker();
  const pkgs = Object.keys(targets);

  return (
    <Screen>
      <AppText variant="title">Settings</AppText>

      <AccessibilityCard enabled={accessibilityOn} />

      <View style={styles.sectionHead}>
        <AppText variant="heading">Blocked apps</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Daily limit per app
        </AppText>
      </View>

      {pkgs.length === 0 && (
        <Card>
          <AppText color={colors.textMuted}>No apps yet. Add the ones you scroll too much.</AppText>
        </Card>
      )}

      {pkgs.map((pkg) => (
        <Card key={pkg}>
          <View style={styles.appRow}>
            <AppText variant="bodyLg" numberOfLines={1} style={styles.flex}>
              {appLabel(apps, pkg)}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Stop blocking ${appLabel(apps, pkg)}`}
              hitSlop={12}
              onPress={() => removeTarget(pkg)}>
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <LimitStepper value={targets[pkg]} onChange={(m) => setLimit(pkg, m)} />
        </Card>
      ))}

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
  appRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
