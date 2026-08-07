import { MapPin, Question } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { HometownMap } from "@/components/hometown-map";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { EmptyState } from "@/components/surface";
import { colors, radii } from "@/constants/theme";
import { getPeople } from "@/lib/data";
import { type MapMode, summariseHometowns } from "@/lib/geocode";
import type { Person } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";

export default function MapScreen() {
  const router = useRouter();
  const screenData = useRefreshableData<Person[]>(() => getPeople());
  const [mode, setMode] = useState<MapMode>("hometown");

  const summary = useMemo(() => {
    const people = (screenData.data ?? [])
      .filter((person) => person.status !== "archived")
      .map((person) => ({
        id: person.id,
        name: person.preferredName || person.fullName,
        hometown: person.hometown,
        university: person.university,
      }));
    return summariseHometowns(people, mode);
  }, [mode, screenData.data]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Finding everyone…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  const { places, unplaced, withoutHometown } = summary;
  const placedCount = places.reduce((total, place) => total + place.people.length, 0);
  const noun = mode === "college" ? "school" : "hometown";

  return (
    <Screen
      onRefresh={() => void screenData.refresh()}
      refreshing={screenData.refreshing}
      subtitle={`Drawn from the ${noun}s you have written down. Nothing about your people is sent anywhere to draw this.`}
      title={mode === "college" ? "Where everyone studies" : "Where everyone's from"}
    >
      <View style={styles.toggle}>
        {(
          [
            ["hometown", "Hometown"],
            ["college", "College"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === value }}
            key={value}
            onPress={() => setMode(value)}
            style={[styles.toggleOption, mode === value && styles.toggleOptionSelected]}
          >
            <AppText
              style={mode === value ? styles.toggleTextSelected : undefined}
              variant="caption"
            >
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {places.length === 0 && unplaced.length === 0 ? (
        <EmptyState
          body={`Add a ${noun} to someone's profile and they will show up here.`}
          icon={MapPin}
          title={`No ${noun}s saved yet`}
        />
      ) : (
        <>
          <HometownMap places={places} />
          <AppText variant="caption">
            {placedCount === 1 ? "1 person" : `${placedCount} people`} placed across{" "}
            {places.length === 1 ? "one place" : `${places.length} places`}.
            {places.some((place) => place.precision !== "city")
              ? " Hollow pins are approximate."
              : ""}
          </AppText>

          <View style={styles.section}>
            <AppText variant="heading">Places</AppText>
            {places.map((place) => (
              <View key={place.key} style={styles.card}>
                <View style={styles.cardHead}>
                  <MapPin
                    color={colors.coral}
                    size={16}
                    weight={place.precision === "city" ? "fill" : "regular"}
                  />
                  <AppText style={styles.cardTitle} variant="body">
                    {place.label}
                  </AppText>
                  <AppText variant="caption">{place.people.length}</AppText>
                </View>
                <View style={styles.names}>
                  {place.people.map((person) => (
                    <Pressable
                      key={person.id}
                      onPress={() => router.push(`/people/${person.id}`)}
                    >
                      <AppText style={styles.name} variant="caption">
                        {person.name}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {unplaced.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading">Couldn&rsquo;t place these</AppText>
          <AppText variant="caption">
            Either it is not in our list, or the name belongs to more than one place and
            we would rather leave it off than guess wrong.
          </AppText>
          {unplaced.map((item) => (
            <View key={item.hometown} style={styles.card}>
              <View style={styles.cardHead}>
                <Question color={colors.inkMuted} size={16} />
                <AppText style={styles.cardTitle} variant="body">
                  {item.hometown}
                </AppText>
                <AppText variant="caption">{item.people.length}</AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {withoutHometown.length > 0 ? (
        <AppText variant="caption">
          {withoutHometown.length === 1
            ? `1 person has no ${noun} saved.`
            : `${withoutHometown.length} people have no ${noun} saved.`}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  toggleOption: {
    alignItems: "center",
    borderRadius: radii.small,
    flex: 1,
    paddingVertical: 9,
  },
  toggleOptionSelected: {
    backgroundColor: colors.paper,
  },
  toggleTextSelected: {
    color: colors.ink,
  },
  section: {
    gap: 9,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    gap: 6,
    padding: 14,
  },
  cardHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
  },
  names: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  name: {
    color: colors.ink,
  },
});
