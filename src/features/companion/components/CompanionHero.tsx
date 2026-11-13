import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

/** Size of the mascot's stage. Phase 6's 3D red panda renders into a box this big. */
export const MASCOT_SIZE = 168;

type Props = {
  /** What the companion says (state-driven, see Home's useCompanionLine). */
  text: string;
  /** Bubble outline color: brand for normal, warn/danger when an app is near/over its limit. */
  color: string;
  /**
   * The mascot itself. Defaults to the placeholder emoji; Phase 6 passes the 3D red panda
   * (brainy / athletic / zen image with outfit layers) here without touching the stage.
   */
  mascot?: ReactNode;
};

/**
 * Home's hero: the companion on a spotlight "stage" with a floor shadow and a gentle idle bob,
 * and a speech bubble underneath. Flat shapes only (no blurry shadows), per the design rules.
 */
export function CompanionHero({ text, color, mascot }: Props) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    bob.set(
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
  }, [bob, reduceMotion]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.get() }] }));
  // The floor shadow shrinks a little as the panda rises.
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + bob.get() / 60 }] }));

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <View style={styles.spotlight} />
        <Animated.View style={[styles.floor, shadowStyle]} />
        <Animated.View style={[styles.mascot, floatStyle]}>
          {mascot ?? (
            <AppText style={styles.emoji} accessibilityLabel="Your red panda companion">
              🐼
            </AppText>
          )}
        </Animated.View>
      </View>

      <View style={styles.bubbleWrap}>
        <View style={[styles.tail, { borderBottomColor: color }]} />
        <View style={[styles.bubble, { borderColor: color }]}>
          <AppText variant="bodyLg" center>
            {text}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const STAGE = MASCOT_SIZE + 40;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 0 },
  stage: { width: '100%', height: STAGE, alignItems: 'center', justifyContent: 'flex-end' },
  // A soft disc behind the mascot, like a spotlight.
  spotlight: {
    position: 'absolute',
    top: 0,
    width: STAGE,
    height: STAGE,
    borderRadius: STAGE / 2,
    backgroundColor: colors.primarySoft,
  },
  floor: {
    position: 'absolute',
    bottom: 14,
    width: MASCOT_SIZE * 0.7,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.borderDark,
    opacity: 0.55,
  },
  mascot: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 112, lineHeight: 140 },
  bubbleWrap: { alignSelf: 'stretch', alignItems: 'center' },
  // Little triangle pointing up at the mascot.
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: {
    alignSelf: 'stretch',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
});
