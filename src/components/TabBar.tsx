import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { colors, radius, space } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { on: IconName; off: IconName; label: string }> = {
  index: { on: 'home', off: 'home-outline', label: 'Home' },
  stats: { on: 'stats-chart', off: 'stats-chart-outline', label: 'Stats' },
  shop: { on: 'bag-handle', off: 'bag-handle-outline', label: 'Shop' },
  settings: { on: 'settings', off: 'settings-outline', label: 'Settings' },
};

/** Floating, rounded bottom bar. The active tab gets a soft indigo pill. */
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
            <View style={[styles.pill, focused && styles.pillOn]}>
              <Ionicons name={focused ? meta.on : meta.off} size={24} color={focused ? colors.primary : colors.textMuted} />
            </View>
            <AppText variant="caption" color={focused ? colors.primary : colors.textMuted}>
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
  item: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: radius.full },
  pillOn: { backgroundColor: colors.primarySoft },
});
