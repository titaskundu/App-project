import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { colors, radius, space } from '@/theme/tokens';

type Props = {
  options: string[];
  /** The option the user picked (null while unanswered). */
  picked: string | null;
  /** The right answer, revealed once answered. */
  answer: string;
  onPick: (option: string) => void;
  /** Optional reward tag shown on the right option once answered (e.g. "2× fast"). */
  tag?: string | null;
};

/**
 * Chunky multiple-choice buttons. After answering, the right option turns green and a wrong
 * pick turns red; the rest fade.
 */
export function ChoiceList({ options, picked, answer, onPick, tag }: Props) {
  const answered = picked !== null;

  return (
    <View style={styles.list}>
      {options.map((opt, i) => {
        const isAnswer = opt === answer;
        const isPicked = opt === picked;
        const state = !answered ? 'idle' : isAnswer ? 'right' : isPicked ? 'wrong' : 'faded';
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityLabel={opt}
            accessibilityState={{ selected: isPicked, disabled: answered }}
            disabled={answered}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onPick(opt);
            }}
            style={({ pressed }) => [
              styles.option,
              state === 'right' && styles.right,
              state === 'wrong' && styles.wrong,
              state === 'faded' && styles.faded,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.badge, state === 'right' && styles.badgeRight, state === 'wrong' && styles.badgeWrong]}>
              {state === 'right' ? (
                <Ionicons name="checkmark" size={18} color={colors.textOnColor} />
              ) : state === 'wrong' ? (
                <Ionicons name="close" size={18} color={colors.textOnColor} />
              ) : (
                <AppText variant="label" color={colors.textMuted}>
                  {String.fromCharCode(65 + i)}
                </AppText>
              )}
            </View>
            <AppText variant="bodyLg" style={styles.text}>
              {opt}
            </AppText>
            {state === 'right' && tag ? <Chip label={tag} icon="flash" color={colors.sparkDark} bg={colors.sparkSoft} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  option: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  // Same total height when pressed (see interests.tsx), so options below don't move.
  pressed: { borderBottomWidth: 2, marginTop: 3 },
  right: { backgroundColor: colors.successSoft, borderColor: colors.success },
  wrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  faded: { opacity: 0.5 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeRight: { backgroundColor: colors.success },
  badgeWrong: { backgroundColor: colors.danger },
  text: { flex: 1 },
});
