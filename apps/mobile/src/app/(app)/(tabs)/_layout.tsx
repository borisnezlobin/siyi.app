import { Tabs } from "expo-router";
import { AppTabBar } from "@/components/app-tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="people" />
      <Tabs.Screen name="follow-ups" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
