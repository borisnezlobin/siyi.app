import { interactionLabels } from "@/lib/interaction-labels";
import type { InteractionType } from "@/lib/types";
import type { InteractionEdit, PersonUpdateEdit } from "@/lib/validation";

/**
 * The order these writes happen in is the whole point of this module, so it is
 * kept away from the network code and driven through a small client the tests
 * can stand in for.
 */

export type StoredUpdateRow = {
  id: string;
  isInteraction: boolean;
  text: string;
  updatedAt: string;
};

export type StoredInteractionRow = {
  id: string;
  sourceUpdateId: string | null;
  note: string | null;
  updatedAt: string;
};

export type LinkedInteractionFields = {
  type: InteractionType;
  occurredAt: string;
  note: string;
  customLabel: string | null;
  customIcon: string | null;
};

export type UpdateFields = {
  text: string;
  recordedAt: string;
  interactionLabel?: string;
};

export type UpdateWriteClient = {
  loadUpdate: (updateId: string) => Promise<StoredUpdateRow | null>;
  writeLinkedInteractions: (
    updateId: string,
    fields: LinkedInteractionFields,
  ) => Promise<void>;
  writeUpdate: (updateId: string, fields: UpdateFields) => Promise<void>;
  deleteLinkedInteractions: (updateId: string) => Promise<void>;
  deleteUpdate: (updateId: string) => Promise<void>;
  loadInteraction: (
    interactionId: string,
  ) => Promise<StoredInteractionRow | null>;
  writeInteraction: (
    interactionId: string,
    fields: LinkedInteractionFields,
  ) => Promise<void>;
  deleteInteraction: (interactionId: string) => Promise<void>;
};

export type WriteOutcome =
  | "written"
  | "merged"
  | "deleted"
  | "gone"
  | "owned-by-update";

export const ownedByUpdateMessage =
  "Edit this from the update it belongs to so both stay in step.";

const keptBothHeading = "Also saved on this phone:";

/**
 * A queued edit that reaches a row somebody has already changed keeps both
 * versions in the one entry. Losing either would mean losing something the
 * user actually wrote, and a phone with no network has no way to ask.
 */
export function mergeKeepingBoth(serverText: string, queuedText: string) {
  const server = serverText.trim();
  const queued = queuedText.trim();
  if (!queued || server === queued) return server;
  if (!server) return queued;
  // A retry after a write that landed but was never acknowledged must not
  // append the same words twice.
  if (server.includes(queued)) return server;
  return `${server}\n\n${keptBothHeading}\n${queued}`;
}

function labelForType(type: InteractionType) {
  return interactionLabels[type] ?? "Update";
}

function changedUnderneath(
  baseUpdatedAt: string | null,
  currentUpdatedAt: string,
) {
  return baseUpdatedAt !== null && baseUpdatedAt !== currentUpdatedAt;
}

/**
 * The linked interactions move first, because they carry the date reminders are
 * measured from. If the second write fails, the visible text is merely stale and
 * running the whole thing again re-applies both — far better than a reminder
 * pointing at a date the user can no longer see.
 */
export async function applyPersonUpdateEdit(
  client: UpdateWriteClient,
  input: {
    updateId: string;
    baseUpdatedAt: string | null;
    edit: PersonUpdateEdit;
  },
): Promise<WriteOutcome> {
  const existing = await client.loadUpdate(input.updateId);
  if (!existing) return "gone";

  const conflicted = changedUnderneath(
    input.baseUpdatedAt,
    existing.updatedAt,
  );
  const text = conflicted
    ? mergeKeepingBoth(existing.text, input.edit.text)
    : input.edit.text;

  if (existing.isInteraction) {
    await client.writeLinkedInteractions(input.updateId, {
      type: input.edit.type,
      occurredAt: input.edit.recordedAt,
      note: text,
      customLabel: input.edit.customLabel,
      customIcon: input.edit.customIcon,
    });
  }

  await client.writeUpdate(input.updateId, {
    text,
    recordedAt: input.edit.recordedAt,
    ...(existing.isInteraction && {
      interactionLabel: input.edit.customLabel || labelForType(input.edit.type),
    }),
  });

  return conflicted ? "merged" : "written";
}

