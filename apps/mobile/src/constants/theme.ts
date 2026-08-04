import type { TextStyle, ViewStyle } from "react-native";

export const colors = {
  ink: "#17201c",
  inkMuted: "#617069",
  porcelain: "#f4f7f4",
  paper: "#ffffff",
  sage: "#dfe9e2",
  sageStrong: "#2f6249",
  coral: "#e66b56",
  coralStrong: "#c94f3b",
  coralSoft: "#fbe5e0",
  sun: "#f3d680",
  sunSoft: "#fff5d8",
  mist: "#e8eeec",
  blueSoft: "#dce6f2",
  blueStrong: "#284f70",
  transparent: "transparent",
} as const;

export const fontFamilies = {
  body: "Manrope_400Regular",
  bodySemibold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",
  display: "Newsreader_500Medium",
} as const;

export const radii = {
  small: 12,
  medium: 18,
  large: 24,
  xlarge: 32,
  round: 999,
} as const;

export const cardShadow: ViewStyle = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 4,
};

export const floatShadow: ViewStyle = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 16 },
  shadowOpacity: 0.2,
  shadowRadius: 28,
  elevation: 8,
};

export const displayTitle: TextStyle = {
  color: colors.ink,
  fontFamily: fontFamilies.display,
  fontSize: 42,
  letterSpacing: -1.6,
  lineHeight: 42,
};
