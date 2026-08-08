"use client";

import { CaretRight, Check, Copy, SpinnerGap } from "@phosphor-icons/react";
import Link from "next/link";
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

const inputClassName =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

type SavedProfile = {
  handle: string | null;
  handle_tag: string | null;
  profile_public: boolean;
  public_fields: Record<string, boolean> | null;
};

/**
 * Your page: the switch that publishes it, the code and address people reach it
 * at, and the way through to choosing what is on it.
 *
 * The switch comes first because everything under it only means something while
 * the page exists — so with it off, the rest is gone rather than greyed. A
 * disabled control still invites you to try it; an absent one asks the only
 * question worth asking, which is whether you want a page at all.
 */
export function ProfileControls({
  initialHandle,
  initialTag,
  initialPublic,
}: {
  initialHandle: string;
  initialTag: string;
  initialPublic: boolean;
}) {
  const [handle, setHandle] = useState(initialHandle);
  const [tag, setTag] = useState(initialTag);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  // The flourish plays once when the page appears and then gets out of the way.
  // Left running it moves light across the code while someone is trying to scan.
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
    if (!url || !isPublic) {
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
  }, [url, isPublic]);

  useEffect(() => {
    if (!isPublic) return;
    setRevealing(true);
    const done = window.setTimeout(() => setRevealing(false), 1100);
    return () => window.clearTimeout(done);
  }, [isPublic]);

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
      <div
        className={`flex items-center justify-between gap-4 ${
          isPublic ? "border-b border-ink/[0.08] pb-5" : ""
        }`}
      >
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

      {isPublic ? (
        <div className="mt-6">
          {tag ? (
            <>
              <div className="flex justify-center">
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
                  <SpinnerGap
                    size={20}
                    className="animate-spin text-ink-muted"
                    aria-hidden="true"
                  />
                )}
              </div>

              <p className="mt-5 text-xs leading-5 text-ink-muted">
                People can find you at{" "}
                <span className="break-all font-mono text-ink">{url}</span>
              </p>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-3 inline-flex h-11 items-center gap-2 rounded-2xl bg-porcelain px-4 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                {copied ? (
                  <Check size={15} weight="bold" aria-hidden="true" />
                ) : (
                  <Copy size={15} weight="bold" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy link"}
              </button>
            </>
          ) : null}

          <label className={`block text-xs font-semibold text-ink-muted ${tag ? "mt-6" : ""}`}>
            Your handle
            <div className="mt-1.5 flex gap-2">
              <input
                value={handle}
                onChange={(event) => setHandle(normalizeHandle(event.target.value))}
                placeholder="alex.vale"
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

          <Link
            href="/settings/card"
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-ink hover:text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Configure what gets shared
            <CaretRight size={14} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {!isPublic && error ? (
        <p className="mt-4 text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
