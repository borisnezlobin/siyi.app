import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  CalendarCheck,
  ChatCircleDots,
  Check,
  Clock,
  Plus,
  UserPlus,
  X,
} from "phosphor-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import {
  colors,
  fontFamilies,
  radii,
} from "@/constants/theme";
import {
  createFollowUp,
  createInteraction,
  getPeople,
} from "@/lib/data";
import {
  interactionTypes,
  type InteractionType,
  type Person,
} from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

type CapturePhase = "menu" | "follow-up" | "interaction";

type QuickCaptureContextValue = {
  revision: number;
  open: () => void;
  addPerson: () => void;
  addFollowUp: (personId?: string) => void;
  logInteraction: (personId?: string) => void;
};

const QuickCaptureContext =
  createContext<QuickCaptureContextValue | null>(null);

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

function dueAtFromOption(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(days === 0 ? 20 : 17, 0, 0, 0);
  return date.toISOString();
}

function CaptureAction({
  icon: IconComponent,
  title,
  body,
  accent,
  onPress,
}: {
  icon: typeof UserPlus;
  title: string;
  body: string;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.captureAction,
        accent && styles.captureActionAccent,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.captureIcon,
          accent && styles.captureIconAccent,
        ]}
      >
        <IconComponent
          color={accent ? colors.paper : colors.sageStrong}
          size={25}
          weight="duotone"
        />
      </View>
      <View style={styles.captureCopy}>
        <AppText
          style={accent ? styles.lightText : undefined}
          variant="heading"
        >
          {title}
        </AppText>
        <AppText
          style={accent ? styles.lightMuted : undefined}
          variant="caption"
        >
          {body}
        </AppText>
      </View>
    </Pressable>
  );
}

