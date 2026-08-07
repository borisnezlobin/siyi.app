"use client";

import { BellRinging, PaperPlaneTilt, SpinnerGap } from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { SwitchControl } from "@/components/switch-control";
import { formatReminderHour, reminderHourOptions } from "@/lib/reminder-hours";

type StatusMessage = { text: string; tone: "success" | "error" };

type PermissionState = NotificationPermission | "unsupported";

/** Monday first: the week people plan around, not the week the calendar prints. */
const weekDays = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export type InitialNotificationPreferences = {
  pushEnabled: boolean;
  overdueContactEnabled: boolean;
  birthdayEnabled: boolean;
  reminderEnabled: boolean;
  reminderHourLocal: number;
  reminderDaysOfWeek: number[];
};

export function NotificationControls({
  initialPreferences,
}: {
  initialPreferences: InitialNotificationPreferences;
}) {
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [pushEnabled, setPushEnabled] = useState(initialPreferences.pushEnabled);
  const [overdueContactEnabled, setOverdueContactEnabled] = useState(
    initialPreferences.overdueContactEnabled,
  );
  const [birthdayEnabled, setBirthdayEnabled] = useState(
    initialPreferences.birthdayEnabled,
  );
  const [reminderEnabled, setReminderEnabled] = useState(
    initialPreferences.reminderEnabled,
  );
  const [reminderHour, setReminderHour] = useState(
    initialPreferences.reminderHourLocal,
  );
  const [days, setDays] = useState(initialPreferences.reminderDaysOfWeek);
  const [working, setWorking] = useState<"push" | "test" | "save" | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission);
    void navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(Boolean(subscription));
    });
  }, []);

  async function enablePush() {
    setWorking("push");
    setMessage(null);

    try {
      if (
        !("Notification" in window) ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        throw new Error("This browser does not support web push.");
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error(
          nextPermission === "denied"
            ? "Notifications are blocked in this browser’s settings."
            : "Notification permission was not granted.",
        );
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            throw new Error("Push keys have not been configured.");
          }
          setPushEnabled(true);
          setMessage({ text: "Push is enabled for this preview.", tone: "success" });
          setWorking(null);
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
        if (!response.ok) throw new Error("The subscription could not be saved.");
      }

      setPushEnabled(true);
      setMessage({
        text: "Push notifications are enabled on this browser.",
        tone: "success",
      });
    } catch (caughtError) {
      setMessage({
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Push notifications could not be enabled.",
        tone: "error",
      });
    }

    setWorking(null);
  }

  async function disablePush() {
    setWorking("push");
    setMessage(null);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }

    await subscription?.unsubscribe();
    setPushEnabled(false);
    setMessage({ text: "Push notifications are off.", tone: "success" });
    setWorking(null);
  }

  async function sendTestNotification() {
    setWorking("test");
    setMessage(null);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/push/test", { method: "POST" });
      if (response.ok) {
        setMessage({
          text: "Test sent. It may take a few seconds to arrive.",
          tone: "success",
        });
      } else {
        // Surface what the server actually said; a bare "could not be sent"
        // leaves nobody able to act on it.
        const detail = await response
          .json()
          .then((body) => body?.error as string | undefined)
          .catch(() => undefined);
        setMessage({
          text: detail || "The test could not be sent.",
          tone: "error",
        });
      }
    } else if (permission === "granted") {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("A gentle hello", {
        body: `${brand.name} notifications are working on this browser.`,
        icon: "/icon-192.png",
        data: { url: "/today" },
      });
      setMessage({
        text: "Test sent. It may take a few seconds to arrive.",
        tone: "success",
      });
    } else {
      setMessage({ text: "Enable push before sending a test.", tone: "error" });
    }

    setWorking(null);
  }

  async function savePreferences() {
    setWorking("save");
    setMessage(null);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pushEnabled,
          overdueContactEnabled,
          birthdayEnabled,
          reminderEnabled,
          reminderHourLocal: reminderHour,
          reminderDaysOfWeek: days,
        }),
      });
      if (!response.ok) {
        setMessage({ text: "Preferences could not be saved.", tone: "error" });
        setWorking(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    setMessage({
      text: "Your notification preferences are saved.",
      tone: "success",
    });
    setWorking(null);
  }

  const permissionCopy = {
    granted: {
      title: "Allowed on this browser",
      body: "This browser can receive the categories you enable below.",
    },
    denied: {
      title: "Blocked in browser settings",
      body: "Open the site permissions in your browser settings if you would like to allow notifications.",
    },
    default: {
      title: "Not requested yet",
      body: "We will show the browser prompt only after you choose Enable push.",
    },
    unsupported: {
      title: "Unavailable here",
      body: "This browser does not support web push. On iPhone and iPad, install the app from Safari’s Share menu first.",
    },
  }[permission];

  return (
    <div className="mt-8 space-y-8">
      <section>
        <h2 className="text-sm font-bold">{permissionCopy.title}</h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">
          {permissionCopy.body}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pushEnabled ? disablePush : enablePush}
            disabled={working === "push" || permission === "unsupported"}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            {working === "push" ? (
              <SpinnerGap size={17} className="animate-spin" aria-hidden="true" />
            ) : (
              <BellRinging size={17} aria-hidden="true" />
            )}
            {pushEnabled ? "Turn off push" : "Enable push"}
          </button>
          <button
            type="button"
            onClick={sendTestNotification}
            disabled={!pushEnabled || working === "test"}
            className="inline-flex h-12 items-center gap-2 rounded-2xl px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <PaperPlaneTilt size={17} aria-hidden="true" />
            Send a test
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">What should arrive?</h2>
        <div className="mt-2 divide-y divide-ink/[0.055]">
          <SwitchControl
            checked={overdueContactEnabled}
            onChange={setOverdueContactEnabled}
            label="People to check in with"
            description="A person is past the reminder interval you chose."
          />
          <SwitchControl
            checked={birthdayEnabled}
            onChange={setBirthdayEnabled}
            label="Upcoming birthdays"
            description="A birthday is approaching."
          />
          <SwitchControl
            checked={reminderEnabled}
            onChange={setReminderEnabled}
            label="Reminders"
            description="A reminder is due or overdue."
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold">Preferred local time</h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">
          The scheduler evaluates this in your saved timezone. Actual delivery can
          vary slightly by provider and device state.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred local time">
          {reminderHourOptions(reminderHour).map((hour) => {
            const selected = reminderHour === hour;
            return (
              <button
                key={hour}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setReminderHour(hour)}
                className={clsx(
                  "h-11 min-w-[4rem] rounded-2xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                  selected ? "bg-ink text-white" : "bg-mist text-ink",
                )}
              >
                {formatReminderHour(hour)}
              </button>
            );
          })}
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">Reminder days</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {weekDays.map(({ value, label }) => {
              const selected = days.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDays((currentDays) =>
                      currentDays.includes(value)
                        ? currentDays.filter((day) => day !== value)
                        : [...currentDays, value].sort(),
                    )
                  }
                  className={clsx(
                    "h-10 min-w-[3rem] rounded-lg px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                    selected ? "bg-sage-strong text-white" : "bg-mist text-ink",
                  )}
                  aria-pressed={selected}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {days.length === 0 ? (
            <p className="mt-2 text-xs text-coral-strong">
              Choose at least one day.
            </p>
          ) : null}
        </fieldset>

        <button
          type="button"
          onClick={savePreferences}
          disabled={working === "save" || days.length === 0}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {working === "save" ? (
            <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
          ) : null}
          Save preferences
        </button>
      </section>

      <section>
        <h2 className="text-sm font-bold">What to expect</h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-ink-muted">
          Focus modes and battery saving can delay or hide alerts. Push needs a
          network connection.
        </p>
        <p className="mt-2 max-w-lg text-sm leading-6 text-ink-muted">
          On iPhone and iPad, install the app from Safari’s Share menu before
          enabling notifications.
        </p>
      </section>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-6",
            message.tone === "success"
              ? "bg-sage text-sage-strong"
              : "bg-[#fbe5e0] text-coral-strong",
          )}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
