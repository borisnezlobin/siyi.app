import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { fontFamilies } from "@/constants/theme";
import { avatarColorFor, avatarInitials } from "@/lib/avatar-colors";

export function Avatar({
  name,
  uri,
  // 48, matching the web's `md`. The two apps drew the same avatar at two
  // sizes, which is the sort of difference that reads as one of them being
  // slightly wrong without anyone being able to say which.
  size = 48,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const initials = avatarInitials(name);
  const color = avatarColorFor(name);
  const cacheKey = uri
    ? uri.startsWith("file:")
      ? uri
      : uri.replace(/[?#].*$/, "")
    : undefined;

  if (uri) {
    return (
      <Image
        cachePolicy="memory-disk"
        contentFit="cover"
        alt={`${name}'s profile photo`}
        accessibilityLabel={`${name}'s profile photo`}
        source={{ uri, cacheKey }}
        style={{
          borderRadius: size / 2,
          height: size,
          width: size,
        }}
        transition={120}
      />
    );
  }

  return (
    <View
      accessibilityLabel={`${name}'s initials`}
      style={[
        styles.fallback,
        {
          backgroundColor: color.background,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}
    >
      <AppText
        style={{
          color: color.ink,
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
    justifyContent: "center",
    overflow: "hidden",
  },
});
