/**
 * Mind-Muscle Sync design tokens.
 * One source of truth for color, type, spacing and shape.
 * Do NOT use Duolingo-like greens. Brain = teal, Muscle = coral, Sparks = gold.
 */

export const colors = {
  // Brand
  primary: '#4F46E5', // indigo — main actions
  primaryDark: '#3730A3', // button "base" / pressed edge
  primarySoft: '#E0E7FF',

  muscle: '#FF6B57', // coral — Muscle Mode
  muscleDark: '#D9483A',
  muscleSoft: '#FFE4DF',

  brain: '#14B8A6', // teal — Brain Mode
  brainDark: '#0F8F82',
  brainSoft: '#CCFBF1',

  spark: '#F5B700', // gold — Sparks currency / rewards
  sparkDark: '#C99400',
  sparkSoft: '#FFF4CC',

  // Surfaces
  background: '#FAF7F2', // warm cream
  surface: '#FFFFFF',
  surfaceMuted: '#F2EEE7',
  border: '#E7E1D7',
  borderDark: '#D6CEC1',

  // Text (never pure black)
  text: '#1F2340', // deep navy-ink
  textMuted: '#6B6F86',
  textOnColor: '#FFFFFF',

  // Feedback
  success: '#22A06B',
  danger: '#E5484D',
  dangerDark: '#B8333A',
  successSoft: '#DCFCE7',
  dangerSoft: '#FEE2E2',

  // Code card (Coding questions)
  codeBg: '#1F2340',
  codeText: '#E0E7FF',
} as const;

export const fonts = {
  regular: 'Nunito_500Medium',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
  /** Code blocks in Coding questions (Android's built-in monospace). */
  mono: 'monospace',
} as const;

export const type = {
  display: { fontFamily: fonts.black, fontSize: 32, lineHeight: 40, letterSpacing: -0.5 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 28 },
  bodyLg: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.extrabold, fontSize: 14, lineHeight: 18, letterSpacing: 0.8 },
  caption: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof type;

/** 4px baseline grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Extra-rounded "squircle" shapes. */
export const radius = {
  sm: 12,
  md: 20,
  lg: 28,
  xl: 40,
  full: 9999,
} as const;

/** Tactile depth: solid bottom edge instead of blurry shadows. */
export const depth = {
  raised: 5, // bottom edge height at rest
  pressed: 1, // bottom edge height when pressed
  minTap: 52, // minimum touch target height
} as const;

/** The tone sets used by buttons, chips and cards. */
export const tones = {
  primary: { bg: colors.primary, edge: colors.primaryDark, fg: colors.textOnColor },
  brain: { bg: colors.brain, edge: colors.brainDark, fg: colors.textOnColor },
  muscle: { bg: colors.muscle, edge: colors.muscleDark, fg: colors.textOnColor },
  spark: { bg: colors.spark, edge: colors.sparkDark, fg: colors.text },
  danger: { bg: colors.danger, edge: colors.dangerDark, fg: colors.textOnColor },
  neutral: { bg: colors.surface, edge: colors.border, fg: colors.primary },
} as const;

export type Tone = keyof typeof tones;
