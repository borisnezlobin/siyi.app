import { Image, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import {
  colors,
  fontFamilies,
} from "@/constants/theme";

export function Avatar({
  name,
  uri,
  size = 50,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (uri) {
    return (
      <Image
        alt={`${name}'s profile photo`}
        accessibilityLabel={`${name}'s profile photo`}
        source={{ uri }}
        style={{
          borderRadius: size / 2,
          height: size,
          width: size,
        }}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${name}'s initials`}
      style={[
        styles.fallback,
        {
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <AppText
        style={{
          color: colors.paper,
          fontFamily: fontFamilies.bodyBold,
          fontSize: Math.max(13, size * 0.29),
          lineHeight: Math.max(16, size * 0.36),
          textAlign: "center",
        }}
      >
        {initials || "•"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    backgroundColor: colors.sageStrong,
    justifyContent: "center",
    overflow: "hidden",
  },
});
