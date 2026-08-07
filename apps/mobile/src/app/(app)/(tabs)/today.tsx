import * as Haptics from "expo-haptics";
import {
  Cake,
  CaretRight,
  ChatCircleDots,
  Check,
  CheckCircle,
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
import { lastSeenLabel } from "@/lib/daily-check-in";
import {
  getAccountSettings,
  getReminders,
  getPeople,
  setReminderComplete,
} from "@/lib/data";
import { refreshHomeWidgets } from "@/lib/home-widgets";
import { daysBetween, daysUntilBirthday, overdueDays } from "@/lib/reminders";
import {
  agendaCounts,
  agendaLimit,
  buildTodayAgenda,
  pickCheckInSuggestions,
  recentlyMetPeople,
  type AgendaItem,
} from "@/lib/today-agenda";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";
import { useQuickCapture } from "@/providers/quick-capture-provider";

type TodayData = Awaited<ReturnType<typeof loadToday>>;

const agendaIcons = {
  reminder: ClockCountdown,
  "check-in": UsersThree,
  birthday: Cake,
};

async function loadToday(userId: string) {
  const [people, reminders, settings] = await Promise.all([
    getPeople(),
    getReminders(),
    getAccountSettings(userId),
  ]);
  return { people, reminders, settings };
}

function AgendaRow({
  item,
  onComplete,
  onOpen,
  showDivider,
}: {
  item: AgendaItem;
  onComplete: () => void;
  onOpen: () => void;
  showDivider: boolean;
}) {
  const Icon = agendaIcons[item.kind];
  const overdue = item.status === "overdue";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={[styles.agendaRow, showDivider && styles.divider]}
    >
      <Icon color={overdue ? colors.coralStrong : colors.inkMuted} size={20} />
      <View style={styles.rowCopy}>
        <AppText numberOfLines={2} variant="label">
          {item.title}
        </AppText>
        <AppText
          numberOfLines={1}
          style={overdue ? styles.overdueText : undefined}
          variant="caption"
        >
          {item.detail}
        </AppText>
      </View>
      {item.reminderId ? (
        <Pressable
          accessibilityLabel={`Complete ${item.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: false }}
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onComplete();
          }}
        >
          <Check color={colors.inkMuted} size={18} weight="bold" />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { session } = useAuth();
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
      reminders: screenData.data.reminders,
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

  const { people, reminders, settings } = screenData.data!;
  const now = new Date();
  const agenda = buildTodayAgenda({
    reminders: reminders
      .filter((reminder) => !reminder.completedAt)
      .map((reminder) => ({
        id: reminder.id,
        personId: reminder.personId,
        text: reminder.text,
        personName:
          reminder.person?.preferredName ||
          reminder.person?.fullName ||
          "Someone",
        daysAway: daysBetween(now, new Date(reminder.dueAt)),
      })),
    overdueCheckIns: people.flatMap((person) => {
      const daysOverdue = overdueDays(person, now, settings.reminderDefaults);
      if (daysOverdue <= 0) return [];
      return [
        {
          personId: person.id,
          name: person.preferredName || person.fullName,
          daysOverdue,
        },
      ];
    }),
    birthdays: people.flatMap((person) => {
      if (person.status !== "active") return [];
      const daysAway = daysUntilBirthday(person.birthday, now);
      if (daysAway === null) return [];
      return [
        {
          personId: person.id,
          name: person.preferredName || person.fullName,
          daysAway,
          turningAge: ageAtNextBirthday(person.birthday, now),
        },
      ];
    }),
  });
  const counts = agendaCounts(agenda);
  const visibleAgenda = agenda.slice(0, agendaLimit);
  const recentlyMet = recentlyMetPeople(people, now);
  const checkInPeople = pickCheckInSuggestions(
    people,
    [
      ...agenda
        .filter((item) => item.kind === "check-in")
        .map((item) => item.personId),
      ...recentlyMet.map((person) => person.id),
    ],
    now,
  );
  const activePeople = people.filter((person) => person.status === "active");

  async function complete(reminderId: string) {
    try {
      await setReminderComplete(reminderId, true);
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
      title="Today"
    >
      <PressableCard
        onPress={() => router.push("/check-in")}
        style={styles.checkInPrompt}
      >
        <View style={styles.checkInBody}>
          <AppText variant="label">Who did you talk to today?</AppText>
          <AppText variant="caption">
            One pass, one tap each — log everyone you saw.
          </AppText>
        </View>
        <CaretRight color={colors.inkMuted} size={16} weight="bold" />
      </PressableCard>

      <Card style={styles.overview}>
        <View style={styles.overviewItem}>
          <AppText variant="title">{counts.needAttention}</AppText>
          <AppText variant="caption">need attention</AppText>
        </View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewItem}>
          <AppText variant="title">{counts.comingUp}</AppText>
          <AppText variant="caption">coming up</AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeading
          subtitle="Overdue first, then what’s coming up"
          title="Time-sensitive"
        />
        {visibleAgenda.length > 0 ? (
          <View>
            {visibleAgenda.map((item, index) => (
              <AgendaRow
                item={item}
                key={item.key}
                onComplete={() =>
                  item.reminderId ? void complete(item.reminderId) : undefined
                }
                onOpen={() => router.push(`/people/${item.personId}`)}
                showDivider={index < visibleAgenda.length - 1}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            body="Nothing is overdue, and there are no birthdays or reminders in the next two weeks."
            icon={CheckCircle}
            title="You’re caught up"
          />
        )}
      </View>

      {counts.needAttention === 0 && activePeople.length > 0 ? (
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
          <View style={styles.groupedCard}>
            {checkInPeople.map((person, index) => (
              <Pressable
                accessibilityRole="button"
                key={person.id}
                onPress={() => quickCapture.sayHello(person.id)}
                style={[
                  styles.personRow,
                  index < checkInPeople.length - 1 && styles.divider,
                ]}
              >
                <Avatar
                  name={person.fullName}
                  size={46}
                  uri={person.profilePhotoUrl}
                />
                <View style={styles.rowCopy}>
                  <AppText variant="label">
                    {person.preferredName || person.fullName}
                  </AppText>
                  <AppText variant="caption">
                    {lastSeenLabel(person, now)}
                  </AppText>
                </View>
                <HandWaving color={colors.inkMuted} size={20} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {recentlyMet.length > 0 ? (
        <View style={styles.section}>
          <SectionHeading detail="Past 7 days" title="New in your circle" />
          <View style={styles.groupedCard}>
            {recentlyMet.map((person, index) => (
              <Pressable
                accessibilityRole="button"
                key={person.id}
                onPress={() => router.push(`/people/${person.id}`)}
                style={[
                  styles.personRow,
                  index < recentlyMet.length - 1 && styles.divider,
                ]}
              >
                <Avatar
                  name={person.fullName}
                  size={46}
                  uri={person.profilePhotoUrl}
                />
                <View style={styles.rowCopy}>
                  <AppText variant="label">
                    {person.preferredName || person.fullName}
                  </AppText>
                  <AppText numberOfLines={1} variant="caption">
                    {person.firstMetLocation
                      ? `Met at ${person.firstMetLocation}`
                      : "Ready for a first note"}
                  </AppText>
                </View>
                <CaretRight color={colors.inkMuted} size={16} />
              </Pressable>
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
    padding: 18,
  },
  overviewItem: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  overviewDivider: {
    backgroundColor: colors.mist,
    height: 38,
    width: StyleSheet.hairlineWidth,
  },
  section: {
    gap: 12,
  },
  agendaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  personRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 70,
    paddingVertical: 10,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  divider: {
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  overdueText: {
    color: colors.coralStrong,
  },
  groupedCard: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    overflow: "hidden",
    paddingHorizontal: 14,
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
