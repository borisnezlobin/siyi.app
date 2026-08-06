import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

vi.mock("expo-server-sdk", () => {
  class FakeExpo {
    static isExpoPushToken() {
      return true;
    }
    async sendPushNotificationsAsync() {
      return [];
    }
    async getPushNotificationReceiptsAsync() {
      return {};
    }
  }
  return { default: FakeExpo };
});

const payload = {
  title: "Reach out to Amelia",
  body: "It has been a while.",
  url: "/people/1",
  tag: "overdue-1",
};

/**
 * Stands in for the parts of the Supabase client push touches: a select that
 * resolves per table, and update chains that go nowhere.
 */
function fakeAdmin(
  tables: Record<string, { data: unknown[] | null; error: unknown }>,
) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        update: () => chain,
        eq: () => chain,
        is: () => Promise.resolve(tables[table] ?? { data: [], error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve(tables[table] ?? { data: [], error: null }),
      };
      return chain;
    },
  };
}

const webSubscription = {
  id: "sub-1",
  endpoint: "https://push.example/1",
  p256dh: "key",
  auth: "auth",
};

describe("sending a push to one user", () => {
  beforeEach(() => {
    vi.resetModules();
    sendNotification.mockReset();
    sendNotification.mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public";
    process.env.VAPID_PRIVATE_KEY = "private";
    process.env.VAPID_SUBJECT = "mailto:hello@siyi.app";
  });

  it("still reaches the browser when the phone-app table does not exist", async () => {
    const { sendPushToUser } = await import("@/lib/push");
    const admin = fakeAdmin({
      push_subscriptions: { data: [webSubscription], error: null },
      native_push_subscriptions: {
        data: null,
        error: {
          code: "PGRST205",
          message:
            "Could not find the table 'public.native_push_subscriptions' in the schema cache",
        },
      },
    });

    const result = await sendPushToUser(admin as never, "user-1", payload);

    expect(result.delivered).toBe(1);
    expect(result.failed).toBe(0);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("reports a real browser failure rather than swallowing it", async () => {
    const { sendPushToUser } = await import("@/lib/push");
    const admin = fakeAdmin({
      push_subscriptions: {
        data: null,
        error: { code: "42501", message: "permission denied" },
      },
      native_push_subscriptions: { data: [], error: null },
    });

    await expect(
      sendPushToUser(admin as never, "user-1", payload),
    ).rejects.toThrow("permission denied");
  });
});
