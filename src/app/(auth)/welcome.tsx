import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { friendlyError, googleConfigured, signInWithGoogle } from '@/features/account/api';
import { Note } from '@/features/account/components/AuthScreen';
import { MIN_AGE } from '@/features/account/profile';
import { under16Locked, useAccount } from '@/features/account/store';
import { CompanionHero } from '@/features/companion/components/CompanionHero';
import { colors, space } from '@/theme/tokens';

/**
 * First screen when signed out: the panda, and the ways in. An account is required (the
 * blocker keeps working while signed out; paying a toll needs a login).
 */
export default function WelcomeScreen() {
  const under16Until = useAccount((s) => s.under16Until);
  const pendingPath = useAccount((s) => s.pendingPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (under16Locked(under16Until)) return <Under16 />;

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompanionHero
          text={
            pendingPath?.startsWith('/toll')
              ? 'Your limit is up! Log in to pay the toll and unlock more time.'
              : "Hi! I'm your panda. I'll guard your scroll time while you earn it back."
          }
          color={pendingPath ? colors.danger : colors.primary}
        />
        <View style={styles.title}>
          <AppText variant="display" center>
            Mind-Muscle Sync
          </AppText>
          <AppText center color={colors.textMuted}>
            Earn your scroll time with your brain or your muscles.
          </AppText>
        </View>

        {error && <Note text={error} bad />}

        <View style={styles.buttons}>
          {googleConfigured && (
            <ChunkyButton
              label={busy ? 'Connecting…' : 'Continue with Google'}
              icon={<Ionicons name="logo-google" size={18} color={colors.textOnColor} />}
              size="lg"
              disabled={busy}
              onPress={google}
            />
          )}
          <ChunkyButton
            label="Continue with email"
            tone="neutral"
            icon={<Ionicons name="mail" size={18} color={colors.primary} />}
            size="lg"
            disabled={busy}
            onPress={() => router.push('/email')}
          />
          <Pressable accessibilityRole="button" style={styles.link} onPress={() => router.push('/login')}>
            <AppText variant="label" uppercase color={colors.primary}>
              I already have an account
            </AppText>
          </Pressable>
        </View>

        <AppText variant="caption" center color={colors.textMuted}>
          By continuing you agree to the Terms and acknowledge the Privacy Policy.
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Shown for a day after an under-16 date of birth. Parent mode comes in a later version. */
function Under16() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.content, styles.center]}>
        <CompanionHero text="Parent mode is on its way! I'll be ready for you soon." color={colors.brain} />
        <Card style={styles.under16}>
          <AppText variant="heading" center>
            {`Mind-Muscle Sync is for ${MIN_AGE}+ for now`}
          </AppText>
          <AppText center color={colors.textMuted}>
            We didn&apos;t keep your account or any of your details. A parent mode is coming, so a parent can set
            things up with you.
          </AppText>
        </Card>
        {__DEV__ && (
          <Pressable accessibilityRole="button" style={styles.link} onPress={() => useAccount.setState({ under16Until: null })}>
            <AppText variant="caption" color={colors.textMuted}>
              DEV ONLY · CLEAR THE UNDER-16 LOCK
            </AppText>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: space.md, gap: space.lg, justifyContent: 'center' },
  center: { flex: 1 },
  title: { gap: space.xs },
  buttons: { gap: space.md },
  link: { alignSelf: 'center', minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg },
  under16: { gap: space.sm },
});
