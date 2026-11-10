import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

type Props = {
  label: string;
  /** Text and icon color. */
  color?: string;
  /** Tinted pill background. */
  bg?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Solid fill (bg = color, white text) for the loudest states, e.g. "TOLL DUE". */
  solid?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Standard tag: tinted pill with an optional icon and an uppercase micro-label. */
export function Chip({ label, color = colors.primary, bg = colors.primarySoft, icon, solid, style }: Props) {
  const fg = solid ? colors.textOnColor : color;
  return (
    <View style={[styles.chip, { backgroundColor: solid ? color : bg }, style]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      {/* flexShrink 0: Android under-measures letter-spaced text and would clip it. */}
      <AppText variant="micro" color={fg} uppercase numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  label: { flexShrink: 0 },
});
