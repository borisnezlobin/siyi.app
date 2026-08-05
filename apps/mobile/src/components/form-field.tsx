import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
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
};

export function FormField({
  label,
  hint,
  error,
  bottomSheet = false,
  multiline,
  style,
  ...props
}: FormFieldProps) {
  const Input = bottomSheet ? BottomSheetTextInput : TextInput;

  return (
    <View style={styles.group}>
      <AppText variant="label">{label}</AppText>
      <Input
        accessibilityLabel={label}
        multiline={multiline}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.coral}
        style={[
          styles.input,
          multiline && styles.multiline,
          error && styles.errorInput,
          style,
        ]}
        {...props}
      />
      {error ? (
        <AppText style={styles.errorText} variant="caption">
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
  multiline: {
    minHeight: 104,
    textAlignVertical: "top",
  },
  errorInput: {
    borderColor: colors.coral,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
