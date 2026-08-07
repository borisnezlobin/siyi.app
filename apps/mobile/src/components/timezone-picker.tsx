import * as Haptics from "expo-haptics";
import {
  Check,
  Clock,
  MagnifyingGlass,
  MapPin,
  X,
} from "phosphor-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import {
  friendlyTimezones,
  timezoneOffset,
  timezonePlace,
  timezoneMatchRank,
  timezoneSearchText,
  timezoneTitle,
} from "@/lib/timezones";
import {
  colors,
  fontFamilies,
  floatShadow,
  radii,
} from "@/constants/theme";

export function TimezonePicker({
  detectedTimezone,
  onChange,
  value,
}: {
  detectedTimezone?: string;
  onChange: (timezone: string) => void;
  value: string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);
    const matches = words.length
      ? friendlyTimezones().filter((timezone) => {
          const haystack = timezoneSearchText(timezone);
          return words.every((word) => haystack.includes(word));
        })
      : friendlyTimezones();

    return [...matches].sort((left, right) => {
      const leftPreferred =
        left.name === detectedTimezone ||
        left.group.includes(detectedTimezone || "");
      const rightPreferred =
        right.name === detectedTimezone ||
        right.group.includes(detectedTimezone || "");
      if (leftPreferred !== rightPreferred) {
        return Number(rightPreferred) - Number(leftPreferred);
      }
      const byRank = timezoneMatchRank(right, normalized) - timezoneMatchRank(left, normalized);
      if (byRank !== 0) return byRank;
      // A zone people actually live in beats one that merely shares a word.
      return right.mainCities.length - left.mainCities.length;
    });
  }, [detectedTimezone, query]);

  function choose(timezone: string) {
    onChange(timezone);
    setOpen(false);
    setQuery("");
    void Haptics.selectionAsync();
  }

  return (
    <>
      <Pressable
        accessibilityHint="Opens a searchable list of cities and timezones"
        accessibilityLabel={`Timezone, ${timezoneTitle(value)}`}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.selection,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.selectionIcon}>
          <Clock color={colors.sageStrong} size={21} weight="duotone" />
        </View>
        <View style={styles.flex}>
          <AppText variant="label">{timezoneTitle(value)}</AppText>
          <AppText numberOfLines={1} variant="caption">
            {[timezonePlace(value), timezoneOffset(value)]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        </View>
        <AppText style={styles.change} variant="caption">
          Change
        </AppText>
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modal}
        >
          <Pressable
            accessibilityLabel="Close timezone picker"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.flex}>
                <AppText variant="title">Where are you?</AppText>
                <AppText style={styles.muted}>
                  Search for a city or country. We’ll handle the clock changes.
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                style={styles.close}
              >
                <X color={colors.ink} size={20} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.search}>
              <MagnifyingGlass color={colors.inkMuted} size={20} />
              <TextInput
                accessibilityLabel="Search cities or countries"
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search city or country…"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="search"
                selectionColor={colors.coral}
                style={styles.searchInput}
                value={query}
              />
            </View>

            <FlatList
              contentContainerStyle={styles.list}
              data={options}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              keyExtractor={(timezone) => timezone.name}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <AppText variant="heading">No matching place</AppText>
                  <AppText style={styles.muted}>
                    Try a nearby city or the country name.
                  </AppText>
                </View>
              }
              renderItem={({ item }) => {
                const selected =
                  item.name === value || item.group.includes(value);
                const detected =
                  item.name === detectedTimezone ||
                  item.group.includes(detectedTimezone || "");
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() =>
                      choose(
                        detected && detectedTimezone
                          ? detectedTimezone
                          : item.name,
                      )
                    }
                    style={[
                      styles.option,
                      selected && styles.optionSelected,
                    ]}
                  >
                    <View style={styles.placeIcon}>
                      <MapPin
                        color={
                          selected ? colors.sageStrong : colors.inkMuted
                        }
                        size={20}
                        weight={selected ? "fill" : "duotone"}
                      />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.optionTitle}>
                        <AppText variant="label">
                          {item.alternativeName}
                        </AppText>
                        {detected ? (
                          <AppText style={styles.detected} variant="caption">
                            This device
                          </AppText>
                        ) : null}
                      </View>
                      <AppText numberOfLines={2} variant="caption">
                        {[
                          item.mainCities.slice(0, 2).join(", "),
                          item.countryName,
                          timezoneOffset(item.name),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </AppText>
                    </View>
                    {selected ? (
                      <Check
                        color={colors.sageStrong}
                        size={20}
                        weight="bold"
                      />
                    ) : null}
                  </Pressable>
                );
              }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(10, 17, 14, 0.46)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  change: {
    color: colors.sageStrong,
    fontFamily: fontFamilies.bodySemibold,
  },
  close: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  detected: {
    color: colors.sageStrong,
    fontFamily: fontFamilies.bodySemibold,
  },
  empty: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 28,
    paddingVertical: 42,
  },
  flex: {
    flex: 1,
  },
  handle: {
    alignSelf: "center",
    backgroundColor: colors.mist,
    borderRadius: 2,
    height: 4,
    marginBottom: 15,
    width: 42,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  list: {
    gap: 5,
    paddingBottom: 18,
  },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  muted: {
    color: colors.inkMuted,
  },
  option: {
    alignItems: "center",
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 11,
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionSelected: {
    backgroundColor: colors.sage,
  },
  optionTitle: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  placeIcon: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  pressed: {
    opacity: 0.72,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 9,
    marginBottom: 12,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    paddingVertical: 12,
  },
  selection: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 11,
    minHeight: 68,
    padding: 13,
  },
  selectionIcon: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.large,
    borderTopRightRadius: radii.large,
    // No minimum: the keyboard has to be able to squeeze this, or the sheet is
    // pushed off the top of the screen instead of shrinking.
    maxHeight: "88%",
    flexShrink: 1,
    paddingHorizontal: 20,
    paddingTop: 11,
    ...floatShadow,
  },
});
