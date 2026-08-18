"use client";

import { ErrorRecovery } from "@/components/error-recovery";

/**
 * A page inside the shell failing should cost you that page, not the app. This
 * boundary keeps the nav on screen, so the way out is the tab bar rather than
 * the two buttons on the card.
 */
export default function AuthenticatedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorRecovery error={error} reset={reset} standalone={false} />;
}
