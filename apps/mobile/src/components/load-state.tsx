import { WarningCircle } from "phosphor-react-native";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { colors } from "@/constants/theme";

export function LoadingState({ label = "Getting things ready…" }: { label?: string }) {
  return (
    <View style={styles.full}>
      <ActivityIndicator color={colors.coral} size="large" />
      <AppText style={styles.muted}>{label}</AppText>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.full}>
      <WarningCircle color={colors.coralStrong} size={34} weight="duotone" />
      <AppText variant="heading">Something went sideways</AppText>
      <AppText style={styles.center}>{message}</AppText>
      {onRetry ? (
        <Button
          compact
          label="Try again"
          onPress={onRetry}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  full: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    flex: 1,
    gap: 10,
    justifyContent: "center",
    padding: 28,
  },
  muted: {
    color: colors.inkMuted,
  },
  center: {
    color: colors.inkMuted,
    maxWidth: 340,
    textAlign: "center",
  },
});
