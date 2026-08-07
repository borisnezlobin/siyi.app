import { Check, UsersThree } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { EmptyState } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
import {
  alreadyLoggedIds,
  checkInCandidates,
  lastSeenLabel,
} from "@/lib/daily-check-in";
import { createInteraction, getPeople } from "@/lib/data";
import { todayDateInputValue, timestampFromDateInput } from "@/lib/date-input";
import type { Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

/**
 * "Who did you talk to today?" — the whole point is that it takes one pass and
 * no typing, so everyone is a single tap and one button saves the lot.
 *
 * Whoever was already logged since 4am opens ticked and stays ticked: coming
 * back at nine should show the people from lunch, not a blank list that looks
 * as though nothing saved.
 */
export default function CheckInScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const screenData = useRefreshableData<Person[]>(() => getPeople());
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(() => screenData.data ?? [], [screenData.data]);
  const candidates = useMemo(
    () => checkInCandidates(people, new Date(), 24),
    [people],
  );
  const loggedAlready = useMemo(
    () => alreadyLoggedIds(people, new Date()),
    [people],
  );

  useEffect(() => {
    setSelected(loggedAlready);
  }, [loggedAlready]);

  const toSave = selected.filter((id) => !loggedAlready.includes(id));

  async function save() {
    if (!session || toSave.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const occurredAt =
        timestampFromDateInput(todayDateInputValue()) ?? new Date().toISOString();
      for (const personId of toSave) {
        await createInteraction(session.user.id, {
          personId,
          type: "other",
          occurredAt,
          note: null,
          customLabel: null,
          customIcon: null,
        });
      }
      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "That could not be saved.",
      );
      setSaving(false);
    }
  }

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Looking at your circle…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Tap everyone you saw or spoke to. One tap each, nothing to type."
      title="Who did you talk to today?"
    >
      {candidates.length === 0 ? (
        <EmptyState
          body="Add someone to your circle and they will show up here."
          icon={UsersThree}
          title="Nobody to log yet"
        />
      ) : (
        <>
          <View style={styles.list}>
            {candidates.map((person) => {
              const chosen = selected.includes(person.id);
              const locked = loggedAlready.includes(person.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: chosen, disabled: locked }}
                  disabled={locked}
                  key={person.id}
                  onPress={() =>
                    setSelected((current) =>
                      current.includes(person.id)
                        ? current.filter((id) => id !== person.id)
                        : [...current, person.id],
                    )
                  }
                  style={[styles.row, chosen && styles.rowSelected]}
                >
                  <Avatar
                    uri={person.profilePhotoUrl}
                    name={person.preferredName || person.fullName}
                    size={40}
                  />
                  <View style={styles.rowBody}>
                    <AppText variant="label">
                      {person.preferredName || person.fullName}
                    </AppText>
                    <AppText variant="caption">
                      {locked ? "Logged today" : lastSeenLabel(person)}
                    </AppText>
                  </View>
                  <View style={[styles.tick, chosen && styles.tickSelected]}>
                    {chosen ? <Check color={colors.paper} size={15} weight="bold" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <AppText style={styles.error} variant="caption">
              {error}
            </AppText>
          ) : null}

          <Button
            disabled={toSave.length === 0 || saving}
            label={
              toSave.length === 0
                ? "Pick anyone you saw"
                : toSave.length === 1
                  ? "Log 1 person"
                  : `Log ${toSave.length} people`
            }
            onPress={() => void save()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 9,
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 13,
    padding: 13,
  },
  rowSelected: {
    backgroundColor: colors.sage,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  tick: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  tickSelected: {
    backgroundColor: colors.sageStrong,
  },
  error: {
    color: colors.coralStrong,
  },
});
