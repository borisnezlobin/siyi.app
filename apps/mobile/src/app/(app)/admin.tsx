import * as Crypto from "expo-crypto";
import { ArrowLeft, CheckCircle, Megaphone, PaperPlaneTilt } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { DateField } from "@/components/date-field";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { Card, SectionHeading } from "@/components/surface";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  fetchAdminAnnouncements,
  fetchAdminOverview,
  publishAnnouncement,
  pushAnnouncement,
  type AdminSegmentSummary,
  type AdminStats,
  type Announcement,
} from "@/lib/admin-client";
import { dateFromDateInput } from "@/lib/date-input";
import { useAuth } from "@/providers/auth-provider";

/**
 * Deliberately unlisted, exactly as the web's /admin is: nothing links here,
 * and it is reached by deep link (siyi://admin). Anyone who is not on the
 * allowlist gets the same "not found" the web serves, because every admin
 * endpoint answers 404 rather than 403.
 */

function peopleLabel(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatCard({
  hint,
  label,
  value,
}: {
  hint?: string;
  label: string;
  value: number;
}) {
  return (
    <Card style={styles.statCard}>
      <AppText variant="caption">{label}</AppText>
      <AppText style={styles.statValue} variant="display">
        {String(value)}
      </AppText>
      {hint ? <AppText variant="caption">{hint}</AppText> : null}
    </Card>
  );
}

function DistributionBar({
  label,
  total,
  users,
}: {
  label: string;
  total: number;
  users: number;
}) {
  const share = total === 0 ? 0 : Math.round((users / total) * 100);
  return (
    <View style={styles.distributionRow}>
      <AppText style={styles.distributionLabel} variant="caption">
        {label}
      </AppText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share}%` }]} />
      </View>
      <AppText style={styles.distributionValue} variant="caption">
        {String(users)}
      </AppText>
    </View>
  );
}

export default function AdminScreen() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [segments, setSegments] = useState<AdminSegmentSummary[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segmentId, setSegmentId] = useState("all");
  const [endsAt, setEndsAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [dedupeKey, setDedupeKey] = useState(() => Crypto.randomUUID());
  const [publishing, setPublishing] = useState(false);
  const [pushConfirmId, setPushConfirmId] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keyed on the token rather than the session object: the auth context hands
  // back a fresh object on some renders, and re-running this would reload the
  // page and throw away a segment chosen mid-compose.
  const accessToken = session?.access_token;

  useEffect(() => {
    let cancelled = false;
    if (!session) return;

    void (async () => {
      const overview = await fetchAdminOverview(session, brand.webUrl);
      if (cancelled) return;
      if (overview) {
        setStats(overview.stats);
        setSegments(overview.segments);
        setSegmentId((current) =>
          overview.segments.some((segment) => segment.id === current)
            ? current
            : (overview.segments[0]?.id ?? "all"),
        );
        const sent = await fetchAdminAnnouncements(session, brand.webUrl);
        if (!cancelled) setAnnouncements(sent);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const selectedSegment =
    segments.find((segment) => segment.id === segmentId) ?? null;
  const audience = selectedSegment?.users ?? 0;
  const canReview = title.trim().length > 0 && body.trim().length > 0;

  const publish = useCallback(async () => {
    if (!session) return;
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      const endsAtDate = endsAt ? dateFromDateInput(endsAt) : null;
      const payload = await publishAnnouncement(session, brand.webUrl, {
        title: title.trim(),
        body: body.trim(),
        segment: segmentId,
        endsAt: endsAtDate ? endsAtDate.toISOString() : null,
        dedupeKey,
      });
      if (payload.announcement) {
        const published = payload.announcement;
        setAnnouncements((current) => [
          published,
          ...current.filter((item) => item.id !== published.id),
        ]);
      }
      setMessage(
        payload.alreadyCreated
          ? "That announcement was already published, so nothing was sent twice."
          : `Banner is live for ${peopleLabel(audience)}.`,
      );
      setTitle("");
      setBody("");
      setEndsAt("");
      setDedupeKey(Crypto.randomUUID());
      setConfirming(false);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "That announcement did not save.",
      );
    } finally {
      setPublishing(false);
    }
  }, [audience, body, dedupeKey, endsAt, segmentId, session, title]);

  const sendPush = useCallback(
    async (announcement: Announcement) => {
      if (!session) return;
      setPushingId(announcement.id);
      setError(null);
      setMessage(null);
      try {
        const payload = await pushAnnouncement(
          session,
          brand.webUrl,
          announcement.id,
        );
        if (payload.announcement) {
          const updated = payload.announcement;
          setAnnouncements((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
        }
        setMessage(
          `Pushed to ${peopleLabel(payload.recipients ?? 0)}: ${payload.delivered ?? 0} delivered, ${payload.failed ?? 0} failed.`,
        );
      } catch (pushError) {
        setError(
          pushError instanceof Error
            ? pushError.message
            : "That push did not go out.",
        );
      } finally {
        setPushingId(null);
        setPushConfirmId(null);
      }
    },
    [session],
  );

  if (loading) {
    return <Screen showBack title="Admin" />;
  }

  // Same answer the web gives someone who is not on the allowlist.
  if (!stats) {
    return (
      <Screen showBack title="Not found">
        <AppText style={styles.muted}>
          This page does not exist.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen
      showBack
      subtitle="Aggregate numbers, and a way to tell everyone something."
      title="Admin"
    >
      <SectionHeading title={`How ${brand.shortName} is doing`} />
      <AppText style={styles.muted}>
        Aggregates only. Nobody’s name, email, or contacts appear here.
      </AppText>
      <View style={styles.statGrid}>
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard
          hint={`${stats.newUsersLast30} in the last 30 days`}
          label="New this week"
          value={stats.newUsersLast7}
        />
        <StatCard
          hint={`${stats.activeLast30} in the last 30 days`}
          label="Active this week"
          value={stats.activeLast7}
        />
        <StatCard label="Push turned on" value={stats.pushEnabledUsers} />
        <StatCard label="Contacts saved" value={stats.totalContacts} />
        <StatCard
          label="Quiet 30 days"
          value={Math.max(0, stats.totalUsers - stats.activeLast30)}
        />
      </View>

      <Card style={styles.block}>
        <AppText variant="heading">Contacts per person</AppText>
        <View style={styles.distribution}>
          {stats.contactBuckets.map((bucket) => (
            <DistributionBar
              key={bucket.id}
              label={bucket.label}
              total={stats.totalUsers}
              users={bucket.users}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.block}>
        <AppText variant="heading">Send an announcement</AppText>
        <AppText style={styles.muted}>
          It shows as a dismissible banner inside the app. Push is a separate,
          deliberate step once the banner exists.
        </AppText>

        {confirming ? (
          <View style={styles.form}>
            <View style={styles.preview}>
              <AppText variant="label">{title}</AppText>
              <AppText style={styles.muted}>{body}</AppText>
            </View>
            <AppText>
              This banner will appear for {peopleLabel(audience)} in the segment
              “{selectedSegment?.label}”
              {endsAt && dateFromDateInput(endsAt)
                ? ` until ${formatDate(
                    (dateFromDateInput(endsAt) as Date).toISOString(),
                  )}`
                : ""}
              . No push notification goes out yet.
            </AppText>
            <Button
              icon={CheckCircle}
              label={
                publishing
                  ? "Publishing…"
                  : `Publish to ${peopleLabel(audience)}`
              }
              loading={publishing}
              onPress={() => void publish()}
            />
            <Button
              icon={ArrowLeft}
              label="Keep editing"
              onPress={() => setConfirming(false)}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.form}>
            <FormField
              label="Title"
              maxLength={120}
              onChangeText={setTitle}
              placeholder="Reminders now arrive on your phone"
              value={title}
            />
            <FormField
              label="Message"
              maxLength={1000}
              multiline
              onChangeText={setBody}
              placeholder="Turn on notifications in Settings and we will nudge you at a good hour."
              value={body}
            />
            <View>
              <AppText variant="label">Who sees it</AppText>
              <View style={styles.segmentRow}>
                {segments.map((segment) => {
                  const selected = segment.id === segmentId;
                  return (
                    <Pressable
                      accessibilityLabel={`${segment.label}, ${segment.users}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={segment.id}
                      onPress={() => setSegmentId(segment.id)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <AppText
                        style={selected ? styles.lightText : undefined}
                        variant="caption"
                      >
                        {segment.label} ({segment.users})
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {selectedSegment ? (
                <AppText style={styles.muted} variant="caption">
                  {selectedSegment.description}
                </AppText>
              ) : null}
            </View>
            <DateField
              hint="Leave this empty to keep it up until you take it down."
              label="Hide it after"
              onChangeText={setEndsAt}
              value={endsAt}
            />
            <Button
              disabled={!canReview}
              icon={Megaphone}
              label="Review before sending"
              onPress={() => setConfirming(true)}
            />
          </View>
        )}

        {message ? (
          <View style={styles.notice}>
            <AppText variant="caption">{message}</AppText>
          </View>
        ) : null}
        {error ? (
          <AppText style={styles.error} variant="caption">
            {error}
          </AppText>
        ) : null}
      </Card>

      <SectionHeading title="What has gone out" />
      {announcements.length === 0 ? (
        <AppText style={styles.muted}>Nothing sent yet.</AppText>
      ) : (
        announcements.map((announcement) => {
          const pushed = Boolean(announcement.pushSentAt);
          return (
            <Card key={announcement.id} style={styles.block}>
              <AppText variant="label">{announcement.title}</AppText>
              <AppText style={styles.muted}>{announcement.body}</AppText>
              <AppText variant="caption">
                {announcement.segment} · {announcement.audienceSize ?? 0} in
                segment at send time · {formatDate(announcement.createdAt)}
              </AppText>
              {pushed ? (
                <AppText variant="caption">
                  Pushed {formatDate(announcement.pushSentAt as string)} to{" "}
                  {announcement.pushRecipientCount ?? 0} ·{" "}
                  {announcement.pushDeliveredCount ?? 0} delivered,{" "}
                  {announcement.pushFailedCount ?? 0} failed
                </AppText>
              ) : pushConfirmId === announcement.id ? (
                <View style={styles.form}>
                  <Button
                    icon={PaperPlaneTilt}
                    label={
                      pushingId === announcement.id
                        ? "Sending…"
                        : `Yes, push to ${announcement.audienceSize ?? 0}`
                    }
                    loading={pushingId === announcement.id}
                    onPress={() => void sendPush(announcement)}
                  />
                  <Button
                    label="Cancel"
                    onPress={() => setPushConfirmId(null)}
                    variant="quiet"
                  />
                </View>
              ) : (
                <Button
                  compact
                  icon={PaperPlaneTilt}
                  label="Send as push"
                  onPress={() => setPushConfirmId(announcement.id)}
                  variant="secondary"
                />
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: colors.inkMuted,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    gap: 4,
    padding: 16,
  },
  statValue: {
    fontSize: 30,
  },
  block: {
    gap: 10,
    padding: 18,
  },
  distribution: {
    gap: 10,
  },
  distributionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  distributionLabel: {
    width: 56,
  },
  track: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    flex: 1,
    height: 10,
    overflow: "hidden",
  },
  fill: {
    backgroundColor: colors.sageStrong,
    height: "100%",
  },
  distributionValue: {
    textAlign: "right",
    width: 36,
  },
  form: {
    gap: 14,
  },
  preview: {
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    gap: 4,
    padding: 14,
  },
  segmentRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipSelected: {
    backgroundColor: colors.ink,
  },
  lightText: {
    color: colors.porcelain,
  },
  notice: {
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    padding: 12,
  },
  error: {
    color: colors.coralStrong,
  },
});
