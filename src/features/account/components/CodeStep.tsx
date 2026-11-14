import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { TextField } from '@/components/ui/TextField';
import { colors, space } from '@/theme/tokens';

const RESEND_SECONDS = 60;

/** The 6-digit code field, a Verify button and "Resend code" with a 60 s cooldown. */
export function CodeStep({
  code,
  setCode,
  busy,
  onVerify,
  onResend,
}: {
  code: string;
  setCode: (c: string) => void;
  busy: boolean;
  onVerify: () => void;
  onResend: () => void;
}) {
  const [wait, setWait] = useState(RESEND_SECONDS);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <>
      <TextField
        label="Code"
        code
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        placeholder="••••••"
        autoFocus
      />
      <ChunkyButton label={busy ? 'Checking…' : 'Verify'} size="lg" disabled={busy || code.length !== 6} onPress={onVerify} />
      <Pressable
        accessibilityRole="button"
        disabled={wait > 0 || busy}
        onPress={() => {
          setWait(RESEND_SECONDS);
          onResend();
        }}
        style={styles.resend}>
        <AppText variant="label" uppercase color={wait > 0 ? colors.textMuted : colors.primary}>
          {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
        </AppText>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  resend: { alignSelf: 'center', minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg },
});
