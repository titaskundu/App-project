import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional tinted background, e.g. colors.brainSoft */
  tint?: string;
  /** Optional colored outline (sides and top). */
  border?: string;
  /** Optional colored bottom lip, usually a darker shade of `border`. */
  edge?: string;
};

/** Flat card with a 2px border and a thicker bottom edge — no blurry shadows. */
export function Card({ children, style, tint, border, edge }: Props) {
  return (
    <View
      style={[
        styles.card,
        tint ? { backgroundColor: tint } : null,
        border ? { borderColor: border } : null,
        edge ? { borderBottomColor: edge } : null,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
});
