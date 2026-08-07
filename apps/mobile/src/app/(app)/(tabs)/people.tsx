import {
  ArrowsDownUp,
  Cake,
  GraduationCap,
  MagnifyingGlass,
  MapPin,
  SlidersHorizontal,
  UsersThree,
  XCircle,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { AppText } from "@/components/app-text";
import { ErrorState, LoadingState } from "@/components/load-state";
import { PersonRow } from "@/components/person-row";
import { Screen } from "@/components/screen";
import { EmptyState } from "@/components/surface";
import { colors, fontFamilies, radii } from "@/constants/theme";
import { personMatchesClassQuery, type PersonClass } from "@/lib/classes";
import { getClasses } from "@/lib/classes-data";
import { collegeSearchTerms } from "@/lib/colleges";
import { getAccountSettings, getPeople } from "@/lib/data";
import {
  type MissingDetail,
  isMissingDetail,
  matchesPeopleQuery,
  missingDetailLabels,
  sectionPeopleAlphabetically,
} from "@/lib/people-filters";
import { relationshipTierLabels } from "@/lib/relationship-labels";
import { overdueDays } from "@/lib/reminders";
import type {
  Person,
  RelationshipStrength,
  ReminderDefaults,
} from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";
import { useQuickCapture } from "@/providers/quick-capture-provider";

type SortMode =
  | "name"
  | "newest"
  | "recently-contacted"
  | "least-recently-contacted";

type OverdueFilter = "all" | "overdue" | "recent";

type PeopleData = {
  people: Person[];
  reminderDefaults: ReminderDefaults;
  classes: PersonClass[];
};

const sortLabels: Record<SortMode, string> = {
  name: "Name",
  newest: "Newest",
  "recently-contacted": "Recently contacted",
  "least-recently-contacted": "Least recently contacted",
};

const missingDetailOptions: MissingDetail[] = ["birthday", "email", "phone"];

export default function PeopleScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const quickCapture = useQuickCapture();
  const screenData = useRefreshableData<PeopleData>(async () => {
    const [people, settings, classes] = await Promise.all([
      getPeople(),
      getAccountSettings(session!.user.id),
      getClasses(session!.user.id),
    ]);
    return {
      people,
      reminderDefaults: settings.reminderDefaults,
      classes,
    };
  });
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [strength, setStrength] =
    useState<RelationshipStrength | null>(null);
  const [tagId, setTagId] = useState<string | null>(null);
  const [overdueFilter, setOverdueFilter] =
    useState<OverdueFilter>("all");
  const [missing, setMissing] = useState<MissingDetail[]>([]);
  const [sort, setSort] = useState<SortMode>("name");

  useEffect(() => {
    if (quickCapture.revision > 0) void screenData.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickCapture.revision]);

  const filteredPeople = useMemo(() => {
    if (!screenData.data) return [];
    const { people, reminderDefaults, classes } = screenData.data;
    const classesByPerson = new Map<string, PersonClass[]>();
    for (const entry of classes) {
      const existing = classesByPerson.get(entry.personId);
      if (existing) existing.push(entry);
      else classesByPerson.set(entry.personId, [entry]);
    }
    const now = new Date();
    const thirtyDaysAgo = now.getTime() - 30 * 86_400_000;
    const filtered = people.filter((person) => {
      if (person.status === "archived") return false;
      // The whole table is already on the device, so acronym search is free here.
      if (
        !matchesPeopleQuery(person, query, collegeSearchTerms) &&
        !personMatchesClassQuery(classesByPerson.get(person.id) ?? [], query)
      ) {
        return false;
      }
      if (missing.some((detail) => !isMissingDetail(person, detail))) return false;
      if (strength && person.relationshipStrength !== strength) return false;
      if (tagId && !person.tags.some((tag) => tag.id === tagId)) return false;
      if (
        overdueFilter === "overdue" &&
        overdueDays(person, now, reminderDefaults) === 0
      ) {
        return false;
      }
      if (
        overdueFilter === "recent" &&
        new Date(person.createdAt).getTime() < thirtyDaysAgo
      ) {
        return false;
      }
      return true;
    });

    return filtered.sort((left, right) => {
      if (sort === "name") {
        return left.fullName.localeCompare(right.fullName);
      }
      if (sort === "recently-contacted") {
        return (
          new Date(right.lastInteractionAt || right.firstMetAt).getTime() -
          new Date(left.lastInteractionAt || left.firstMetAt).getTime()
        );
      }
      if (sort === "least-recently-contacted") {
        return (
          new Date(left.lastInteractionAt || left.firstMetAt).getTime() -
          new Date(right.lastInteractionAt || right.firstMetAt).getTime()
        );
      }
      return (
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime()
      );
    });
  }, [missing, overdueFilter, query, screenData.data, sort, strength, tagId]);

  const sections = useMemo(
    () => (sort === "name" ? sectionPeopleAlphabetically(filteredPeople) : []),
    [filteredPeople, sort],
  );

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Opening your circle…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState
        message={screenData.error}
        onRetry={() => void screenData.reload()}
      />
    );
  }

  const tags = Array.from(
    new Map(
      screenData.data!.people
        .flatMap((person) => person.tags)
        .map((tag) => [tag.id, tag]),
    ).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle="Search by name, school, class, hometown, major, dorm, or tag."
      title="People"
    >
      <View style={styles.shortcuts}>
        {(
          [
            ["/birthdays", "Birthdays", Cake],
            ["/classes", "Classes", GraduationCap],
            ["/map", "Map", MapPin],
          ] as const
        ).map(([href, label, Icon]) => (
          <Pressable
            accessibilityRole="button"
            key={href}
            onPress={() => router.push(href)}
            style={styles.shortcut}
          >
            <Icon color={colors.ink} size={17} />
            <AppText variant="caption">{label}</AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <MagnifyingGlass color={colors.inkMuted} size={20} />
          <TextInput
            accessibilityLabel="Search people"
            autoCapitalize="none"
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
        </View>
        <Pressable
          accessibilityLabel="Show filters"
          accessibilityRole="button"
          accessibilityState={{ expanded: showFilters }}
          onPress={() => setShowFilters((visible) => !visible)}
          style={[
            styles.filterButton,
            showFilters && styles.filterButtonSelected,
          ]}
        >
          <SlidersHorizontal
            color={showFilters ? colors.paper : colors.ink}
            size={21}
            weight="bold"
          />
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.filters}>
          <FilterGroup label="Reminder pace">
            {([1, 2, 3, 4] as const).map((value) => (
              <FilterChip
                key={value}
                label={relationshipTierLabels[value]}
                onPress={() =>
                  setStrength(
                    strength === value
                      ? null
                      : (value as RelationshipStrength),
                  )
                }
                selected={strength === value}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Timing">
            {(
              [
                ["all", "Everyone"],
                ["overdue", "Overdue"],
                ["recent", "Added recently"],
              ] as const
            ).map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                onPress={() => setOverdueFilter(value)}
                selected={overdueFilter === value}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Missing details">
            {missingDetailOptions.map((detail) => (
              <FilterChip
                key={detail}
                label={missingDetailLabels[detail]}
                onPress={() =>
                  setMissing((current) =>
                    current.includes(detail)
                      ? current.filter((entry) => entry !== detail)
                      : [...current, detail],
                  )
                }
                selected={missing.includes(detail)}
              />
            ))}
          </FilterGroup>
          {tags.length > 0 ? (
            <FilterGroup label="Tag">
              {tags.map((tag) => (
                <FilterChip
                  key={tag.id}
                  label={tag.name}
                  onPress={() =>
                    setTagId(tagId === tag.id ? null : tag.id)
                  }
                  selected={tagId === tag.id}
                />
              ))}
            </FilterGroup>
          ) : null}
          <FilterGroup
            icon={<ArrowsDownUp color={colors.inkMuted} size={17} />}
            label="Sort"
          >
            {(Object.keys(sortLabels) as SortMode[]).map((value) => (
              <FilterChip
                key={value}
                label={sortLabels[value]}
                onPress={() => setSort(value)}
                selected={sort === value}
              />
            ))}
          </FilterGroup>
        </View>
      ) : null}

      <View style={styles.resultHeader}>
        <AppText variant="heading">
          {filteredPeople.length === 1
            ? "1 person"
            : `${filteredPeople.length} people`}
        </AppText>
        <AppText variant="caption">{sortLabels[sort]}</AppText>
      </View>

      {filteredPeople.length > 0 ? (
        sections.length > 0 ? (
          <View style={styles.sections}>
            {sections.map((section) => (
              <View key={section.letter} style={styles.section}>
                <AppText style={styles.sectionLetter} variant="label">
                  {section.letter}
                </AppText>
                <View style={styles.list}>
                  {section.people.map((person) => (
                    <PersonRow
                      key={person.id}
                      onPress={() => router.push(`/people/${person.id}`)}
                      person={person}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {filteredPeople.map((person) => (
              <PersonRow
                key={person.id}
                onPress={() => router.push(`/people/${person.id}`)}
                person={person}
              />
            ))}
          </View>
        )
      ) : (
        <EmptyState
          body={
            screenData.data!.people.length === 0
              ? "Use the coral plus button when you meet someone."
              : "Try removing a filter or searching for something broader."
          }
          icon={UsersThree}
          title={
            screenData.data!.people.length === 0
              ? "Add your first person"
              : "No matches yet"
          }
        />
      )}
    </Screen>
  );
}

function FilterGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.filterGroup}>
      <View style={styles.filterLabel}>
        {icon}
        <AppText variant="label">{label}</AppText>
      </View>
      <ScrollView
        contentContainerStyle={styles.chipRow}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <AppText
        style={selected ? styles.chipTextSelected : undefined}
        variant="caption"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 52,
    paddingHorizontal: 15,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
  },
  filterButton: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  filterButtonSelected: {
    backgroundColor: colors.ink,
  },
  filters: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 17,
    paddingVertical: 18,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 18,
  },
  chipRow: {
    gap: 8,
    paddingHorizontal: 18,
  },
  chip: {
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: colors.sageStrong,
  },
  chipTextSelected: {
    color: colors.paper,
  },
  resultHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  list: {
    gap: 9,
  },
  shortcuts: {
    flexDirection: "row",
    gap: 9,
  },
  shortcut: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    paddingVertical: 13,
  },
  sections: {
    gap: 20,
  },
  section: {
    gap: 9,
  },
  sectionLetter: {
    color: colors.inkMuted,
    paddingHorizontal: 4,
  },
});
