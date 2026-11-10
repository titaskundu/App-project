import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/theme/tokens';

const SIZE = 104;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Big coral ring: reps done of the target. Pops a little on each rep (`tick`). */
export function RepRing({ reps, target, tick }: { reps: number; target: number; tick: number }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (tick > 0) scale.set(withSequence(withTiming(1.12, { duration: 90 }), withTiming(1, { duration: 180 })));
  }, [tick, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ratio = target > 0 ? Math.min(1, reps / target) : 0;

  return (
    <Animated.View style={[styles.wrap, style]} accessibilityLabel={`${reps} of ${target} reps`}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.muscleSoft} strokeWidth={STROKE} fill={colors.surface} />
        {ratio > 0 && (
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.muscle}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${C * ratio} ${C}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
        )}
      </Svg>
      <View style={styles.center}>
        <AppText variant="title" color={colors.muscleDark}>
          {reps}
        </AppText>
        <AppText variant="micro" uppercase color={colors.textMuted}>
          {`of ${target}`}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center' },
});
