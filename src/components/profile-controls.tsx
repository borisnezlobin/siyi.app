"use client";

import { Check, Copy, QrCode, SpinnerGap } from "@phosphor-icons/react";
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
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:bg-porcelain disabled:text-ink-muted";

type SavedProfile = {
  handle: string | null;
  handle_tag: string | null;
  profile_public: boolean;
  public_fields: Record<string, boolean> | null;
};

/**
 * Your page: the switch that publishes it, the address people reach it at, and
 * the choice of what is on it.
 *
 * The switch comes first because everything under it only means something while
 * the page exists. With it off the rest sits inside a disabled fieldset, so the
 * browser stops the controls working and announces them as disabled rather than
 * leaving them look-only grey.
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
  const [showQr, setShowQr] = useState(false);
  // The flourish plays once on reveal and then gets out of the way. Left
  // running it moves light across the code while someone is trying to scan it.
  const [revealing, setRevealing] = useState(false);

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
      margin: 4,
      width: 320,
      color: { dark: "#17201c", light: "#ffffff" },
    }).then((image) => {
      if (stillMounted) setQr(image);
    });
    return () => {
      stillMounted = false;
    };
  }, [url]);

  useEffect(() => {
    if (!showQr) return;
    setRevealing(true);
    const done = window.setTimeout(() => setRevealing(false), 1100);
    return () => window.clearTimeout(done);
  }, [showQr]);

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
      <div className="flex items-center justify-between gap-4 border-b border-ink/[0.08] pb-5">
        <p className="text-sm font-semibold text-ink">Enable shareable link</p>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          aria-label="Enable shareable link"
          onClick={() => void save({ isPublic: !isPublic })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 ${
            isPublic ? "bg-sage-strong" : "bg-ink/15"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${
              isPublic ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <fieldset
        disabled={!isPublic}
        className={`mt-6 transition-opacity ${isPublic ? "" : "opacity-45"}`}
      >
        {tag ? (
          <>
            <p className="text-xs leading-5 text-ink-muted">
              People can find you at{" "}
              <span className="break-all font-mono text-ink">{url}</span>
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
              <button
                type="button"
                onClick={() => setShowQr((open) => !open)}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-porcelain px-4 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <QrCode size={15} weight="bold" aria-hidden="true" />
                {showQr ? "Hide code" : "Show code"}
              </button>
            </div>

            {showQr ? (
              <div className="mt-4">
                {qr ? (
                  <div className="relative w-fit overflow-hidden rounded-3xl bg-white p-6 ring-1 ring-black/[0.035]">
                    {revealing ? <ConnectRipple size={248} /> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qr}
                      alt={`QR code for ${formatHandle(handle, tag)}`}
                      width={216}
                      height={216}
                      className="relative size-[216px] rounded-lg"
                    />
                  </div>
                ) : (
                  <SpinnerGap size={20} className="animate-spin text-ink-muted" aria-hidden="true" />
                )}
              </div>
            ) : null}
          </>
        ) : null}

        <label className={`block text-xs font-semibold text-ink-muted ${tag ? "mt-6" : ""}`}>
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

        <div className="mt-6">
          <p className="text-xs font-semibold text-ink-muted">What goes on it</p>
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
        </div>
      </fieldset>
    </div>
  );
}
