"use client";

import { Check, Copy, SpinnerGap } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ConnectRipple } from "@/components/connect-ripple";
import {
  buildProfileUrl,
  formatHandle,
  handleProblem,
  handleProblemMessages,
  normalizeHandle,
} from "@/lib/handles";
import { getApiResponseError, readJsonResponse } from "@/lib/http";
import { ownCardFields, ownCardLabels, type OwnCard } from "@/lib/own-card";

const inputClassName =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

type SavedProfile = {
  handle: string | null;
  handle_tag: string | null;
  profile_public: boolean;
  public_fields: Record<string, boolean> | null;
};

/**
 * Your page: an address you can say out loud, and the choice of what is on it.
 *
 * Everything starts off. Turning the page on with nothing ticked publishes a
 * name and nothing else, which is the safe end of the dial to start from.
 */
export function ProfileControls({
  initialHandle,
  initialTag,
  initialPublic,
  initialPublicFields,
  card,
}: {
  initialHandle: string;
  initialTag: string;
  initialPublic: boolean;
  initialPublicFields: Record<string, boolean>;
  card: OwnCard;
}) {
  const [handle, setHandle] = useState(initialHandle);
  const [tag, setTag] = useState(initialTag);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [publicFields, setPublicFields] = useState(initialPublicFields);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  const url = useMemo(
    () =>
      tag && handle
        ? buildProfileUrl(
            typeof window === "undefined" ? "https://www.siyi.app" : window.location.origin,
            handle,
            tag,
          )
        : "",
    [handle, tag],
  );

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let stillMounted = true;
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 320,
      color: { dark: "#17201c", light: "#00000000" },
    }).then((image) => {
      if (stillMounted) setQr(image);
    });
    return () => {
      stillMounted = false;
    };
  }, [url]);

  async function save(changes: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "That could not be saved."),
        );
      }
      const result = await readJsonResponse<{ profile?: SavedProfile }>(response);
      if (result?.profile) {
        setHandle(result.profile.handle ?? "");
        setTag(result.profile.handle_tag ?? "");
        setIsPublic(result.profile.profile_public);
        setPublicFields(result.profile.public_fields ?? {});
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "That could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const problem = handle ? handleProblem(handle) : null;

  return (
    <div>
      <label className="block text-xs font-semibold text-ink-muted">
        Your handle
        <div className="mt-1.5 flex gap-2">
          <input
            value={handle}
            onChange={(event) => setHandle(normalizeHandle(event.target.value))}
            placeholder="boris.nezlobin"
            maxLength={30}
            className={inputClassName}
          />
          <button
            type="button"
            onClick={() => void save({ handle })}
            disabled={saving || Boolean(problem) || !handle}
            className="h-12 shrink-0 rounded-2xl bg-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-ink/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {saving ? "Saving…" : tag ? "Update" : "Claim"}
          </button>
        </div>
      </label>

      {problem ? (
        <p className="mt-2 text-xs text-coral-strong">{handleProblemMessages[problem]}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-coral-strong">{error}</p> : null}

      {tag ? (
        <>
          <p className="mt-3 break-all font-mono text-xs leading-5 text-ink">{url}</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            People can find you as{" "}
            <span className="font-semibold text-ink">{formatHandle(handle, tag)}</span>.
            The four characters keep your page from being guessed by name alone,
            and stay the same if you rename yourself.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-porcelain px-4 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {copied ? (
                <Check size={15} weight="bold" aria-hidden="true" />
              ) : (
                <Copy size={15} weight="bold" aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          <div className="mt-4">
            <div>
              {qr ? (
                <div className="relative w-fit overflow-hidden rounded-3xl bg-white p-8 shadow-card ring-1 ring-black/[0.035]">
                  <ConnectRipple size={264} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr}
                    alt={`QR code for ${formatHandle(handle, tag)}`}
                    width={200}
                    height={200}
                    className="relative size-[200px]"
                  />
                </div>
              ) : (
                <SpinnerGap size={20} className="animate-spin text-ink-muted" aria-hidden="true" />
              )}
            </div>
          </div>

          <div className="mt-6 flex items-start justify-between gap-4 rounded-2xl bg-porcelain p-4">
            <div>
              <p className="text-xs font-semibold text-ink">Turn my page on</p>
              <p className="mt-1 text-[11px] leading-4 text-ink-muted">
                Anyone with the address can read it. Off means it is nobody&apos;s.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              aria-label="Turn my page on"
              onClick={() => void save({ isPublic: !isPublic })}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 ${
                isPublic ? "bg-sage-strong" : "bg-ink/15"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-all ${
                  isPublic ? "left-[1.375rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <fieldset className="mt-5">
            <legend className="text-xs font-semibold text-ink-muted">
              What goes on it
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {ownCardFields.map((field) => {
                const on = publicFields[field] === true;
                const filled = Boolean(card[field]);
                return (
                  <button
                    key={field}
                    type="button"
                    aria-pressed={on}
                    disabled={!filled}
                    onClick={() =>
                      void save({
                        publicFields: { ...publicFields, [field]: !on },
                      })
                    }
                    title={filled ? undefined : "Fill this in below first"}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                      on ? "bg-ink text-white" : "bg-ink/[0.06] text-ink-muted hover:bg-ink/10"
                    }`}
                  >
                    {ownCardLabels[field]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}
