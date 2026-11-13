import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useSharedValue, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { useBrain } from '@/features/brain/store';
import { scopeLabel, useBlocker } from '@/features/blocker/store';
import { RepRing } from '@/features/muscle/components/RepRing';
import { SkeletonOverlay } from '@/features/muscle/components/SkeletonOverlay';
import { FRAMING_TEXT } from '@/features/muscle/framing';
import type { RawFrame } from '@/features/muscle/pose';
import { useMuscle } from '@/features/muscle/store';
import {
  EXERCISE_ORDER,
  EXERCISE_TEXT,
  EXERCISES,
  formBonus,
  MUSCLE_PRACTICE_BANK_MINUTES,
  MUSCLE_TOLL_MINUTES,
  muscleReward,
  repsFor,
  TIP_TEXT,
} from '@/features/muscle/toll';
import { simFrame } from '@/features/muscle/testing/fakePose';
import type { Exercise } from '@/features/muscle/types';
import { useMuscleSession, type Interruption } from '@/features/muscle/useMuscleSession';
import { recordTollEvent } from '@/features/sync/sync';
import { colors, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';
import { PoseCamera, PoseCameraView, type CameraPermission, type PoseStatus } from '@modules/pose-camera';

type Mode = 'toll' | 'practice' | 'calibration';

const ICONS: Record<Exercise, keyof typeof Ionicons.glyphMap> = {
  squat: 'body',
  jack: 'star',
  raise: 'hand-right',
};

const isExercise = (e: unknown): e is Exercise => EXERCISE_ORDER.includes(e as Exercise);

/**
 * Muscle Mode. Routes:
 *  - /muscle?mode=toll&pkg=…&scope=…   toll from the blocker popup (unlocks the app)
 *  - /muscle?mode=practice             practice set that banks minutes (Home)
 *  - /muscle?mode=calibration          redo the movement check (Settings)
 * The camera counts reps on the phone; nothing is recorded or uploaded.
 */
export default function MuscleScreen() {
  const params = useLocalSearchParams<{ mode?: string; pkg?: string; scope?: string; exercise?: string; sim?: string }>();
  const mode: Mode = params.mode === 'practice' || params.mode === 'calibration' ? params.mode : 'toll';
  const pkg = params.pkg ?? '';
  const scope = params.scope || pkg;

  const [tollsToday] = useState(() => Object.values(useBlocker.getState().today?.tolls ?? {}).reduce((a, b) => a + b, 0));
  const [exercise, setExercise] = useState<Exercise | null>(isExercise(params.exercise) ? params.exercise : null);
  const [perm, setPerm] = useState<CameraPermission | null>(null);
  const consent = useMuscle((s) => s.poseConsent);
  const sim = __DEV__ && params.sim === '1';

  useEffect(() => {
    PoseCamera.getPermission()
      .then(setPerm)
      .catch(() => setPerm({ status: 'denied', granted: false, canAskAgain: false }));
  }, []);

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/')), []);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [close])
  );

  const pick = (ex: Exercise) => {
    useMuscle.getState().setLastExercise(ex);
    setExercise(ex);
  };

  if (!exercise) return <Picker mode={mode} tollsToday={tollsToday} onPick={pick} close={close} />;
  if (!consent && !sim) return <ConsentAsk close={close} />;
  if (!perm) return <SafeAreaView style={styles.safe} />;
  if (!perm.granted) return <PermissionAsk perm={perm} onChange={setPerm} close={close} />;

  const target = mode === 'toll' ? repsFor(exercise, tollsToday) : mode === 'practice' ? EXERCISES[exercise].base : 1;
  return (
    <Session
      key={exercise}
      mode={mode}
      exercise={exercise}
      target={target}
      pkg={pkg}
      scope={scope}
      close={close}
      sim={sim}
    />
  );
}

