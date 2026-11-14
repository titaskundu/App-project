import { router } from 'expo-router';
import { useState } from 'react';

import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { TextField } from '@/components/ui/TextField';
import { cancelSetup, friendlyError, sendEmailCode, setPassword, verifyEmailCode } from '@/features/account/api';
import { AuthScreen, Note } from '@/features/account/components/AuthScreen';
import { CodeStep } from '@/features/account/components/CodeStep';
import { emailError, passwordError } from '@/features/account/profile';

type Step = 'email' | 'code' | 'password';

/** Sign up with email: email → 6-digit code → password. Then the profile screen takes over. */
export default function EmailSignUpScreen() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

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
    if (step === 'email') router.back();
    else if (step === 'code') setStep('email');
    // After the code the user is signed in: going back cancels the sign-up.
    else void cancelSetup().then(() => setStep('email'));
  };

  if (step === 'email') {
    const err = touched ? emailError(email) : null;
    return (
      <AuthScreen title="Your email" subtitle="We'll send you a 6-digit code to check it's yours." onBack={back}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched(true)}
          error={err}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          returnKeyType="send"
        />
        {error && <Note text={error} bad />}
        <ChunkyButton
          label={busy ? 'Sending…' : 'Send code'}
          size="lg"
          disabled={busy || !!emailError(email)}
          onPress={() =>
            run(async () => {
              await sendEmailCode(email);
              setCode('');
              setStep('code');
            })
          }
        />
      </AuthScreen>
    );
  }

  if (step === 'code') {
    return (
      <AuthScreen title="Check your email" subtitle={`We sent a 6-digit code to ${email.trim()}.`} onBack={back}>
        <CodeStep
          code={code}
          setCode={setCode}
          busy={busy}
          onVerify={() => run(async () => {
            // An existing account just logs in (the gate takes over); a new one sets a password.
            if ((await verifyEmailCode(email, code)) === 'new') setStep('password');
          })}
          onResend={() => run(() => sendEmailCode(email))}
        />
        {error && <Note text={error} bad />}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title="Create a password" subtitle="You'll use it with your email to log in." onBack={back}>
      <TextField
        label="Password"
        value={password}
        onChangeText={setPw}
        secret
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        error={password ? passwordError(password) : null}
        hint="At least 8 characters, with letters and a number"
      />
      {error && <Note text={error} bad />}
      <ChunkyButton
        label={busy ? 'Saving…' : 'Continue'}
        size="lg"
        disabled={busy || !!passwordError(password)}
        onPress={() => run(() => setPassword(password))}
      />
    </AuthScreen>
  );
}
