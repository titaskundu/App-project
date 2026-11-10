import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ChunkyButton } from '@/components/ui/ChunkyButton';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { AppBlocker } from '@modules/app-blocker';

/**
 * Explains the Accessibility permission before sending the user to Android settings
 * (Google Play requires this "prominent disclosure"), or shows that it's on.
 */
export function AccessibilityCard({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <Card style={styles.compact}>
        <View style={styles.row}>
          <View style={styles.shield}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">Blocking is on</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Watching your blocked apps
            </AppText>
          </View>
          <Chip label="Active" color={colors.success} bg={colors.successSoft} />
        </View>
      </Card>
    );
  }

  return (
    <Card tint={colors.muscleSoft} border={colors.muscle} edge={colors.muscleDark}>
      <View style={styles.row}>
        <Ionicons name="warning" size={22} color={colors.muscleDark} />
        <AppText variant="heading" style={styles.flex}>
          Turn on blocking
        </AppText>
      </View>
      <AppText color={colors.text}>
        Mind-Muscle Sync uses Android&apos;s Accessibility service only to see{' '}
        <AppText style={styles.strong}>which app is open</AppText> and, in Instagram, YouTube and Facebook,{' '}
        <AppText style={styles.strong}>which section is open</AppText> (like Reels or Shorts). That&apos;s how
        it pauses what you pick after your daily limit.
      </AppText>
      <AppText color={colors.textMuted}>
        It never reads your messages, what you type, or what&apos;s in posts and videos. Nothing leaves your
        phone.
      </AppText>
      <AppText variant="caption" color={colors.textMuted}>
        In the next screen: tap &quot;Mind-Muscle Sync blocker&quot; → turn it on.
      </AppText>
      <ChunkyButton
        label="Open settings"
        tone="muscle"
        onPress={() => AppBlocker.openAccessibilitySettings()}
        style={styles.button}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  strong: { fontFamily: fonts.extrabold },
  compact: { paddingVertical: space.md },
  shield: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: { marginTop: space.sm },
});
