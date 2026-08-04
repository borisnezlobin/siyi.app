import type { SupabaseClient } from "@supabase/supabase-js";
import Expo, {
  type ExpoPushReceiptId,
} from "expo-server-sdk";
import webPush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NativePushSubscriptionRow = {
  id: string;
  expo_push_token: string;
  last_ticket_id: string | null;
  last_ticket_sent_at: string | null;
};

export type PushSendResult = {
  delivered: number;
  failed: number;
  revoked: number;
};

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID keys are not configured.");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

function getPushStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

export async function sendPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const [webResult, nativeResult] = await Promise.all([
    sendWebPushToUser(admin, userId, payload),
    sendNativePushToUser(admin, userId, payload),
  ]);
  return {
    delivered: webResult.delivered + nativeResult.delivered,
    failed: webResult.failed + nativeResult.failed,
    revoked: webResult.revoked + nativeResult.revoked,
  };
}

async function sendWebPushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);
  const result: PushSendResult = { delivered: 0, failed: 0, revoked: 0 };
  const subscriptions = data as PushSubscriptionRow[];
  if (subscriptions.length === 0) return result;

  configureVapid();

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify(payload),
          {
            TTL: 60 * 60 * 24,
            urgency: "normal",
          },
        );

        result.delivered += 1;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", subscription.id);
      } catch (sendError) {
        const statusCode = getPushStatusCode(sendError);

        if (statusCode === 404 || statusCode === 410) {
          result.revoked += 1;
          await admin
            .from("push_subscriptions")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", subscription.id);
        } else {
          result.failed += 1;
        }
      }
    }),
  );

  return result;
}

function expoClient() {
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  return new Expo(accessToken ? { accessToken } : undefined);
}

async function revokeNativeSubscription(
  admin: SupabaseClient,
  subscriptionId: string,
) {
  await admin
    .from("native_push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", subscriptionId);
}

async function cleanupNativeReceipt(
  expo: Expo,
  admin: SupabaseClient,
  subscription: NativePushSubscriptionRow,
) {
  if (!subscription.last_ticket_id || !subscription.last_ticket_sent_at) {
    return false;
  }
  const receiptAge =
    Date.now() - new Date(subscription.last_ticket_sent_at).getTime();
  if (receiptAge < 15 * 60 * 1000 || receiptAge > 24 * 60 * 60 * 1000) {
    return false;
  }

  try {
    const receipts = await expo.getPushNotificationReceiptsAsync([
      subscription.last_ticket_id as ExpoPushReceiptId,
    ]);
    const receipt = receipts[subscription.last_ticket_id];
    if (
      receipt?.status === "error" &&
      receipt.details?.error === "DeviceNotRegistered"
    ) {
      await revokeNativeSubscription(admin, subscription.id);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function sendNativePushToUser(
  admin: SupabaseClient,
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  const { data, error } = await admin
    .from("native_push_subscriptions")
    .select(
      "id,expo_push_token,last_ticket_id,last_ticket_sent_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error(error.message);

  const result: PushSendResult = { delivered: 0, failed: 0, revoked: 0 };
  const expo = expoClient();
  const activeSubscriptions: NativePushSubscriptionRow[] = [];

  for (const subscription of data as NativePushSubscriptionRow[]) {
    if (!Expo.isExpoPushToken(subscription.expo_push_token)) {
      await revokeNativeSubscription(admin, subscription.id);
      result.revoked += 1;
      continue;
    }
    const revoked = await cleanupNativeReceipt(expo, admin, subscription);
    if (revoked) {
      result.revoked += 1;
      continue;
    }
    activeSubscriptions.push(subscription);
  }

  if (activeSubscriptions.length === 0) return result;

  const tickets = await expo.sendPushNotificationsAsync(
    activeSubscriptions.map((subscription) => ({
      to: subscription.expo_push_token,
      title: payload.title,
      body: payload.body,
      data: { url: payload.url },
      tag: payload.tag,
      collapseId: payload.tag,
      channelId: "reminders",
      priority: "default",
      ttl: 60 * 60 * 24,
    })),
  );

  await Promise.all(
    tickets.map(async (ticket, index) => {
      const subscription = activeSubscriptions[index];
      if (ticket.status === "ok") {
        result.delivered += 1;
        await admin
          .from("native_push_subscriptions")
          .update({
            last_used_at: new Date().toISOString(),
            last_ticket_id: ticket.id,
            last_ticket_sent_at: new Date().toISOString(),
          })
          .eq("id", subscription.id);
        return;
      }

      if (ticket.details?.error === "DeviceNotRegistered") {
        result.revoked += 1;
        await revokeNativeSubscription(admin, subscription.id);
      } else {
        result.failed += 1;
      }
    }),
  );

  return result;
}
