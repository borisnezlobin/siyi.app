"use client";

import {
  BellRinging,
  BellSlash,
  CheckCircle,
  Info,
  PaperPlaneTilt,
  SpinnerGap,
  WarningCircle,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { SwitchControl } from "@/components/switch-control";

type PermissionState = NotificationPermission | "unsupported";

const weekDays = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
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
  followUpEnabled: boolean;
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
  const [followUpEnabled, setFollowUpEnabled] = useState(
    initialPreferences.followUpEnabled,
  );
  const [reminderHour, setReminderHour] = useState(
    String(initialPreferences.reminderHourLocal),
  );
  const [days, setDays] = useState(initialPreferences.reminderDaysOfWeek);
  const [working, setWorking] = useState<"push" | "test" | "save" | null>(null);
  const [message, setMessage] = useState("");

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
    setMessage("");

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
          setMessage("Push is enabled for this preview.");
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
      setMessage("Push notifications are enabled.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Push could not be enabled.",
      );
    }

    setWorking(null);
  }

  async function disablePush() {
    setWorking("push");
    setMessage("");
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
    setMessage("Push notifications are off on this browser.");
    setWorking(null);
  }

  async function sendTestNotification() {
    setWorking("test");
    setMessage("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/push/test", { method: "POST" });
      setMessage(
        response.ok
          ? "Test notification sent."
          : "The test notification could not be sent.",
      );
    } else if (permission === "granted") {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("A gentle hello", {
        body: `${brand.name} notifications are working on this browser.`,
        icon: "/icon-192.png",
        data: { url: "/today" },
      });
      setMessage("Test notification sent.");
    } else {
      setMessage("Enable push before sending a test.");
    }

    setWorking(null);
  }

  async function savePreferences() {
    setWorking("save");
    setMessage("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pushEnabled,
          overdueContactEnabled,
          birthdayEnabled,
          followUpEnabled,
          reminderHourLocal: Number(reminderHour),
          reminderDaysOfWeek: days,
        }),
      });
      if (!response.ok) {
        setMessage("Preferences could not be saved.");
        setWorking(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    setMessage("Notification preferences saved.");
    setWorking(null);
  }

  const permissionCopy = {
    granted: "Allowed on this browser",
    denied: "Blocked in browser settings",
    default: "Not requested yet",
    unsupported: "Not supported on this browser",
  }[permission];

  return (
    <div className="mt-7 space-y-4">
      <section className="rounded-[1.75rem] bg-ink p-5 text-white shadow-float sm:p-6">
        <div className="flex items-start gap-4">
          <span
            className={clsx(
              "grid size-12 shrink-0 place-items-center rounded-full",
              pushEnabled ? "bg-sage text-sage-strong" : "bg-white/10 text-white",
            )}
          >
            {pushEnabled ? (
              <BellRinging size={23} weight="fill" aria-hidden="true" />
            ) : (
              <BellSlash size={23} aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {pushEnabled ? "Push is on" : "Stay in the loop"}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/62">
              {permissionCopy}. Permission is only requested when you choose to
              enable push.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pushEnabled ? disablePush : enablePush}
                disabled={working === "push" || permission === "unsupported"}
                className="inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
              >
                {working === "push" ? (
                  <SpinnerGap size={16} className="animate-spin" aria-hidden="true" />
                ) : pushEnabled ? (
                  <BellSlash size={16} aria-hidden="true" />
                ) : (
                  <BellRinging size={16} weight="fill" aria-hidden="true" />
                )}
                {pushEnabled ? "Turn off push" : "Enable push"}
              </button>
              <button
                type="button"
                onClick={sendTestNotification}
                disabled={!pushEnabled || working === "test"}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
              >
                <PaperPlaneTilt size={16} aria-hidden="true" />
                Send a test
              </button>
            </div>
          </div>
        </div>
      </section>

      {permission === "denied" ? (
        <div className="flex gap-3 rounded-2xl bg-[#fbe5e0] p-4 text-coral-strong">
          <WarningCircle size={20} className="shrink-0" aria-hidden="true" />
          <p className="text-xs leading-5">
            This browser has blocked notifications. Open the site permissions in
            your browser settings, allow notifications, then return here.
          </p>
        </div>
      ) : null}

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-sm font-bold">What should arrive?</h2>
        <div className="mt-2 divide-y divide-black/[0.055]">
          <SwitchControl
            checked={overdueContactEnabled}
            onChange={setOverdueContactEnabled}
            label="Contact reminders"
            description="When someone passes their chosen reminder interval."
          />
          <SwitchControl
            checked={birthdayEnabled}
            onChange={setBirthdayEnabled}
            label="Upcoming birthdays"
            description="A heads-up before a saved birthday."
          />
          <SwitchControl
            checked={followUpEnabled}
            onChange={setFollowUpEnabled}
            label="Follow-ups"
            description="For follow-ups that are due or overdue."
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-sm font-bold">Choose a calm time</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Reminders are evaluated in your saved timezone.
        </p>
        <label className="mt-4 block text-xs font-semibold text-ink-muted">
          Preferred local time
          <input
            type="time"
            value={`${reminderHour.padStart(2, "0")}:00`}
            onChange={(event) => setReminderHour(event.target.value.split(":")[0])}
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
        <fieldset className="mt-4">
          <legend className="text-xs font-semibold text-ink-muted">
            Reminder days
          </legend>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
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
                    "grid h-10 place-items-center rounded-xl text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                    selected
                      ? "bg-sage text-sage-strong"
                      : "bg-porcelain text-ink-muted",
                  )}
                  aria-pressed={selected}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <div className="flex gap-3 rounded-2xl bg-[#e5edf1] p-4 text-[#355468]">
        <Info size={20} className="shrink-0" aria-hidden="true" />
        <div className="text-xs leading-5">
          <p>
            On iPhone and iPad, install the app from Safari’s Share menu before
            enabling notifications. Browsers can pause delivery when battery
            saving or notification focus modes are active.
          </p>
        </div>
      </div>

      {message ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl bg-sage px-4 py-3 text-xs font-semibold text-sage-strong"
        >
          <CheckCircle size={17} weight="fill" aria-hidden="true" />
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={savePreferences}
        disabled={working === "save" || days.length === 0}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-[#28332e] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {working === "save" ? (
          <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
        ) : null}
        Save preferences
      </button>
    </div>
  );
}
