import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { colors, space } from '@/theme/tokens';

import { allowanceMs } from '../limits';
import { appLabel, useBlocker } from '../store';
import { UsageBar } from './UsageBar';

/** Home card: live time used vs allowance for each blocked app. */
export function TodayAppsCard() {
  const { apps, targets, today, accessibilityOn } = useBlocker();
  const pkgs = Object.keys(targets);

  if (pkgs.length === 0) {
    return (
      <Card>
        <AppText variant="heading">Today&apos;s apps</AppText>
        <AppText color={colors.textMuted}>Pick the apps that eat your time, and set a daily limit.</AppText>
        <ChunkyButton label="Pick apps" onPress={() => router.navigate('/settings')} style={styles.button} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="heading">Today&apos;s apps</AppText>
        {!accessibilityOn && (
          <AppText variant="caption" color={colors.danger} onPress={() => router.navigate('/settings')}>
            Blocking off · fix
          </AppText>
        )}
      </View>
      <View style={styles.list}>
        {pkgs.map((pkg) => (
          <UsageBar
            key={pkg}
            label={appLabel(apps, pkg)}
            usedMs={today?.usage[pkg] ?? 0}
            allowanceMs={allowanceMs(targets[pkg], today?.extra[pkg] ?? 0)}
          />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: space.md, marginTop: space.sm },
  button: { marginTop: space.sm },
});
