import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { AppIcon, useAppIcons } from '@/features/blocker/components/AppIcon';
import { LimitSheet } from '@/features/blocker/components/LimitSheet';
import { KIND_ICON, ModeChips } from '@/features/blocker/components/ModeChips';
import { UsageRing } from '@/features/blocker/components/UsageRing';
import {
  byUrgency,
  formatDuration,
  limitMode,
  scopeStatuses,
  worstLevel,
  type ScopeStatus,
  type UsageLevel,
} from '@/features/blocker/limits';
import { appLabel, useBlocker } from '@/features/blocker/store';
import { useLiveBlocker } from '@/features/blocker/useLiveBlocker';
import { colors, modeTones, radius, space } from '@/theme/tokens';

/** Tiles glide to their new places when the order changes. */
const SHUFFLE = LinearTransition.duration(380);
/** Wait for the sheet's slide-out before re-sorting. */
const RESORT_DELAY_MS = 240;

/**
 * All blocked apps as tiles (opened from Settings). The most urgent app gets a wide tile at the
 * top; tapping any tile opens a bottom sheet with that app's limits, so this screen stays short.
 * The order is frozen while the sheet is open and re-sorts (animated) after it closes.
 */
export default function BlockedAppsScreen() {
  useLiveBlocker(4000);
  const { apps, targets, today, shortFormApps } = useBlocker();
  const { width } = useWindowDimensions();
  const [editing, setEditing] = useState<string | null>(null);
  const [frozen, setFrozen] = useState<string[] | null>(null);
  const resortTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const live = byUrgency(targets, today);
  // While frozen: keep the old order (dropping removed apps, adding any new ones at the end).
  const pkgs = frozen ? [...frozen.filter((p) => live.includes(p)), ...live.filter((p) => !frozen.includes(p))] : live;
  useAppIcons(live);

  useEffect(() => () => {
    if (resortTimer.current) clearTimeout(resortTimer.current);
  }, []);

  const openSheet = (pkg: string) => {
    if (resortTimer.current) clearTimeout(resortTimer.current);
    setFrozen(pkgs);
    setEditing(pkg);
  };
  const closeSheet = useCallback(() => {
    setEditing(null);
    resortTimer.current = setTimeout(() => setFrozen(null), RESORT_DELAY_MS);
  }, []);

  const statuses = Object.fromEntries(pkgs.map((p) => [p, scopeStatuses(targets, today, p)]));
  const overCount = pkgs.filter((p) => worstLevel(statuses[p]) === 'over').length;
  const usedMs = pkgs.reduce((sum, p) => sum + (today?.usage[p] ?? 0), 0);
  const halfWidth = (width - space.md * 3) / 2;

  return (
    <View style={styles.safe}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.flex}>
            <AppText variant="title">Blocked apps</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Tap an app to change its limit
            </AppText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {pkgs.length === 0 ? (
            <View style={styles.empty}>
              <AppText variant="display" center>
                🛡️
              </AppText>
              <AppText variant="heading" center>
                Nothing blocked yet
              </AppText>
              <AppText center color={colors.textMuted}>
                Pick the apps you scroll too much and give each a daily limit.
              </AppText>
              <ChunkyButton label="Pick apps" onPress={() => router.push('/pick-apps')} />
            </View>
          ) : (
            <>
              <View style={styles.strip}>
                <Stat value={String(pkgs.length)} label="Guarded" color={colors.primary} />
                <View style={styles.stripDivider} />
                <Stat value={String(overCount)} label="Over limit" color={overCount ? colors.danger : colors.brainDark} />
                <View style={styles.stripDivider} />
                <Stat value={formatDuration(usedMs)} label="Used today" color={colors.text} />
              </View>

              {/* One wrapping grid, so a tile can glide anywhere (even into the wide top slot). */}
              <View style={styles.grid}>
                {pkgs.map((pkg, i) => (
                  <Animated.View key={pkg} layout={SHUFFLE} style={{ width: i === 0 ? '100%' : halfWidth }}>
                    <AppTile
                      wide={i === 0}
                      pkg={pkg}
                      name={appLabel(apps, pkg)}
                      feed={shortFormApps[pkg]}
                      statuses={statuses[pkg]}
                      onPress={() => openSheet(pkg)}
                    />
                  </Animated.View>
                ))}
                <Animated.View key="add" layout={SHUFFLE} style={{ width: halfWidth }}>
                  <AddTile />
                </Animated.View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
      <LimitSheet pkg={editing} onClose={closeSheet} />
    </View>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading" color={color} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="micro" uppercase color={colors.textMuted} numberOfLines={1} style={styles.noShrink}>
        {label}
      </AppText>
    </View>
  );
}

/** Tile look per state: calm white, amber when almost out, red with a lock when out. */
const LOOK: Record<UsageLevel, { bg: string; border: string; edge: string }> = {
  ok: { bg: colors.surface, border: colors.border, edge: colors.borderDark },
  near: { bg: colors.warnSoft, border: colors.warn, edge: colors.sparkDark },
  over: { bg: colors.dangerSoft, border: colors.danger, edge: colors.dangerDark },
};

function ringColor(s: ScopeStatus): string {
  return s.level === 'over' ? colors.danger : s.level === 'near' ? colors.warn : modeTones[s.kind].color;
}

function AppTile({
  pkg,
  name,
  feed,
  statuses,
  wide,
  onPress,
}: {
  pkg: string;
  name: string;
  feed: string | undefined;
  statuses: ScopeStatus[];
  wide: boolean;
  onPress: () => void;
}) {
  const level = worstLevel(statuses);
  const look = LOOK[level];
  const mode = limitMode(Object.fromEntries(statuses.map((s) => [s.scope, s.limit])), pkg);
  const ringSize = wide ? 92 : 76;

  const ring = (
    <View>
      <UsageRing size={ringSize} stroke={wide ? 7 : 6} rings={statuses.map((s) => ({ ratio: s.ratio, color: ringColor(s) }))}>
        <AppIcon pkg={pkg} label={name} size={statuses.length > 1 ? (wide ? 48 : 38) : wide ? 58 : 46} />
      </UsageRing>
      {level === 'over' && (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={13} color={colors.textOnColor} />
        </View>
      )}
    </View>
  );

  const info = (
    <>
      <AppText variant={wide ? 'title' : 'bodyLg'} numberOfLines={1} style={!wide && styles.tileName}>
        {name}
      </AppText>
      {mode && <ModeChips mode={mode} feed={feed} />}
      {level === 'over' ? (
        <Chip label="Toll due" icon="lock-closed" color={colors.danger} solid />
      ) : (
        <View style={styles.lines}>
          {statuses.map((s) => (
            <View key={s.scope} style={styles.line}>
              <Ionicons name={KIND_ICON[s.kind]} size={12} color={modeTones[s.kind].dark} />
              <AppText variant="caption" numberOfLines={1} color={s.level === 'near' ? colors.sparkDark : colors.textMuted}>
                {`${formatDuration(s.usedMs)} / ${formatDuration(s.allowanceMs)}`}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${level === 'over' ? 'Toll due' : 'Within limit'}. Change limit`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        wide && styles.tileWide,
        { backgroundColor: look.bg, borderColor: look.border, borderBottomColor: look.edge },
        pressed && styles.tilePressed,
      ]}>
      {wide ? (
        <>
          {ring}
          <View style={[styles.flex, styles.wideInfo]}>{info}</View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </>
      ) : (
        <>
          {ring}
          <View style={styles.tileInfo}>{info}</View>
        </>
      )}
    </Pressable>
  );
}

function AddTile() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add or remove apps"
      onPress={() => router.push('/pick-apps')}
      style={({ pressed }) => [styles.tile, styles.add, pressed && styles.addPressed]}>
      <View style={styles.addCircle}>
        <Ionicons name="add" size={30} color={colors.primary} />
      </View>
      <AppText variant="label" uppercase color={colors.primary} numberOfLines={1} style={styles.noShrink}>
        Add app
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  noShrink: { flexShrink: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.md },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { borderBottomWidth: 2, marginTop: 2 },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xxl },
  empty: { alignItems: 'stretch', gap: space.md, marginTop: space.xl },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  stripDivider: { width: 2, alignSelf: 'stretch', backgroundColor: colors.surfaceMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    padding: space.md,
    gap: space.sm,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 5,
  },
  tileWide: { flexDirection: 'row', gap: space.md },
  // Same total height when pressed, so nothing below moves.
  tilePressed: { borderBottomWidth: 2, marginTop: 3 },
  tileInfo: { alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  tileName: { textAlign: 'center' },
  wideInfo: { gap: 6 },
  lines: { gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lock: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.danger,
    borderWidth: 3,
    borderColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    justifyContent: 'center',
    minHeight: 180,
    borderStyle: 'dashed',
    borderBottomWidth: 2,
    borderColor: colors.borderDark,
    backgroundColor: 'transparent',
  },
  addPressed: { backgroundColor: colors.primarySoft },
  addCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
