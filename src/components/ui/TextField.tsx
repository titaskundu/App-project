import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, depth, fonts, radius, space } from '@/theme/tokens';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Problem with the value (shown in red under the field). */
  error?: string | null;
  /** Helpful note under the field when there's no error. */
  hint?: string | null;
  /** Shown at the right edge inside the field (e.g. a username check icon). */
  right?: ReactNode;
  /** Password field with a show/hide eye. */
  secret?: boolean;
  /** Big, centered, spaced digits (one-time codes). */
  code?: boolean;
};

/** Chunky text input: micro label, a thick-bottomed field that turns indigo when focused. */
export function TextField({ label, error, hint, right, secret, code, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <AppText variant="micro" uppercase color={colors.textMuted}>
        {label}
      </AppText>
      <View style={[styles.field, { borderColor }, focused && styles.fieldFocused]}>
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secret ? hidden : input.secureTextEntry}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, code && styles.code]}
        />
        {secret && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={10}
            onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye' : 'eye-off'} size={22} color={colors.textMuted} />
          </Pressable>
        )}
        {right}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.dangerDark}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.textMuted}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: depth.minTap + 4,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  fieldFocused: { backgroundColor: colors.surface },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 18, color: colors.text, paddingVertical: space.sm },
  code: { fontFamily: fonts.black, fontSize: 28, letterSpacing: 12, textAlign: 'center' },
});
