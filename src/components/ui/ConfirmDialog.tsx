import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { colors, radius, space, type Tone } from '@/theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone?: Tone;
  cancelLabel?: string;
  busy?: boolean;
  /** Icon shown in a circle above the title. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Red version for destructive actions (red outline, red icon, red confirm button). */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Centered pop-up asking to confirm an action: dimmed backdrop, a chunky card that zooms in,
 * confirm + cancel. Tapping the backdrop or Android Back cancels.
 *
 * An in-screen overlay rather than an RN Modal (Android Modals stop above the navigation bar),
 * so render it last, outside the screen's SafeAreaView / ScrollView.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  confirmTone = 'primary',
  cancelLabel = 'Cancel',
  busy,
  icon,
  danger,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, busy, onCancel]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, styles.wrap]}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={cancelLabel} onPress={() => !busy && onCancel()} />
      <Animated.View
        entering={ZoomIn.duration(180)}
        style={[styles.card, danger && styles.cardDanger]}
        accessibilityViewIsModal>
        {icon && (
          <View style={[styles.icon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
            <Ionicons name={icon} size={30} color={danger ? colors.danger : colors.primary} />
          </View>
        )}
        <AppText variant="heading" center color={danger ? colors.dangerDark : colors.text}>
          {title}
        </AppText>
        <AppText center color={colors.textMuted}>
          {message}
        </AppText>
        <ChunkyButton label={confirmLabel} tone={danger ? 'danger' : confirmTone} disabled={busy} onPress={onConfirm} />
        <ChunkyButton label={cancelLabel} tone="neutral" disabled={busy} onPress={onCancel} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.scrim, justifyContent: 'center', padding: space.lg },
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: colors.border,
  },
  cardDanger: { borderColor: colors.danger, borderBottomColor: colors.dangerDark },
  icon: { alignSelf: 'center', width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
