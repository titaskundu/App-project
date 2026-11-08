import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

import { formatDuration } from '../limits';

type Props = { label: string; usedMs: number; allowanceMs: number };

/** One row of "Instagram ████░░ 16 min / 20 min". Turns coral near the limit, red at it. */
export function UsageBar({ label, usedMs, allowanceMs }: Props) {
  const ratio = allowanceMs > 0 ? Math.min(usedMs / allowanceMs, 1) : 1;
  const fill = ratio >= 1 ? colors.danger : ratio >= 0.8 ? colors.muscle : colors.primary;

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <AppText variant="bodyLg" numberOfLines={1} style={styles.flex}>
          {label}
        </AppText>
        <AppText variant="caption" numberOfLines={1} style={styles.noShrink} color={ratio >= 1 ? colors.danger : colors.textMuted}>
          {ratio >= 1 ? 'Toll due' : `${formatDuration(usedMs)} / ${formatDuration(allowanceMs)}`}
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  noShrink: { flexShrink: 0 },
  track: { height: 14, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
