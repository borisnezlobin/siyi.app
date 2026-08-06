import { maxNoteBodyLength, normalizeNoteHeading } from "@/lib/note-sections";

export type NoteText = { heading: string; body: string };

export type NoteConflictResolution = {
  heading: string;
  body: string;
  /**
   * When both versions cannot fit in one section, ours becomes a section of
   * its own instead of being trimmed away.
   */
  spillover: NoteText | null;
};

/**
 * A note edit made on the phone, applied to whatever the section looks like by
 * the time the edit reaches the server.
 *
 * When nobody else touched the section, the phone's version wins outright.
 * When someone did, both versions are kept: the newer text stays where it is
 * and the phone's version is added below it, clearly marked. Nothing anyone
 * wrote is ever dropped.
 */
export function resolveNoteConflict({
  base,
  ours,
  remote,
}: {
  base: NoteText;
  ours: NoteText;
  remote: NoteText | null;
}): NoteConflictResolution {
  const ourHeading = normalizeNoteHeading(ours.heading);
  if (!remote) {
    return { heading: ourHeading, body: ours.body, spillover: null };
  }

  const baseHeading = normalizeNoteHeading(base.heading);
  const remoteHeading = normalizeNoteHeading(remote.heading);
  const theyRenamed = remoteHeading !== baseHeading;
  const weRenamed = ourHeading !== baseHeading;
  const headingsClash = theyRenamed && weRenamed && remoteHeading !== ourHeading;
  const heading = headingsClash
    ? remoteHeading
    : weRenamed
      ? ourHeading
      : remoteHeading;

  if (remote.body === base.body || remote.body === ours.body) {
    return { heading, body: ours.body, spillover: null };
  }
  if (ours.body === base.body) {
    return { heading, body: remote.body, spillover: null };
  }

  const marker = headingsClash
    ? `Also written on your phone, under “${ourHeading}”:`
    : "Also written on your phone:";
  const merged = `${remote.body}\n\n${marker}\n${ours.body}`;

  if (merged.length <= maxNoteBodyLength) {
    return { heading, body: merged, spillover: null };
  }

  return {
    heading,
    body: remote.body,
    spillover: {
      heading: normalizeNoteHeading(`${ourHeading} (from your phone)`).slice(
        0,
        60,
      ),
      body: ours.body,
    },
  };
}
