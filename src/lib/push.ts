import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";

type PushPayload = {
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
  configureVapid();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) throw new Error(error.message);

  const result: PushSendResult = { delivered: 0, failed: 0, revoked: 0 };

  await Promise.all(
    (data as PushSubscriptionRow[]).map(async (subscription) => {
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
