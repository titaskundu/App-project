import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, modeTones, radius } from '@/theme/tokens';

import type { LimitMode } from '../limits';
import { KIND_ICON } from './ModeChips';

type Props = { value: LimitMode; feed: string; onChange: (mode: LimitMode) => void };

const BOTH = { color: colors.text, dark: colors.textDark };

/**
 * Chunky 3-way switch: Reels only | Whole app | Both. The picked segment pops up in its
 * mode's color with a darker lip; the others sit flat in the tray.
 */
export function ModeSwitch({ value, feed, onChange }: Props) {
  const options: { mode: LimitMode; label: string; color: string; dark: string; icons: (keyof typeof KIND_ICON)[] }[] = [
    { mode: 'short', label: `${feed} only`, ...modeTones.short, icons: ['short'] },
    { mode: 'app', label: 'Whole app', ...modeTones.app, icons: ['app'] },
    { mode: 'both', label: 'Both', ...BOTH, icons: ['short', 'app'] },
  ];

  return (
    <View style={styles.tray} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = value === o.mode;
        return (
          <Pressable
            key={o.mode}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (on) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(o.mode);
            }}
            style={[styles.seg, on && { backgroundColor: o.color, borderBottomColor: o.dark }, on && styles.segOn]}>
            <View style={styles.icons}>
              {o.icons.map((k) => (
                <Ionicons key={k} name={KIND_ICON[k]} size={16} color={on ? colors.textOnColor : modeTones[k].color} />
              ))}
            </View>
            <AppText variant="micro" uppercase numberOfLines={1} color={on ? colors.textOnColor : colors.textMuted} style={styles.label}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  seg: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
  },
  segOn: { transform: [{ translateY: -1 }] },
  icons: { flexDirection: 'row', gap: 2 },
  label: { flexShrink: 0 },
});
