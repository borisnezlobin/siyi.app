import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { brand } from "@/config/brand";
import { supabase } from "@/lib/supabase";

const deviceIdKey = `${brand.slug}.push-device-id`;

export type PushPermissionState =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function deviceId() {
  const existing = await SecureStore.getItemAsync(deviceIdKey);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(deviceIdKey, created);
  return created;
}

function projectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  );
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (!Device.isDevice || (Platform.OS !== "ios" && Platform.OS !== "android")) {
    return "unavailable";
  }
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) return "granted";
  if (permission.canAskAgain) return "undetermined";
  return "denied";
}

async function upsertExpoToken(session: Session) {
  const easProjectId = projectId();
  if (!easProjectId) {
    throw new Error(
      "Add the EAS project ID before enabling push notifications.",
    );
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: `${brand.name} reminders`,
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 90, 180],
      lightColor: "#e66b56",
    });
  }

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    })
  ).data;
  const currentDeviceId = await deviceId();
  const { error } = await supabase.from("native_push_subscriptions").upsert(
    {
      user_id: session.user.id,
      expo_push_token: token,
      platform: Platform.OS,
      device_id: currentDeviceId,
      device_name: Device.deviceName || Device.modelName || "",
      app_version: Constants.expoConfig?.version || "",
      revoked_at: null,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "user_id,device_id" },
  );
  if (error) throw error;
  return token;
}

export async function enableNativePush(session: Session) {
  if (!Device.isDevice) {
    throw new Error(
      "Remote push notifications require a physical iPhone or Android device.",
    );
  }

  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: false,
      },
    });
  }
  if (!permission.granted) {
    throw new Error(
      "Notifications are blocked for this app. You can allow them in your device settings.",
    );
  }

  await upsertExpoToken(session);
  const { error } = await supabase
    .from("notification_preferences")
    .update({ push_enabled: true })
    .eq("user_id", session.user.id);
  if (error) throw error;
}

export async function disableNativePush(session: Session) {
  const currentDeviceId = await deviceId();
  const now = new Date().toISOString();
  const [subscriptionResult, preferenceResult] = await Promise.all([
    supabase
      .from("native_push_subscriptions")
      .update({ revoked_at: now })
      .eq("user_id", session.user.id)
      .eq("device_id", currentDeviceId),
    supabase
      .from("notification_preferences")
      .update({ push_enabled: false })
      .eq("user_id", session.user.id),
  ]);
  const error = subscriptionResult.error || preferenceResult.error;
  if (error) throw error;
}

export async function refreshExistingPushRegistration(session: Session) {
  const permission = await getPushPermissionState();
  if (permission !== "granted") return;

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error || !data?.push_enabled) return;
  await upsertExpoToken(session);
}

export async function sendNativeTestNotification(
  session: Session,
  webUrl: string,
) {
  if (!webUrl) {
    throw new Error("Set the production web URL before sending a test.");
  }
  const response = await fetch(`${webUrl.replace(/\/$/, "")}/api/push/test`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "The test notification was not sent.");
  }
}

export function appRouteFromNotificationUrl(value: unknown) {
  if (typeof value !== "string") return "/today" as const;
  if (/^\/people\/[0-9a-f-]+$/i.test(value)) return value as `/people/${string}`;
  if (value === "/follow-ups") return "/follow-ups" as const;
  if (value === "/notifications") return "/notifications" as const;
  return "/today" as const;
}
