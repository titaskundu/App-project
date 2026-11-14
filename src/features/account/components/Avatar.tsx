import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors } from '@/theme/tokens';

import { initials } from '../profile';

/** Profile picture: initials in an indigo circle with a solid lip. Phase 6 adds panda avatars. */
export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderBottomWidth: Math.max(3, size / 16) }]}>
      <AppText variant={size >= 64 ? 'title' : 'heading'} color={colors.textOnColor}>
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
