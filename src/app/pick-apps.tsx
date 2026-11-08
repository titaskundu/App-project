import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { SUGGESTED_PACKAGES } from '@/features/blocker/limits';
import { useBlocker } from '@/features/blocker/store';
import { colors, fonts, radius, space } from '@/theme/tokens';

/** Modal list of installed apps. Common distracting apps are listed first. */
export default function PickAppsScreen() {
  const { apps, appsLoaded, loadApps, targets, setTargetSet } = useBlocker();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(Object.keys(targets)));
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadApps().catch(() => {});
  }, [loadApps]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? apps.filter((a) => a.label.toLowerCase().includes(q) || a.packageName.includes(q))
      : apps;
    const rank = (pkg: string) => {
      const i = SUGGESTED_PACKAGES.indexOf(pkg);
      return i === -1 ? SUGGESTED_PACKAGES.length : i;
    };
    return [...filtered].sort((a, b) => rank(a.packageName) - rank(b.packageName));
  }, [apps, query]);

  const toggle = (pkg: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pkg)) next.delete(pkg);
      else next.add(pkg);
      return next;
    });

  const save = () => {
    setTargetSet([...selected]);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <AppText variant="title">Pick apps to limit</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={colors.text} />
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
      />

      {!appsLoaded ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(a) => a.packageName}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const on = selected.has(item.packageName);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(item.packageName)}
                style={[styles.item, on && styles.itemOn]}>
                <View style={[styles.avatar, on && styles.avatarOn]}>
                  <AppText variant="heading" color={on ? colors.textOnColor : colors.primary}>
                    {item.label.charAt(0).toUpperCase()}
                  </AppText>
                </View>
                <AppText variant="bodyLg" numberOfLines={1} style={styles.flex}>
                  {item.label}
                </AppText>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={on ? colors.primary : colors.borderDark}
                />
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <ChunkyButton label={`Save (${selected.size})`} size="lg" onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingTop: space.md,
  },
  search: {
    margin: space.md,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderTopWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  loader: { marginTop: space.xl },
  list: { paddingHorizontal: space.md, paddingBottom: space.xl, gap: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOn: { backgroundColor: colors.primary },
  flex: { flex: 1 },
  footer: { padding: space.md, borderTopWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
});
