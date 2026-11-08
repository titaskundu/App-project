import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { depth, radius, space, tones, type Tone } from '@/theme/tokens';

type Props = {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  icon?: ReactNode;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const SPRING = { damping: 14, stiffness: 420, mass: 0.6 };

/**
 * Tactile "plastic key" button: a solid darker edge under the face.
 * On press the face drops into the edge, then springs back.
 */
export function ChunkyButton({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  size = 'md',
  style,
}: Props) {
  const t = tones[tone];
  const press = useSharedValue(0); // 0 = resting, 1 = pressed
  const travel = depth.raised - depth.pressed;

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * travel }],
  }));

  const height = size === 'lg' ? 64 : depth.minTap;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        press.value = withSpring(1, SPRING);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => {
        press.value = withSpring(0, SPRING);
      }}
      onPress={onPress}
      style={[{ height: height + depth.raised, opacity: disabled ? 0.5 : 1 }, style]}>
      {/* the edge sits underneath and stays put */}
      <View
        style={[
          styles.edge,
          { height, backgroundColor: t.edge, top: depth.raised },
          tone === 'neutral' && styles.neutralEdge,
        ]}
      />
      <Animated.View
        style={[
          styles.face,
          { height, backgroundColor: t.bg },
          tone === 'neutral' && styles.neutralFace,
          faceStyle,
        ]}>
        {icon}
        <AppText variant="label" uppercase numberOfLines={1} color={t.fg}>
          {label}
        </AppText>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius.lg,
  },
  face: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  neutralEdge: {
    borderWidth: 2,
    borderColor: '#D6CEC1',
  },
  neutralFace: {
    borderWidth: 2,
    borderColor: '#E7E1D7',
  },
});
