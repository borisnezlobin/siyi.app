"use client";

import { Check, Copy, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import { brand } from "@/config/brand";
import { referralShareMessage, referralUrl } from "@/lib/referral";

/**
 * Your code, the link it makes, and how many people have used it.
 *
 * The count is deliberately the only number here. A leaderboard of everyone
 * would mean showing one user how another is doing, and the people being
 * counted never agreed to appear in anyone's ranking.
 */
export function ReferralControl({
  code,
  joined,
  baseUrl,
}: {
  code: string | null;
  joined: number;
  baseUrl: string;
}) {
  const [copied, setCopied] = useState<"link" | "message" | null>(null);

  if (!code) {
    return (
      <section className="rounded-[1.5rem] bg-white p-6 shadow-card">
        <h2 className="font-display text-2xl tracking-[-0.02em]">
          Invite a friend
        </h2>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          Your invite link could not be created just now. Reload the page and it
          should be here.
        </p>
      </section>
    );
  }

  const link = referralUrl(baseUrl, code);

  async function copy(what: "link" | "message") {
    const text = what === "link" ? link : referralShareMessage(code!, baseUrl);
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section className="rounded-[1.5rem] bg-white p-6 shadow-card">
      <h2 className="font-display text-2xl tracking-[-0.02em]">
        Invite a friend
      </h2>
      <p className="mt-2 text-sm leading-7 text-ink-muted">
        {brand.shortName} is more useful when the people around you keep track
        too. Send this to someone who keeps saying they should text you back.
      </p>

      <div className="mt-5 rounded-2xl bg-porcelain p-4">
        <span className="text-xs font-semibold text-ink-muted">Your code</span>
        <p className="mt-1 font-display text-3xl tracking-[0.12em]">{code}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => copy("link")}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {copied === "link" ? (
            <Check size={16} weight="bold" />
          ) : (
            <Copy size={16} weight="bold" />
          )}
          {copied === "link" ? "Link copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => copy("message")}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-porcelain px-5 text-sm font-semibold text-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {copied === "message" ? (
            <Check size={16} weight="bold" />
          ) : null}
          {copied === "message" ? "Message copied" : "Copy a message"}
        </button>
      </div>

      <p className="mt-4 inline-flex items-center gap-2 text-sm text-ink-muted">
        <UsersThree size={17} weight="fill" className="text-sage-strong" />
        {joined === 0
          ? "Nobody has joined on your code yet."
          : `${joined} ${joined === 1 ? "person has" : "people have"} joined on your code.`}
      </p>
    </section>
  );
}
