import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, modeTones, radius, space, type LimitKind } from '@/theme/tokens';

import { formatDuration, usageLevel } from '../limits';
import { AppIcon } from './AppIcon';
import { KIND_ICON } from './ModeChips';

type Props = { pkg: string; appName: string; label: string; kind: LimitKind; usedMs: number; allowanceMs: number };

/**
 * One row of "[icon] Instagram Reels ████░░ 16 min / 20 min". The bar is in the limit's
 * color (Reels coral, whole app indigo), amber when almost out, red when out.
 */
export function UsageBar({ pkg, appName, label, kind, usedMs, allowanceMs }: Props) {
  const ratio = allowanceMs > 0 ? Math.min(usedMs / allowanceMs, 1) : 1;
  const level = usageLevel(ratio);
  const t = modeTones[kind];
  const fill = level === 'over' ? colors.danger : level === 'near' ? colors.warn : t.color;

  return (
    <View style={styles.row}>
      <AppIcon pkg={pkg} label={appName} size={36} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Ionicons name={KIND_ICON[kind]} size={14} color={t.dark} />
          <AppText variant="bodyLg" numberOfLines={1} style={styles.flex}>
            {label}
          </AppText>
          <AppText
            variant="caption"
            numberOfLines={1}
            style={styles.noShrink}
            color={level === 'over' ? colors.danger : colors.textMuted}>
            {level === 'over' ? 'TOLL DUE' : `${formatDuration(usedMs)} / ${formatDuration(allowanceMs)}`}
          </AppText>
        </View>
        <View style={[styles.track, { backgroundColor: t.soft }]}>
          <View style={[styles.fill, { width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: fill }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { flex: 1, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  flex: { flex: 1 },
  noShrink: { flexShrink: 0 },
  track: { height: 12, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