/** Choose the move: three big coral cards. */
function Picker({
  mode,
  tollsToday,
  onPick,
  close,
}: {
  mode: Mode;
  tollsToday: number;
  onPick: (e: Exercise) => void;
  close: () => void;
}) {
  const last = useMuscle((s) => s.lastExercise);
  const checked = useMuscle((s) => s.checked);
  const title = mode === 'calibration' ? 'Movement check' : mode === 'toll' ? 'Pick your move' : 'Muscle practice';
  const subtitle =
    mode === 'calibration'
      ? 'Do one slow rep so I learn your range. Pick a move:'
      : mode === 'toll'
        ? `Unlock ${MUSCLE_TOLL_MINUTES} min, plus up to +5 for good form.`
        : `Bank +${MUSCLE_PRACTICE_BANK_MINUTES} min for later.`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close}>
          <Ionicons name="close" size={28} color={colors.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.pickBody}>
        <AppText variant="title">{title}</AppText>
        <AppText color={colors.textMuted}>{subtitle}</AppText>
        {EXERCISE_ORDER.map((ex) => {
          const reps = mode === 'toll' ? repsFor(ex, tollsToday) : mode === 'practice' ? EXERCISES[ex].base : 1;
          const text = EXERCISE_TEXT[ex];
          return (
            <Pressable
              key={ex}
              accessibilityRole="button"
              accessibilityLabel={mode === 'calibration' ? text.name : `${reps} ${text.plural}`}
              onPress={() => onPick(ex)}
              style={({ pressed }) => [styles.move, ex === last && styles.moveLast, pressed && styles.movePressed]}>
              <View style={styles.moveIcon}>
                <Ionicons name={ICONS[ex]} size={28} color={colors.textOnColor} />
              </View>
              <View style={styles.flex}>
                <View style={styles.moveTitle}>
                  <AppText variant="heading" color={colors.muscleDark}>
                    {mode === 'calibration' ? text.name : `${reps} ${text.plural}`}
                  </AppText>
                  {mode === 'calibration' && checked.includes(ex) && (
                    <Chip label="Checked" icon="checkmark" color={colors.success} bg={colors.successSoft} />
                  )}
                </View>
                <AppText variant="caption" color={colors.text}>
                  {text.how}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={22} color={colors.muscleDark} />
            </Pressable>
          );
        })}
        <View style={styles.privacy}>
          <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
            Your camera counts reps on this phone. Nothing is recorded or uploaded.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Explains the camera before Android's permission prompt. */
function PermissionAsk({
  perm,
  onChange,
  close,
}: {
  perm: CameraPermission;
  onChange: (p: CameraPermission) => void;
  close: () => void;
}) {
  const blocked = !perm.canAskAgain;
  const ask = async () => onChange(await PoseCamera.requestPermission());

  // Coming back from Android settings: check again.
  useFocusEffect(
    useCallback(() => {
      PoseCamera.getPermission().then((p) => p.granted && onChange(p));
    }, [onChange])
  );

  return (
    <SafeAreaView style={[styles.safe, styles.permWrap]}>
      <View style={styles.permTop}>
        <View style={styles.permIcon}>
          <Ionicons name="camera" size={48} color={colors.muscle} />
        </View>
        <AppText variant="title" center>
          Let me see your reps
        </AppText>
        <AppText variant="bodyLg" center color={colors.textMuted}>
          Muscle Mode uses your front camera to count your reps. It all happens on this phone: no video is saved or
          sent anywhere.
        </AppText>
      </View>
      <View style={styles.actions}>
        <ChunkyButton
          label={blocked ? 'Open settings' : 'Allow camera'}
          tone="muscle"
          size="lg"
          onPress={blocked ? () => Linking.openSettings() : ask}
        />
        <ChunkyButton label="Not now" tone="neutral" onPress={close} />
      </View>
    </SafeAreaView>
  );
}

const MEDIAPIPE_TERMS_URL = 'https://developers.google.com/edge/mediapipe/legal/tos';

