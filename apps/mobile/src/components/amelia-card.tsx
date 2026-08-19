import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Card, SectionHeading } from "@/components/surface";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  fetchAmeliaOverview,
  importAmeliaConversation,
  linkAmeliaSpeaker,
  unlinkAmeliaSpeaker,
  type AmeliaOverview,
} from "@/lib/amelia-data";
import { relativeDateLabel } from "@/lib/relative-time";
import { useAuth } from "@/providers/auth-provider";

type BusyAction = "unlink" | `link:${string}` | `import:${string}` | null;

/**
 * The bridge to Amelia, the conversation-capture service — the same section
 * the web person page shows. Renders nothing at all when Amelia is not
 * configured, so the section only exists for people running the service.
 */
export function AmeliaCard({
  personId,
  personName,
  onImported,
}: {
  personId: string;
  personName: string;
  onImported: () => void;
}) {
  const { session } = useAuth();
  const [overview, setOverview] = useState<AmeliaOverview | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  // Every response checks it still belongs to the mounted personId before it
  // writes state, so a slow reply for the previous person cannot land on the
  // next one, and nothing writes after unmount.
  const activePersonId = useRef<string | null>(null);

  useEffect(() => {
    activePersonId.current = personId;
    setOverview(null);
    setError(null);
    if (session) {
      void fetchAmeliaOverview(session, brand.webUrl, personId).then((next) => {
        if (activePersonId.current === personId && next) setOverview(next);
      });
    }
    return () => {
      activePersonId.current = null;
    };
  }, [personId, session]);

  if (!session || !overview?.configured) return null;

  const act = async (action: BusyAction, run: () => Promise<void>) => {
    setBusy(action);
    setError(null);
    try {
      await run();
      const next = await fetchAmeliaOverview(session, brand.webUrl, personId);
      if (activePersonId.current !== personId) return;
      if (next) setOverview(next);
      onImported();
    } catch (actionError) {
      if (activePersonId.current !== personId) return;
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Something went wrong.",
      );
    } finally {
      if (activePersonId.current === personId) setBusy(null);
    }
  };

  const linkableSpeakers = (overview.people ?? []).filter(
    (speaker) => !speaker.linked,
  );
  const linkedSpeakerName = overview.link
    ? (overview.people ?? []).find(
        (speaker) => speaker.id === overview.link?.ameliaPersonId,
      )?.name
    : null;
  const conversations = overview.conversations ?? [];

  return (
    <View style={styles.section}>
      <SectionHeading title="Conversations" />
      <Card style={styles.card}>
        {!overview.reachable ? (
          <AppText variant="caption">
            Amelia is not reachable right now.
          </AppText>
        ) : overview.link ? (
          <>
            <View style={styles.linkedRow}>
              <AppText style={styles.linkedLabel} variant="caption">
                Voice linked to {linkedSpeakerName ?? personName} in Amelia.
              </AppText>
              <Pressable
                accessibilityLabel="Unlink voice"
                accessibilityRole="button"
                disabled={busy !== null}
                hitSlop={8}
                onPress={() => void act("unlink", () =>
                  unlinkAmeliaSpeaker(session, brand.webUrl, personId),
                )}
              >
                <AppText style={styles.unlink} variant="caption">
                  {busy === "unlink" ? "Unlinking…" : "Unlink"}
                </AppText>
              </Pressable>
            </View>
            {conversations.length === 0 ? (
              <AppText variant="caption">
                No captured conversations with them yet.
              </AppText>
            ) : (
              conversations.map((conversation) => (
                <View key={conversation.id} style={styles.row}>
                  <View style={styles.rowBody}>
                    <AppText variant="body">
                      {conversation.title ?? "Untitled conversation"}
                    </AppText>
                    <AppText variant="caption">
                      {relativeDateLabel(conversation.startedAt)} ·{" "}
                      {conversation.participants.join(", ")}
                    </AppText>
                  </View>
                  {conversation.imported ? (
                    <AppText variant="caption">Imported</AppText>
                  ) : (
                    <Pressable
                      accessibilityLabel={`Import ${
                        conversation.title ?? "conversation"
                      }`}
                      accessibilityRole="button"
                      disabled={busy !== null}
                      onPress={() =>
                        void act(`import:${conversation.id}`, () =>
                          importAmeliaConversation(
                            session,
                            brand.webUrl,
                            conversation.id,
                          ),
                        )
                      }
                      style={styles.importButton}
                    >
                      <AppText style={styles.importLabel} variant="caption">
                        {busy === `import:${conversation.id}`
                          ? "Importing…"
                          : "Import"}
                      </AppText>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </>
        ) : linkableSpeakers.length ? (
          <>
            <AppText variant="caption">
              Link {personName} to a voice Amelia has heard.
            </AppText>
            {linkableSpeakers.map((speaker) => (
              <Pressable
                accessibilityLabel={`Link ${speaker.name}`}
                accessibilityRole="button"
                disabled={busy !== null}
                key={speaker.id}
                onPress={() =>
                  void act(`link:${speaker.id}`, () =>
                    linkAmeliaSpeaker(
                      session,
                      brand.webUrl,
                      personId,
                      speaker.id,
                    ),
                  )
                }
                style={styles.row}
              >
                <View style={styles.rowBody}>
                  <AppText variant="body">{speaker.name}</AppText>
                </View>
                <AppText style={styles.importLabel} variant="caption">
                  {busy === `link:${speaker.id}` ? "Linking…" : "Link voice"}
                </AppText>
              </Pressable>
            ))}
          </>
        ) : (
          <AppText variant="caption">
            No unlinked Amelia speakers to connect yet.
          </AppText>
        )}
        {error ? (
          <AppText style={styles.error} variant="caption">
            {error}
          </AppText>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 11,
  },
  card: {
    gap: 9,
  },
  linkedRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  linkedLabel: {
    flex: 1,
  },
  unlink: {
    color: colors.inkMuted,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 12,
    padding: 13,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  importButton: {
    minHeight: 32,
    justifyContent: "center",
  },
  importLabel: {
    color: colors.coralStrong,
  },
  error: {
    color: colors.coralStrong,
  },
});
