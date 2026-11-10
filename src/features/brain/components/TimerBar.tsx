import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors, radius } from '@/theme/tokens';

type Props = {
  /** Changes whenever a new countdown should start (e.g. the question id). */
  runKey: string;
  seconds: number;
  /** Freeze the bar (e.g. once the question is answered). */
  paused: boolean;
};

/**
 * Pill-shaped countdown bar that shrinks over the question's time limit. Purely visual: the
 * screen keeps its own timer for "time's up", so the bar can never cause a wrong result.
 */
export function TimerBar({ runKey, seconds, paused }: Props) {
  const progress = useSharedValue(1);

  useEffect(() => {
    progress.value = 1;
    progress.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear });
  }, [runKey, seconds, progress]);

  useEffect(() => {
    if (paused) cancelAnimation(progress);
  }, [paused, progress]);

  const fill = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: progress.value < 0.25 ? colors.muscle : colors.brain,
  }));

  return (
    <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