/**
 * The interactions go first here too, but for the opposite reason: the foreign
 * key only nulls source_update_id, so removing the update first would leave its
 * interactions behind as their own timeline entries. The update would look
 * deleted, then reappear.
 */
export async function applyPersonUpdateDelete(
  client: UpdateWriteClient,
  updateId: string,
): Promise<WriteOutcome> {
  await client.deleteLinkedInteractions(updateId);
  await client.deleteUpdate(updateId);
  return "deleted";
}

/**
 * Only entries that stand on their own are editable directly. One the database
 * created from a multi-person update is kept in step with that update instead,
 * so editing it here would put the two out of sync.
 */
export async function applyInteractionEdit(
  client: UpdateWriteClient,
  input: {
    interactionId: string;
    baseUpdatedAt: string | null;
    edit: InteractionEdit;
  },
): Promise<WriteOutcome> {
  const existing = await client.loadInteraction(input.interactionId);
  if (!existing) return "gone";
  if (existing.sourceUpdateId) return "owned-by-update";

  const conflicted = changedUnderneath(
    input.baseUpdatedAt,
    existing.updatedAt,
  );
  const note = conflicted
    ? mergeKeepingBoth(existing.note ?? "", input.edit.note ?? "")
    : input.edit.note ?? "";

  await client.writeInteraction(input.interactionId, {
    type: input.edit.type,
    occurredAt: input.edit.occurredAt,
    note,
    customLabel: input.edit.customLabel,
    customIcon: input.edit.customIcon,
  });

  return conflicted ? "merged" : "written";
}

export async function applyInteractionDelete(
  client: UpdateWriteClient,
  interactionId: string,
): Promise<WriteOutcome> {
  const existing = await client.loadInteraction(interactionId);
  if (!existing) return "gone";
  if (existing.sourceUpdateId) return "owned-by-update";

  await client.deleteInteraction(interactionId);
  return "deleted";
}

/** The queued shapes this module knows how to replay. */
export type QueuedUpdateMutation =
  | {
      kind: "edit-person-update";
      updateId: string;
      baseUpdatedAt: string | null;
      input: PersonUpdateEdit;
    }
  | { kind: "delete-person-update"; updateId: string }
  | {
      kind: "edit-interaction";
      interactionId: string;
      baseUpdatedAt: string | null;
      input: InteractionEdit;
    }
  | { kind: "delete-interaction"; interactionId: string };

const queuedUpdateKinds = [
  "edit-person-update",
  "delete-person-update",
  "edit-interaction",
  "delete-interaction",
];

export function isQueuedUpdateMutation(
  mutation: { kind: string },
): mutation is QueuedUpdateMutation {
  return queuedUpdateKinds.includes(mutation.kind);
}

export async function replayQueuedUpdateMutation(
  client: UpdateWriteClient,
  mutation: QueuedUpdateMutation,
): Promise<WriteOutcome> {
  if (mutation.kind === "edit-person-update") {
    return applyPersonUpdateEdit(client, {
      updateId: mutation.updateId,
      baseUpdatedAt: mutation.baseUpdatedAt,
      edit: mutation.input,
    });
  }
  if (mutation.kind === "delete-person-update") {
    return applyPersonUpdateDelete(client, mutation.updateId);
  }
  if (mutation.kind === "edit-interaction") {
    return applyInteractionEdit(client, {
      interactionId: mutation.interactionId,
      baseUpdatedAt: mutation.baseUpdatedAt,
      edit: mutation.input,
    });
  }
  return applyInteractionDelete(client, mutation.interactionId);
}
