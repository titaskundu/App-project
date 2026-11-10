import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

type TabMeta = { on: IconName; off: IconName; label: string; color: string; soft: string; edge: string };

/** Each section has its own color, so the active tab is easy to spot. */
const ICONS: Record<string, TabMeta> = {
  index: { on: 'home', off: 'home-outline', label: 'Home', color: colors.primary, soft: colors.primarySoft, edge: colors.primary },
  stats: { on: 'stats-chart', off: 'stats-chart-outline', label: 'Stats', color: colors.brainDark, soft: colors.brainSoft, edge: colors.brain },
  shop: { on: 'bag-handle', off: 'bag-handle-outline', label: 'Shop', color: colors.sparkDark, soft: colors.sparkSoft, edge: colors.spark },
  settings: { on: 'settings', off: 'settings-outline', label: 'Settings', color: colors.muscleDark, soft: colors.muscleSoft, edge: colors.muscle },
};

/** Rounded bottom bar. The active tab's icon sits in a raised pill in its section's color. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {state.routes.map((route, index) => {
        const meta = ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={styles.item}>
            <View style={[styles.pill, focused && { backgroundColor: meta.soft, borderBottomColor: meta.edge }]}>
              <Ionicons name={focused ? meta.on : meta.off} size={24} color={focused ? meta.color : colors.textMuted} />
            </View>
            <AppText variant={focused ? 'micro' : 'caption'} uppercase={focused} color={focused ? meta.color : colors.textMuted}>
              {meta.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderColor: colors.border,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: space.sm,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
});