/** One-time consent before the rep counter first runs (it sends Google usage stats, never images). */
function ConsentAsk({ close }: { close: () => void }) {
  return (
    <SafeAreaView style={[styles.safe, styles.permWrap]}>
      <ScrollView contentContainerStyle={styles.consentScroll}>
        <View style={styles.permIcon}>
          <Ionicons name="shield-checkmark" size={48} color={colors.muscle} />
        </View>
        <AppText variant="title" center>
          Before we count reps
        </AppText>
        <AppText variant="bodyLg" center color={colors.textMuted}>
          The rep counter uses Google’s MediaPipe. Your camera images stay on this phone and are never saved or sent.
        </AppText>
        <AppText center color={colors.textMuted}>
          MediaPipe sends Google usage stats: this app’s ID, your phone model and Android version, how often it ran, and
          general details of the camera frames (like their size). You can withdraw anytime in Settings → Account & data.
        </AppText>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => Linking.openURL(MEDIAPIPE_TERMS_URL)}>
          <AppText variant="label" uppercase center color={colors.primary}>
            Google’s details
          </AppText>
        </Pressable>
      </ScrollView>
      <View style={styles.actions}>
        <ChunkyButton label="I agree" tone="muscle" size="lg" onPress={() => useMuscle.getState().setPoseConsent(true)} />
        <ChunkyButton label="Not now" tone="neutral" onPress={close} />
      </View>
    </SafeAreaView>
  );
}

