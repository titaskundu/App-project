import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, fonts } from '@/theme/tokens';

import { useBlocker } from '../store';

/** Loads icons for these apps once (call it in the screen, so icons are fetched in one batch). */
export function useAppIcons(pkgs: string[]) {
  const loadIcons = useBlocker((s) => s.loadIcons);
  const key = pkgs.join('|');
  useEffect(() => {
    if (key) loadIcons(key.split('|')).catch(() => {});
  }, [key, loadIcons]);
}

type Props = {
  pkg: string;
  label: string;
  size?: number;
  /**
   * Show the icon as a round "coin" with this outline color (e.g. the card color), for
   * overlapping stacks: launcher icons have see-through edges, so they need a plate behind them.
   */
  outline?: string;
};

/** The app's real launcher icon, or its first letter while loading / when there's none. */
export function AppIcon({ pkg, label, size = 40, outline }: Props) {
  const uri = useBlocker((s) => s.icons[pkg]);

  if (outline) {
    const inner = Math.round(size * 0.66);
    return (
      <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2, borderColor: outline }]}>
        <AppIcon pkg={pkg} label={label} size={inner} />
      </View>
    );
  }

  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (uri) {
    return (
      <View style={[box, styles.clip]}>
        <Image source={{ uri }} style={styles.fill} contentFit="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }
  return (
    <View style={[box, styles.letter]}>
      <AppText color={colors.primary} style={{ fontFamily: fonts.black, fontSize: size * 0.45, lineHeight: size * 0.6 }}>
        {label.charAt(0).toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  coin: { borderWidth: 3, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },
  letter: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
