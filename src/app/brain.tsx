import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { AREAS, areaTitle } from '@/features/brain/areas';
import { ChoiceList } from '@/features/brain/components/ChoiceList';
import { CodeCard } from '@/features/brain/components/CodeCard';
import { Keypad } from '@/features/brain/components/Keypad';
import { TimerBar } from '@/features/brain/components/TimerBar';
import type { SessionMode } from '@/features/brain/history';
import { difficultyFor, START_RATING } from '@/features/brain/rating';
import { useBrain } from '@/features/brain/store';
import { recordTollEvent } from '@/features/sync/sync';
import {
  BONUS_PER_EXTRA,
  difficultyBump,
  FAST_SHARE,
  MAX_EXTRA_QUESTIONS,
  passMark,
  passed,
  practiceReward,
  PRACTICE_PASS,
  PRACTICE_QUESTIONS,
  questionCount,
  tollReward,
} from '@/features/brain/toll';
import { useBrainSession } from '@/features/brain/useBrainSession';
import { scopeLabel, useBlocker } from '@/features/blocker/store';
import { colors, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';

/**
 * A Brain session. Opened as:
 *  - /brain?mode=toll&pkg=…&scope=…   pay a toll for a blocked app (from the Toll screen)
 *  - /brain?mode=practice             practice round that banks minutes (Home)
 *  - /brain?mode=calibration[&first=1] 60-second level test (after the interests quiz)
 */
export default function BrainScreen() {
  const params = useLocalSearchParams<{ mode?: string; pkg?: string; scope?: string; first?: string }>();
  const mode: SessionMode = params.mode === 'practice' || params.mode === 'calibration' ? params.mode : 'toll';
  const pkg = params.pkg ?? '';
  const scope = params.scope || pkg;

  // Repeat tolls today make the set longer and harder (read once, when the screen opens).
  const [tollsToday] = useState(() =>
    Object.values(useBlocker.getState().today?.tolls ?? {}).reduce((a, b) => a + b, 0)
  );
  const required = mode === 'toll' ? questionCount(tollsToday) : PRACTICE_QUESTIONS;
  const bump = mode === 'toll' ? difficultyBump(tollsToday) : 0;

  const s = useBrainSession({ mode, required, bump });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (s.phase === 'result') {
    return <Result mode={mode} session={s} required={required} pkg={pkg} scope={scope} first={params.first === '1'} close={close} />;
  }

  const q = s.question;
  const answered = s.phase === 'feedback';
  const last = s.answers.concat(s.extra).at(-1);
  const right = answered && !s.timedOut && s.given !== null && last?.correct;
  const fastTag = right && last?.fast ? '2× fast' : null;
  const area = AREAS.find((a) => a.id === q.area);
  const doneCount = s.extraMode ? s.extra.length : s.answers.length;
  const total = s.extraMode ? MAX_EXTRA_QUESTIONS : required;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header: close, progress, and the clock or bonus */}
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={close}>
          <Ionicons name="close" size={28} color={colors.textMuted} />
        </Pressable>
        {mode === 'calibration' ? (
          <AppText variant="label" color={colors.brainDark} style={styles.flex}>
            {`LEVEL CHECK · 0:${String(s.calibrationLeft).padStart(2, '0')}`}
          </AppText>
        ) : (
          <View style={styles.segments}>
            {Array.from({ length: total }, (_, i) => (
              <View key={i} style={[styles.segment, i < doneCount && styles.segmentDone]} />
            ))}
          </View>
        )}
        {s.extraMode && (
          <Pressable accessibilityRole="button" onPress={s.finishExtra} hitSlop={8}>
            <AppText variant="caption" color={colors.brainDark}>
              {`+${s.extraCorrect * BONUS_PER_EXTRA} MIN · STOP`}
            </AppText>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.chipRow}>
          <Chip label={areaTitle(q.area)} icon={area?.icon} color={colors.brainDark} bg={colors.brainSoft} />
          {mode !== 'calibration' && !answered && <FastWindow key={q.id} seconds={s.limit * FAST_SHARE} />}
        </View>
        <AppText variant="title">{q.prompt}</AppText>
        {q.code && <CodeCard code={q.code} />}

        {q.type === 'mcq' && q.options ? (
          <ChoiceList
            options={q.options}
            picked={answered ? (s.given ?? '') : null}
            answer={q.answer}
            onPick={(o) => s.submit(o)}
            tag={fastTag}
          />
        ) : (
          <View style={[styles.answerBox, answered && (right ? styles.answerRight : styles.answerWrong)]}>
            <AppText variant="display" color={s.input ? colors.text : colors.borderDark}>
              {s.input || '?'}
            </AppText>
            {fastTag && (
              <View style={styles.answerTag}>
                <Chip label={fastTag} icon="flash" color={colors.sparkDark} bg={colors.sparkSoft} />
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottom}>
        <TimerBar runKey={q.id} seconds={s.limit} paused={answered} />
        {q.type === 'numeric' && !answered && (
          <Keypad value={s.input} onChange={s.setInput} onSubmit={s.submit} />
        )}
        {answered && (
          <View style={[styles.feedback, right ? styles.feedbackRight : styles.feedbackWrong]}>
            <View style={styles.feedbackHead}>
              <Ionicons name={right ? 'checkmark-circle' : 'close-circle'} size={28} color={right ? colors.success : colors.danger} />
              <AppText variant="heading" color={right ? colors.success : colors.dangerDark}>
                {right ? (last?.fast ? 'Lightning fast!' : 'Correct!') : s.timedOut ? "Time's up" : 'Not quite'}
              </AppText>
            </View>
            {!right && (
              <AppText color={colors.text}>
                {q.type === 'numeric' && !q.explanation.endsWith(`= ${q.answer}`) ? `Answer: ${q.answer}. ` : ''}
                {q.explanation}
              </AppText>
            )}
            <ChunkyButton label="Continue" tone={right ? 'brain' : 'danger'} onPress={s.next} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * Gold "2×" chip shown while a fast answer still earns the bonus; it disappears when the
 * fast window closes. Remounted per question (key), so its timer restarts each time.
 */
function FastWindow({ seconds }: { seconds: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(false), seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);
  if (!open) return null;
  return (
    <Animated.View entering={ZoomIn} exiting={FadeOut}>
      <Chip label="2× if fast" icon="flash" color={colors.sparkDark} bg={colors.sparkSoft} />
    </Animated.View>
  );
}

type Session = ReturnType<typeof useBrainSession>;

function Result({
  mode,
  session: s,
  required,
  pkg,
  scope,
  first,
  close,
}: {
  mode: SessionMode;
  session: Session;
  required: number;
  pkg: string;
  scope: string;
  first: boolean;
  close: () => void;
}) {
  const { apps, shortFormApps, refresh } = useBlocker();
  const { ratings, areas, bankAdd, setCalibrated } = useBrain();
  const ok = passed(s.correctCount, required);
  const name = scopeLabel(apps, shortFormApps, scope);

  // Practice: bank minutes exactly once per result. Calibration: remember it's done.
  const practicePassed = s.correctCount >= PRACTICE_PASS;
  const bankedOnce = useRef(false);
  const [banked] = useState(() =>
    mode === 'practice' && practicePassed ? practiceReward(true, useBrain.getState().bank.earnedToday) : 0
  );
  useEffect(() => {
    if (mode === 'calibration') setCalibrated();
    if (banked > 0 && !bankedOnce.current) {
      bankedOnce.current = true;
      bankAdd(banked);
    }
  }, [mode, banked, bankAdd, setCalibrated]);

  // Sync: practice results and failed tolls are recorded when shown; a passed toll on claim.
  const answered = s.answers.length;
  const answeredRight = s.answers.filter((a) => a.correct).length;
  const recordedOnce = useRef(false);
  useEffect(() => {
    if (recordedOnce.current) return;
    recordedOnce.current = true;
    if (mode === 'practice')
      recordTollEvent({ kind: 'brain', mode, passed: practicePassed, minutes: banked, questions: answered, correct: answeredRight });
    else if (mode === 'toll' && !ok)
      recordTollEvent({ kind: 'brain', mode, scope, passed: false, minutes: 0, questions: answered, correct: answeredRight });
  }, [mode, ok, practicePassed, banked, scope, answered, answeredRight]);

  const leaveAll = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  const claim = () => {
    const minutes = tollReward(s.extraCorrect);
    if (scope) AppBlocker.grantMinutes(scope, minutes, true);
    recordTollEvent({ kind: 'brain', mode: 'toll', scope, passed: true, minutes, questions: answered, correct: answeredRight });
    refresh();
    if (pkg) AppBlocker.openApp(pkg);
    leaveAll();
  };

  const levels = useMemo(
    () => (areas.length ? areas : AREAS.map((a) => a.id)).map((a) => ({ a, level: difficultyFor(ratings[a] ?? START_RATING) })),
    [areas, ratings]
  );

  let emoji = '🎉';
  let title = '';
  let body = '';
  let actions: { label: string; tone: 'brain' | 'neutral' | 'primary'; onPress: () => void }[] = [];

  if (mode === 'toll') {
    if (ok) {
      const minutes = tollReward(s.extraCorrect);
      title = s.extraMode ? `Bonus round done!` : 'Toll paid!';
      body = `${s.correctCount}/${required} right${s.extraMode ? ` · ${s.extraCorrect} bonus ${s.extraCorrect === 1 ? 'answer' : 'answers'}` : ''}. ${minutes} minutes unlocked${name ? ` for ${name}` : ''}.`;
      actions = [{ label: pkg ? `Open ${name} · +${minutes} min` : `Unlock +${minutes} min`, tone: 'brain', onPress: claim }];
      if (!s.extraMode) actions.push({ label: `Keep going · +${BONUS_PER_EXTRA} min each`, tone: 'neutral', onPress: s.keepGoing });
    } else {
      emoji = '🤔';
      title = 'Not quite';
      body = `${s.correctCount}/${required} right. You need ${passMark(required)} to unlock. New questions are ready.`;
      actions = [
        { label: 'Try a new set', tone: 'brain', onPress: s.restart },
        { label: 'Not now', tone: 'neutral', onPress: close },
      ];
    }
  } else if (mode === 'practice') {
    emoji = practicePassed ? '🧠' : '💪';
    title = practicePassed ? 'Nice practice!' : 'Keep practising';
    body = practicePassed
      ? banked
        ? `${s.correctCount}/${PRACTICE_QUESTIONS} right. +${banked} min saved to your bank for later.`
        : `${s.correctCount}/${PRACTICE_QUESTIONS} right. Your bank is full for today.`
      : `${s.correctCount}/${PRACTICE_QUESTIONS} right. Get ${PRACTICE_PASS} right to bank minutes.`;
    actions = [
      { label: 'Practice again', tone: 'brain', onPress: s.restart },
      { label: 'Done', tone: 'neutral', onPress: close },
    ];
  } else {
    emoji = '📈';
    title = 'Level check done';
    body = `${s.answers.length} questions, ${s.correctCount} right. Questions will now match your level and get harder as you improve.`;
    actions = [{ label: first ? "Let's go" : 'Done', tone: 'brain', onPress: first ? () => router.replace('/') : close }];
  }

  return (
    <SafeAreaView style={[styles.safe, styles.resultWrap]}>
      <View style={styles.resultTop}>
        <View style={styles.mascot}>
          <AppText variant="display">{emoji}</AppText>
        </View>
        <AppText variant="display" center>
          {title}
        </AppText>
        <AppText variant="bodyLg" center color={colors.textMuted}>
          {body}
        </AppText>
        {mode === 'calibration' && (
          <View style={styles.levels}>
            {levels.map(({ a, level }) => (
              <View key={a} style={styles.levelRow}>
                <AppText variant="bodyLg" style={styles.flex}>
                  {areaTitle(a)}
                </AppText>
                <AppText variant="label" color={colors.brainDark}>{`LEVEL ${level}/5`}</AppText>
              </View>
            ))}
          </View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.sm, minHeight: 52 },
  segments: { flex: 1, flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 12, borderRadius: radius.full, backgroundColor: colors.surfaceMuted },
  segmentDone: { backgroundColor: colors.brain },
  body: { padding: space.md, gap: space.md },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  answerTag: { position: 'absolute', top: space.sm, right: space.sm },
  answerBox: {
    minHeight: 84,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerRight: { borderColor: colors.success, backgroundColor: colors.successSoft },
  answerWrong: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  bottom: { padding: space.md, gap: space.md },
  feedback: { borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 2 },
  feedbackRight: { backgroundColor: colors.successSoft, borderColor: colors.success },
  feedbackWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resultWrap: { padding: space.md, justifyContent: 'space-between' },
  resultTop: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  mascot: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.brainSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levels: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  actions: { gap: space.sm },
});
