import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import {
  applyBackup,
  backupWithGoogle,
  deleteMyData,
  exportMyData,
  fetchBackup,
  finishSwitch,
  googleConfigured,
  hasProgress,
} from '@/features/sync/account';
import type { Backup } from '@/features/sync/snapshot';
import { syncOnHold, useSync } from '@/features/sync/sync';
import { useMuscle } from '@/features/muscle/store';
import { colors, radius, space } from '@/theme/tokens';

type Busy = 'google' | 'restore' | 'export' | 'delete' | null;

function syncedAgo(ts: number | null): string {
  if (!ts) return 'Not synced yet';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'Synced just now';
  if (min < 60) return `Synced ${min} min ago`;
  return `Synced at ${new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return /network|fetch|offline|internet/i.test(msg) ? 'No internet right now. Try again when you’re online.' : msg;
}

/**
 * Account & data (from Settings): backup status, "Back up with Google", the restore question on
 * a new phone, "Export my data" and "Delete my data".
 */
export default function AccountScreen() {
  const { configured, userId, isAnonymous, email, pending, lastSyncAt } = useSync();
  const [busy, setBusy] = useState<Busy>(null);
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [restore, setRestore] = useState<Backup | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const poseConsent = useMuscle((s) => s.poseConsent);

  // The app was closed while the restore question was open: ask again.
  useEffect(() => {
    if (!syncOnHold() || isAnonymous || !userId) return;
    fetchBackup()
      .then((b) => (hasProgress(b) ? setRestore(b) : finishSwitch()))
      .catch(() => {});
  }, [isAnonymous, userId]);

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    setBusy(kind);
    setNote(null);
    try {
      await task();
    } catch (e) {
      setNote({ text: errorText(e), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const onGoogle = () =>
    run('google', async () => {
      const res = await backupWithGoogle();
      if (res.kind === 'linked') setNote({ text: 'Backed up. Sign in with this Google account on a new phone to get everything back.' });
      if (res.kind === 'switched') {
        if (hasProgress(res.backup)) setRestore(res.backup);
        else {
          await finishSwitch();
          setNote({ text: 'Signed in. Your progress on this phone is now backed up.' });
        }
      }
    });

  const onRestore = (useBackup: boolean) =>
    run('restore', async () => {
      if (useBackup && restore) await applyBackup(restore);
      await finishSwitch();
      setRestore(null);
      setNote({ text: useBackup ? 'Backup restored.' : 'Kept this phone’s progress. It’s now your backup.' });
    });

  const onDelete = () =>
    run('delete', async () => {
      await deleteMyData();
      setConfirmDelete(false);
      setNote({ text: 'Your data was deleted. You’re starting fresh.' });
    });

  const backupDate = restore?.updatedAt
    ? new Date(restore.updatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

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
          <View style={styles.flex}>
            <AppText variant="title">Account & data</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Backup, export and delete
            </AppText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {restore && (
            <Card border={colors.primary} edge={colors.primaryDark} style={styles.gap}>
              <AppText variant="heading">Found your backup</AppText>
              <AppText color={colors.textMuted}>
                {`Saved ${backupDate}. Restore your topics, levels, movement checks and blocked apps? Your toll history is already merged.`}
              </AppText>
              <ChunkyButton label="Restore backup" disabled={!!busy} onPress={() => onRestore(true)} />
              <ChunkyButton label="Keep this phone’s progress" tone="neutral" disabled={!!busy} onPress={() => onRestore(false)} />
            </Card>
          )}

          {!configured ? (
            <Card style={styles.gap}>
              <AppText variant="heading">Backup isn’t set up</AppText>
              <AppText color={colors.textMuted}>Everything is saved on this phone only.</AppText>
            </Card>
          ) : (
            <Card style={styles.gap}>
              <View style={styles.statusRow}>
                <View style={[styles.statusIcon, { backgroundColor: isAnonymous ? colors.warnSoft : colors.successSoft }]}>
                  <Ionicons
                    name={isAnonymous ? 'cloud-offline' : 'cloud-done'}
                    size={22}
                    color={isAnonymous ? colors.warn : colors.success}
                  />
                </View>
                <View style={styles.flex}>
                  <AppText variant="heading">{isAnonymous ? 'Not backed up yet' : 'Backed up with Google'}</AppText>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
                    {isAnonymous ? 'Only this phone can get it back' : email ?? ''}
                  </AppText>
                </View>
              </View>
              <View style={styles.chips}>
                <Chip
                  label={userId ? (pending > 0 ? `Waiting to upload · ${pending}` : syncedAgo(lastSyncAt)) : 'Offline'}
                  icon={pending > 0 || !userId ? 'time' : 'checkmark'}
                  color={colors.primary}
                  bg={colors.primarySoft}
                />
              </View>
              {isAnonymous && googleConfigured && (
                <ChunkyButton
                  label={busy === 'google' ? 'Connecting…' : 'Back up with Google'}
                  icon={<Ionicons name="logo-google" size={18} color={colors.textOnColor} />}
                  disabled={!!busy}
                  onPress={onGoogle}
                />
              )}
            </Card>
          )}

          {note && (
            <Card tint={note.bad ? colors.dangerSoft : colors.successSoft} style={styles.gap}>
              <AppText color={note.bad ? colors.dangerDark : colors.text}>{note.text}</AppText>
            </Card>
          )}

          {configured && (
            <Card style={styles.gap}>
              <AppText variant="micro" uppercase color={colors.textMuted}>
                Your data
              </AppText>
              <AppText color={colors.textMuted}>
                We store your limits, topics, levels, movement checks, toll history and answers. Never camera images,
                what’s on your screen, or anything you type.
              </AppText>
              <ChunkyButton
                label={busy === 'export' ? 'Preparing…' : 'Export my data'}
                tone="neutral"
                icon={<Ionicons name="download" size={18} color={colors.primary} />}
                disabled={!!busy}
                onPress={() => run('export', exportMyData)}
              />
              {!confirmDelete ? (
                <ChunkyButton
                  label="Delete my data"
                  tone="neutral"
                  icon={<Ionicons name="trash" size={18} color={colors.primary} />}
                  disabled={!!busy}
                  onPress={() => setConfirmDelete(true)}
                />
              ) : (
                <Card border={colors.danger} edge={colors.dangerDark} style={styles.gap}>
                  <AppText variant="heading">Delete everything?</AppText>
                  <AppText color={colors.textMuted}>
                    This deletes your account, backup, toll history and answers, and resets Brain and Muscle progress on
                    this phone. Your blocked-app limits stay. This can’t be undone.
                  </AppText>
                  <ChunkyButton
                    label={busy === 'delete' ? 'Deleting…' : 'Yes, delete my data'}
                    tone="danger"
                    disabled={!!busy}
                    onPress={onDelete}
                  />
                  <ChunkyButton label="Cancel" tone="neutral" disabled={!!busy} onPress={() => setConfirmDelete(false)} />
                </Card>
              )}
            </Card>
          )}

          <Card style={styles.gap}>
            <AppText variant="micro" uppercase color={colors.textMuted}>
              Camera rep counter
            </AppText>
            <AppText color={colors.textMuted}>
              {poseConsent
                ? 'You agreed that Google’s MediaPipe may run the rep counter. It sends Google usage stats, never camera images.'
                : 'You’ll be asked before the rep counter first uses the camera.'}
            </AppText>
            {poseConsent && (
              <ChunkyButton
                label="Withdraw consent"
                tone="neutral"
                size="sm"
                onPress={() => {
                  useMuscle.getState().setPoseConsent(false);
                  setNote({ text: 'Consent withdrawn. Muscle Mode will ask again before using the camera.' });
                }}
              />
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
