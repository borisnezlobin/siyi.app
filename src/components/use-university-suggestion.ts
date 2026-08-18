"use client";

import { useEffect, useState } from "react";

type ResolvedSuggestion = {
  /** The school's full name, ready to accept. */
  name: string;
  /** The sentence explaining where the answer came from. */
  note: string;
};

/**
 * Recognising somebody's school from their email address, without paying for
 * the college table to find out.
 *
 * `university-suggestion` reaches the megabyte-plus college data, so importing
 * it at the top of a form put that data in the form's own chunk. Settings is a
 * tab in the bottom bar, so that was a megabyte parsed on the main thread of a
 * tap, to fill in a field that is usually already answered.
 *
 * The module is loaded only once there is a blank field to fill. The suggestion
 * arrives a moment after the form does, which is the right order anyway: it is
 * an offer, not part of the page.
 *
 * The shared library itself is untouched — the phone bundles it whole and has
 * no chunks to split it into, so the deferral belongs here rather than in a
 * signature both platforms would have to carry.
 */
export function useUniversitySuggestion(
  accountEmail: string,
  currentValue: string | null | undefined,
): ResolvedSuggestion | null {
  const [suggestion, setSuggestion] = useState<ResolvedSuggestion | null>(null);
  const filled = Boolean((currentValue ?? "").trim());

  useEffect(() => {
    // Anything already there is an answer, not a gap to fill — and a reason not
    // to fetch the table at all.
    if (filled || !accountEmail) {
      setSuggestion(null);
      return;
    }

    let stillMounted = true;
    void import("@/lib/university-suggestion").then(
      ({ suggestUniversityFromEmail, universitySuggestionNote }) => {
        if (!stillMounted) return;
        const match = suggestUniversityFromEmail(accountEmail, currentValue);
        setSuggestion(
          match
            ? { name: match.name, note: universitySuggestionNote(match.domain) }
            : null,
        );
      },
    );

    return () => {
      stillMounted = false;
    };
  }, [accountEmail, currentValue, filled]);

  return suggestion;
}
