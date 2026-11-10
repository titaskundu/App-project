import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { modeTones, type LimitKind } from '@/theme/tokens';

import type { LimitMode } from '../limits';

/** Icon for each kind of limit: film = Reels/Shorts, phone = the whole app. */
export const KIND_ICON = { short: 'film', app: 'phone-portrait' } as const;

/** "REELS" / "SHORTS" or "WHOLE APP". */
export function kindLabel(kind: LimitKind, feed: string | undefined): string {
  return kind === 'short' ? (feed ?? 'Reels') : 'Whole app';
}

/** One chip per limit the app has, in the limit's own color. */
export function ModeChips({ mode, feed }: { mode: LimitMode; feed?: string }) {
  const kinds: LimitKind[] = mode === 'both' ? ['short', 'app'] : [mode];
  return (
    <View style={styles.row}>
      {kinds.map((k) => (
        <KindChip key={k} kind={k} feed={feed} only={mode === 'short'} />
      ))}
    </View>
  );
}

/** `only`: say "Reels only" when Reels is the app's only limit. */
export function KindChip({ kind, feed, only }: { kind: LimitKind; feed?: string; only?: boolean }) {
  const t = modeTones[kind];
  const label = kindLabel(kind, feed) + (only && kind === 'short' ? ' only' : '');
  return <Chip label={label} icon={KIND_ICON[kind]} color={t.dark} bg={t.soft} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
