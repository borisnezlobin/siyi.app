"use client";

import { QuickCaptureTrigger } from "@/components/quick-capture-hub";

type QuickInteractionSheetProps = {
  personId: string;
  personName: string;
  buttonLabel?: string;
  compact?: boolean;
};

/**
 * The one-tap way to say "I saw them" from a list. It opens the interaction
 * composer with that person already chosen, so the rest can be skipped.
 */
export function QuickInteractionSheet({
  personId,
  personName,
  buttonLabel,
  compact = false,
}: QuickInteractionSheetProps) {
  return (
    <QuickCaptureTrigger
      mode="interaction"
      personId={personId}
      label={buttonLabel ?? `Log time with ${personName}`}
      compact={compact}
    />
  );
}
