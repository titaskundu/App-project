import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { signOut } from '@/features/account/api';
import { useAccount } from '@/features/account/store';
import { CompanionHero } from '@/features/companion/components/CompanionHero';
import { colors, space } from '@/theme/tokens';

/**
 * Shown the first time an account is opened on this phone, while its backup and profile load.
 * That needs the internet once; after that the app works offline.
 */
export default function SetupScreen() {
  const state = useAccount((s) => s.gate);
  const retry = useAccount((s) => s.retryCheck);
  const offline = state === 'offline';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <CompanionHero
          text={offline ? "I can't reach the internet. Connect once to finish setting up." : 'Getting your account ready…'}
          color={offline ? colors.warn : colors.primary}
        />
        {offline ? (
          <View style={styles.buttons}>
            <ChunkyButton label="Try again" size="lg" onPress={retry} />
            <ChunkyButton label="Use a different account" tone="neutral" onPress={() => void signOut()} />
          </View>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
        <AppText variant="caption" center color={colors.textMuted}>
          Your blocked apps stay guarded meanwhile.
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: space.md, gap: space.lg, justifyContent: 'center' },
  buttons: { gap: space.md },
});
