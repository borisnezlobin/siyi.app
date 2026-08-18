"use client";

import { CircleNotch, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useLinkStatus } from "next/link";

/**
 * What a tap looks like before the page arrives.
 *
 * `-webkit-tap-highlight-color: transparent` in globals.css removes the flash
 * the browser would have drawn, and nothing replaced it, so from finger-down
 * until the next screen painted the app was byte-identical to before the tap.
 * Anything slower than about a tenth of a second read as a dead button, and the
 * answer people reach for is to tap again.
 *
 * `useLinkStatus` has to be read from inside the Link it describes, which is
 * why the contents of every nav item live in here rather than in the shell.
 */
export function NavItemContents({
  icon: Icon,
  label,
  active,
  size,
}: {
  icon: PhosphorIcon;
  label: string;
  active: boolean;
  /** The tab bar, the sidebar and the account links each draw these at their
   *  own size, so the caller says which rather than this guessing from a name. */
  size: number;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? (
        <CircleNotch
          size={size}
          weight="bold"
          className="animate-spin"
          aria-hidden="true"
        />
      ) : (
        <Icon
          size={size}
          weight={active ? "fill" : "regular"}
          aria-hidden="true"
        />
      )}
      <span>{label}</span>
      {/* The spinner is decorative, so the pending state is said out loud
          here instead — otherwise the new feedback reaches everyone except
          the people who most need a tap acknowledged. */}
      {pending ? <span className="sr-only">Loading</span> : null}
    </>
  );
}
