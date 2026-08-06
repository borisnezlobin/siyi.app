import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { format } from "date-fns";
import * as Haptics from "expo-haptics";
import { CalendarBlank } from "phosphor-react-native";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type TextInput,
  type TextInputProps,
} from "react-native";
import { AppText } from "@/components/app-text";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import {
  dateFromDateInput,
  dateInputLabel,
  parseDateInput,
} from "@/lib/date-input";

/**
 * A date you can type however you like or pick off a calendar. Whatever is
 * typed gets read back in words underneath, so nobody has to wonder whether
 * 03/04 was March or April.
 */
type DateFieldProps = Omit<TextInputProps, "onChangeText" | "value"> & {
  label: string;
  hint?: string;
  error?: string;
  bottomSheet?: boolean;
  /** Always YYYY-MM-DD once it can be read, and whatever was typed until then. */
  value: string;
  onChangeText: (value: string) => void;
  maximumDate?: Date;
  minimumDate?: Date;
  /** Callback form only, to match the fields it sits alongside. */
  ref?: (input: TextInput | null | undefined) => void;
};

export function DateField({
  label,
  hint,
  value,
  onChangeText,
  bottomSheet = false,
  maximumDate,
  minimumDate,
  error,
  onBlur,
  ...props
}: DateFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const understood = dateInputLabel(value);
  const unreadable = value.trim().length > 0 && !understood;
  const pickerValue = dateFromDateInput(value) ?? maximumDate ?? new Date();

  return (
    <View style={styles.group}>
      <FormField
        autoCapitalize="none"
        autoCorrect={false}
        bottomSheet={bottomSheet}
        error={error}
        hint={error ? undefined : hint}
        label={label}
        onBlur={(event) => {
          // Settle on the stored shape once they stop typing, so what is on
          // screen and what is saved never disagree.
          const parsed = parseDateInput(value);
          if (parsed && parsed !== value) onChangeText(parsed);
          onBlur?.(event);
        }}
        onChangeText={onChangeText}
        value={value}
        {...props}
      />
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`${label}: pick from a calendar`}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
          onPress={() => {
            setPickerOpen((open) => !open);
            void Haptics.selectionAsync();
          }}
          style={[styles.chip, pickerOpen && styles.chipOpen]}
        >
          <CalendarBlank
            color={pickerOpen ? colors.paper : colors.inkMuted}
            size={15}
          />
          <AppText
            style={pickerOpen ? styles.lightText : undefined}
            variant="caption"
          >
            {pickerOpen ? "Close calendar" : "Pick a date"}
          </AppText>
        </Pressable>
        {understood ? (
          <AppText
            accessibilityLiveRegion="polite"
            style={styles.understood}
            variant="caption"
          >
            {understood}
          </AppText>
        ) : unreadable ? (
          <AppText
            accessibilityLiveRegion="polite"
            style={styles.unreadable}
            variant="caption"
          >
            Not a date we can read yet
          </AppText>
        ) : null}
      </View>
      {pickerOpen ? (
        <DateTimePicker
          accentColor={colors.coral}
          display="inline"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          mode="date"
          onValueChange={(_event, date) => onChangeText(format(date, "yyyy-MM-dd"))}
          presentation="inline"
          style={styles.picker}
          value={pickerValue}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 9,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  chipOpen: {
    backgroundColor: colors.ink,
  },
  lightText: {
    color: colors.paper,
  },
  understood: {
    color: colors.inkMuted,
    flexShrink: 1,
  },
  unreadable: {
    color: colors.coralStrong,
    flexShrink: 1,
  },
  picker: {
    alignSelf: "stretch",
  },
});
