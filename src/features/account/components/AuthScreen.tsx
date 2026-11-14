import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { colors, radius, space } from '@/theme/tokens';

/**
 * Frame for the sign-up / log-in screens: optional back button, a title and subtitle, then the
 * form, which scrolls and moves up with the keyboard.
 */
export function AuthScreen({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {onBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              onPress={onBack}
              style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          )}
          <View style={styles.head}>
            <AppText variant="display">{title}</AppText>
            {subtitle ? <AppText color={colors.textMuted}>{subtitle}</AppText> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Red (problem) or green (all good) message card under a form. */
export function Note({ text, bad }: { text: string; bad?: boolean }) {
  return (
    <Card tint={bad ? colors.dangerSoft : colors.successSoft}>
      <AppText color={bad ? colors.dangerDark : colors.text}>{text}</AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: space.md, gap: space.md, paddingBottom: space.xxl },
  head: { gap: space.xs, marginBottom: space.sm },
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
});
