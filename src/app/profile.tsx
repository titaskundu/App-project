import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/TextField';
import { deleteAccount, friendlyError, setPassword, signOut, updateProfile, usernameAvailable } from '@/features/account/api';
import { Avatar } from '@/features/account/components/Avatar';
import { ageOn, nameError, normalizeUsername, passwordError, usernameError } from '@/features/account/profile';
import { useAccount } from '@/features/account/store';
import { useMuscle } from '@/features/muscle/store';
import { exportMyData } from '@/features/sync/account';
import { useSync } from '@/features/sync/sync';
import { colors, radius, space } from '@/theme/tokens';

type Busy = 'save' | 'password' | 'export' | 'delete' | 'signout' | null;

function syncLine(pending: number, lastSyncAt: number | null): string {
  if (pending > 0) return `Waiting to upload · ${pending}`;
  if (!lastSyncAt) return 'Will sync when online';
  const min = Math.round((Date.now() - lastSyncAt) / 60000);
  if (min < 1) return 'Synced just now';
  if (min < 60) return `Synced ${min} min ago`;
  return `Synced at ${new Date(lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Profile (from Settings): who you are, auto-sync status, password, privacy (camera consent,
 * export, delete) and sign-out. Signing out keeps blocked-app limits running.
 */
export default function ProfileScreen() {
  const profile = useAccount((s) => s.profile);
  const { email, provider, pending, lastSyncAt } = useSync();
  const poseConsent = useMuscle((s) => s.poseConsent);
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState<'signout' | 'delete' | null>(null);

  if (!profile) return <SafeAreaView style={styles.safe} />;
  const isGoogle = provider === 'google';

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    setNote(null);
    try {
      await task();
    } catch (e) {
      setNote({ text: friendlyError(e), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const startEdit = () => {
    setName(profile.displayName);
    setUsername(profile.username);
    setEditing(true);
    setNote(null);
  };

  const saveEdit = () =>
    run('save', async () => {
      const uname = normalizeUsername(username);
      const err = nameError(name) ?? usernameError(uname);
      if (err) throw new Error(err);
      if (uname !== profile.username && !(await usernameAvailable(uname))) throw new Error(`@${uname} is already taken`);
      await updateProfile({ displayName: name, username: uname });
      setEditing(false);
      setNote({ text: 'Profile saved.' });
    });

  const savePassword = () =>
    run('password', async () => {
      const err = passwordError(newPassword);
      if (err) throw new Error(err);
      await setPassword(newPassword);
      setChangingPassword(false);
      setNewPassword('');
      setNote({ text: 'Password changed.' });
    });

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <AppText variant="title">Profile</AppText>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Who you are */}
          <Card style={styles.gap}>
            <View style={styles.who}>
              <Avatar name={profile.displayName} size={72} />
              <View style={styles.flex}>
                <AppText variant="title" numberOfLines={1}>
                  {profile.displayName}
                </AppText>
                <AppText color={colors.textMuted} numberOfLines={1}>{`@${profile.username}`}</AppText>
                <Chip
                  label={isGoogle ? 'Google account' : 'Email account'}
                  icon={isGoogle ? 'logo-google' : 'mail'}
                  color={colors.primary}
                  bg={colors.primarySoft}
                />
              </View>
            </View>
            {editing ? (
              <View style={styles.gap}>
                <TextField label="Name" value={name} onChangeText={setName} error={nameError(name)} />
                <TextField
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={username ? usernameError(username) : null}
                />
                <ChunkyButton label={busy === 'save' ? 'Saving…' : 'Save'} disabled={!!busy} onPress={saveEdit} />
                <ChunkyButton label="Cancel" tone="neutral" disabled={!!busy} onPress={() => setEditing(false)} />
              </View>
            ) : (
              <ChunkyButton label="Edit profile" tone="neutral" size="sm" icon={<Ionicons name="create" size={14} color={colors.primary} />} onPress={startEdit} />
            )}
          </Card>

          {note && (
            <Card tint={note.bad ? colors.dangerSoft : colors.successSoft}>
              <AppText color={note.bad ? colors.dangerDark : colors.text}>{note.text}</AppText>
            </Card>
          )}

          {/* Details */}
          <Card style={styles.gapSm}>
            <Section title="Details" />
            <Row icon="mail" label="Email" value={email ?? '—'} />
            <Row icon="gift" label="Birthday" value={`${formatDate(profile.birthDate)} · ${ageOn(profile.birthDate, new Date())} years`} />
            <Row icon="calendar" label="Member since" value={formatDate(profile.createdAt)} />
          </Card>

          {/* Sync */}
          <Card style={styles.gapSm}>
            <Section title="Sync" />
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="cloud-done" size={20} color={colors.success} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyLg">Auto-sync is on</AppText>
                <AppText variant="caption" color={colors.textMuted}>
                  {syncLine(pending, lastSyncAt)}
                </AppText>
              </View>
            </View>
            <AppText variant="caption" color={colors.textMuted}>
              Your limits, topics, levels, movement checks, tolls and answers are saved to your account. Never camera
              images, what&apos;s on your screen, or anything you type.
            </AppText>
          </Card>

          {/* Security (email accounts only; Google handles its own) */}
          {!isGoogle && (
            <Card style={styles.gapSm}>
              <Section title="Security" />
              {changingPassword ? (
                <View style={styles.gap}>
                  <TextField
                    label="New password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secret
                    autoCapitalize="none"
                    autoComplete="new-password"
                    error={newPassword ? passwordError(newPassword) : null}
                    hint="At least 8 characters, with letters and a number"
                  />
                  <ChunkyButton label={busy === 'password' ? 'Saving…' : 'Save password'} disabled={!!busy} onPress={savePassword} />
                  <ChunkyButton label="Cancel" tone="neutral" disabled={!!busy} onPress={() => setChangingPassword(false)} />
                </View>
              ) : (
                <ChunkyButton label="Change password" tone="neutral" icon={<Ionicons name="key" size={18} color={colors.primary} />} onPress={() => setChangingPassword(true)} />
              )}
            </Card>
          )}

          {/* Privacy */}
          <Card style={styles.gapSm}>
            <Section title="Privacy" />
            <AppText color={colors.textMuted}>
              {poseConsent
                ? 'Camera rep counter: you agreed that Google’s MediaPipe may run it. It sends Google usage stats, never images.'
                : 'Camera rep counter: you’ll be asked before it first uses the camera.'}
            </AppText>
            {poseConsent && (
              <ChunkyButton
                label="Withdraw camera consent"
                tone="neutral"
                size="sm"
                onPress={() => {
                  useMuscle.getState().setPoseConsent(false);
                  setNote({ text: 'Consent withdrawn. Muscle Mode will ask again before using the camera.' });
                }}
              />
            )}
            <ChunkyButton
              label={busy === 'export' ? 'Preparing…' : 'Export my data'}
              tone="neutral"
              icon={<Ionicons name="download" size={18} color={colors.primary} />}
              disabled={!!busy}
              onPress={() => run('export', exportMyData)}
            />
            <ChunkyButton
              label="Delete account"
              tone="dangerOutline"
              icon={<Ionicons name="trash" size={18} color={colors.danger} />}
              disabled={!!busy}
              onPress={() => setConfirm('delete')}
            />
          </Card>

          {/* Sign out (confirmed in a pop-up) */}
          <ChunkyButton
            label="Sign out"
            tone="neutral"
            icon={<Ionicons name="log-out" size={18} color={colors.primary} />}
            onPress={() => setConfirm('signout')}
          />
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={confirm === 'signout'}
        icon="log-out"
        title="Sign out?"
        message={`${
          pending > 0
            ? `${pending} item${pending === 1 ? " hasn't" : "s haven't"} uploaded yet (no internet). Signing out now loses ${pending === 1 ? 'it' : 'them'}.`
            : 'Your progress is saved to your account and comes back when you log in.'
        } Your blocked apps stay guarded; paying a toll needs a login.`}
        confirmLabel={busy === 'signout' ? 'Signing out…' : 'Sign out'}
        busy={busy === 'signout'}
        onConfirm={() => run('signout', signOut)}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        visible={confirm === 'delete'}
        danger
        icon="trash"
        title="Delete your account?"
        message="This deletes your account, profile, backup, toll history and answers. Your blocked-app limits stay on this phone. This can't be undone."
        confirmLabel={busy === 'delete' ? 'Deleting…' : 'Delete my account'}
        cancelLabel="Keep my account"
        busy={busy === 'delete'}
        onConfirm={() => run('delete', deleteAccount)}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

function Section({ title }: { title: string }) {
  return (
    <AppText variant="micro" uppercase color={colors.textMuted}>
      {title}
    </AppText>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="caption" color={colors.textMuted}>
          {label}
        </AppText>
        <AppText variant="bodyLg" numberOfLines={1}>
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { borderBottomWidth: 2, marginTop: 2 },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  gap: { gap: space.md },
  gapSm: { gap: space.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
