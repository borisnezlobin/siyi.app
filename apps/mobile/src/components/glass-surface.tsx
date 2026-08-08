import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/**
 * Liquid Glass where the system has it — iOS 26 and up — and the plain surface
 * everywhere else. The fallback is not a lesser version of the effect but the
 * fill the app used before, because a hand-rolled blur on a phone that has no
 * Liquid Glass looks like an imitation of one.
 */
export const liquidGlassAvailable = isLiquidGlassAvailable();

type GlassSurfaceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Applied only when the effect is unavailable, so the shape stays put. */
  fallbackStyle?: StyleProp<ViewStyle>;
  isInteractive?: boolean;
  glassEffectStyle?: "clear" | "regular";
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
};

export function GlassSurface({
  children,
  style,
  fallbackStyle,
  isInteractive = false,
  glassEffectStyle = "regular",
  pointerEvents,
}: GlassSurfaceProps) {
  if (!liquidGlassAvailable) {
    return (
      <View pointerEvents={pointerEvents} style={[style, fallbackStyle]}>
        {children}
      </View>
    );
  }

  return (
    <GlassView
      glassEffectStyle={glassEffectStyle}
      isInteractive={isInteractive}
      pointerEvents={pointerEvents}
      // Glass draws its own material; a fill on top of it defeats the point.
      style={[style, styles.transparent]}
    >
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  transparent: {
    backgroundColor: "transparent",
  },
  fill: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  pressed: {
    opacity: 0.6,
  },
});

type GlassIconButtonProps = {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  /** The round or rounded shape the button should take. */
  style?: StyleProp<ViewStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
};

/**
 * A round icon button that sits on glass.
 *
 * The Pressable is on the outside, with the glass drawn inside it. Nesting it
 * the other way let the glass answer the touch itself — it has its own press
 * animation — while the handler underneath never ran, so the button appeared to
 * respond and then did nothing.
 */
export function GlassIconButton({
  children,
  onPress,
  accessibilityLabel,
  style,
  fallbackStyle,
}: GlassIconButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      <GlassSurface
        fallbackStyle={fallbackStyle}
        // The glass must not take the touch; the Pressable around it has it.
        pointerEvents="none"
        style={[styles.fill, style]}
      >
        {children}
      </GlassSurface>
    </Pressable>
  );
}
