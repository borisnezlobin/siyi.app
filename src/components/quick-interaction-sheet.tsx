"use client";

import { UpdateSheet } from "@/components/update-sheet";

type QuickInteractionSheetProps = {
  personId: string;
  personName: string;
  buttonLabel?: string;
  compact?: boolean;
};

export function QuickInteractionSheet({
  personId,
  personName,
  buttonLabel = "Add update",
  compact = false,
}: QuickInteractionSheetProps) {
  return (
    <UpdateSheet
      personId={personId}
      personName={personName}
      buttonLabel={buttonLabel}
      variant={compact ? "compact" : "primary"}
    />
  );
}
