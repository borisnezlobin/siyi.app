import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import { customTypeIconFor } from "@/lib/custom-type-icon";
import {
  customTypeIconKeys,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";

type CustomTypeFieldsProps = {
  label: string;
  icon: CustomTypeIconKey | "";
  onLabelChange: (label: string) => void;
  onIconChange: (icon: CustomTypeIconKey | "") => void;
  recentLabels?: string[];
};

export function CustomTypeFields({
  label,
  icon,
  onLabelChange,
  onIconChange,
  recentLabels = [],
}: CustomTypeFieldsProps) {
  return (
    <View style={styles.group}>
      <FormField
        bottomSheet
        label="What would you call it?"
        maxLength={40}
        onChangeText={onLabelChange}
        placeholder="Went bouldering"
        value={label}
      />

      {recentLabels.length > 0 ? (
        <View style={styles.chipRow}>
          {recentLabels.map((recent) => (
            <Pressable
              accessibilityRole="button"
              key={recent}
              onPress={() => {
                void Haptics.selectionAsync();
                onLabelChange(recent);
              }}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <AppText variant="caption">{recent}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      <AppText variant="caption">Pick an icon (optional)</AppText>
      <View style={styles.chipRow}>
        {customTypeIconKeys.map((key) => {
          const IconComponent = customTypeIconFor(key);
          const active = icon === key;
          return (
            <Pressable
              accessibilityLabel={`Use the ${key} icon`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={key}
              onPress={() => {
                void Haptics.selectionAsync();
                onIconChange(active ? "" : key);
              }}
              style={({ pressed }) => [
                styles.iconChoice,
                active && styles.iconChoiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <IconComponent
                color={active ? colors.paper : colors.inkMuted}
                size={19}
                weight={active ? "fill" : "regular"}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    gap: 10,
    padding: 14,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  iconChoice: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  iconChoiceSelected: {
    backgroundColor: colors.sageStrong,
  },
  pressed: {
    opacity: 0.8,
  },
});