function PersonPicker({
  people,
  selectedId,
  onSelect,
}: {
  people: Person[];
  selectedId: string | null;
  onSelect: (personId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filteredPeople = people
    .filter((person) =>
      [
        person.fullName,
        person.preferredName,
        person.instagramUsername,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .slice(0, 7);

  return (
    <View style={styles.picker}>
      <AppText variant="label">Who is this for?</AppText>
      <View style={styles.search}>
        <TextInput
          accessibilityLabel="Search people"
          autoCapitalize="words"
          onChangeText={setQuery}
          placeholder="Search people"
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.coral}
          style={styles.searchInput}
          value={query}
        />
      </View>
      <View style={styles.personOptions}>
        {filteredPeople.map((person) => {
          const selected = person.id === selectedId;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={person.id}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(person.id);
              }}
              style={({ pressed }) => [
                styles.personOption,
                selected && styles.personOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <Avatar
                name={person.fullName}
                size={38}
                uri={person.profilePhotoUrl}
              />
              <AppText numberOfLines={1} style={styles.personOptionName}>
                {person.preferredName || person.fullName}
              </AppText>
              {selected ? (
                <Check color={colors.paper} size={17} weight="bold" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function QuickCaptureProvider({
  children,
}: {
  children: ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [phase, setPhase] = useState<CapturePhase>("menu");
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [followUpText, setFollowUpText] = useState("");
  const [dueOption, setDueOption] = useState(1);
  const [interactionType, setInteractionType] =
    useState<InteractionType>("texted");
  const [interactionNote, setInteractionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      setPeople((await getPeople()).filter((person) => person.status !== "archived"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "People could not be loaded.",
      );
    } finally {
      setLoadingPeople(false);
    }
  }, []);

  const resetForm = useCallback(() => {
    setFollowUpText("");
    setDueOption(1);
    setInteractionType("texted");
    setInteractionNote("");
    setError(null);
  }, []);

  const present = useCallback(
    (nextPhase: CapturePhase, personId?: string) => {
      resetForm();
      setPhase(nextPhase);
      setSelectedPersonId(personId || null);
      modalRef.current?.present();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (nextPhase !== "menu") void loadPeople();
    },
    [loadPeople, resetForm],
  );

  const addPerson = useCallback(() => {
    modalRef.current?.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/people/new");
  }, [router]);

  async function saveFollowUp() {
    if (!session || !selectedPersonId || !followUpText.trim()) {
      setError("Choose someone and add what you want to remember.");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createFollowUp(session.user.id, {
        personId: selectedPersonId,
        text: followUpText,
        dueAt: dueAtFromOption(dueOption),
      });
      setRevision((value) => value + 1);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      modalRef.current?.dismiss();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That follow-up could not be saved.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  async function saveInteraction() {
    if (!session || !selectedPersonId) {
      setError("Choose someone first.");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createInteraction(session.user.id, {
        personId: selectedPersonId,
        type: interactionType,
        occurredAt: new Date().toISOString(),
        note: interactionNote,
      });
      setRevision((value) => value + 1);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      modalRef.current?.dismiss();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That interaction could not be saved.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.42}
        pressBehavior="close"
      />
    ),
    [],
  );

  const value = useMemo<QuickCaptureContextValue>(
    () => ({
      revision,
      open: () => present("menu"),
      addPerson,
      addFollowUp: (personId) => present("follow-up", personId),
      logInteraction: (personId) => present("interaction", personId),
    }),
    [addPerson, present, revision],
  );

  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <BottomSheetModal
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        enableDynamicSizing
        handleIndicatorStyle={styles.handle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        ref={modalRef}
      >
        {phase === "menu" ? (
          <BottomSheetView
            style={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View>
                <AppText variant="title">Capture the moment</AppText>
                <AppText style={styles.muted}>
                  Save it now, keep the context later.
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => modalRef.current?.dismiss()}
                style={styles.closeButton}
              >
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>
            <View style={styles.actionStack}>
              <CaptureAction
                accent
                body="Name, contact, and where you met"
                icon={UserPlus}
                onPress={addPerson}
                title="Add someone"
              />
              <CaptureAction
                body="Set something useful for later"
                icon={CalendarCheck}
                onPress={() => present("follow-up")}
                title="Add a follow-up"
              />
              <CaptureAction
                body="Text, call, coffee, class, or anything else"
                icon={ChatCircleDots}
                onPress={() => present("interaction")}
                title="Log an interaction"
              />
            </View>
          </BottomSheetView>
        ) : (
          <BottomSheetScrollView
            contentContainerStyle={[
              styles.sheetContent,
              { paddingBottom: Math.max(insets.bottom + 24, 36) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <AppText variant="title">
                  {phase === "follow-up"
                    ? "Add a follow-up"
                    : "Log an interaction"}
                </AppText>
                <AppText style={styles.muted}>
                  {phase === "follow-up"
                    ? "A small promise to your future self."
                    : "A quick note is plenty."}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                onPress={() => modalRef.current?.dismiss()}
                style={styles.closeButton}
              >
                <X color={colors.ink} size={21} />
              </Pressable>
            </View>

            {loadingPeople ? (
              <ActivityIndicator color={colors.coral} style={styles.loader} />
            ) : people.length > 0 ? (
              <PersonPicker
                onSelect={setSelectedPersonId}
                people={people}
                selectedId={selectedPersonId}
              />
            ) : (
              <View style={styles.noPeople}>
                <AppText variant="heading">Add someone first</AppText>
                <AppText style={styles.muted}>
                  Interactions and follow-ups stay attached to a person.
                </AppText>
                <Button
                  compact
                  icon={Plus}
                  label="Add someone"
                  onPress={addPerson}
                />
              </View>
            )}

            {phase === "follow-up" ? (
              <>
                <FormField
                  autoFocus={Boolean(selectedPersonId)}
                  label="What do you want to remember?"
                  multiline
                  onChangeText={setFollowUpText}
                  placeholder="Send the class notes"
                  value={followUpText}
                />
                <View style={styles.optionGroup}>
                  <AppText variant="label">When?</AppText>
                  <View style={styles.optionRow}>
                    {[
                      { label: "Today", value: 0 },
                      { label: "Tomorrow", value: 1 },
                      { label: "Next week", value: 7 },
                      { label: "In 2 weeks", value: 14 },
                    ].map((option) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: dueOption === option.value,
                        }}
                        key={option.value}
                        onPress={() => {
                          setDueOption(option.value);
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.optionChip,
                          dueOption === option.value &&
                            styles.optionChipSelected,
                        ]}
                      >
                        <Clock
                          color={
                            dueOption === option.value
                              ? colors.paper
                              : colors.inkMuted
                          }
                          size={15}
                        />
                        <AppText
                          style={
                            dueOption === option.value
                              ? styles.lightText
                              : undefined
                          }
                          variant="caption"
                        >
                          {option.label}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Button
                  disabled={!selectedPersonId || !followUpText.trim()}
                  label="Save follow-up"
                  loading={saving}
                  onPress={() => void saveFollowUp()}
                />
              </>
            ) : (
              <>
                <View style={styles.optionGroup}>
                  <AppText variant="label">What happened?</AppText>
                  <View style={styles.typeGrid}>
                    {interactionTypes.map((type) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: interactionType === type,
                        }}
                        key={type}
                        onPress={() => {
                          setInteractionType(type);
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.typeOption,
                          interactionType === type &&
                            styles.typeOptionSelected,
                        ]}
                      >
                        <AppText
                          style={
                            interactionType === type
                              ? styles.lightText
                              : undefined
                          }
                          variant="label"
                        >
                          {interactionLabels[type]}
                        </AppText>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <FormField
                  label="Note (optional)"
                  multiline
                  onChangeText={setInteractionNote}
                  placeholder="Caught up after class"
                  value={interactionNote}
                />
                <Button
                  disabled={!selectedPersonId}
                  label="Save interaction"
                  loading={saving}
                  onPress={() => void saveInteraction()}
                />
              </>
            )}
            {error ? (
              <AppText style={styles.error} variant="caption">
                {error}
              </AppText>
            ) : null}
          </BottomSheetScrollView>
        )}
      </BottomSheetModal>
    </QuickCaptureContext.Provider>
  );
}

export function useQuickCapture() {
  const context = useContext(QuickCaptureContext);
  if (!context) {
    throw new Error(
      "useQuickCapture must be used inside QuickCaptureProvider.",
    );
  }
  return context;
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.porcelain,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
  },
  handle: {
    backgroundColor: colors.inkMuted,
    opacity: 0.35,
    width: 44,
  },
  sheetContent: {
    gap: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sheetHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionStack: {
    gap: 12,
  },
  captureAction: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    flexDirection: "row",
    gap: 14,
    minHeight: 92,
    padding: 16,
  },
  captureActionAccent: {
    backgroundColor: colors.coral,
  },
  captureIcon: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  captureIconAccent: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  captureCopy: {
    flex: 1,
    gap: 3,
  },
  lightText: {
    color: colors.paper,
  },
  lightMuted: {
    color: "rgba(255,255,255,0.78)",
  },
  muted: {
    color: colors.inkMuted,
  },
  error: {
    color: colors.coralStrong,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  picker: {
    gap: 10,
  },
  search: {
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
  },
  searchInput: {
    color: colors.ink,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 15,
  },
  personOptions: {
    gap: 8,
  },
  personOption: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  personOptionSelected: {
    backgroundColor: colors.sageStrong,
  },
  personOptionName: {
    flex: 1,
  },
  optionGroup: {
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  optionChipSelected: {
    backgroundColor: colors.ink,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 17,
  },
  typeOptionSelected: {
    backgroundColor: colors.sageStrong,
  },
  noPeople: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 8,
    padding: 20,
  },
  loader: {
    marginVertical: 24,
  },
  flex: {
    flex: 1,
  },
});
