import {
  Text,
  type TextProps,
  type TextStyle,
} from "react-native";
import { colors, fontFamilies } from "@/constants/theme";

type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "body"
  | "label"
  | "caption";

const variantStyles: Record<TextVariant, TextStyle> = {
  display: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 42,
    letterSpacing: -1.6,
    lineHeight: 44,
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.display,
    fontSize: 32,
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heading: {
    color: colors.ink,
    fontFamily: fontFamilies.bodyBold,
    fontSize: 18,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  body: {
    color: colors.ink,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    color: colors.ink,
    fontFamily: fontFamilies.bodySemibold,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    color: colors.inkMuted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 17,
  },
};

export function AppText({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: TextVariant }) {
  return <Text style={[variantStyles[variant], style]} {...props} />;
}
