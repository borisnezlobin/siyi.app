import * as Haptics from "expo-haptics";
import {
  CalendarBlank,
  Cake,
  CaretRight,
  Check,
  CheckCircle,
  ChatCircleDots,
  ClockCountdown,
  HandWaving,
  UsersThree,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar } from "@/components/avatar";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { PersonRow } from "@/components/person-row";
import { Screen } from "@/components/screen";
import {
  Card,
  EmptyState,
  PressableCard,
  SectionHeading,
} from "@/components/surface";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import { ageAtNextBirthday } from "@/lib/birthday-age";
import {
  getAccountSettings,
  getFollowUps,
  getPeople,
  setFollowUpComplete,
} from "@/lib/data";
import { relativeDayLabel } from "@/lib/date-labels";
import { refreshHomeWidgets } from "@/lib/home-widgets";
import {
  daysUntilBirthday,
  nextBirthday,
  overdueDays,
  reminderDueDate,
} from "@/lib/reminders";
import type { FollowUp, Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";
import { useQuickCapture } from "@/providers/quick-capture-provider";

type TodayData = Awaited<ReturnType<typeof loadToday>>;

async function loadToday(userId: string) {
  const [people, followUps, settings] = await Promise.all([
    getPeople(),
    getFollowUps(),
    getAccountSettings(userId),
  ]);
  return { people, followUps, settings };
}

function stableDailyScore(personId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const text = `${day}:${personId}`;
  let score = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    score ^= text.charCodeAt(index);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

function FollowUpItem({
  followUp,
  onComplete,
  onOpen,
}: {
  followUp: FollowUp;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const overdue = new Date(followUp.dueAt) < new Date();
  return (
    <PressableCard onPress={onOpen} style={styles.actionRow}>
      <View
        style={[
          styles.actionIcon,
          overdue ? styles.urgentIcon : styles.upcomingIcon,
        ]}
      >
        <ClockCountdown
          color={overdue ? colors.coralStrong : colors.sageStrong}
          size={22}
          weight="duotone"
        />
      </View>
      <View style={styles.actionCopy}>
        <AppText numberOfLines={2} variant="label">
          {followUp.text}
        </AppText>
        <AppText
          style={overdue ? styles.urgentText : undefined}
          variant="caption"
        >
          {followUp.person?.preferredName ||
            followUp.person?.fullName ||
            "Someone"}{" "}
          · {relativeDayLabel(followUp.dueAt)}
        </AppText>
      </View>
      <Pressable
        accessibilityLabel={`Complete ${followUp.text}`}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        hitSlop={10}
        onPress={(event) => {
          event.stopPropagation();
          onComplete();
        }}
        style={styles.check}
      >
        <Check color={colors.sageStrong} size={20} weight="bold" />
      </Pressable>
    </PressableCard>
  );
}

function BirthdayItem({
  person,
  onOpen,
}: {
  person: Person;
  onOpen: () => void;
}) {
  const days = daysUntilBirthday(person.birthday);
  const birthday = nextBirthday(person.birthday);
  const turning = ageAtNextBirthday(person.birthday);
  return (
    <PressableCard onPress={onOpen} style={styles.actionRow}>
      <View style={[styles.actionIcon, styles.birthdayIcon]}>
        <Cake color={colors.ink} size={22} weight="duotone" />
      </View>
      <Avatar
        name={person.fullName}
        size={42}
        uri={person.profilePhotoUrl}
      />
      <View style={styles.actionCopy}>
        <AppText variant="label">
          {person.preferredName || person.fullName}
        </AppText>
        <AppText variant="caption">
          {days === 0
            ? "Birthday today"
            : `${days} day${days === 1 ? "" : "s"} away`}
          {birthday
            ? ` · ${birthday.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}`
            : ""}
          {turning === null ? "" : ` · turns ${turning}`}
        </AppText>
      </View>
    </PressableCard>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const quickCapture = useQuickCapture();
  const screenData = useRefreshableData<TodayData>(() =>
    loadToday(session!.user.id),
  );

  useEffect(() => {
    if (quickCapture.revision > 0) void screenData.reload();
    // The revision is the deliberate refresh signal after a sheet save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCapture.revision]);

  useEffect(() => {
    if (!screenData.data) return;
    void refreshHomeWidgets({
      people: screenData.data.people,
      followUps: screenData.data.followUps,
      reminderDefaults: screenData.data.settings.reminderDefaults,
    });
  }, [screenData.data]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Finding what matters today…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState
        message={screenData.error}
        onRetry={() => void screenData.reload()}
      />
    );
  }

  const { people, followUps, settings } = screenData.data!;
  const now = new Date();
  const upcomingCutoff = new Date(now);
  upcomingCutoff.setDate(upcomingCutoff.getDate() + 14);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const openFollowUps = followUps.filter((item) => !item.completedAt);
  const overdueFollowUps = openFollowUps.filter(
    (item) => new Date(item.dueAt).getTime() < now.getTime(),
  );
  const upcomingFollowUps = openFollowUps
    .filter((item) => {
      const dueAt = new Date(item.dueAt).getTime();
      return (
        dueAt >= now.getTime() && dueAt <= upcomingCutoff.getTime()
      );
    })
    .slice(0, 5);
  const birthdays = people
    .filter((person) => {
      const days = daysUntilBirthday(person.birthday, now);
      return days !== null && days <= 14 && person.status === "active";
    })
    .sort(
      (left, right) =>
        (daysUntilBirthday(left.birthday, now) || 0) -
        (daysUntilBirthday(right.birthday, now) || 0),
    );
  const overduePeople = people
    .filter(
      (person) =>
        overdueDays(person, now, settings.reminderDefaults) > 0,
    )
    .sort(
      (left, right) =>
        overdueDays(right, now, settings.reminderDefaults) -
        overdueDays(left, now, settings.reminderDefaults),
    );
  const activePeople = people.filter((person) => person.status === "active");
  const checkInPeople = [...activePeople]
    .sort((left, right) => {
      const leftContactedAt = new Date(
        left.lastInteractionAt || left.firstMetAt,
      ).getTime();
      const rightContactedAt = new Date(
        right.lastInteractionAt || right.firstMetAt,
      ).getTime();
      return (
        leftContactedAt - rightContactedAt ||
        stableDailyScore(left.id) - stableDailyScore(right.id)
      );
    })
    .slice(0, 3);
  const recentlyMet = people
    .filter(
      (person) =>
        now.getTime() - new Date(person.firstMetAt).getTime() <=
        7 * 86_400_000,
    )
    .slice(0, 4);
  const reminderItems = [
    ...overdueFollowUps.map((followUp) => ({
      kind: "reminder" as const,
      id: followUp.id,
      at: new Date(followUp.dueAt).getTime(),
      followUp,
    })),
    ...overduePeople.map((person) => ({
      kind: "person" as const,
      id: person.id,
      at: reminderDueDate(person, settings.reminderDefaults).getTime(),
      person,
    })),
    ...birthdays.map((person) => ({
      kind: "birthday" as const,
      id: person.id,
      at: nextBirthday(person.birthday, now)?.getTime() ?? Infinity,
      person,
    })),
    ...upcomingFollowUps.map((followUp) => ({
      kind: "reminder" as const,
      id: followUp.id,
      at: new Date(followUp.dueAt).getTime(),
      followUp,
    })),
  ]
    .sort((left, right) => left.at - right.at)
    .slice(0, 12);
  const hasTimeSensitive = reminderItems.length > 0;
  const hasImmediateAttention =
    overdueFollowUps.length > 0 ||
    overduePeople.length > 0 ||
    upcomingFollowUps.some(
      (followUp) =>
        new Date(followUp.dueAt).getTime() <= endOfToday.getTime(),
    ) ||
    birthdays.some(
      (person) => (daysUntilBirthday(person.birthday, now) ?? 99) <= 1,
    );

  async function complete(followUpId: string) {
    try {
      await setFollowUpComplete(followUpId, true);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      await screenData.reload();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Here’s what needs attention and who might appreciate a hello."
      title={
        profile?.displayName
          ? `Hi, ${profile.displayName.split(" ")[0]}`
          : "Today"
      }
    >
      <PressableCard
        onPress={() => router.push("/check-in")}
        style={styles.checkInPrompt}
      >
        <View style={styles.checkInBody}>
          <AppText variant="body">Who did you talk to today?</AppText>
          <AppText variant="caption">
            One pass, one tap each — log everyone you saw.
          </AppText>
        </View>
        <CaretRight color={colors.inkMuted} size={16} weight="bold" />
      </PressableCard>

      <Card style={styles.overview}>
        <View style={styles.overviewItem}>
          <View style={[styles.overviewIcon, styles.summaryUrgent]}>
            <ClockCountdown
              color={colors.coralStrong}
              size={21}
              weight="duotone"
            />
          </View>
          <View style={styles.overviewCopy}>
            <AppText variant="heading">
              {overdueFollowUps.length + overduePeople.length}
            </AppText>
            <AppText variant="caption">need attention</AppText>
          </View>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <View style={[styles.overviewIcon, styles.summaryUpcoming]}>
            <CalendarBlank
              color={colors.sageStrong}
              size={21}
              weight="duotone"
            />
          </View>
          <View style={styles.overviewCopy}>
            <AppText variant="heading">
              {birthdays.length + upcomingFollowUps.length}
            </AppText>
            <AppText variant="caption">coming up</AppText>
          </View>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeading title="Reminders" />
        {hasTimeSensitive ? (
          <View style={styles.list}>
            {reminderItems.map((item) => {
              if (item.kind === "reminder") {
                return (
                  <FollowUpItem
                    followUp={item.followUp}
                    key={`reminder-${item.id}`}
                    onComplete={() => void complete(item.followUp.id)}
                    onOpen={() =>
                      router.push(`/people/${item.followUp.personId}`)
                    }
                  />
                );
              }
              if (item.kind === "birthday") {
                return (
                  <BirthdayItem
                    key={`birthday-${item.id}`}
                    onOpen={() => router.push(`/people/${item.person.id}`)}
                    person={item.person}
                  />
                );
              }
              return (
                <PersonRow
                  key={`person-${item.id}`}
                  onPress={() => router.push(`/people/${item.person.id}`)}
                  person={item.person}
                  trailing={
                    <Button
                      compact
                      icon={UsersThree}
                      label="Saw them"
                      onPress={() =>
                        quickCapture.logInteraction(item.person.id)
                      }
                      variant="secondary"
                    />
                  }
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            body="Nothing is overdue and there are no birthdays or reminders in the next two weeks."
            icon={CheckCircle}
            title="You are comfortably caught up"
          />
        )}
      </View>

      {!hasImmediateAttention && activePeople.length > 0 ? (
        <Card style={styles.catchUpPrompt}>
          <View style={styles.catchUpCopy}>
            <AppText variant="heading">Have a little room today?</AppText>
            <AppText style={styles.catchUpBody}>
              {brand.name} can pick someone and bring back the context you
              saved.
            </AppText>
          </View>
          <Button
            icon={ChatCircleDots}
            label="Catch up with someone"
            onPress={() => quickCapture.catchUp()}
          />
        </Card>
      ) : null}

      {checkInPeople.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading title="Have you checked in recently?" />
          <View style={styles.checkInCard}>
            {checkInPeople.map((person, index) => (
              <Pressable
                accessibilityRole="button"
                key={person.id}
                onPress={() => quickCapture.sayHello(person.id)}
                style={[
                  styles.checkInRow,
                  index < checkInPeople.length - 1 && styles.checkInDivider,
                ]}
              >
                <Avatar
                  name={person.fullName}
                  size={46}
                  uri={person.profilePhotoUrl}
                />
                <View style={styles.actionCopy}>
                  <AppText variant="label">
                    {person.preferredName || person.fullName}
                  </AppText>
                  <AppText variant="caption">
                    Choose how to say hello
                  </AppText>
                </View>
                <HandWaving
                  color={colors.coralStrong}
                  size={22}
                  weight="duotone"
                />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {recentlyMet.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading
            detail="Past 7 days"
            title="New in your circle"
          />
          <View style={styles.list}>
            {recentlyMet.map((person) => (
              <PersonRow
                key={person.id}
                onPress={() => router.push(`/people/${person.id}`)}
                person={person}
              />
            ))}
          </View>
        </View>
      ) : null}

      {people.length === 0 ? (
        <EmptyState
          body="Add the next person you meet. The quick form takes only a few seconds."
          icon={UsersThree}
          title="Your circle starts here"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  checkInPrompt: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 15,
  },
  checkInBody: {
    flex: 1,
    gap: 3,
  },
  overview: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    padding: 15,
  },
  overviewItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  overviewIcon: {
    alignItems: "center",
    borderRadius: radii.small,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  overviewCopy: {
    flex: 1,
    gap: 1,
  },
  overviewDivider: {
    backgroundColor: colors.mist,
    height: 38,
    width: StyleSheet.hairlineWidth,
  },
  summaryUrgent: {
    backgroundColor: colors.coralSoft,
  },
  summaryUpcoming: {
    backgroundColor: colors.sage,
  },
  section: {
    gap: 12,
  },
  list: {
    gap: 10,
  },
  actionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  actionIcon: {
    alignItems: "center",
    borderRadius: radii.medium,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  urgentIcon: {
    backgroundColor: colors.coralSoft,
  },
  upcomingIcon: {
    backgroundColor: colors.sage,
  },
  birthdayIcon: {
    backgroundColor: colors.sunSoft,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  urgentText: {
    color: colors.coralStrong,
  },
  check: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.small,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  checkInCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    overflow: "hidden",
    paddingHorizontal: 14,
  },
  checkInRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 74,
    paddingVertical: 10,
  },
  checkInDivider: {
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  catchUpPrompt: {
    gap: 15,
  },
  catchUpCopy: {
    gap: 4,
  },
  catchUpBody: {
    color: colors.inkMuted,
  },
});
