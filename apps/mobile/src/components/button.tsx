import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import type { IconWeight } from "phosphor-react-native";
import type { ComponentType } from "react";
import { AppText } from "@/components/app-text";
import {
  colors,
  fontFamilies,
  radii,
} from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "dark";

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; text: string; spinner: string }
> = {
  primary: {
    container: { backgroundColor: colors.coral },
    text: colors.paper,
    spinner: colors.paper,
  },
  secondary: {
    container: { backgroundColor: colors.mist },
    text: colors.ink,
    spinner: colors.ink,
  },
  quiet: {
    container: { backgroundColor: colors.transparent },
    text: colors.ink,
    spinner: colors.ink,
  },
  danger: {
    container: { backgroundColor: colors.coralSoft },
    text: colors.coralStrong,
    spinner: colors.coralStrong,
  },
  dark: {
    container: { backgroundColor: colors.ink },
    text: colors.paper,
    spinner: colors.paper,
  },
};

// Wide enough for both the icon set and the brand marks in `brand-marks`.
// Phosphor icons take a stroke weight; fixed artwork like the Google mark does
// not, so it accepts the prop and ignores it rather than the slot being closed
// to anything that is not an icon.
type ButtonIcon = ComponentType<{
  color?: string;
  size?: number;
  weight?: IconWeight;
}>;

type ButtonProps = PressableProps & {
  label: string;
  icon?: ButtonIcon;
  variant?: ButtonVariant;
  loading?: boolean;
  compact?: boolean;
  haptic?: boolean;
};

export function Button({
  label,
  icon: IconComponent,
  variant = "primary",
  loading = false,
  compact = false,
  disabled,
  haptic = true,
  onPress,
  style,
  ...props
}: ButtonProps) {
  const visual = variantStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={(event) => {
        if (haptic) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(event);
      }}
      style={(state) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        visual.container,
        (disabled || loading) && styles.disabled,
        state.pressed && styles.pressed,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={visual.spinner} />
      ) : (
        <>
          {IconComponent ? (
            <IconComponent
              color={visual.text}
              size={compact ? 18 : 20}
              weight="bold"
            />
          ) : null}
          <AppText
            style={[
              styles.text,
              { color: visual.text },
              compact && styles.compactText,
            ]}
          >
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 9,
    justifyContent: "center",
  },
  regular: {
    minHeight: 54,
    paddingHorizontal: 22,
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: 15,
  },
  text: {
    fontFamily: fontFamilies.bodyBold,
  },
  compactText: {
    fontSize: 13,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
});
