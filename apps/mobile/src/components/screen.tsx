import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { colors } from "@/constants/theme";

type ScreenProps = ScrollViewProps & {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomInset?: number;
  maxContentWidth?: number;
};

export function Screen({
  title,
  eyebrow,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  bottomInset = 124,
  maxContentWidth = 1040,
  contentContainerStyle,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.fill}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
          },
          {
            paddingTop: Math.max(insets.top + 18, 28),
            paddingBottom: bottomInset + insets.bottom,
          },
          contentContainerStyle,
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.coral}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
        style={styles.fill}
        {...props}
      >
        {eyebrow || title || subtitle ? (
          <View style={styles.header}>
            {eyebrow ? (
              <AppText style={styles.eyebrow} variant="label">
                {eyebrow}
              </AppText>
            ) : null}
            {title ? <AppText variant="display">{title}</AppText> : null}
            {subtitle ? (
              <AppText style={styles.subtitle}>{subtitle}</AppText>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    alignSelf: "center",
    gap: 22,
    paddingHorizontal: 20,
    width: "100%",
  },
  header: {
    gap: 7,
  },
  eyebrow: {
    color: colors.coralStrong,
  },
  subtitle: {
    color: colors.inkMuted,
    maxWidth: 560,
  },
});
