import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { colors, depth, radius, space, tones, type Tone } from '@/theme/tokens';

type Props = {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  icon?: ReactNode;
  disabled?: boolean;
  /** sm = compact action inside a card (still ≥ 44px with its edge). */
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

const SPRING = { damping: 14, stiffness: 420, mass: 0.6 };

/**
 * Tactile pill-shaped "plastic key" button: a solid darker edge under the face.
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

  const height = size === 'lg' ? 64 : size === 'sm' ? 40 : depth.minTap;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={size === 'sm' ? 6 : undefined}
      onPressIn={() => {
        press.value = withSpring(1, SPRING);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => {
        press.value = withSpring(0, SPRING);
      }}
      onPress={onPress}
      style={[{ height: height + depth.raised, opacity: disabled ? 0.5 : 1 }, style]}>
      {/* the edge sits underneath and stays put. A disabled button has no edge: it sits flat
          where the edge would be, so the faded face never shows a second shape behind it. */}
      {!disabled && (
        <View
          style={[
            styles.edge,
            { height, backgroundColor: t.edge, top: depth.raised },
            tone === 'neutral' && styles.neutralEdge,
            tone === 'dangerOutline' && styles.dangerEdge,
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.face,
          { height, backgroundColor: t.bg },
          disabled && { marginTop: depth.raised },
          size === 'sm' && styles.faceSm,
          tone === 'neutral' && styles.neutralFace,
          tone === 'dangerOutline' && styles.dangerFace,
          faceStyle,
        ]}>
        {icon}
        <AppText variant={size === 'sm' ? 'micro' : 'label'} uppercase numberOfLines={1} color={t.fg} style={styles.label}>
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
    borderRadius: radius.full,
  },
  face: {
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  faceSm: { paddingHorizontal: space.md, gap: space.xs },
  label: { flexShrink: 0 },
  neutralEdge: {
    borderWidth: 2,
    borderColor: colors.borderDark,
  },
  neutralFace: {
    borderWidth: 2,
    borderColor: colors.border,
  },
  dangerEdge: { borderWidth: 2, borderColor: colors.dangerSoft },
  dangerFace: { borderWidth: 2, borderColor: colors.dangerSoft },
});
