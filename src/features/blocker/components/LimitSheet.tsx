import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { colors, modeTones, radius, space } from '@/theme/tokens';

import {
  appLimits,
  formatDuration,
  limitMode,
  scopeStatuses,
  targetsForMode,
  withAppLimits,
  type LimitMode,
  type ScopeStatus,
} from '../limits';
import { appLabel, useBlocker } from '../store';
import { AppIcon } from './AppIcon';
import { LimitStepper } from './LimitStepper';
import { KindChip } from './ModeChips';
import { ModeSwitch } from './ModeSwitch';

type Props = {
  pkg: string | null;
  onClose: () => void;
  /** Called after Save, so the screen can re-sort once the sheet is gone. */
  onSaved?: () => void;
};

// A plain slide (no spring), so the sheet doesn't wobble.
const SLIDE_IN = SlideInDown.duration(260).easing(Easing.out(Easing.cubic));
const SLIDE_OUT = SlideOutDown.duration(200).easing(Easing.in(Easing.cubic));
/** Share of the screen the sheet takes when it has a Reels/Shorts mode switch. */
const SHEET_HEIGHT = 0.86;

/**
 * Bottom sheet with one app's controls. Changes are a draft until Save; closing with unsaved
 * changes asks to save or discard. "Stop blocking" applies at once.
 *
 * Drawn as an overlay inside the screen (render it last, outside any SafeAreaView) rather than
 * a Modal, because Android Modals stop above the navigation bar and leave a gray band. The
 * wrapper stays mounted so the slide-out animation can play.
 */
export function LimitSheet({ pkg, onClose, onSaved }: Props) {
  const open = useBlocker((s) => pkg !== null && limitMode(s.targets, pkg) !== null);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open && pkg !== null && <SheetContent key={pkg} pkg={pkg} onClose={onClose} onSaved={onSaved} />}
    </View>
  );
}

function SheetContent({ pkg, onClose, onSaved }: { pkg: string; onClose: () => void; onSaved?: () => void }) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { apps, targets, today, shortFormApps, saveAppLimits, removeApp } = useBlocker();
  const name = appLabel(apps, pkg);
  const feed = shortFormApps[pkg];

  // The draft: this app's limits as edited in the sheet (store is untouched until Save).
  const [saved] = useState(() => appLimits(targets, pkg));
  const [draft, setDraft] = useState(saved);
  // Minutes of limits switched off in the draft, so switching back restores them.
  const memory = useRef<Record<string, number>>({ ...saved });
  const [confirming, setConfirming] = useState(false);

  const mode = limitMode(draft, pkg) ?? 'app';
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const statuses = scopeStatuses(withAppLimits(targets, pkg, draft), today, pkg);

  const requestClose = () => {
    if (dirty) setConfirming(true);
    else onClose();
  };

  const save = () => {
    saveAppLimits(pkg, draft);
    onClose();
    onSaved?.();
  };

  // Android back: close the prompt first, then the sheet (asking if there are changes).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirming) setConfirming(false);
      else if (dirty) setConfirming(true);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [confirming, dirty, onClose]);

  const setMode = (m: LimitMode) => setDraft((d) => appLimits(targetsForMode({ ...memory.current, ...d }, pkg, m), pkg));
  const setMinutes = (scope: string, minutes: number) => {
    memory.current[scope] = minutes;
    setDraft((d) => ({ ...d, [scope]: minutes }));
  };

  return (
    <>
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, styles.backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={requestClose} />
      </Animated.View>

      {/* Apps with a Reels/Shorts mode get a fixed height, so switching Reels only / Whole app /
          Both doesn't make the sheet jump: header, mode switch and buttons stay put, and only the
          limit cards scroll between them. */}
      <Animated.View
        entering={SLIDE_IN}
        exiting={SLIDE_OUT}
        style={[styles.sheet, { paddingBottom: insets.bottom + space.sm }, feed ? { height: Math.round(windowHeight * SHEET_HEIGHT) } : null]}>
        <View style={styles.handle} />
        <View style={styles.fixedTop}>
          <View style={styles.head}>
            <AppIcon pkg={pkg} label={name} size={52} />
            <View style={styles.flex}>
              <AppText variant="title" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                Daily limit · resets at midnight
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={requestClose}>
              <Ionicons name="close" size={28} color={colors.textMuted} />
            </Pressable>
          </View>

          {feed ? (
            <View style={styles.section}>
              <AppText variant="micro" uppercase color={colors.textMuted}>
                What to limit
              </AppText>
              <ModeSwitch value={mode} feed={feed} onChange={setMode} />
            </View>
          ) : null}
        </View>

        <ScrollView style={feed ? styles.flex : null} contentContainerStyle={styles.scrollContent} bounces={false}>
          {statuses.map((s) => (
            <LimitBlock key={s.scope} status={s} name={name} feed={feed} onChange={(m) => setMinutes(s.scope, m)} />
          ))}

          {today?.stale.includes(pkg) && mode !== 'app' && (
            <View style={styles.warning}>
              <Ionicons name="alert-circle" size={18} color={colors.muscleDark} />
              <AppText variant="caption" color={colors.muscleDark} style={styles.flex}>
                {`Can't spot ${feed} right now (maybe after a ${name} update). Counting all of ${name} against your ${feed} limit until it's fixed.`}
              </AppText>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <ChunkyButton label={dirty ? 'Save' : 'Saved'} disabled={!dirty} onPress={save} />

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onClose();
              removeApp(pkg);
            }}
            style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
            <AppText variant="label" uppercase numberOfLines={1} color={colors.danger} style={styles.noShrink}>
              Stop blocking
            </AppText>
          </Pressable>
        </View>
      </Animated.View>

      {confirming && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, styles.promptWrap]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Keep editing" onPress={() => setConfirming(false)} />
          <Animated.View entering={ZoomIn.duration(180)} style={styles.prompt}>
            <AppText variant="heading" center>
              Save your changes?
            </AppText>
            <AppText center color={colors.textMuted}>
              {`You changed ${name}'s limit. Save it, or throw the changes away?`}
            </AppText>
            <ChunkyButton
              label="Save"
              onPress={() => {
                setConfirming(false);
                save();
              }}
            />
            <ChunkyButton
              label="Discard"
              tone="neutral"
              onPress={() => {
                setConfirming(false);
                onClose();
              }}
            />
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setConfirming(false)} style={styles.keep}>
              <AppText variant="caption" color={colors.textMuted}>
                Keep editing
              </AppText>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}
    </>
  );
}

