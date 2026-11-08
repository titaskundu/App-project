import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/theme/tokens';

/** Temporary body for tabs that arrive in later phases. */
export function ComingSoon({ title, phase, note }: { title: string; phase: number; note: string }) {
  return (
    <Screen>
      <AppText variant="title">{title}</AppText>
      <Card>
        <AppText variant="label" uppercase color={colors.primary}>
          Coming in phase {phase}
        </AppText>
        <AppText color={colors.textMuted}>{note}</AppText>
      </Card>
    </Screen>
  );
}
