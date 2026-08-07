import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import {
  ClockCountdown,
  GearSix,
  House,
  Plus,
  UsersThree,
  type Icon,
} from "phosphor-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import {
  colors,
  floatShadow,
  radii,
} from "@/constants/theme";
import { useQuickCapture } from "@/providers/quick-capture-provider";

type TabsProps = React.ComponentProps<typeof Tabs>;
type TabBarRenderer = NonNullable<TabsProps["tabBar"]>;
type AppTabBarProps = Parameters<TabBarRenderer>[0];

const tabDetails: Record<string, { label: string; icon: Icon }> = {
  today: { label: "Today", icon: House },
  people: { label: "People", icon: UsersThree },
  reminders: { label: "Reminders", icon: ClockCountdown },
  settings: { label: "Settings", icon: GearSix },
};

export function AppTabBar({
  state,
  descriptors,
  navigation,
}: AppTabBarProps) {
  const insets = useSafeAreaInsets();
  const quickCapture = useQuickCapture();

  return (
    <View
      style={[
        styles.shell,
        {
          height: 70 + Math.max(insets.bottom, 10),
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const details = tabDetails[route.name];
          if (!details) return null;
          const selected = state.index === index;
          const IconComponent = details.icon;

          return (
            <Pressable
              accessibilityLabel={
                descriptors[route.key]?.options.tabBarAccessibilityLabel
              }
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={route.key}
              onLongPress={() =>
                navigation.emit({
                  type: "tabLongPress",
                  target: route.key,
                })
              }
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                  void Haptics.selectionAsync();
                }
              }}
              style={[styles.tab, index === 1 && styles.leftTabGap, index === 2 && styles.rightTabGap]}
            >
              <IconComponent
                color={selected ? colors.ink : colors.inkMuted}
                size={23}
                weight={selected ? "fill" : "regular"}
              />
              <AppText
                style={[
                  styles.tabLabel,
                  selected && styles.tabLabelSelected,
                ]}
                variant="caption"
              >
                {details.label}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityLabel="Add something"
          accessibilityRole="button"
          onPress={quickCapture.open}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
          ]}
        >
          <Plus color={colors.paper} size={29} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
  },
  tabs: {
    ...floatShadow,
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.xlarge,
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 4,
  },
  tab: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 60,
    minWidth: 64,
  },
  tabLabel: {
    color: colors.inkMuted,
    fontSize: 10,
  },
  tabLabelSelected: {
    color: colors.ink,
  },
  leftTabGap: {
    marginRight: 24,
  },
  rightTabGap: {
    marginLeft: 24,
  },
  action: {
    ...floatShadow,
    alignItems: "center",
    backgroundColor: colors.coral,
    borderRadius: radii.round,
    height: 58,
    justifyContent: "center",
    left: "50%",
    marginLeft: -29,
    position: "absolute",
    top: -35,
    width: 58,
    zIndex: 5,
  },
  actionPressed: {
    backgroundColor: colors.coralStrong,
    transform: [{ scale: 0.94 }, { rotate: "8deg" }],
  },
});