/**
 * One limit in its mode's color. The bar shows time LEFT today, so + makes it grow and −
 * makes it shrink (a "used" bar would do the opposite while you adjust).
 */
function LimitBlock({
  status: s,
  name,
  feed,
  onChange,
}: {
  status: ScopeStatus;
  name: string;
  feed: string | undefined;
  onChange: (minutes: number) => void;
}) {
  const t = modeTones[s.kind];
  const hint =
    s.kind === 'short'
      ? `Only time in ${feed ?? 'Reels'}. The rest of ${name} stays open.`
      : feed
        ? `All time in ${name}, ${feed} included.`
        : `All time in ${name}.`;
  const leftMs = Math.max(0, s.allowanceMs - s.usedMs);
  const leftRatio = s.allowanceMs > 0 ? leftMs / s.allowanceMs : 0;
  const fill = s.level === 'near' ? colors.warn : t.color;

  return (
    <View style={[styles.block, { backgroundColor: t.soft, borderColor: t.color, borderBottomColor: t.dark }]}>
      <View style={styles.blockHead}>
        <KindChip kind={s.kind} feed={feed} />
        <AppText variant="caption" numberOfLines={1} color={colors.textMuted} style={styles.noShrink}>
          {`${formatDuration(s.usedMs)} used today`}
        </AppText>
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        {hint}
      </AppText>
      <View style={styles.leftRow}>
        <AppText variant="caption" color={s.level === 'over' ? colors.danger : t.dark}>
          {s.level === 'over' ? 'No time left today' : `${formatDuration(leftMs)} left today`}
        </AppText>
      </View>
      <View style={styles.track}>
        {leftRatio > 0 && <View style={[styles.fill, { width: `${Math.max(leftRatio * 100, 2)}%`, backgroundColor: fill }]} />}
      </View>
      <View style={styles.stepper}>
        <LimitStepper value={s.limit} onChange={onChange} kind={s.kind} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.scrim },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: radius.full,
    backgroundColor: colors.borderDark,
    marginTop: space.sm,
  },
  fixedTop: { padding: space.md, paddingBottom: space.sm, gap: space.md },
  scrollContent: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.md },
  footer: { paddingHorizontal: space.md, paddingTop: space.sm, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  noShrink: { flexShrink: 0 },
  section: { gap: space.sm },
  block: { padding: space.md, gap: space.sm, borderRadius: radius.lg, borderWidth: 2, borderBottomWidth: 5 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  leftRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  track: { height: 10, borderRadius: radius.full, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  stepper: { alignItems: 'center', marginTop: space.xs },
  warning: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.muscleSoft,
  },
  remove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.surface,
  },
  removePressed: { borderBottomWidth: 2, marginTop: 2 },
  promptWrap: { backgroundColor: colors.scrim, justifyContent: 'center', padding: space.lg },
  prompt: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  keep: { alignSelf: 'center', paddingVertical: space.xs },
});
