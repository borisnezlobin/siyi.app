import { X } from "phosphor-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import { normalizeCollegeText, searchColleges } from "@/lib/colleges";

/**
 * A university field that suggests schools as you type, so "cmu" or "uc berkeley"
 * lands on the full name. It stays a plain text field underneath: anything can be
 * typed and saved, whether or not the list has heard of it.
 */
export function CollegeField({
  value,
  onChangeText,
  bottomSheet = false,
  ...fieldProps
}: {
  value: string;
  onChangeText: (value: string) => void;
  bottomSheet?: boolean;
  [key: string]: unknown;
}) {
  const [focused, setFocused] = useState(false);

  const suggestions = useMemo(() => {
    if (!focused) return [];
    const matches = searchColleges(value, 6);
    // Nothing to offer once they have typed the name exactly.
    if (matches.length === 1 && normalizeCollegeText(matches[0].name) === normalizeCollegeText(value)) {
      return [];
    }
    return matches;
  }, [focused, value]);

  return (
    <View>
      <FormField
        // A default university arrives already filled in, and clearing a field
        // you did not type in should not mean selecting it first.
        accessory={
          value ? (
            <Pressable
              accessibilityLabel="Clear university"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onChangeText("")}
              style={styles.clear}
            >
              <X color={colors.inkMuted} size={15} weight="bold" />
            </Pressable>
          ) : undefined
        }
        autoCapitalize="words"
        autoCorrect={false}
        bottomSheet={bottomSheet}
        label="University"
        maxLength={120}
        onBlur={() => setFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        placeholder="Start typing, or an acronym like CMU"
        value={value}
        {...fieldProps}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((college) => (
            <Pressable
              accessibilityRole="button"
              key={college.name}
              onPress={() => {
                onChangeText(college.name);
                setFocused(false);
              }}
              style={styles.suggestion}
            >
              <AppText variant="body">{college.name}</AppText>
              {college.place ? (
                <AppText variant="caption">{college.place}</AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clear: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  suggestions: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    marginTop: 6,
    overflow: "hidden",
  },
  suggestion: {
    borderBottomColor: colors.mist,
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
});