/** The live camera session. */
function Session({
  mode,
  exercise,
  target,
  pkg,
  scope,
  close,
  sim,
}: {
  mode: Mode;
  exercise: Exercise;
  target: number;
  pkg: string;
  scope: string;
  close: () => void;
  /** Dev only: feed a simulated person instead of the camera (emulator testing). */
  sim: boolean;
}) {
  const s = useMuscleSession({ exercise, target, checkOnly: mode === 'calibration' });
  const [camera, setCamera] = useState<PoseStatus>({ state: 'starting' });
  const data = useSharedValue<number[]>([]);
  const size = useSharedValue({ w: 0, h: 0 });
  const text = EXERCISE_TEXT[exercise];
  const { onFrame } = s;

  const feed = useCallback(
    (f: RawFrame) => {
      data.set(f.lm.length ? [f.w, f.h, ...f.lm] : []);
      onFrame(f);
    },
    [data, onFrame]
  );

  useEffect(() => {
    if (!sim) return;
    let i = 0;
    const id = setInterval(() => feed(simFrame(exercise, i++)), 42);
    return () => clearInterval(id);
  }, [sim, exercise, feed]);

  if (s.stage === 'done') {
    return <Result mode={mode} exercise={exercise} reps={s.reps} fullReps={s.fullReps} pkg={pkg} scope={scope} close={close} again={s.restart} />;
  }

  const counting = s.stage === 'go';
  const framed = s.stage === 'setup' && s.framing === 'ok';

  return (
    <View style={styles.camWrap} onLayout={(e) => size.set({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <PoseCameraView
        style={StyleSheet.absoluteFill}
        active
        onStatus={(e) => setCamera(e.nativeEvent)}
        onPose={(e) => {
          if (!sim) feed(e.nativeEvent);
        }}
      />
      <SkeletonOverlay data={data} size={size} color={framed || counting ? colors.textOnColor : colors.muscleSoft} joint={colors.muscle} />

      <SafeAreaView style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Corners only, so the middle stays clear for the user's head and raised arms. */}
        <View style={styles.camHeader}>
          <View style={styles.headLeft}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close} style={styles.roundBtn}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
            <Chip
              label={mode === 'calibration' ? 'Movement check' : text.name}
              icon={ICONS[exercise]}
              color={colors.muscleDark}
              bg={colors.surface}
              style={styles.headChip}
            />
          </View>
          {/* Also while paused mid-set, so the user sees their reps are kept. */}
          {(counting || s.reps > 0) && <RepRing reps={s.reps} target={target} tick={s.repTick} />}
        </View>

        {s.stage === 'countdown' && (
          <View style={styles.centerFill} pointerEvents="none">
            <Animated.View key={s.count} entering={ZoomIn.duration(250)} style={styles.countBubble}>
              <AppText variant="display" color={colors.textOnColor} style={styles.countText}>
                {s.count}
              </AppText>
            </Animated.View>
          </View>
        )}

        <View style={styles.flex} pointerEvents="none" />

        <View style={styles.panelWrap}>
          {s.tip && (counting || s.stage === 'check') && (
            <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={styles.tip}>
              <Ionicons name="arrow-down-circle" size={22} color={colors.sparkDark} />
              <AppText variant="heading" color={colors.text}>
                {TIP_TEXT[s.tip]}
              </AppText>
            </Animated.View>
          )}
          <Panel stage={s.stage} framing={s.framing} interrupted={s.interrupted} camera={camera} exercise={exercise} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Panel({
  stage,
  framing,
  interrupted,
  camera,
  exercise,
}: {
  stage: string;
  framing: keyof typeof FRAMING_TEXT;
  interrupted: Interruption;
  camera: PoseStatus;
  exercise: Exercise;
}) {
  const text = EXERCISE_TEXT[exercise];
  let icon: keyof typeof Ionicons.glyphMap = 'phone-portrait';
  let color: string = colors.muscleDark;
  let title = '';
  let body = '';

  if (camera.state === 'error') {
    icon = 'alert-circle';
    color = colors.danger;
    title = "Camera didn't start";
    body = camera.message ?? 'Close this screen and try again.';
  } else if (stage === 'setup') {
    const ok = framing === 'ok';
    icon = ok ? 'checkmark-circle' : 'body';
    color = ok ? colors.success : colors.muscleDark;
    title = FRAMING_TEXT[framing];
    if (interrupted === 'set') {
      // Paused mid-set: the user left the frame. Reps are kept.
      body = ok ? 'Counting carries on after the countdown.' : 'Paused. Your reps carry on after a quick 3-2-1.';
    } else if (interrupted === 'countdown') {
      // The 3-2-1 stopped because the user left the frame or moved.
      body = ok ? 'Stay still until the countdown ends.' : 'Stay in view until the countdown ends.';
    } else {
      body = ok
        ? 'Starting in a moment.'
        : exercise === 'squat'
          ? 'Prop your phone facing you (a table is fine), then step back about 2 m.'
          : 'Prop your phone at waist height, then step back about 2 m.';
    }
  } else if (stage === 'countdown') {
    icon = ICONS[exercise];
    title = 'Get ready!';
    body = text.how;
  } else if (stage === 'check') {
    icon = 'scan';
    title = `One slow, full ${text.name.toLowerCase()}`;
    body = "I'll learn your range, so reps count fairly for your body.";
  } else if (stage === 'checked') {
    icon = 'checkmark-circle';
    color = colors.success;
    title = 'Got it!';
    body = 'Your range is saved.';
  } else {
    icon = ICONS[exercise];
    title = 'Keep going!';
    body = text.how;
  }

  return (
    <View style={styles.panel}>
      <Ionicons name={icon} size={30} color={color} />
      <View style={styles.flex}>
        <AppText variant="heading" color={color}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function Result({
  mode,
  exercise,
  reps,
  fullReps,
  pkg,
  scope,
  close,
  again,
}: {
  mode: Mode;
  exercise: Exercise;
  reps: number;
  fullReps: number;
  pkg: string;
  scope: string;
  close: () => void;
  again: () => void;
}) {
  const { apps, shortFormApps, refresh } = useBlocker();
  const name = scopeLabel(apps, shortFormApps, scope);
  const text = EXERCISE_TEXT[exercise];

  // Practice: bank minutes exactly once per set.
  const bankedOnce = useRef(false);
  const [banked, setBanked] = useState(0);
  useEffect(() => {
    if (mode === 'practice' && !bankedOnce.current) {
      bankedOnce.current = true;
      const added = useBrain.getState().bankAdd(MUSCLE_PRACTICE_BANK_MINUTES);
      setBanked(added);
      recordTollEvent({ kind: 'muscle', mode: 'practice', passed: true, minutes: added, exercise, reps, fullReps });
    }
  }, [mode, exercise, reps, fullReps]);

  const minutes = muscleReward(fullReps, reps);
  const bonus = formBonus(fullReps, reps);
  const leaveAll = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };
  const claim = () => {
    if (scope) AppBlocker.grantMinutes(scope, minutes, true);
    recordTollEvent({ kind: 'muscle', mode: 'toll', scope, passed: true, minutes, exercise, reps, fullReps });
    refresh();
    if (pkg) AppBlocker.openApp(pkg);
    leaveAll();
  };

  let title = '';
  let body = '';
  let actions: { label: string; tone: 'muscle' | 'neutral'; onPress: () => void }[] = [];
  if (mode === 'toll') {
    title = 'Toll paid!';
    body = `${reps} ${text.plural}, ${fullReps} with full form. ${minutes} minutes unlocked${name ? ` for ${name}` : ''}.`;
    actions = [{ label: pkg ? `Open ${name} · +${minutes} min` : `Unlock +${minutes} min`, tone: 'muscle', onPress: claim }];
  } else if (mode === 'practice') {
    title = 'Nice moves!';
    body = banked
      ? `${reps} ${text.plural}, ${fullReps} with full form. +${banked} min saved to your bank for later.`
      : `${reps} ${text.plural}, ${fullReps} with full form. Your bank is full for today.`;
    actions = [
      { label: 'Go again', tone: 'muscle', onPress: again },
      { label: 'Done', tone: 'neutral', onPress: close },
    ];
  } else {
    title = 'Movement check saved';
    body = `${text.name} reps now count against your own range.`;
    actions = [{ label: 'Done', tone: 'muscle', onPress: close }];
  }

  return (
    <SafeAreaView style={[styles.safe, styles.permWrap]}>
      <View style={styles.permTop}>
        <View style={styles.permIcon}>
          <AppText variant="display">{mode === 'calibration' ? '📏' : '💪'}</AppText>
        </View>
        <AppText variant="display" center>
          {title}
        </AppText>
        <AppText variant="bodyLg" center color={colors.textMuted}>
          {body}
        </AppText>
        {mode === 'toll' && bonus > 0 && (
          <Chip label={`+${bonus} min form bonus`} icon="ribbon" color={colors.sparkDark} bg={colors.sparkSoft} style={styles.centered} />
        )}
      </View>
      <View style={styles.actions}>
        {actions.map((a) => (
          <ChunkyButton key={a.label} label={a.label} tone={a.tone} size="lg" onPress={a.onPress} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm, minHeight: 52 },
  pickBody: { padding: space.md, gap: space.md },
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 88,
    borderRadius: radius.lg,
    backgroundColor: colors.muscleSoft,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.muscle,
    borderBottomColor: colors.muscleDark,
  },
  moveLast: { borderWidth: 3, borderBottomWidth: 6 },
  movePressed: { borderBottomWidth: 2, marginTop: 3 },
  moveIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.muscle,
    borderBottomWidth: 4,
    borderBottomColor: colors.muscleDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  permWrap: { padding: space.md, justifyContent: 'space-between' },
  permTop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  consentScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  permIcon: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.muscleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: space.sm },
  centered: { alignSelf: 'center' },
  camWrap: { flex: 1, backgroundColor: colors.text },
  camHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: space.md },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Chip defaults to alignSelf flex-start; center it on the ✕ button (minus the button's 2px lip).
  headChip: { alignSelf: 'center', marginBottom: 2 },
  roundBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerFill: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  countBubble: {
    width: 140,
    height: 140,
    borderRadius: radius.full,
    backgroundColor: colors.muscle,
    borderBottomWidth: 6,
    borderBottomColor: colors.muscleDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 72, lineHeight: 84 },
  panelWrap: { padding: space.md, gap: space.sm },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    alignSelf: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: colors.sparkSoft,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.spark,
  },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
});
