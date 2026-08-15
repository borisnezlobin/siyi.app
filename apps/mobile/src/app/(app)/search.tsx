import { MagnifyingGlass, XCircle } from "phosphor-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { GlassSurface } from "@/components/glass-surface";
import { RevealingTextInput } from "@/components/focus-scroll";
import { Screen } from "@/components/screen";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { useCachedData } from "@/hooks/use-cached-data";
import { getPeople, getPeopleCached } from "@/lib/data";
import { relativeDateLabel } from "@/lib/relative-time";
import { groupResultsByPerson, snippetAround, type SearchResult } from "@/lib/search";
import { searchEverything, type SearchOutcome } from "@/lib/search-data";
import type { Person } from "@/lib/types";

/** The web says the same six words for the same six kinds. */
const kindLabels: Record<SearchResult["kind"], string> = {
  person: "Person",
  update: "Update",
  note: "Note",
  interaction: "Interaction",
  class: "Class",
  reminder: "Reminder",
};

const debounceMs = 250;

type ScreenState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "failed"; message: string }
  | SearchOutcome;

export default function SearchScreen() {
  const router = useRouter();
  const screenData = useCachedData<Person[]>("people", getPeople, { cached: getPeopleCached });
  // Seeded rather than pushed in through an effect, so arriving from the
  // people list's "no matches" link searches once instead of rendering an empty
  // box and then correcting itself.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(q ?? "");
  const [state, setState] = useState<ScreenState>({ status: "idle" });

  // Monotonic, so a slow answer to an abandoned query cannot land after a fast
  // answer to the current one. There is no AbortController on the Supabase
  // client to cancel with, so the guard has to be on the way back in.
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      requestId.current += 1;
      setState({ status: "idle" });
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;

    const timer = setTimeout(() => {
      setState({ status: "searching" });

      searchEverything(trimmed)
        .then((outcome) => {
          if (requestId.current === id) setState(outcome);
        })
        .catch((error: unknown) => {
          if (requestId.current !== id) return;
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : "Search could not run.",
          });
        });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query]);

  const people = useMemo(() => screenData.data ?? [], [screenData.data]);

  const grouping = useMemo(
    () =>
      state.status === "ready"
        ? groupResultsByPerson(state.results, people)
        : { people: [], loose: [] },
    [state, people],
  );

  const hasResults = grouping.people.length > 0 || grouping.loose.length > 0;

  return (
    <Screen
      showBack
      stickyHeader={
        <View style={styles.searchRow}>
          <GlassSurface fallbackStyle={styles.searchFallback} style={styles.search}>
            <MagnifyingGlass color={colors.inkMuted} size={20} />
            <RevealingTextInput
              accessibilityLabel="Search everything you have written"
              autoCapitalize="none"
              autoFocus
              onChangeText={setQuery}
              placeholder="Search…"
              placeholderTextColor={colors.inkMuted}
              returnKeyType="search"
              selectionColor={colors.coral}
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => setQuery("")}
              >
                <XCircle color={colors.inkMuted} size={20} weight="fill" />
              </Pressable>
            ) : null}
          </GlassSurface>
        </View>
      }
      subtitle="People, updates, notes, interactions, classes and reminders."
      title="Search"
    >
      {state.status === "idle" ? (
        <Message
          body="Try a place you met someone, a class you share, or something they told you."
          title="What are you looking for?"
        />
      ) : null}

      {state.status === "searching" ? <Message title="Searching…" /> : null}

      {state.status === "offline" ? (
        <Message
          body="Search runs against your account rather than the copy on this phone, so it needs a connection."
          title="You are offline"
        />
      ) : null}

      {state.status === "unavailable" ? (
        <Message
          body="Search turns on once migration 0028 has been applied to the database."
          title="Search is not switched on yet"
        />
      ) : null}

      {state.status === "failed" ? <Message title="Search could not run" body={state.message} /> : null}

      {state.status === "ready" && !hasResults ? (
        <Message
          body="Nothing you have written mentions that."
          title={`No matches for "${query.trim()}"`}
        />
      ) : null}

      {state.status === "ready" && hasResults ? (
        <View style={styles.groups}>
          {grouping.people.map((group) => (
            <View key={group.person.id} style={styles.group}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/people/${group.person.id}`)}
                style={styles.groupHeader}
              >
                <Avatar
                  name={group.person.preferredName || group.person.fullName}
                  size={36}
                  uri={group.person.profilePhotoUrl}
                />
                <AppText variant="heading">
                  {group.person.preferredName || group.person.fullName}
                </AppText>
              </Pressable>
              {group.results.map((entry) => (
                <ResultRow entry={entry} key={`${entry.kind}-${entry.recordId}`} query={query} />
              ))}
            </View>
          ))}

          {grouping.loose.length > 0 ? (
            <View style={styles.group}>
              <AppText style={styles.looseHeading} variant="heading">
                Not tied to anyone
              </AppText>
              {grouping.loose.map((entry) => (
                <ResultRow entry={entry} key={`${entry.kind}-${entry.recordId}`} query={query} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

function ResultRow({ entry, query }: { entry: SearchResult; query: string }) {
  const when = entry.occurredAt ? relativeDateLabel(entry.occurredAt) : null;
  const snippet = snippetAround(entry.snippet, query);

  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <AppText style={styles.kind} variant="caption">
          {kindLabels[entry.kind]}
        </AppText>
        {when ? (
          <AppText style={styles.kind} variant="caption">
            {when}
          </AppText>
        ) : null}
      </View>
      {entry.title ? <AppText variant="label">{entry.title}</AppText> : null}
      {snippet ? <AppText style={styles.snippet}>{snippet}</AppText> : null}
    </View>
  );
}

function Message({ body, title }: { body?: string; title: string }) {
  return (
    <View style={styles.message}>
      <AppText variant="title">{title}</AppText>
      {body ? <AppText style={styles.messageBody}>{body}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  // No fill here: the glass is the fill. The paper and its hairline come back
  // only where the system has no Liquid Glass to draw.
  search: {
    alignItems: "center",
    borderRadius: radii.medium,
    flex: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  searchFallback: {
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderWidth: 1,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  groups: {
    gap: 22,
    marginTop: 18,
  },
  group: {
    gap: 10,
  },
  groupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  looseHeading: {
    color: colors.inkMuted,
  },
  row: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    gap: 4,
    padding: 14,
  },
  rowMeta: {
    flexDirection: "row",
    gap: 8,
  },
  kind: {
    color: colors.inkMuted,
  },
  snippet: {
    color: colors.ink,
  },
  message: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  messageBody: {
    color: colors.inkMuted,
    maxWidth: 320,
    textAlign: "center",
  },
});
