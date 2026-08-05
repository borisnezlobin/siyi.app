import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  Archive,
  At,
  Buildings,
  Cake,
  CalendarCheck,
  ChatCircleDots,
  Coffee,
  Envelope,
  GraduationCap,
  HouseLine,
  InstagramLogo,
  MapPin,
  NotePencil,
  PencilSimple,
  Phone,
  PhoneCall,
  UsersThree,
} from "phosphor-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { Card, SectionHeading } from "@/components/surface";
import { colors, floatShadow, radii } from "@/constants/theme";
import { archivePerson, getPersonDetails } from "@/lib/data";
import { dateLabel, elapsedLabel, relativeDayLabel } from "@/lib/date-labels";
import { reminderDueDate } from "@/lib/reminders";
import type { InteractionType } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useQuickCapture } from "@/providers/quick-capture-provider";

const interactionIcons: Record<InteractionType, typeof ChatCircleDots> = {
  met: UsersThree,
  texted: ChatCircleDots,
  called: PhoneCall,
  coffee: Coffee,
  meal: Coffee,
  party: UsersThree,
  class: GraduationCap,
  event: CalendarCheck,
  other: NotePencil,
};

const interactionLabels: Record<InteractionType, string> = {
  met: "Met",
  texted: "Texted",
  called: "Called",
  coffee: "Coffee",
  meal: "Meal",
  party: "Party",
  class: "Class",
  event: "Event",
  other: "Other",
};

