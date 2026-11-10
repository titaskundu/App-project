import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, fonts } from '@/theme/tokens';

import { appLabel, useBlocker } from '../store';
import { AppIcon } from './AppIcon';

const SIZE = 52;
const OVERLAP = 16;

/** Up to `max` overlapping app icons, then a "+N" bubble. */
export function AppIconStack({ pkgs, max = 3, outline = colors.surface }: { pkgs: string[]; max?: number; outline?: string }) {
  const apps = useBlocker((s) => s.apps);
  const shown = pkgs.slice(0, max);
  const more = pkgs.length - shown.length;

  return (
    <View style={styles.row}>
      {shown.map((pkg, i) => (
        <View key={pkg} style={[i > 0 && styles.overlap, { zIndex: max - i }]}>
          <AppIcon pkg={pkg} label={appLabel(apps, pkg)} size={SIZE} outline={outline} />
        </View>
      ))}
      {more > 0 && (
        <View style={[styles.overlap, styles.more, { borderColor: outline }]}>
          <AppText color={colors.primary} style={styles.moreText}>{`+${more}`}</AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginLeft: -OVERLAP },
  more: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 3,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: { fontFamily: fonts.black, fontSize: 14, lineHeight: 18 },
});
