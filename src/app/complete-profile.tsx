import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { TextField } from '@/components/ui/TextField';
import { createProfile, friendlyError, rejectUnder16, signOut, usernameAvailable } from '@/features/account/api';
import { AuthScreen, Note } from '@/features/account/components/AuthScreen';
import {
  birthDateError,
  isOldEnough,
  nameError,
  normalizeUsername,
  suggestUsername,
  toIsoDate,
  usernameError,
} from '@/features/account/profile';
import { useSync } from '@/features/sync/sync';
import { colors, space } from '@/theme/tokens';

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'error';

/**
 * Required after sign-up (and for an existing account without a profile): name, a unique
 * username, and date of birth. Under 16 → the account isn't kept, and the welcome screen shows
 * the "parent mode is coming" message.
 */
export default function CompleteProfileScreen() {
  const fullName = useSync((s) => s.fullName);
  const email = useSync((s) => s.email);
  const [name, setName] = useState(fullName ?? '');
  const [username, setUsername] = useState(() => (fullName ? suggestUsername(fullName) : ''));
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Suggest a username from the name until the user types their own.
  const onName = (n: string) => {
    setName(n);
    if (!usernameEdited) {
      setUsername(n.trim() ? suggestUsername(n) : '');
      setAvailability('idle');
    }
  };

  // Live "is it free?" check, half a second after typing stops.
  const uname = normalizeUsername(username);
  const formatError = usernameError(uname);
  useEffect(() => {
    if (formatError) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setAvailability('checking');
      usernameAvailable(uname)
        .then((ok) => !cancelled && setAvailability(ok ? 'free' : 'taken'))
        .catch(() => !cancelled && setAvailability('error'));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [uname, formatError]);

  const birthIso = toIsoDate(Number(year), Number(month), Number(day));
  const dobComplete = day.length > 0 && month.length > 0 && year.length === 4;
  const dobError = dobComplete || submitted ? birthDateError(birthIso, new Date()) : null;
  const unameError = username ? formatError ?? (availability === 'taken' ? 'Already taken' : null) : null;
  const ready = !nameError(name) && !formatError && availability === 'free' && !!birthIso && !birthDateError(birthIso, new Date());

  const submit = async () => {
    setSubmitted(true);
    if (!ready || !birthIso) return;
    setBusy(true);
    setError(null);
    try {
      if (!isOldEnough(birthIso, new Date())) {
        await rejectUnder16();
        return;
      }
      await createProfile({ displayName: name, username: uname, birthDate: birthIso });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const status =
    !username || formatError ? null : availability === 'checking' ? (
      <ActivityIndicator color={colors.primary} />
    ) : availability === 'free' ? (
      <Ionicons name="checkmark-circle" size={24} color={colors.success} />
    ) : availability === 'taken' ? (
      <Ionicons name="close-circle" size={24} color={colors.danger} />
    ) : null;

  return (
    <AuthScreen title="About you" subtitle={email ? `Signed in as ${email}` : 'A few details to set up your account.'}>
      <TextField label="Your name" value={name} onChangeText={onName} autoComplete="name" textContentType="name" error={submitted ? nameError(name) : null} />
      <TextField
        label="Username"
        value={username}
        onChangeText={(t) => {
          setUsernameEdited(true);
          setUsername(t);
          setAvailability('idle'); // the old "free" no longer applies
        }}
        autoCapitalize="none"
        autoCorrect={false}
        right={status}
        error={unameError}
        hint={availability === 'free' ? `@${uname} is yours` : 'Letters, numbers and _ (3–20)'}
      />
      <View style={styles.dob}>
        <AppText variant="micro" uppercase color={colors.textMuted}>
          Date of birth
        </AppText>
        <View style={styles.dobRow}>
          <View style={styles.dobDay}>
            <TextField label="Day" value={day} onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="DD" maxLength={2} />
          </View>
          <View style={styles.dobDay}>
            <TextField label="Month" value={month} onChangeText={(t) => setMonth(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="MM" maxLength={2} />
          </View>
          <View style={styles.dobYear}>
            <TextField label="Year" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="YYYY" maxLength={4} />
          </View>
        </View>
        {dobError ? (
          <AppText variant="caption" color={colors.dangerDark}>
            {dobError}
          </AppText>
        ) : (
          <AppText variant="caption" color={colors.textMuted}>
            Kept private. Only used to check you&apos;re old enough.
          </AppText>
        )}
      </View>

      {error && <Note text={error} bad />}
      <ChunkyButton label={busy ? 'Saving…' : 'Finish'} size="lg" disabled={busy || !ready} onPress={submit} />
      <Pressable accessibilityRole="button" style={styles.link} onPress={() => void signOut()}>
        <AppText variant="label" uppercase color={colors.textMuted}>
          Use a different account
        </AppText>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  dob: { gap: 6 },
  dobRow: { flexDirection: 'row', gap: space.sm },
  dobDay: { flex: 1 },
  dobYear: { flex: 1.5 },
  link: { alignSelf: 'center', minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg },
});
