import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { colors, space } from '@/theme/tokens';

import { allowanceMs, isShortScope, scopePkg, shortScope, trackedPackages } from '../limits';
import { appLabel, scopeLabel, useBlocker } from '../store';
import { useAppIcons } from './AppIcon';
import { UsageBar } from './UsageBar';

/** Home card: live time used vs allowance for each limit (Reels limit first, then whole app). */
export function TodayAppsCard() {
  const { apps, targets, today, accessibilityOn, shortFormApps } = useBlocker();
  const pkgs = trackedPackages(targets);
  const scopes = pkgs.flatMap((pkg) => [shortScope(pkg), pkg].filter((s) => targets[s] !== undefined));
  useAppIcons(pkgs);

  const label = (scope: string) => {
    const name = scopeLabel(apps, shortFormApps, scope);
    if (!isShortScope(scope)) return name;
    const n = today?.counts[scope] ?? 0;
    return n > 0 ? `${name} · ${n}` : name;
  };

  if (pkgs.length === 0) {
    return (
      <Card>
        <AppText variant="heading">Today&apos;s apps</AppText>
        <AppText color={colors.textMuted}>Pick the apps that eat your time, and set a daily limit.</AppText>
        <ChunkyButton label="Pick apps" onPress={() => router.push('/pick-apps')} style={styles.button} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="heading">Today&apos;s apps</AppText>
        {!accessibilityOn ? (
          <AppText variant="caption" color={colors.danger} onPress={() => router.navigate('/settings')}>
            Blocking off · fix
          </AppText>
        ) : (
          <AppText variant="caption" color={colors.primary} onPress={() => router.push('/blocked-apps')}>
            Edit limits
          </AppText>
        )}
      </View>
      <View style={styles.list}>
        {scopes.map((scope) => (
          <UsageBar
            key={scope}
            pkg={scopePkg(scope)}
            appName={appLabel(apps, scopePkg(scope))}
            kind={isShortScope(scope) ? 'short' : 'app'}
            label={label(scope)}
            usedMs={today?.usage[scope] ?? 0}
            allowanceMs={allowanceMs(targets[scope], today?.extra[scope] ?? 0)}
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
