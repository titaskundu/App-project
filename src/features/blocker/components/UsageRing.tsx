import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme/tokens';

export type Ring = { ratio: number; color: string };

type Props = {
  size: number;
  /** Outermost first. Each ratio is clamped to 0–1. */
  rings: Ring[];
  stroke?: number;
  children?: ReactNode;
};

const GAP = 2;

/** Concentric progress rings (like an activity ring) with content in the middle. */
export function UsageRing({ size, rings, stroke = 6, children }: Props) {
  const mid = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {rings.map((ring, i) => {
          const r = mid - stroke / 2 - i * (stroke + GAP);
          const c = 2 * Math.PI * r;
          // A sliver even at 0, so an unused limit still shows its color.
          const ratio = Math.min(Math.max(ring.ratio, 0.03), 1);
          return [
            <Circle key={`t${i}`} cx={mid} cy={mid} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />,
            <Circle
              key={`f${i}`}
              cx={mid}
              cy={mid}
              r={r}
              stroke={ring.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - ratio)}
              // Start at 12 o'clock and go clockwise.
              transform={`rotate(-90 ${mid} ${mid})`}
            />,
          ];
        })}
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