export default function PersonDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, catchUp } = useLocalSearchParams<{
    id: string;
    catchUp?: string;
  }>();
  const catchUpOpenedRef = useRef(false);
  const quickCapture = useQuickCapture();
  const personData = useRefreshableData(() => getPersonDetails(id));

  useEffect(() => {
    if (quickCapture.revision > 0) void personData.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCapture.revision]);

  useEffect(() => {
    if (
      catchUp === "1" &&
      personData.data &&
      !catchUpOpenedRef.current
    ) {
      catchUpOpenedRef.current = true;
      quickCapture.catchUp(personData.data.person.id);
    }
  }, [catchUp, personData.data, quickCapture]);

  if (personData.loading && !personData.data) {
    return <LoadingState label="Loading profile…" />;
  }
  if (personData.error && !personData.data) {
    return (
      <ErrorState
        message={personData.error}
        onRetry={() => void personData.reload()}
      />
    );
  }

  const { person, interactions, followUps, updates } = personData.data!;
  const openFollowUps = followUps.filter((followUp) => !followUp.completedAt);
  const timelineEntries = [
    ...updates.map((update) => ({
      kind: "update" as const,
      id: update.id,
      occurredAt: update.recordedAt,
      update,
    })),
    ...interactions
      .filter((interaction) => !interaction.sourceUpdateId)
      .map((interaction) => ({
        kind: "interaction" as const,
        id: interaction.id,
        occurredAt: interaction.occurredAt,
        interaction,
      })),
  ].sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
  const reminder = reminderDueDate(person);
  const facts = [
    {
      icon: At,
      label: "Instagram",
      value: person.instagramUsername
        ? `@${person.instagramUsername}`
        : null,
    },
    { icon: MapPin, label: "Hometown", value: person.hometown },
    {
      icon: Buildings,
      label: "Residence",
      value: person.dormOrResidence,
    },
    { icon: GraduationCap, label: "Major", value: person.major },
    {
      icon: CalendarCheck,
      label: "Graduation",
      value: person.graduationYear
        ? String(person.graduationYear)
        : null,
    },
    {
      icon: Cake,
      label: "Birthday",
      value: person.birthday
        ? new Date(`${person.birthday}T12:00:00`).toLocaleDateString(
            undefined,
            { month: "long", day: "numeric" },
          )
        : null,
    },
    {
      icon: HouseLine,
      label: "First met",
      value: person.firstMetLocation,
    },
  ].filter((fact) => fact.value);

  function archive() {
    Alert.alert(
      `Archive ${person.preferredName || person.fullName}?`,
      "They will stop appearing in reminders. Their details and history stay available in your data export.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: () => {
            void archivePerson(person.id)
              .then(async () => {
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                router.replace("/people");
              })
              .catch(() =>
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                ),
              );
          },
        },
      ],
    );
  }

  return (
    <View style={styles.fill}>
      <Screen
        bottomInset={112 + insets.bottom}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <ArrowLeft color={colors.ink} size={21} />
          </Pressable>
          <View style={styles.topActions}>
            <Pressable
              accessibilityLabel="Edit person"
              accessibilityRole="button"
              onPress={() => router.push(`/people/${person.id}/edit`)}
              style={styles.headerButton}
            >
              <PencilSimple color={colors.ink} size={20} />
            </Pressable>
            <Pressable
              accessibilityLabel="Archive person"
              accessibilityRole="button"
              onPress={archive}
              style={styles.headerButton}
            >
              <Archive color={colors.coralStrong} size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarFrame}>
            <Avatar
              name={person.fullName}
              size={126}
              uri={person.profilePhotoUrl}
            />
          </View>
          <View style={styles.profileCopy}>
            <AppText style={styles.name} variant="display">
              {person.preferredName || person.fullName}
            </AppText>
            {person.preferredName ? (
              <AppText style={styles.muted}>{person.fullName}</AppText>
            ) : null}
            <View style={styles.tagRow}>
              <View style={styles.strengthChip}>
                <AppText style={styles.strengthText} variant="caption">
                  Strength {person.relationshipStrength}
                </AppText>
              </View>
              {person.tags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <AppText variant="caption">{tag.name}</AppText>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.contactActions}>
          {person.phoneNumber ? (
            <ContactAction
              icon={Phone}
              label="Call"
              onPress={() =>
                void Linking.openURL(`tel:${person.phoneNumber}`)
              }
            />
          ) : null}
          {person.phoneNumber ? (
            <ContactAction
              icon={ChatCircleDots}
              label="Text"
              onPress={() =>
                void Linking.openURL(`sms:${person.phoneNumber}`)
              }
            />
          ) : null}
          {person.email ? (
            <ContactAction
              icon={Envelope}
              label="Email"
              onPress={() => void Linking.openURL(`mailto:${person.email}`)}
            />
          ) : null}
          {person.instagramUsername ? (
            <ContactAction
              icon={InstagramLogo}
              label="Instagram"
              onPress={() =>
                void Linking.openURL(
                  `https://instagram.com/${person.instagramUsername}`,
                )
              }
            />
          ) : null}
        </View>

        <View style={styles.stats}>
          <Card style={styles.stat}>
            <AppText variant="caption">Last interaction</AppText>
            <AppText variant="heading">
              {elapsedLabel(person.lastInteractionAt)}
            </AppText>
          </Card>
          <Card style={styles.stat}>
            <AppText variant="caption">Next reminder</AppText>
            <AppText variant="heading">
              {relativeDayLabel(reminder)}
            </AppText>
          </Card>
        </View>

        {facts.length > 0 ? (
          <View style={styles.section}>
            <SectionHeading title="What you know" />
            <Card style={styles.facts}>
              {facts.map((fact) => {
                const IconComponent = fact.icon;
                return (
                  <View key={fact.label} style={styles.fact}>
                    <View style={styles.factIcon}>
                      <IconComponent
                        color={colors.sageStrong}
                        size={20}
                        weight="duotone"
                      />
                    </View>
                    <View>
                      <AppText variant="caption">{fact.label}</AppText>
                      <AppText variant="label">{fact.value}</AppText>
                    </View>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}

        {person.generalNotes ? (
          <View style={styles.section}>
            <SectionHeading title="Notes" />
            <Card>
              <AppText>{person.generalNotes}</AppText>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading
            detail={`${openFollowUps.length} open`}
            title="Follow-ups"
          />
          {openFollowUps.length > 0 ? (
            <Card style={styles.timelineCard}>
              {openFollowUps.map((followUp) => (
                <View key={followUp.id} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCopy}>
                    <AppText variant="label">{followUp.text}</AppText>
                    <AppText variant="caption">
                      {relativeDayLabel(followUp.dueAt)}
                    </AppText>
                  </View>
                </View>
              ))}
            </Card>
          ) : (
            <Card style={styles.emptyCard}>
              <AppText style={styles.muted}>
                Nothing is waiting on your list.
              </AppText>
              <Button
                compact
                icon={CalendarCheck}
                label="Add one"
                onPress={() => quickCapture.addFollowUp(person.id)}
                variant="secondary"
              />
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeading
            detail={`${timelineEntries.length}`}
            title="Updates"
          />
          {timelineEntries.length > 0 ? (
            <Card style={styles.timelineCard}>
              {timelineEntries.map((entry) => {
                if (entry.kind === "update") {
                  return (
                    <View key={entry.id} style={styles.timelineItem}>
                      <View style={styles.interactionIcon}>
                        <NotePencil
                          color={colors.sageStrong}
                          size={19}
                          weight="duotone"
                        />
                      </View>
                      <View style={styles.timelineCopy}>
                        <AppText variant="label">
                          {entry.update.isInteraction
                            ? entry.update.interactionLabel || "Interaction"
                            : "Note"}
                        </AppText>
                        <AppText variant="caption">
                          {dateLabel(entry.update.recordedAt)}
                        </AppText>
                        <AppText style={styles.note}>
                          {entry.update.text}
                        </AppText>
                      </View>
                    </View>
                  );
                }
                const { interaction } = entry;
                const IconComponent = interactionIcons[interaction.type];
                return (
                  <View key={entry.id} style={styles.timelineItem}>
                    <View style={styles.interactionIcon}>
                      <IconComponent
                        color={colors.sageStrong}
                        size={19}
                        weight="duotone"
                      />
                    </View>
                    <View style={styles.timelineCopy}>
                      <AppText variant="label">
                        {interactionLabels[interaction.type]}
                      </AppText>
                      <AppText variant="caption">
                        {dateLabel(interaction.occurredAt)}
                      </AppText>
                      {interaction.note ? (
                        <AppText style={styles.note}>
                          {interaction.note}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </Card>
          ) : null}
        </View>
      </Screen>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Button
          icon={NotePencil}
          label="Add update"
          onPress={() => quickCapture.addUpdate(person.id)}
        />
        <Pressable
          accessibilityLabel="Add follow-up"
          accessibilityRole="button"
          onPress={() => quickCapture.addFollowUp(person.id)}
          style={styles.footerSecondary}
        >
          <CalendarCheck color={colors.sageStrong} size={22} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

function ContactAction({
  icon: IconComponent,
  label,
  onPress,
}: {
  icon: typeof Phone;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactAction,
        pressed && styles.pressed,
      ]}
    >
      <IconComponent color={colors.ink} size={22} weight="duotone" />
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    gap: 20,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  profileHeader: {
    alignItems: "center",
    gap: 14,
  },
  avatarFrame: {
    backgroundColor: colors.sage,
    borderRadius: radii.round,
    padding: 8,
  },
  profileCopy: {
    alignItems: "center",
    gap: 4,
  },
  name: {
    textAlign: "center",
  },
  muted: {
    color: colors.inkMuted,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "center",
    marginTop: 5,
  },
  strengthChip: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.round,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  strengthText: {
    color: colors.coralStrong,
  },
  tagChip: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  contactActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    justifyContent: "center",
  },
  contactAction: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    gap: 4,
    justifyContent: "center",
    minHeight: 66,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    gap: 5,
  },
  section: {
    gap: 11,
  },
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 18,
  },
  fact: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    minWidth: "44%",
  },
  factIcon: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  timelineCard: {
    gap: 18,
  },
  timelineItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 11,
  },
  timelineDot: {
    backgroundColor: colors.coral,
    borderRadius: radii.round,
    height: 10,
    marginLeft: 8,
    marginTop: 6,
    width: 10,
  },
  interactionIcon: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.round,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  timelineCopy: {
    flex: 1,
    gap: 2,
  },
  note: {
    color: colors.inkMuted,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  footer: {
    ...floatShadow,
    alignItems: "center",
    backgroundColor: colors.paper,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
  footerSecondary: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.small,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
});
