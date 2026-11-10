import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { AREAS } from '@/features/brain/areas';
import { useBrain } from '@/features/brain/store';
import type { Area } from '@/features/brain/types';
import { colors, radius, space } from '@/theme/tokens';

const REACTIONS = ['Ooh, good pick!', 'Big brain energy.', 'Love that.', 'Now we’re talking!', 'You’ve got range!'];

/**
 * Interests quiz: which Brain areas should tolls ask about? Shown on first launch
 * (/interests?first=1, then the level check) and from Settings to change picks.
 */
export default function InterestsScreen() {
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirst = first === '1';
  const { areas, setAreas } = useBrain();
  const [picked, setPicked] = useState<Set<Area>>(() => new Set(areas));

  const toggle = (a: Area) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const save = () => {
    setAreas(AREAS.map((a) => a.id).filter((id) => picked.has(id)));
    if (isFirst) router.replace('/brain?mode=calibration&first=1');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const count = picked.size;
  const reaction = count === 0 ? 'Pick at least one. You can change these later.' : REACTIONS[(count - 1) % REACTIONS.length];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {!isFirst && (
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()} style={styles.close}>
            <Ionicons name="close" size={28} color={colors.textMuted} />
          </Pressable>
        )}
        <AppText variant="display">What do you want to train?</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>
          Tolls ask quick questions from the topics you pick. They get harder as you get better.
        </AppText>

        <View style={styles.mascotRow}>
          <View style={styles.mascot}>
            <AppText variant="title">🐼</AppText>
          </View>
          <View style={styles.bubble}>
            <AppText variant="bodyLg" numberOfLines={2}>
              {reaction}
            </AppText>
          </View>
        </View>

        {AREAS.map((a) => {
          const on = picked.has(a.id);
          return (
            <Pressable
              key={a.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${a.title}. ${a.description}`}
              onPress={() => toggle(a.id)}
              style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.cardPressed]}>
              <View style={[styles.icon, on && styles.iconOn]}>
                <Ionicons name={a.icon} size={26} color={on ? colors.textOnColor : colors.brainDark} />
              </View>
              <View style={styles.flex}>
                <AppText variant="heading">{a.title}</AppText>
                <AppText color={colors.textMuted}>{a.description}</AppText>
              </View>
              <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={28} color={on ? colors.brain : colors.borderDark} />
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <ChunkyButton
          label={count === 0 ? 'Pick at least 1' : isFirst ? `Continue (${count})` : `Save (${count})`}
          tone="brain"
          size="lg"
          disabled={count === 0}
          onPress={save}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  close: { alignSelf: 'flex-end' },
  flex: { flex: 1 },
  mascotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mascot: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.brainSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flex: 1,
    // Fixed height (two lines of text) so the cards below don't jump when the reaction changes.
    height: 2 * 26 + 2 * space.md + 4,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    minHeight: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.brain, backgroundColor: colors.brainSoft },
  // Pressed: the face drops 3px into its edge. marginTop + thinner border keep the card's total
  // height the same, so the cards below don't move.
  cardPressed: { borderBottomWidth: 2, marginTop: 3 },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brainSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOn: { backgroundColor: colors.brain },
  footer: { padding: space.md, borderTopWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
});
