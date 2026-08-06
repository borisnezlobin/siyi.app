import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { colors, radii } from "@/constants/theme";
import { customTypeIconFor } from "@/lib/custom-type-icon";
import {
  customTypeIconKeys,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";

/**
 * Only entries the user named themselves get an icon; the name itself is
 * asked for by the composer, next to its suggestions.
 */
export function CustomTypeIconPicker({
  icon,
  onIconChange,
}: {
  icon: CustomTypeIconKey | "";
  onIconChange: (icon: CustomTypeIconKey | "") => void;
}) {
  return (
    <View style={styles.iconGroup}>
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
  iconGroup: {
    gap: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
