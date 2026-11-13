import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, modeTones, space, type LimitKind } from '@/theme/tokens';

import { LIMIT_STEPS, stepLimit } from '../limits';

type Props = {
  value: number;
  onChange: (minutes: number) => void;
  /** Color by what the limit covers (Reels = coral, whole app = indigo). */
  kind?: LimitKind;
};

/** "−  15 min  +" control that moves through LIMIT_STEPS. */
export function LimitStepper({ value, onChange, kind = 'app' }: Props) {
  const t = modeTones[kind];
  const atMin = value <= LIMIT_STEPS[0];
  const atMax = value >= LIMIT_STEPS[LIMIT_STEPS.length - 1];

  return (
    <View style={styles.wrap}>
      <StepButton icon="remove" disabled={atMin} onPress={() => onChange(stepLimit(value, -1))} label="Less time" kind={kind} />
      <AppText variant="title" color={t.dark} style={styles.value}>
        {value}
        <AppText variant="caption" color={t.dark}>
          {' min'}
        </AppText>
      </AppText>
      <StepButton icon="add" disabled={atMax} onPress={() => onChange(stepLimit(value, 1))} label="More time" kind={kind} />
    </View>
  );
}

const SIZE = 48;
const LIP = 4;

/**
 * Round "coin" button: a darker circle sits LIP px below the colored face, and the face sinks
 * into it when pressed (a bottom border on a circle would draw as a crescent instead).
 */
function StepButton({
  icon,
  disabled,
  onPress,
  label,
  kind,
}: {
  icon: 'add' | 'remove';
  disabled: boolean;
  onPress: () => void;
  label: string;
  kind: LimitKind;
}) {
  const t = modeTones[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.coin, disabled && styles.disabled]}>
      {({ pressed }) => (
        <>
          {/* Disabled: no edge circle, the face sits flat (a faded face over its edge looked doubled). */}
          {!disabled && <View style={[styles.circle, styles.edge, { backgroundColor: t.dark }]} />}
          <View style={[styles.circle, { backgroundColor: t.color }, (pressed || disabled) && styles.facePressed, disabled && styles.faceFlat]}>
            <Ionicons name={icon} size={22} color={colors.textOnColor} />
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { minWidth: 84, textAlign: 'center' },
  coin: { width: SIZE, height: SIZE + LIP },
  circle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edge: { top: LIP },
  facePressed: { top: LIP - 1 },
  faceFlat: { top: LIP },
  disabled: { opacity: 0.35 },
});
