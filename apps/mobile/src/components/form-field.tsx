import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { AppText } from "@/components/app-text";
import {
  colors,
  fontFamilies,
  radii,
} from "@/constants/theme";

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  bottomSheet?: boolean;
  /** Sits inside the field frame, e.g. a show-password toggle. */
  accessory?: ReactNode;
  /** Callback form only, so it fits both the plain and bottom-sheet inputs. */
  ref?: (input: TextInput | null | undefined) => void;
};

export function FormField({
  label,
  hint,
  error,
  bottomSheet = false,
  accessory,
  multiline,
  style,
  ...props
}: FormFieldProps) {
  const Input = bottomSheet ? BottomSheetTextInput : TextInput;
  const input = (
    <Input
      accessibilityLabel={label}
      multiline={multiline}
      placeholderTextColor={colors.inkMuted}
      selectionColor={colors.coral}
      style={[
        accessory ? styles.bareInput : styles.input,
        multiline && styles.multiline,
        !accessory && error && styles.errorFrame,
        style,
      ]}
      {...props}
    />
  );

  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      {accessory ? (
        <View style={[styles.frame, error && styles.errorFrame]}>
          {input}
          {accessory}
        </View>
      ) : (
        input
      )}
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          variant="caption"
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 7,
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  frame: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    paddingRight: 8,
  },
  bareInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  multiline: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  errorFrame: {
    borderColor: colors.coral,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
