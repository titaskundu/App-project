import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Called with the typed value (may be newer than `value` if taps come faster than renders). */
  onSubmit: (value: string) => void;
  disabled?: boolean;
};

const MAX_DIGITS = 7;

/** Number keypad for numeric answers: 1–9, delete, 0, check. Chunky keys with a pressed-in edge. */
export function Keypad({ value, onChange, onSubmit, disabled }: Props) {
  // The latest typed value, updated on every tap. Fast taps can arrive before the screen has
  // re-rendered with the previous digit, so taps must never rely on the (older) `value` prop.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const press = (key: string) => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    const cur = latest.current;
    if (key === 'ok') {
      if (cur) onSubmit(cur);
      return;
    }
    const next = key === 'del' ? cur.slice(0, -1) : cur.length >= MAX_DIGITS ? cur : cur === '0' ? key : cur + key;
    latest.current = next;
    onChange(next);
  };

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['del', '0', 'ok'],
  ];

  return (
    <View style={styles.grid}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) => {
            const isOk = key === 'ok';
            const label = key === 'del' ? 'Delete' : isOk ? 'Check answer' : key;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={label}
                disabled={disabled}
                onPress={() => press(key)}
                style={({ pressed }) => [
                  styles.key,
                  isOk && styles.okKey,
                  pressed && styles.keyPressed,
                  (disabled || (isOk && !value)) && styles.keyDisabled,
                ]}>
                {key === 'del' ? (
                  <Ionicons name="backspace" size={26} color={colors.text} />
                ) : isOk ? (
                  <Ionicons name="checkmark" size={30} color={colors.textOnColor} />
                ) : (
                  <AppText variant="title">{key}</AppText>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  key: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okKey: { backgroundColor: colors.brain, borderColor: colors.brainDark },
  keyPressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }] },
  keyDisabled: { opacity: 0.45 },
});
