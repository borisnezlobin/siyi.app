import * as Haptics from "expo-haptics";
import { CaretDown, CaretUp } from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { colors, radii } from "@/constants/theme";

/**
 * One collapsible group on the person form. The web form uses the same six
 * groups in the same order, so a collapsed header has to say what is inside.
 */
export function FormSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityLabel={title}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          setOpen((wasOpen) => !wasOpen);
          void Haptics.selectionAsync();
        }}
        style={styles.header}
      >
        <View style={styles.headerCopy}>
          <AppText variant="label">{title}</AppText>
          <AppText numberOfLines={1} variant="caption">
            {summary}
          </AppText>
        </View>
        {open ? (
          <CaretUp color={colors.inkMuted} size={18} />
        ) : (
          <CaretDown color={colors.inkMuted} size={18} />
        )}
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 17,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  body: {
    gap: 16,
    paddingBottom: 17,
    paddingHorizontal: 17,
  },
});
