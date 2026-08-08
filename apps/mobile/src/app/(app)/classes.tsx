import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { colors, radii } from "@/constants/theme";
import { peopleByCourse, type PersonClass } from "@/lib/classes";
import { getClasses } from "@/lib/classes-data";
import { getPeople } from "@/lib/data";
import type { Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

export default function ClassesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const screenData = useRefreshableData<{
    people: Person[];
    classes: PersonClass[];
  }>(async () => {
    const [people, classes] = await Promise.all([
      getPeople(),
      getClasses(session!.user.id),
    ]);
    return { people, classes };
  });

  const groups = useMemo(() => {
    if (!screenData.data) return [];
    const { people, classes } = screenData.data;
    return peopleByCourse(
      people
        .filter((person) => person.status !== "archived")
        .map((person) => ({
          id: person.id,
          name: person.preferredName || person.fullName,
          classes: classes.filter((entry) => entry.personId === person.id),
        })),
    );
  }, [screenData.data]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Reading everyone's classes…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  return (
    <Screen
      showBack
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Who you have a course with, built from what you have written down."
      title="Classes"
    >
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <AppText variant="title">No classes saved yet</AppText>
          <AppText style={styles.emptyBody}>
            Add a class on someone&apos;s profile and it will show up here. You can
            then search for everyone in a course, or with a professor.
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {groups.map((group) => (
            <View key={group.code} style={styles.card}>
              <View style={styles.head}>
                <AppText style={styles.code} variant="label">
                  {group.code}
                  {group.title ? (
                    <AppText variant="caption"> · {group.title}</AppText>
                  ) : null}
                </AppText>
                <AppText variant="caption">{group.people.length}</AppText>
              </View>
              {group.professors.length > 0 ? (
                <AppText variant="caption">{group.professors.join(", ")}</AppText>
              ) : null}
              <View style={styles.names}>
                {group.people.map((person, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={person.id}
                    onPress={() => router.push(`/people/${person.id}`)}
                  >
                    <AppText style={styles.name}>
                      {index > 0 ? ", " : ""}
                      {person.name}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 9,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    gap: 6,
    padding: 14,
  },
  head: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  code: {
    flex: 1,
  },
  names: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  name: {
    color: colors.ink,
    textDecorationLine: "underline",
  },
  empty: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyBody: {
    color: colors.inkMuted,
    maxWidth: 340,
    textAlign: "center",
  },
});
