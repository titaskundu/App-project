import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

import { LIMIT_STEPS, stepLimit } from '../limits';

type Props = { value: number; onChange: (minutes: number) => void };

/** "−  15 min  +" control that moves through LIMIT_STEPS. */
export function LimitStepper({ value, onChange }: Props) {
  const atMin = value <= LIMIT_STEPS[0];
  const atMax = value >= LIMIT_STEPS[LIMIT_STEPS.length - 1];

  return (
    <View style={styles.wrap}>
      <StepButton icon="remove" disabled={atMin} onPress={() => onChange(stepLimit(value, -1))} label="Less time" />
      <AppText variant="heading" style={styles.value}>
        {value} min
      </AppText>
      <StepButton icon="add" disabled={atMax} onPress={() => onChange(stepLimit(value, 1))} label="More time" />
    </View>
  );
}

function StepButton({
  icon,
  disabled,
  onPress,
  label,
}: {
  icon: 'add' | 'remove';
  disabled: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.disabled]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  value: { minWidth: 76, textAlign: 'center' },
  step: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#C7D2FE',
  },
  stepPressed: { transform: [{ translateY: 2 }], borderBottomWidth: 1 },
  disabled: { opacity: 0.35 },
});
