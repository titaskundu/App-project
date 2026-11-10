import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, fonts, radius, space } from '@/theme/tokens';

import { DEFAULT_LIMIT } from '../limits';
import { LimitStepper } from './LimitStepper';

type Props = {
  title: string;
  hint: string;
  /** Minutes, or undefined when this limit is off. */
  value: number | undefined;
  onChange: (minutes: number | null) => void;
  /** False when this is the app's only limit (remove the app instead). */
  canTurnOff: boolean;
};

/**
 * One optional limit inside an app's Settings card, e.g. "Reels only · 15 min" or
 * "Whole app · off". Used for apps that support a separate Reels/Shorts limit.
 */
export function ScopeLimitRow({ title, hint, value, onChange, canTurnOff }: Props) {
  const on = value !== undefined;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="bodyLg" style={styles.title}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {hint}
          </AppText>
        </View>
        {on && canTurnOff && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Turn off ${title} limit`}
            hitSlop={12}
            onPress={() => onChange(null)}>
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.addLabel}>
              Turn off
            </AppText>
          </Pressable>
        )}
      </View>

      {on ? (
        <LimitStepper value={value} onChange={onChange} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add a ${title} limit`}
          onPress={() => onChange(DEFAULT_LIMIT)}
          style={({ pressed }) => [styles.add, pressed && styles.addPressed]}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} numberOfLines={1} style={styles.addLabel}>
            ADD LIMIT
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bold },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
  },
  // Android under-measures letter-spaced text and clips or wraps it ("ADD LIMIT" → "ADD")
  // unless it can't shrink. Used for both small action labels.
  addLabel: { flexShrink: 0 },
  addPressed: { borderBottomWidth: 2, marginTop: 2 },
});
