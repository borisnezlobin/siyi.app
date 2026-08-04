import * as Haptics from "expo-haptics";
import {
  CalendarBlank,
  Cake,
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
import { colors, radii } from "@/constants/theme";
import {
  getAccountSettings,
  getFollowUps,
  getPeople,
  setFollowUpComplete,
} from "@/lib/data";
import { relativeDayLabel } from "@/lib/date-labels";
import {
  daysUntilBirthday,
  nextBirthday,
  overdueDays,
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
  const openFollowUps = followUps.filter((item) => !item.completedAt);
  const overdueFollowUps = openFollowUps.filter(
    (item) => new Date(item.dueAt).getTime() < now.getTime(),
  );
  const upcomingFollowUps = openFollowUps
    .filter((item) => new Date(item.dueAt).getTime() >= now.getTime())
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
    .sort(
      (left, right) =>
        stableDailyScore(left.id) - stableDailyScore(right.id),
    )
    .slice(0, 3);
  const recentlyMet = people
    .filter(
      (person) =>
        now.getTime() - new Date(person.firstMetAt).getTime() <=
        7 * 86_400_000,
    )
    .slice(0, 4);
  const hasTimeSensitive =
    overdueFollowUps.length > 0 ||
    upcomingFollowUps.length > 0 ||
    birthdays.length > 0;

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
      eyebrow="Your day, with context"
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="A calm look at what needs attention and who might appreciate a hello."
      title={
        profile?.displayName
          ? `Hi, ${profile.displayName.split(" ")[0]}`
          : "Today"
      }
    >
      <View style={styles.summaryRow}>
        <Card style={[styles.summary, styles.summaryUrgent]}>
          <ClockCountdown color={colors.coralStrong} size={22} weight="duotone" />
          <AppText variant="title">
            {overdueFollowUps.length + overduePeople.length}
          </AppText>
          <AppText variant="caption">need attention</AppText>
        </Card>
        <Card style={[styles.summary, styles.summaryUpcoming]}>
          <CalendarBlank color={colors.sageStrong} size={22} weight="duotone" />
          <AppText variant="title">
            {birthdays.length + upcomingFollowUps.length}
          </AppText>
          <AppText variant="caption">coming up</AppText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading
          detail="Overdue first, then upcoming"
          title="Time-sensitive"
        />
        {hasTimeSensitive ? (
          <View style={styles.list}>
            {overdueFollowUps.map((followUp) => (
              <FollowUpItem
                followUp={followUp}
                key={followUp.id}
                onComplete={() => void complete(followUp.id)}
                onOpen={() =>
                  router.push(`/people/${followUp.personId}`)
                }
              />
            ))}
            {birthdays.map((person) => (
              <BirthdayItem
                key={person.id}
                onOpen={() => router.push(`/people/${person.id}`)}
                person={person}
              />
            ))}
            {upcomingFollowUps.map((followUp) => (
              <FollowUpItem
                followUp={followUp}
                key={followUp.id}
                onComplete={() => void complete(followUp.id)}
                onOpen={() =>
                  router.push(`/people/${followUp.personId}`)
                }
              />
            ))}
          </View>
        ) : (
          <EmptyState
            body="Nothing is overdue and there are no birthdays or follow-ups in the next two weeks."
            icon={CheckCircle}
            title="You are comfortably caught up"
          />
        )}
      </View>

      {overduePeople.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading
            detail={`${overduePeople.length} due`}
            title="Ready for a check-in"
          />
          <View style={styles.list}>
            {overduePeople.slice(0, 5).map((person) => (
              <PersonRow
                key={person.id}
                onPress={() => router.push(`/people/${person.id}`)}
                person={person}
                trailing={
                  <Button
                    compact
                    icon={ChatCircleDots}
                    label="Log"
                    onPress={() => quickCapture.logInteraction(person.id)}
                    variant="secondary"
                  />
                }
              />
            ))}
          </View>
        </View>
      ) : null}

      {checkInPeople.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading
            detail="A fresh few each day"
            title="Have you checked in recently?"
          />
          <View style={styles.checkInCard}>
            {checkInPeople.map((person, index) => (
              <Pressable
                accessibilityRole="button"
                key={person.id}
                onPress={() => quickCapture.logInteraction(person.id)}
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
                    Tap to log a recent interaction
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
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summary: {
    flex: 1,
    gap: 4,
    minHeight: 138,
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
    borderRadius: radii.round,
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
});
