import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
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
      <Card>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark" size={22} color={colors.success} />
          <AppText variant="heading" style={styles.flex}>
            Blocking is on
          </AppText>
          <View style={[styles.pill, { backgroundColor: '#DCFCE7' }]}>
            <AppText variant="caption" color={colors.success}>
              ACTIVE
            </AppText>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card tint={colors.muscleSoft}>
      <View style={styles.row}>
        <Ionicons name="warning" size={22} color={colors.muscleDark} />
        <AppText variant="heading" style={styles.flex}>
          Turn on blocking
        </AppText>
      </View>
      <AppText color={colors.text}>
        Mind-Muscle Sync uses Android&apos;s Accessibility service only to see{' '}
        <AppText style={styles.strong}>which app is open</AppText>, so it can pause the apps you pick after your
        daily limit.
      </AppText>
      <AppText color={colors.textMuted}>
        It never reads what&apos;s on your screen, what you type, or any personal data. Nothing leaves your
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
  pill: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.full },
  button: { marginTop: space.sm },
});
