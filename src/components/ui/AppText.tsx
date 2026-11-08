import { Text, type TextProps } from 'react-native';

import { colors, type, type TypeVariant } from '@/theme/tokens';

type Props = TextProps & {
  variant?: TypeVariant;
  color?: string;
  center?: boolean;
  uppercase?: boolean;
};

/** The only text component screens should use, so typography stays consistent. */
export function AppText({
  variant = 'body',
  color = colors.text,
  center,
  uppercase,
  style,
  children,
  ...rest
}: Props) {
  // Uppercase the string itself rather than using `textTransform`: on Android,
  // textTransform text is measured at its lowercase width and can wrap mid-word.
  const content = uppercase && typeof children === 'string' ? children.toUpperCase() : children;

  return (
    <Text
      {...rest}
      style={[type[variant], { color }, center && { textAlign: 'center' }, style]}>
      {content}
    </Text>
  );
}
