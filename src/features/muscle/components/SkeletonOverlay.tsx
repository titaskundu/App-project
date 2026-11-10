import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { colors } from '@/theme/tokens';

import { SKELETON } from '../pose';

const ALine = Animated.createAnimatedComponent(Line);
const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * `data` = [frameW, frameH, x, y, visibility × 33] with x/y as 0–1 of the frame (the camera's
 * raw numbers). `size` = this overlay's size on screen. The preview fills the screen and crops
 * the overflow (like CSS "cover"), so points are mapped the same way.
 * Drawn on the UI thread from shared values, so 24 updates a second don't re-render React.
 */
type Props = { data: SharedValue<number[]>; size: SharedValue<{ w: number; h: number }>; color: string; joint: string };

const JOINTS = Array.from(new Set(SKELETON.flat()));

function toScreen(d: number[], s: { w: number; h: number }, i: number) {
  'worklet';
  const fw = d[0];
  const fh = d[1];
  const scale = Math.max(s.w / fw, s.h / fh);
  const ox = (s.w - fw * scale) / 2;
  const oy = (s.h - fh * scale) / 2;
  const at = 2 + i * 3;
  return { x: d[at] * fw * scale + ox, y: d[at + 1] * fh * scale + oy, v: d[at + 2] };
}

function useBoneProps(a: number, b: number, data: Props['data'], size: Props['size'], opacity: number) {
  return useAnimatedProps(() => {
    const d = data.value;
    if (d.length < 2 + 33 * 3 || size.value.w === 0) return { x1: 0, y1: 0, x2: 0, y2: 0, strokeOpacity: 0 };
    const p = toScreen(d, size.value, a);
    const q = toScreen(d, size.value, b);
    return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, strokeOpacity: p.v > 0.5 && q.v > 0.5 ? opacity : 0 };
  });
}

/** A light line with a dark outline, so it shows on both bright and dark backgrounds. */
function Bone({ a, b, data, size, color }: { a: number; b: number } & Omit<Props, 'joint'>) {
  const outline = useBoneProps(a, b, data, size, 0.45);
  const line = useBoneProps(a, b, data, size, 0.95);
  return (
    <>
      <ALine animatedProps={outline} stroke={colors.text} strokeWidth={10} strokeLinecap="round" />
      <ALine animatedProps={line} stroke={color} strokeWidth={6} strokeLinecap="round" />
    </>
  );
}

function Joint({ i, data, size, color }: { i: number; data: Props['data']; size: Props['size']; color: string }) {
  const props = useAnimatedProps(() => {
    const d = data.value;
    if (d.length < 2 + 33 * 3 || size.value.w === 0) return { cx: 0, cy: 0, fillOpacity: 0, strokeOpacity: 0 };
    const p = toScreen(d, size.value, i);
    return { cx: p.x, cy: p.y, fillOpacity: p.v > 0.5 ? 1 : 0, strokeOpacity: p.v > 0.5 ? 1 : 0 };
  });
  return <ACircle animatedProps={props} r={7} fill={color} stroke={colors.surface} strokeWidth={2} />;
}

export function SkeletonOverlay({ data, size, color, joint }: Props) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {SKELETON.map(([a, b]) => (
        <Bone key={`${a}-${b}`} a={a} b={b} data={data} size={size} color={color} />
      ))}
      {JOINTS.map((i) => (
        <Joint key={i} i={i} data={data} size={size} color={joint} />
      ))}
    </Svg>
  );
}
