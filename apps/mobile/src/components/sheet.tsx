import { Modal, StyleSheet, View, type ViewStyle } from "react-native";
import { colors, floatShadow, radii } from "@/constants/theme";

/**
 * A centred card over a dimmed screen, for the few questions that have to be
 * answered before anything else happens.
 *
 * Distinct from `AppBottomSheet`, which is for composing something: this one
 * interrupts, so it sits in the middle and offers two answers.
 */
export function Sheet({
  visible,
  onRequestClose,
  children,
  style,
}: {
  visible: boolean;
  onRequestClose?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      transparent
      visible={visible}
    >
      <View style={styles.scrim}>
        <View style={[styles.sheet, style]}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: "rgba(23, 32, 28, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    ...floatShadow,
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 16,
    padding: 26,
  },
});
