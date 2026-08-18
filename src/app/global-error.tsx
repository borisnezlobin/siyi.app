"use client";

import { Manrope, Newsreader } from "next/font/google";
import { ErrorRecovery } from "@/components/error-recovery";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

/**
 * The root layout is what fails when a browser is running an old build against
 * a new one, and a failed root layout takes `error.tsx` down with it — the only
 * boundary above it is this one. Without it that case fell through to Next's
 * own unstyled error page, which offers nothing to press.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manrope.variable} ${newsreader.variable} ${manrope.className} antialiased`}
      >
        <ErrorRecovery error={error} reset={reset} />
      </body>
    </html>
  );
}
