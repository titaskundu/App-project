import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '@/theme/tokens';

/** Pseudocode for Coding questions, in a dark monospace card (scrolls sideways if a line is long). */
export function CodeCard({ code }: { code: string }) {
  return (
    <ScrollView horizontal style={styles.card} contentContainerStyle={styles.content} showsHorizontalScrollIndicator={false}>
      <Text style={styles.code} accessibilityLabel={`Code: ${code}`}>
        {code}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { flexGrow: 0, backgroundColor: colors.codeBg, borderRadius: radius.md },
  content: { padding: space.md },
  code: { fontFamily: fonts.mono, fontSize: 15, lineHeight: 22, color: colors.codeText },
});
