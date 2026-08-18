import { useRouter } from "expo-router";
import { useState } from "react";
import { ArrowLeft } from "phosphor-react-native";
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
import {
  FocusScrollProvider,
  useFocusScrollArea,
} from "@/components/focus-scroll";
import { GlassIconButton, liquidGlassAvailable } from "@/components/glass-surface";
import { colors } from "@/constants/theme";

type ScreenProps = ScrollViewProps & {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  bottomInset?: number;
  maxContentWidth?: number;
  keyboardAvoiding?: boolean;
  /** For anything pushed on top of a tab, which the tab bar cannot get back from. */
  showBack?: boolean;
  /** Controls that stay put on the glass while the list scrolls under them. */
  stickyHeader?: React.ReactNode;
  /**
   * The screen's primary action, pinned above the safe area. A button at the
   * end of a list is only reachable by scrolling to the end of the list, and on
   * a long one it is not obvious it is there at all.
   */
  footer?: React.ReactNode;
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
  keyboardAvoiding = true,
  showBack = false,
  stickyHeader,
  footer,
  contentContainerStyle,
  ...props
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const heading =
    eyebrow || title || subtitle ? (
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
    ) : null;

  // Counted rather than written down: what comes before the sticky block
  // decides its index, and getting it wrong sticks the wrong thing.
  const stickyIndex = (showBack ? 1 : 0) + (heading ? 1 : 0);
  const { focusScroll, scrollProps } = useFocusScrollArea();
  // Measured rather than assumed: the footer holds whatever the screen puts in
  // it, and a guessed height either hides the last row or leaves a gap.
  const [footerHeight, setFooterHeight] = useState(0);

  return (
    <KeyboardAvoidingView
      behavior={
        keyboardAvoiding && Platform.OS === "ios" ? "padding" : undefined
      }
      style={styles.fill}
    >
      <FocusScrollProvider value={focusScroll}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.content,
            {
              maxWidth: maxContentWidth,
            },
            {
              // With a sticky block the inset is on the scroll view itself, so
              // the block pins below the status bar rather than under it.
              paddingTop: stickyHeader ? 10 : Math.max(insets.top + 10, 22),
              paddingBottom: bottomInset + insets.bottom + footerHeight,
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
          stickyHeaderIndices={stickyHeader ? [stickyIndex] : undefined}
          style={[styles.fill, stickyHeader ? { paddingTop: insets.top } : null]}
          {...scrollProps}
        {...props}
        >
          {showBack ? (
            // On its own row and hard left: an arrow pointing left, anywhere but
            // the left edge, reads as pointing at whatever is beside it.
            <View style={styles.backRow}>
              <GlassIconButton
                accessibilityLabel="Go back"
                fallbackStyle={styles.backFallback}
                onPress={() => router.back()}
                style={styles.back}
              >
                <ArrowLeft color={colors.ink} size={21} />
              </GlassIconButton>
            </View>
          ) : null}

          {heading}

          {stickyHeader ? (
            <View
              style={[
                styles.sticky,
                liquidGlassAvailable ? null : styles.stickyFallback,
              ]}
            >
              {stickyHeader}
            </View>
          ) : null}

          {children}
        </ScrollView>

        {footer ? (
          <View
            onLayout={(event) =>
              setFooterHeight(event.nativeEvent.layout.height)
            }
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </FocusScrollProvider>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.porcelain,
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
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
  // The block itself carries no fill: each control inside it is its own piece
  // of glass, and a slab behind them would read as a card they float on.
  sticky: {
    gap: 12,
    paddingVertical: 8,
  },
  // Without Liquid Glass there is nothing between the controls, so the page
  // colour goes back in and the list stops showing through the gaps.
  stickyFallback: {
    backgroundColor: colors.porcelain,
  },
  backRow: {
    alignItems: "flex-start",
  },
  back: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backFallback: {
    backgroundColor: colors.paper,
  },
  header: {
    gap: 7,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  eyebrow: {
    color: colors.coralStrong,
  },
  subtitle: {
    color: colors.inkMuted,
    maxWidth: 560,
  },
});
