import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { TextField } from '@/components/ui/TextField';
import {
  cancelSetup,
  friendlyError,
  googleConfigured,
  logInWithPassword,
  sendResetCode,
  setPassword,
  signInWithGoogle,
  verifyResetCode,
} from '@/features/account/api';
import { AuthScreen, Note } from '@/features/account/components/AuthScreen';
import { CodeStep } from '@/features/account/components/CodeStep';
import { emailError, passwordError } from '@/features/account/profile';
import { colors, space } from '@/theme/tokens';

type Step = 'login' | 'reset-email' | 'reset-code' | 'reset-password';

/** Log in with email + password or Google, and "Forgot password?" with a 6-digit code. */
export default function LoginScreen() {
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    if (step === 'login') router.back();
    else if (step === 'reset-password') void cancelSetup().then(() => setStep('login'));
    else setStep(step === 'reset-code' ? 'reset-email' : 'login');
  };

  if (step === 'reset-email') {
    return (
      <AuthScreen title="Reset password" subtitle="We'll email you a 6-digit code." onBack={back}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        {error && <Note text={error} bad />}
        <ChunkyButton
          label={busy ? 'Sending…' : 'Send code'}
          size="lg"
          disabled={busy || !!emailError(email)}
          onPress={() =>
            run(async () => {
              await sendResetCode(email);
              setCode('');
              setStep('reset-code');
            })
          }
        />
      </AuthScreen>
    );
  }

  if (step === 'reset-code') {
    return (
      <AuthScreen title="Check your email" subtitle={`We sent a 6-digit code to ${email.trim()}.`} onBack={back}>
        <CodeStep
          code={code}
          setCode={setCode}
          busy={busy}
          onVerify={() =>
            run(async () => {
              await verifyResetCode(email, code);
              setPw('');
              setStep('reset-password');
            })
          }
          onResend={() => run(() => sendResetCode(email))}
        />
        {error && <Note text={error} bad />}
      </AuthScreen>
    );
  }

  if (step === 'reset-password') {
    return (
      <AuthScreen title="New password" subtitle="Pick a new password for your account." onBack={back}>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPw}
          secret
          autoCapitalize="none"
          autoComplete="new-password"
          error={password ? passwordError(password) : null}
          hint="At least 8 characters, with letters and a number"
        />
        {error && <Note text={error} bad />}
        <ChunkyButton
          label={busy ? 'Saving…' : 'Save and log in'}
          size="lg"
          disabled={busy || !!passwordError(password)}
          onPress={() => run(() => setPassword(password))}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Welcome back" subtitle="Log in to keep your limits, levels and progress." onBack={back}>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPw}
        secret
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
      />
      <Pressable accessibilityRole="button" style={styles.forgot} onPress={() => setStep('reset-email')}>
        <AppText variant="label" uppercase color={colors.primary}>
          Forgot password?
        </AppText>
      </Pressable>
      {error && <Note text={error} bad />}
      <ChunkyButton
        label={busy ? 'Logging in…' : 'Log in'}
        size="lg"
        disabled={busy || !!emailError(email) || !password}
        onPress={() => run(() => logInWithPassword(email, password))}
      />
      {googleConfigured && (
        <>
          <View style={styles.or}>
            <View style={styles.line} />
            <AppText variant="micro" uppercase color={colors.textMuted}>
              or
            </AppText>
            <View style={styles.line} />
          </View>
          <ChunkyButton
            label="Continue with Google"
            tone="neutral"
            icon={<Ionicons name="logo-google" size={18} color={colors.primary} />}
            disabled={busy}
            onPress={() => run(async () => void (await signInWithGoogle()))}
          />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  line: { flex: 1, height: 2, backgroundColor: colors.border },
});
