import {
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetModal,
} from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUUpLeft,
  Bell,
  ChatCircle,
  ChatCircleDots,
  Check,
  Clock,
  DiscordLogo,
  Envelope,
  InstagramLogo,
  LightbulbFilament,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Plus,
  Shuffle,
  Trash,
  UserPlus,
  UsersThree,
  Warning,
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
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppBottomSheet,
  AppBottomSheetScrollView,
} from "@/components/app-bottom-sheet";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { DateField } from "@/components/date-field";
import { useRevealOnFocus } from "@/components/focus-scroll";
import { FormField } from "@/components/form-field";
import { brand } from "@/config/brand";
import {
  colors,
  fontFamilies,
  radii,
} from "@/constants/theme";
import {
  createReminder,
  editReminder,
  deleteReminder,
  createInteraction,
  createPersonUpdate,
  deleteInteraction,
  deletePersonUpdate,
  editInteraction,
  editPersonUpdate,
  getPeople,
  getPersonDetails,
  getRecentCustomLabels,
  noteSectionsOf,
  classifyUpdateViaWeb,
  type PersonDetails,
} from "@/lib/data";
import {
  classifyUpdate,
  sourceLabel,
  type ClassifierSource,
} from "@/lib/update-classifier";
import { getClasses } from "@/lib/classes-data";
import { contactDraftsOf, type ContactMethodDraft } from "@/lib/contact-methods";
import { onDeviceSortUpdate } from "@/lib/on-device-intelligence";
import { mobileProposalClient } from "@/lib/update-proposal-client";
import {
  applyResultMessage,
  applyUpdateProposal,
} from "@/lib/update-proposal-apply";
import {
  buildProposalContext,
  buildProposalItems,
  describeItem,
  planFromItems,
  planSize,
  proposalFieldLabels,
  type Decisions,
  type ProposalItem,
} from "@/lib/update-proposal";
import { CustomTypeIconPicker } from "@/components/custom-type-fields";
import {
  isCustomTypeIconKey,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";
import { interactionRowsFor, learnedUpdateFor } from "@/lib/capture-drafts";
import { interactionLabels } from "@/lib/interaction-labels";
import {
  interactionFromTitle,
  interactionTitleSuggestions,
} from "@/lib/interaction-title";
import { rankPeopleForPicker } from "@/lib/person-search";
import type { EditableEntry } from "@/lib/update-entries";
import {
  chooseCatchUpPerson,
  fallbackConversationStarters,
} from "@/lib/catch-up";
import {
  dateFromDateInput,
  daysAgoDateInputValue,
  isFutureDateInput,
  isValidDateInput,
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import {
  contactChoicesForPerson,
  openContactMethod,
  type ContactMethod,
} from "@/lib/contact-links";
import {
  getPreferredContactMethod,
  setPreferredContactMethod,
} from "@/lib/contact-preferences";
import { lastInteractionLine } from "@/lib/relative-time";
import {
  reminderDayFromDaysAway,
  reminderDayLabel,
  reminderDayValue,
  reminderDueAt,
  reminderQuickChoices,
} from "@/lib/reminder-due";
import { onDeviceConversationStarters } from "@/lib/on-device-intelligence";
import {
  type InteractionType,
  type Reminder,
  type Person,
} from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

type CapturePhase =
  | "menu"
  | "update-review"
  | "reminder"
  | "interaction"
  | "update"
  | "catch-up"
  | "choose-catch-up"
  | "contact";

type QuickCaptureContextValue = {
  revision: number;
  open: () => void;
  addPerson: () => void;
  addReminder: (personId?: string) => void;
  editReminder: (reminder: Reminder) => void;
  logInteraction: (personId?: string) => void;
  addUpdate: (personId?: string) => void;
  editEntry: (entry: EditableEntry) => void;
  catchUp: (personId?: string) => void;
  sayHello: (personId: string) => void;
};

const QuickCaptureContext =
  createContext<QuickCaptureContextValue | null>(null);

function CaptureAction({
  icon: IconComponent,
  title,
  body,
  divided = true,
  primary = false,
  onPress,
}: {
  icon: typeof UserPlus;
  title: string;
  body: string;
  divided?: boolean;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.captureAction,
        divided && styles.captureActionDivided,
        primary && styles.captureActionPrimary,
        pressed && styles.pressed,
      ]}
    >
      <IconComponent color={primary ? colors.paper : colors.ink} size={21} />
      <View style={styles.captureCopy}>
        <AppText style={primary ? styles.lightText : undefined} variant="label">
          {title}
        </AppText>
        <AppText
          style={primary ? styles.lightMuted : undefined}
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
  selectedIds,
  onToggle,
  multiple = false,
  locked = false,
  label = "Who is this for?",
}: {
  people: Person[];
  selectedIds: string[];
  onToggle: (personId: string) => void;
  multiple?: boolean;
  locked?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const revealOnFocus = useRevealOnFocus();
  const lockedPerson = people.find((person) =>
    selectedIds.includes(person.id),
  );

  if (locked && lockedPerson) {
    return (
      <View style={styles.lockedPerson}>
        <Avatar
          name={lockedPerson.fullName}
          size={44}
          uri={lockedPerson.profilePhotoUrl}
        />
        <View style={styles.flex}>
          <AppText variant="caption">{label}</AppText>
          <AppText variant="label">
            {lockedPerson.preferredName || lockedPerson.fullName}
          </AppText>
        </View>
        <Check color={colors.sageStrong} size={20} weight="bold" />
      </View>
    );
  }

  const normalizedQuery = query.trim();
  // A plain list stops being usable somewhere past a hundred contacts, so the
  // same ranking the web uses does the work here: name-start first, then
  // whoever was seen most recently.
  const ranked = rankPeopleForPicker(
    people.map((person) => ({
      ...person,
      lastInteractionAt: person.lastInteractionAt || person.createdAt,
    })),
    normalizedQuery,
    normalizedQuery ? 12 : 6,
  );
  const filteredPeople = ranked
    .map((match) => people.find((person) => person.id === match.id))
    .filter((person): person is Person => Boolean(person));

  return (
    <View style={styles.picker}>
      <View style={styles.search}>
        <MagnifyingGlass color={colors.inkMuted} size={19} />
        <BottomSheetTextInput
          accessibilityLabel="Search people"
          autoCapitalize="words"
          onChangeText={setQuery}
          onSubmitEditing={() => Keyboard.dismiss()}
          placeholder="Search…"
          placeholderTextColor={colors.inkMuted}
          returnKeyType="search"
          selectionColor={colors.coral}
          style={styles.searchInput}
          submitBehavior="blurAndSubmit"
          value={query}
          {...revealOnFocus}
        />
      </View>
      <AppText variant="label">
        {normalizedQuery
          ? "Search results"
          : multiple
            ? "Recent people · choose one or more"
            : "Recent people"}
      </AppText>
      <View style={styles.personOptions}>
        {filteredPeople.map((person) => {
          const selected = selectedIds.includes(person.id);
          return (
            <Pressable
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: selected }}
              key={person.id}
              onPress={() => {
                void Haptics.selectionAsync();
                onToggle(person.id);
              }}
              style={({ pressed }) => [
                styles.personOption,
                selected && styles.personOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View>
                <Avatar
                  name={person.fullName}
                  size={48}
                  uri={person.profilePhotoUrl}
                />
                {selected ? (
                  <View style={styles.selectedBadge}>
                    <Check color={colors.paper} size={12} weight="bold" />
                  </View>
                ) : null}
              </View>
              <AppText
                numberOfLines={1}
                style={[
                  styles.personOptionName,
                  selected && styles.selectedPersonName,
                ]}
                variant="caption"
              >
                {person.preferredName || person.fullName}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {filteredPeople.length === 0 ? (
        <AppText style={styles.noResults}>
          No one matches that search yet.
        </AppText>
      ) : null}
    </View>
  );
}

const contactVisuals: Record<
  ContactMethod,
  {
    backgroundColor: string;
    gradient?: readonly [string, string, ...string[]];
    icon: typeof InstagramLogo;
  }
> = {
  instagram: {
    backgroundColor: "#e1306c",
    gradient: ["#833ab4", "#fd1d1d", "#fcaf45"] as const,
    icon: InstagramLogo,
  },
  messages: {
    backgroundColor: "#34c759",
    icon: ChatCircle,
  },
  mail: {
    backgroundColor: "#0a84ff",
    icon: Envelope,
  },
  discord: {
    backgroundColor: "#5865f2",
    icon: DiscordLogo,
  },
};

function ContactChoiceButton({
  method,
  label,
  detail,
  onPress,
}: {
  method: ContactMethod;
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const visual = contactVisuals[method];
  const IconComponent = visual.icon;
  return (
    <Pressable
      accessibilityLabel={`${label}: ${detail}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.contactChoice,
        pressed && styles.pressed,
      ]}
    >
      {visual.gradient ? (
        <LinearGradient
          colors={visual.gradient}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.brandIcon}
        >
          <IconComponent color={colors.paper} size={25} weight="fill" />
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.brandIcon,
            { backgroundColor: visual.backgroundColor },
          ]}
        >
          <IconComponent color={colors.paper} size={25} weight="fill" />
        </View>
      )}
      <View style={styles.contactChoiceCopy}>
        <AppText variant="label">{label}</AppText>
        <AppText numberOfLines={1} variant="caption">
          {detail}
        </AppText>
      </View>
      <ArrowRight color={colors.inkMuted} size={18} />
    </Pressable>
  );
}

/** Every value they hold of each kind, which is what a proposal is compared to. */
function contactsByKind(drafts: ContactMethodDraft[]) {
  const byKind: Partial<Record<ContactMethodDraft["kind"], string[]>> = {};
  for (const draft of drafts) {
    if (!draft.value.trim()) continue;
    byKind[draft.kind] = [...(byKind[draft.kind] ?? []), draft.value];
  }
  return byKind;
}

export function QuickCaptureProvider({
  children,
}: {
  children: ReactNode;
}) {
  const modalRef = useRef<BottomSheetModal>(null);
  const contextRequestRef = useRef(0);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [phase, setPhase] = useState<CapturePhase>("menu");
  // What a model made of the update, waiting to be agreed with.
  const [reviewItems, setReviewItems] = useState<ProposalItem[]>([]);
  const [reviewDecisions, setReviewDecisions] = useState<Decisions>({});
  const [reviewSource, setReviewSource] = useState<ClassifierSource>("none");
  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [personSelectionLocked, setPersonSelectionLocked] = useState(false);
  const [reminderText, setReminderText] = useState("");
  // Set while an existing reminder is open rather than a new one being written.
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  // Held as text, so the date can be typed as readily as tapped. The chips and
  // everything downstream read the day back out of it.
  const [dueDateText, setDueDateText] = useState(() =>
    reminderDayValue(reminderDayFromDaysAway(1)),
  );
  // Whatever was typed, read as a day. A half-typed date keeps the last one it
  // understood rather than leaving the reminder with no due date at all.
  const dueDay =
    dateFromDateInput(dueDateText) ?? reminderDayFromDaysAway(1);
  const [updateText, setUpdateText] = useState("");
  const [title, setTitle] = useState("");
  const [customIcon, setCustomIcon] = useState<CustomTypeIconKey | "">("");
  const [updateDate, setUpdateDate] = useState(todayDateInputValue());
  const [choosingUpdateDate, setChoosingUpdateDate] = useState(false);
  const [recentCustomLabels, setRecentCustomLabels] = useState<string[]>([]);
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [catchUpDetails, setCatchUpDetails] =
    useState<PersonDetails | null>(null);
  const [loadingCatchUp, setLoadingCatchUp] = useState(false);
  const [modelConversationStarters, setModelConversationStarters] = useState<
    string[]
  >([]);
  const [preferredContactMethod, setPreferredContactMethodState] =
    useState<ContactMethod | null>(null);

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true);
    try {
      setPeople(
        (await getPeople()).filter(
          (person) => person.status !== "archived",
        ),
      );
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
    setReminderText("");
    setDueDateText(reminderDayValue(reminderDayFromDaysAway(1)));
    setUpdateText("");
    setTitle("");
    setCustomIcon("");
    setUpdateDate(todayDateInputValue());
    setChoosingUpdateDate(false);
    setEditingEntry(null);
    setEditingReminderId(null);
    setConfirmingDelete(false);
    setError(null);
  }, []);

  const present = useCallback(
    (nextPhase: CapturePhase, personId?: string) => {
      resetForm();
      setPhase(nextPhase);
      setSelectedPersonIds(personId ? [personId] : []);
      setPersonSelectionLocked(Boolean(personId));
      modalRef.current?.present();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (nextPhase !== "menu") {
        void loadPeople();
      }
      if (nextPhase === "update" || nextPhase === "interaction") {
        void getRecentCustomLabels()
          .then(setRecentCustomLabels)
          .catch(() => setRecentCustomLabels([]));
      }
    },
    [loadPeople, resetForm],
  );

  /** The same sheet as writing one, opened on a reminder that already exists. */
  const openReminder = useCallback(
    (reminder: Reminder) => {
      resetForm();
      setPhase("reminder");
      setSelectedPersonIds([reminder.personId]);
      setPersonSelectionLocked(true);
      setReminderText(reminder.text);
      setDueDateText(toDateInputValue(reminder.dueAt));
      setEditingReminderId(reminder.id);
      modalRef.current?.present();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void loadPeople();
    },
    [loadPeople, resetForm],
  );

  const editEntry = useCallback(
    (entry: EditableEntry) => {
      resetForm();
      setPhase("update");
      setEditingEntry(entry);
      setSelectedPersonIds([]);
      setPersonSelectionLocked(true);
      setUpdateText(entry.body);
      setTitle(entry.customLabel?.trim() || interactionLabels[entry.type] || "");
      setCustomIcon(
        isCustomTypeIconKey(entry.customIcon) ? entry.customIcon : "",
      );
      setUpdateDate(toDateInputValue(entry.at) || todayDateInputValue());
      modalRef.current?.present();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      void getRecentCustomLabels()
        .then(setRecentCustomLabels)
        .catch(() => setRecentCustomLabels([]));
    },
    [resetForm],
  );

  const presentPersonContext = useCallback(
    async (
      nextPhase: Extract<CapturePhase, "catch-up" | "contact">,
      personId?: string,
    ) => {
      resetForm();
      const requestId = contextRequestRef.current + 1;
      contextRequestRef.current = requestId;
      setPhase(nextPhase);
      setCatchUpDetails(null);
      setModelConversationStarters([]);
      setPreferredContactMethodState(null);
      setSelectedPersonIds([]);
      setPersonSelectionLocked(false);
      setLoadingCatchUp(true);
      modalRef.current?.present();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const availablePeople = (
          await getPeople()
        ).filter((person) => person.status === "active");
        setPeople(availablePeople);
        const person = personId
          ? availablePeople.find((item) => item.id === personId)
          : chooseCatchUpPerson(availablePeople);
        if (!person) {
          setError("Add someone before starting a catch-up.");
          return;
        }
        setSelectedPersonIds([person.id]);
        const details = await getPersonDetails(person.id);
        setCatchUpDetails(details);
        void getPreferredContactMethod(person.id).then(
          setPreferredContactMethodState,
        );
        void onDeviceConversationStarters(details.person).then((starters) => {
          if (contextRequestRef.current === requestId && starters.length > 0) {
            setModelConversationStarters(starters);
          }
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "That person’s context could not be loaded.",
        );
      } finally {
        setLoadingCatchUp(false);
      }
    },
    [resetForm],
  );

  const addPerson = useCallback(() => {
    modalRef.current?.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/people/new");
  }, [router]);

  /** Two taps, like every other delete in the sheet: the first one asks. */
  async function removeReminder() {
    if (!editingReminderId) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await deleteReminder(editingReminderId);
      await finishSaving();
    } catch (deleteError) {
      reportFailure(deleteError, "That reminder could not be deleted.");
    } finally {
      setSaving(false);
    }
  }

  async function saveReminder() {
    const personId = selectedPersonIds[0];
    if (!session || !personId || !reminderText.trim()) {
      setError("Choose someone and add what you want to remember.");
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Warning,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingReminderId) {
        await editReminder(editingReminderId, {
          text: reminderText,
          dueAt: reminderDueAt(dueDay),
        });
      } else {
        await createReminder(session.user.id, {
          personId,
          text: reminderText,
          dueAt: reminderDueAt(dueDay),
        });
      }
      setRevision((value) => value + 1);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      modalRef.current?.dismiss();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "That reminder could not be saved.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  const resolvedTitle = interactionFromTitle(title);
  const titleChoices = Array.from(
    new Set([...interactionTitleSuggestions, ...recentCustomLabels]),
  ).slice(0, 10);

  /**
   * Called rather than rendered as a component, so retyping the date does not
   * remount the field and drop the keyboard.
   */
  function whenChooser() {
    return (
      <View style={styles.optionGroup}>
        <AppText variant="label">When was this?</AppText>
        <View style={styles.optionRow}>
          {[
            { label: "Today", value: todayDateInputValue() },
            { label: "Yesterday", value: daysAgoDateInputValue(1) },
          ].map((option) => {
            const selected =
              !choosingUpdateDate && updateDate === option.value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() => {
                  setChoosingUpdateDate(false);
                  setUpdateDate(option.value);
                  void Haptics.selectionAsync();
                }}
                style={[
                  styles.optionChip,
                  selected && styles.optionChipSelected,
                ]}
              >
                <AppText
                  style={selected ? styles.lightText : undefined}
                  variant="caption"
                >
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: choosingUpdateDate }}
            onPress={() => {
              setChoosingUpdateDate(true);
              void Haptics.selectionAsync();
            }}
            style={[
              styles.optionChip,
              choosingUpdateDate && styles.optionChipSelected,
            ]}
          >
            <Clock
              color={choosingUpdateDate ? colors.paper : colors.inkMuted}
              size={15}
            />
            <AppText
              style={choosingUpdateDate ? styles.lightText : undefined}
              variant="caption"
            >
              Another day
            </AppText>
          </Pressable>
        </View>
        {choosingUpdateDate ? (
          <DateField
            bottomSheet
            label="Date"
            maximumDate={new Date()}
            onChangeText={setUpdateDate}
            placeholder={daysAgoDateInputValue(7)}
            value={updateDate}
          />
        ) : null}
      </View>
    );
  }
  const savedCustomLabel = resolvedTitle.customLabel;
  const savedCustomIcon =
    resolvedTitle.type === "other" && customIcon ? customIcon : null;

  function warnAbout(message: string) {
    setError(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  function dateIsUsable() {
    if (isValidDateInput(updateDate) && !isFutureDateInput(updateDate)) {
      return true;
    }
    warnAbout("Pick a day that has already happened.");
    return false;
  }

  async function finishSaving() {
    setRevision((value) => value + 1);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    modalRef.current?.dismiss();
  }

  function reportFailure(saveError: unknown, fallback: string) {
    setError(saveError instanceof Error ? saveError.message : fallback);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  /**
   * Seeing four people at once is one evening to you and four separate rows in
   * the database, because each of them has their own answer to "when did I last
   * see them" — which is the date every reminder is measured from.
   */
  async function saveInteraction() {
    if (!session || selectedPersonIds.length === 0) {
      warnAbout("Choose who you saw.");
      return;
    }
    if (!dateIsUsable()) return;

    setSaving(true);
    setError(null);
    try {
      const rows = interactionRowsFor({
        personIds: selectedPersonIds,
        title,
        occurredOn: updateDate,
        note: updateText,
        icon: savedCustomIcon,
      });
      for (const row of rows) {
        await createInteraction(session.user.id, row);
      }
      await finishSaving();
    } catch (saveError) {
      reportFailure(saveError, "That could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * An update is something you learned, so it is written with is_interaction
   * false and nobody's last-seen date moves. Editing an older entry keeps
   * whatever it was saved as: nothing here quietly changes its meaning.
   */
  async function saveUpdate() {
    if (!session || !updateText.trim()) {
      warnAbout(editingEntry ? "Add a few words." : "Write what you learned.");
      return;
    }
    if (!editingEntry && selectedPersonIds.length === 0) {
      warnAbout("Choose who this update is about.");
      return;
    }
    if (!dateIsUsable()) return;

    setSaving(true);
    setError(null);
    try {
      const recordedAt = timestampFromDateInput(updateDate);
      const naming = editingEntry?.countsAsContact
        ? {
            type: resolvedTitle.type,
            customLabel: savedCustomLabel,
            customIcon: savedCustomIcon,
          }
        : {
            type: "other" as InteractionType,
            customLabel: null,
            customIcon: null,
          };

      if (editingEntry?.kind === "update") {
        await editPersonUpdate(session.user.id, editingEntry.id, {
          text: updateText,
          recordedAt,
          ...naming,
        });
      } else if (editingEntry?.kind === "interaction") {
        await editInteraction(session.user.id, editingEntry.id, {
          occurredAt: recordedAt,
          note: updateText,
          ...naming,
        });
      } else {
        // One person at a time: sorting one sentence into several profiles
        // would have to guess which parts belong to whom.
        if (selectedPersonIds.length === 1) {
          const sorted = await sortThisUpdate(selectedPersonIds[0]);
          if (sorted) {
            setSaving(false);
            return;
          }
        }

        await createPersonUpdate(
          session.user.id,
          learnedUpdateFor({
            personIds: selectedPersonIds,
            text: updateText,
            recordedOn: updateDate,
          }),
        );
      }
      await finishSaving();
    } catch (saveError) {
      reportFailure(saveError, "That update could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Ask where this update belongs, and show what came back.
   *
   * Returns true when there is something to agree with, so the caller waits.
   * Everything else — no model, nothing found, a model having a bad day — is a
   * false, and the update saves as plain words exactly as it always did.
   */
  async function sortThisUpdate(personId: string): Promise<boolean> {
    if (!session) return false;

    try {
      return await proposeSortedUpdate(personId);
    } catch {
      // Sorting is an extra, never a gate. Anything at all going wrong here
      // leaves the update to be saved as plain words, which is what this did
      // before there was a model involved.
      return false;
    }
  }

  async function proposeSortedUpdate(personId: string): Promise<boolean> {
    if (!session) return false;

    const details = await getPersonDetails(personId).catch(() => null);
    if (!details) return false;

    const heldClasses = session
      ? await getClasses(session.user.id)
          .then((all) =>
            all
              .filter((entry) => entry.personId === personId)
              .map((entry) => entry.courseCode),
          )
          .catch(() => [] as string[])
      : [];

    const sections = noteSectionsOf(details).sections.map((note) => ({
      id: note.id,
      heading: note.heading,
      body: note.body,
    }));
    const context = buildProposalContext({
      person: details.person,
      sections,
      now: new Date(),
    });

    const { proposal, source } = await classifyUpdate({
      context,
      text: updateText,
      onDevice: onDeviceSortUpdate,
      onServer: brand.webUrl
        ? async () => {
            const answer = await classifyUpdateViaWeb(session, brand.webUrl, {
              personId,
              text: updateText,
            });
            return answer?.proposal ?? null;
          }
        : null,
    });

    if (!proposal) return false;

    const items = buildProposalItems({
      proposal,
      person: details.person,
      sections,
      contact: contactsByKind(contactDraftsOf(details.person)),
      classes: heldClasses,
      now: new Date(),
    });
    if (items.length === 0) return false;

    setReviewItems(items);
    setReviewDecisions({});
    setReviewSource(source);
    setPhase("update-review");
    return true;
  }

  /** Write what was agreed to, the typed words first. */
  async function saveReviewedUpdate() {
    if (!session || selectedPersonIds.length !== 1) return;
    setSaving(true);
    setError(null);
    try {
      const result = await applyUpdateProposal(
        mobileProposalClient({
          userId: session.user.id,
          personId: selectedPersonIds[0],
          recordedOn: updateDate,
        }),
        {
          text: updateText,
          plan: planFromItems(reviewItems, reviewDecisions),
        },
      );

      const message = applyResultMessage(result);
      if (message) {
        setError(message);
        return;
      }
      await finishSaving();
    } catch (saveError) {
      reportFailure(saveError, "That update could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function removeUpdate() {
    if (!session || !editingEntry) return;
    setSaving(true);
    setError(null);
    try {
      if (editingEntry.kind === "update") {
        await deletePersonUpdate(session.user.id, editingEntry.id);
      } else {
        await deleteInteraction(session.user.id, editingEntry.id);
      }
      setRevision((value) => value + 1);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      modalRef.current?.dismiss();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "That update could not be deleted.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  const value = useMemo<QuickCaptureContextValue>(
    () => ({
      revision,
      open: () => present("menu"),
      addPerson,
      addReminder: (personId) => present("reminder", personId),
      editReminder: openReminder,
      logInteraction: (personId) => present("interaction", personId),
      addUpdate: (personId) => present("update", personId),
      editEntry,
      catchUp: (personId) => {
        void presentPersonContext("catch-up", personId);
      },
      sayHello: (personId) => {
        void presentPersonContext("contact", personId);
      },
    }),
    [addPerson, editEntry, openReminder, present, presentPersonContext, revision],
  );
  const contextPerson = catchUpDetails?.person || null;
  const conversationStarters =
    modelConversationStarters.length > 0
      ? modelConversationStarters
      : contextPerson
        ? fallbackConversationStarters(contextPerson)
        : [];
  const contactChoices = contextPerson
    ? contactChoicesForPerson(contextPerson).sort((left, right) => {
        if (left.method === preferredContactMethod) return -1;
        if (right.method === preferredContactMethod) return 1;
        return 0;
      })
    : [];
  const preferredContactChoice =
    contactChoices.find(
      (choice) => choice.method === preferredContactMethod,
    ) || null;

  function togglePerson(personId: string, multiple: boolean) {
    setSelectedPersonIds((current) => {
      if (!multiple) return [personId];
      return current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId];
    });
  }

  async function openContactChoice(method: ContactMethod) {
    if (!contextPerson) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setPreferredContactMethod(contextPerson.id, method);
      setPreferredContactMethodState(method);
      await openContactMethod(contextPerson, method);
    } catch {
      Alert.alert(
        "Couldn’t open that app",
        "Check that the app is installed, or add another contact method for this person.",
      );
    }
  }

  // The three phases that ask you to type. Their save button lives in the
  // sheet's pinned footer, where the keyboard cannot get on top of it and no
  // amount of form above it can push it below the fold. The error goes there
  // too: a warning you have to scroll to find is a warning nobody reads.
  const composing =
    phase === "reminder" ||
    phase === "interaction" ||
    phase === "update" ||
    phase === "update-review";

  const reviewCount = planSize(planFromItems(reviewItems, reviewDecisions));
  const reviewSaveLabel =
    reviewCount === 0
      ? "Save the note"
      : `Save ${reviewCount} ${reviewCount === 1 ? "change" : "changes"}`;

  const composerFooter = (
    <>
      {error ? (
        <AppText style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}
      {phase === "update-review" ? (
        <View style={styles.reviewActions}>
          <Button
            label="Back"
            onPress={() => setPhase("update")}
            style={styles.flex}
            variant="secondary"
          />
          <Button
            label={reviewSaveLabel}
            loading={saving}
            onPress={() => void saveReviewedUpdate()}
            style={styles.flex}
          />
        </View>
      ) : phase === "reminder" ? (
        <>
          <Button
            disabled={!selectedPersonIds[0] || !reminderText.trim()}
            label={editingReminderId ? "Save changes" : "Save reminder"}
            loading={saving}
            onPress={() => void saveReminder()}
          />
          {editingReminderId ? (
            <Button
              label={confirmingDelete ? "Tap again to delete" : "Delete reminder"}
              onPress={() => void removeReminder()}
              variant="secondary"
            />
          ) : null}
        </>
      ) : phase === "interaction" ? (
        <Button
          disabled={selectedPersonIds.length === 0}
          label="Log interaction"
          loading={saving}
          onPress={() => void saveInteraction()}
        />
      ) : (
        <Button
          disabled={
            !updateText.trim() ||
            (!editingEntry && selectedPersonIds.length === 0)
          }
          label={editingEntry ? "Save changes" : "Save update"}
          loading={saving}
          onPress={() => void saveUpdate()}
        />
      )}
    </>
  );

  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <AppBottomSheet
        footer={composing ? composerFooter : undefined}
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
            <CaptureAction
              body="Someone new to remember"
              divided={false}
              icon={UserPlus}
              onPress={addPerson}
              primary
              title="Add a person"
            />
            <View style={styles.actionStack}>
              <CaptureAction
                body="Who you saw or spoke to"
                divided={false}
                icon={UsersThree}
                onPress={() => present("interaction")}
                title="Log an interaction"
              />
              <CaptureAction
                body="Anything you found out — we file it for you"
                icon={NotePencil}
                onPress={() => present("update")}
                title="Add an update"
              />
              <CaptureAction
                body="Something to do before you forget"
                icon={Bell}
                onPress={() => present("reminder")}
                title="Add a reminder"
              />
            </View>
          </BottomSheetView>
        ) : phase === "catch-up" ||
          phase === "choose-catch-up" ||
          phase === "contact" ? (
          <AppBottomSheetScrollView>
            <View style={styles.sheetHeader}>
              {phase === "contact" || phase === "choose-catch-up" ? (
                <Pressable
                  accessibilityLabel="Back to catch-up context"
                  accessibilityRole="button"
                  onPress={() => setPhase("catch-up")}
                  style={styles.closeButton}
                >
                  <ArrowLeft color={colors.ink} size={21} />
                </Pressable>
              ) : null}
              <View style={styles.flex}>
                <AppText variant="title">
                  {phase === "catch-up"
                    ? "Good idea"
                    : phase === "choose-catch-up"
                      ? "Choose someone"
                      : contextPerson
                      ? `Say hello to ${
                          contextPerson.preferredName ||
                          contextPerson.fullName.split(" ")[0]
                        }`
                      : "Choose how to say hello"}
                </AppText>
                <AppText style={styles.muted}>
                  {phase === "catch-up"
                    ? contextPerson
                      ? `How about reaching out to ${
                          contextPerson.preferredName ||
                          contextPerson.fullName.split(" ")[0]
                        }?`
                      : "Finding someone you haven’t heard from in a while…"
                    : phase === "choose-catch-up"
                      ? `Search your people, or let ${brand.shortName} pick.`
                      : "Pick the app that feels natural."}
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

            {phase === "choose-catch-up" ? (
              <>
                <Button
                  compact
                  icon={Shuffle}
                  label="Pick someone for me"
                  onPress={() => {
                    const otherPeople = people.filter(
                      (person) =>
                        person.status === "active" &&
                        person.id !== contextPerson?.id,
                    );
                    const choice =
                      otherPeople[
                        Math.floor(Math.random() * otherPeople.length)
                      ] || people[0];
                    if (choice) {
                      void presentPersonContext("catch-up", choice.id);
                    }
                  }}
                  variant="secondary"
                />
                <PersonPicker
                  onToggle={(personId) =>
                    void presentPersonContext("catch-up", personId)
                  }
                  people={people}
                  selectedIds={
                    contextPerson ? [contextPerson.id] : selectedPersonIds
                  }
                />
              </>
            ) : loadingCatchUp ? (
              <ActivityIndicator color={colors.coral} style={styles.loader} />
            ) : contextPerson ? (
              phase === "catch-up" ? (
                <>
                  <View style={styles.contextProfile}>
                    <Avatar
                      name={contextPerson.fullName}
                      size={68}
                      uri={contextPerson.profilePhotoUrl}
                    />
                    <View style={styles.contextProfileCopy}>
                      <AppText variant="heading">
                        {contextPerson.preferredName ||
                          contextPerson.fullName}
                      </AppText>
                      <AppText variant="caption">
                        {lastInteractionLine(contextPerson.lastInteractionAt)}
                      </AppText>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setPhase("choose-catch-up")}
                        style={styles.choosePersonInline}
                      >
                        <Shuffle color={colors.inkMuted} size={14} />
                        <AppText variant="caption">
                          Choose someone else
                        </AppText>
                      </Pressable>
                    </View>
                  </View>

                  {contextPerson.generalNotes ? (
                    <View style={styles.contextBlock}>
                      <AppText variant="label">What you saved</AppText>
                      <AppText style={styles.contextBody}>
                        {contextPerson.generalNotes}
                      </AppText>
                    </View>
                  ) : null}

                  <View style={styles.starterSection}>
                    <View style={styles.starterHeading}>
                      <LightbulbFilament
                        color={colors.coralStrong}
                        size={21}
                        weight="duotone"
                      />
                      <AppText variant="label">A few easy openings</AppText>
                    </View>
                    {modelConversationStarters.length > 0 ? (
                      <AppText style={styles.privateSuggestion} variant="caption">
                        Suggested privately on this iPhone
                      </AppText>
                    ) : null}
                    {conversationStarters.map((starter) => (
                      <View key={starter} style={styles.starterRow}>
                        <View style={styles.starterDot} />
                        <AppText style={styles.starterCopy}>{starter}</AppText>
                      </View>
                    ))}
                  </View>

                  {preferredContactChoice ? (
                    <View style={styles.preferredContact}>
                      <ContactChoiceButton
                        detail={`Last used · ${preferredContactChoice.detail}`}
                        label={preferredContactChoice.label}
                        method={preferredContactChoice.method}
                        onPress={() =>
                          void openContactChoice(
                            preferredContactChoice.method,
                          )
                        }
                      />
                      <Button
                        compact
                        label="Choose another app"
                        onPress={() => setPhase("contact")}
                        variant="quiet"
                      />
                    </View>
                  ) : (
                    <Button
                      icon={ChatCircleDots}
                      label="Choose how to say hello"
                      onPress={() => setPhase("contact")}
                    />
                  )}
                </>
              ) : (
                <>
                  <View style={styles.contactPerson}>
                    <Avatar
                      name={contextPerson.fullName}
                      size={54}
                      uri={contextPerson.profilePhotoUrl}
                    />
                    <View style={styles.flex}>
                      <AppText variant="heading">
                        {contextPerson.preferredName ||
                          contextPerson.fullName}
                      </AppText>
                      <AppText variant="caption">
                        Opening another app won’t automatically save an update.
                      </AppText>
                    </View>
                  </View>
                  <View style={styles.contactChoices}>
                    {contactChoices.map((choice) => (
                      <ContactChoiceButton
                        detail={choice.detail}
                        key={choice.method}
                        label={choice.label}
                        method={choice.method}
                        onPress={() =>
                          void openContactChoice(choice.method)
                        }
                      />
                    ))}
                  </View>
                  {!contextPerson.instagramUsername &&
                  !contextPerson.phoneNumber &&
                  !contextPerson.email ? (
                    <AppText style={styles.contactNote} variant="caption">
                      Add a phone number, email, or Instagram handle for a
                      direct shortcut. Discord can open your inbox, but{" "}
                      {brand.shortName} can’t target someone from a username alone.
                    </AppText>
                  ) : null}
                </>
              )
            ) : (
              <View style={styles.noPeople}>
                <AppText variant="heading">No one to choose yet</AppText>
                <AppText style={styles.muted}>
                  Add someone, then {brand.shortName} can bring back useful context
                  when you want to catch up.
                </AppText>
                <Button
                  compact
                  icon={Plus}
                  label="Add someone"
                  onPress={addPerson}
                />
              </View>
            )}
            {error ? (
              <AppText style={styles.error} variant="caption">
                {error}
              </AppText>
            ) : null}
          </AppBottomSheetScrollView>
        ) : phase === "update-review" ? (
          <AppBottomSheetScrollView>
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <AppText variant="title">Here is what I found</AppText>
                <AppText style={styles.sheetSubtitle}>
                  Everything below gets saved. Drop anything that is wrong.
                </AppText>
              </View>
            </View>

            <View style={styles.reviewList}>
              {reviewItems.map((item) => {
                const decision = reviewDecisions[item.id] ?? {};
                const described = describeItem(item);
                const conflicted = item.kind === "field" && item.conflict;

                return (
                  <View key={item.id} style={styles.reviewRow}>
                    <View style={styles.reviewRowTop}>
                      <View style={styles.flex}>
                        <View style={styles.reviewLabelRow}>
                          {conflicted ? (
                            <Warning
                              color={colors.coralStrong}
                              size={13}
                              weight="fill"
                            />
                          ) : null}
                          <AppText style={styles.reviewLabel} variant="caption">
                            {described.title}
                          </AppText>
                        </View>
                        <AppText
                          style={[
                            styles.reviewText,
                            decision.removed && styles.reviewTextDropped,
                          ]}
                        >
                          {described.detail}
                        </AppText>
                      </View>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          decision.removed
                            ? `Put ${described.title} back`
                            : `Leave out ${described.title}`
                        }
                        hitSlop={8}
                        onPress={() =>
                          setReviewDecisions((current) => ({
                            ...current,
                            [item.id]: {
                              ...current[item.id],
                              removed: !decision.removed,
                            },
                          }))
                        }
                        style={styles.reviewDrop}
                      >
                        {decision.removed ? (
                          <ArrowUUpLeft color={colors.inkMuted} size={16} />
                        ) : (
                          <Trash color={colors.inkMuted} size={16} />
                        )}
                      </Pressable>
                    </View>

                    {conflicted && !decision.removed ? (
                      <View style={styles.reviewChoice}>
                        <AppText style={styles.reviewHint} variant="caption">
                          {proposalFieldLabels[item.field]} is already saved.
                          Which one is right?
                        </AppText>
                        <View style={styles.reviewChips}>
                          {[
                            { keep: true, label: `Keep ${item.current}` },
                            { keep: false, label: `Use ${item.display}` },
                          ].map((choice) => {
                            const selected =
                              Boolean(decision.keepExisting) === choice.keep;
                            return (
                              <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                key={choice.label}
                                onPress={() =>
                                  setReviewDecisions((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...current[item.id],
                                      keepExisting: choice.keep,
                                    },
                                  }))
                                }
                                style={[
                                  styles.reviewChip,
                                  selected && styles.reviewChipOn,
                                ]}
                              >
                                <AppText
                                  style={[
                                    styles.reviewChipLabel,
                                    selected && styles.reviewChipLabelOn,
                                  ]}
                                  variant="caption"
                                >
                                  {choice.label}
                                </AppText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {sourceLabel(reviewSource) ? (
              <AppText style={styles.reviewSource} variant="caption">
                {sourceLabel(reviewSource)}
              </AppText>
            ) : null}
          </AppBottomSheetScrollView>
        ) : (
          <AppBottomSheetScrollView>
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <AppText variant="title">
                  {phase === "reminder"
                    ? "Add a reminder"
                    : editingEntry
                      ? "Edit this entry"
                      : phase === "interaction"
                        ? "Who did you see?"
                        : "What did you find out?"}
                </AppText>
                <AppText style={styles.muted}>
                  {phase === "reminder"
                    ? "A small promise to your future self."
                    : editingEntry
                      ? "Change what you wrote, or take it off the timeline."
                      : phase === "interaction"
                        ? "Tap a face. Everything after that is optional."
                        : "Anything you found out. We sort it into their profile."}
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

            {phase === "reminder" ? (
              <>
                {loadingPeople ? (
                  <ActivityIndicator
                    color={colors.coral}
                    style={styles.loader}
                  />
                ) : people.length > 0 ? (
                  <PersonPicker
                    label="Reminder for"
                    locked={personSelectionLocked}
                    onToggle={(personId) => togglePerson(personId, false)}
                    people={people}
                    selectedIds={selectedPersonIds}
                  />
                ) : (
                  <View style={styles.noPeople}>
                    <AppText variant="heading">Add someone first</AppText>
                    <AppText style={styles.muted}>
                      Reminders stay attached to a person.
                    </AppText>
                    <Button
                      compact
                      icon={Plus}
                      label="Add someone"
                      onPress={addPerson}
                    />
                  </View>
                )}
                <FormField
                  autoFocus={Boolean(selectedPersonIds[0])}
                  bottomSheet
                  label="What do you want to remember?"
                  multiline
                  onChangeText={setReminderText}
                  placeholder="Send the class notes"
                  value={reminderText}
                />
                <View style={styles.optionGroup}>
                  <AppText variant="label">When?</AppText>
                  <View style={styles.optionRow}>
                    {reminderQuickChoices.map((option) => {
                      const optionDay = reminderDayFromDaysAway(
                        option.daysAway,
                      );
                      const selected =
                        reminderDayValue(dueDay) ===
                        reminderDayValue(optionDay);
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={option.label}
                          onPress={() => {
                            setDueDateText(reminderDayValue(optionDay));
                            void Haptics.selectionAsync();
                          }}
                          style={[
                            styles.optionChip,
                            selected && styles.optionChipSelected,
                          ]}
                        >
                          <Clock
                            color={selected ? colors.paper : colors.inkMuted}
                            size={15}
                          />
                          <AppText
                            style={selected ? styles.lightText : undefined}
                            variant="caption"
                          >
                            {option.label}
                          </AppText>
                        </Pressable>
                      );
                    })}
                  </View>
                  <DateField
                    bottomSheet
                    label="Or choose a date"
                    minimumDate={reminderDayFromDaysAway(0)}
                    onChangeText={setDueDateText}
                    value={dueDateText}
                  />
                  <AppText style={styles.dueSummary} variant="caption">
                    Due {reminderDayLabel(dueDay)}
                  </AppText>
                </View>
              </>
            ) : phase === "interaction" ? (
              <>
                {loadingPeople ? (
                  <ActivityIndicator
                    color={colors.coral}
                    style={styles.loader}
                  />
                ) : people.length > 0 ? (
                  <PersonPicker
                    label="You saw"
                    locked={personSelectionLocked}
                    multiple
                    onToggle={(personId) => togglePerson(personId, true)}
                    people={people}
                    selectedIds={selectedPersonIds}
                  />
                ) : (
                  <View style={styles.noPeople}>
                    <AppText variant="heading">Add someone first</AppText>
                    <AppText style={styles.muted}>
                      An interaction is time spent with a person.
                    </AppText>
                    <Button
                      compact
                      icon={Plus}
                      label="Add someone"
                      onPress={addPerson}
                    />
                  </View>
                )}

                {selectedPersonIds.length > 0 ? (
                  <>
                    <View style={styles.optionGroup}>
                      <FormField
                        bottomSheet
                        label="What was it? (optional)"
                        maxLength={40}
                        onChangeText={setTitle}
                        placeholder="Coffee, studio night, ran into them…"
                        value={title}
                      />
                      <View style={styles.optionRow}>
                        {titleChoices.map((choice) => (
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityState={{ checked: title === choice }}
                            key={choice}
                            onPress={() => {
                              setTitle(choice);
                              void Haptics.selectionAsync();
                            }}
                            style={[
                              styles.optionChip,
                              title === choice && styles.optionChipSelected,
                            ]}
                          >
                            <AppText
                              style={
                                title === choice ? styles.lightText : undefined
                              }
                              variant="caption"
                            >
                              {choice}
                            </AppText>
                          </Pressable>
                        ))}
                      </View>
                      {resolvedTitle.type === "other" && title.trim() ? (
                        <CustomTypeIconPicker
                          icon={customIcon}
                          onIconChange={setCustomIcon}
                        />
                      ) : null}
                    </View>

                    {whenChooser()}

                    <FormField
                      bottomSheet
                      label="Anything to remember? (optional)"
                      multiline
                      onChangeText={setUpdateText}
                      placeholder="A line is plenty."
                      value={updateText}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <>
                {editingEntry ? null : loadingPeople ? (
                  <ActivityIndicator
                    color={colors.coral}
                    style={styles.loader}
                  />
                ) : people.length > 0 ? (
                  <PersonPicker
                    label="This is about"
                    locked={personSelectionLocked}
                    onToggle={(personId) => togglePerson(personId, false)}
                    people={people}
                    selectedIds={selectedPersonIds}
                  />
                ) : (
                  <View style={styles.noPeople}>
                    <AppText variant="heading">Add someone first</AppText>
                    <AppText style={styles.muted}>
                      Updates stay attached to the people they are about.
                    </AppText>
                    <Button
                      compact
                      icon={Plus}
                      label="Add someone"
                      onPress={addPerson}
                    />
                  </View>
                )}

                {editingEntry?.countsAsContact ? (
                  <View style={styles.optionGroup}>
                    <FormField
                      bottomSheet
                      label="What was it?"
                      maxLength={40}
                      onChangeText={setTitle}
                      placeholder="Coffee, studio night, ran into them…"
                      value={title}
                    />
                    <View style={styles.optionRow}>
                      {titleChoices.map((choice) => (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: title === choice }}
                          key={choice}
                          onPress={() => {
                            setTitle(choice);
                            void Haptics.selectionAsync();
                          }}
                          style={[
                            styles.optionChip,
                            title === choice && styles.optionChipSelected,
                          ]}
                        >
                          <AppText
                            style={
                              title === choice ? styles.lightText : undefined
                            }
                            variant="caption"
                          >
                            {choice}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                    {resolvedTitle.type === "other" ? (
                      <CustomTypeIconPicker
                        icon={customIcon}
                        onIconChange={setCustomIcon}
                      />
                    ) : null}
                  </View>
                ) : null}

                <FormField
                  autoFocus
                  bottomSheet
                  label={
                    editingEntry?.countsAsContact
                      ? "Anything to remember?"
                      : "What did you learn?"
                  }
                  multiline
                  onChangeText={setUpdateText}
                  placeholder="Joshua has been getting into photography"
                  style={styles.fastUpdateInput}
                  value={updateText}
                />

                {editingEntry ? (
                  whenChooser()
                ) : (
                  <AppText style={styles.muted} variant="caption">
                    This goes on their profile. It does not count as seeing
                    them, so their reminder stays where it is.
                  </AppText>
                )}

                {!editingEntry &&
                personSelectionLocked &&
                selectedPersonIds.length === 1 ? (
                  <Button
                    compact
                    icon={PencilSimple}
                    label="Edit profile details"
                    onPress={() => {
                      const personId = selectedPersonIds[0];
                      modalRef.current?.dismiss();
                      router.push(`/people/${personId}/edit`);
                    }}
                    variant="quiet"
                  />
                ) : null}

                {editingEntry ? (
                  confirmingDelete ? (
                    <View style={styles.confirmDelete}>
                      <AppText variant="label">
                        {editingEntry.countsAsContact
                          ? "Delete this? You will not get it back, and your reminders will move back accordingly."
                          : "Delete this update? You will not get it back."}
                      </AppText>
                      <View style={styles.confirmRow}>
                        <Button
                          compact
                          label="Yes, delete it"
                          loading={saving}
                          onPress={() => void removeUpdate()}
                          style={styles.flex}
                          variant="danger"
                        />
                        <Button
                          compact
                          label="Keep it"
                          onPress={() => setConfirmingDelete(false)}
                          style={styles.flex}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  ) : (
                    <Button
                      compact
                      icon={Trash}
                      label="Delete this entry"
                      onPress={() => setConfirmingDelete(true)}
                      variant="quiet"
                    />
                  )
                ) : null}
              </>
            )}
          </AppBottomSheetScrollView>
        )}
      </AppBottomSheet>
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
  sheetSubtitle: {
    color: colors.inkMuted,
    marginTop: 4,
  },
  reviewList: {
    gap: 8,
    marginTop: 4,
  },
  reviewRow: {
    backgroundColor: colors.porcelain,
    borderRadius: radii.large,
    gap: 10,
    padding: 14,
  },
  reviewRowTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  reviewLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  reviewLabel: {
    color: colors.inkMuted,
  },
  reviewText: {
    marginTop: 2,
  },
  reviewTextDropped: {
    opacity: 0.45,
    textDecorationLine: "line-through",
  },
  reviewDrop: {
    alignItems: "center",
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  reviewChoice: {
    gap: 8,
  },
  reviewHint: {
    color: colors.inkMuted,
  },
  reviewChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  reviewChip: {
    backgroundColor: colors.paper,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  reviewChipOn: {
    backgroundColor: colors.ink,
  },
  reviewChipLabel: {
    color: colors.inkMuted,
  },
  reviewChipLabelOn: {
    color: colors.paper,
  },
  reviewSource: {
    color: colors.inkMuted,
    marginTop: 12,
    textAlign: "center",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
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
    borderRadius: radii.small,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionStack: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    paddingHorizontal: 16,
  },
  captureAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    minHeight: 64,
    paddingVertical: 14,
  },
  captureActionPrimary: {
    backgroundColor: colors.coral,
    borderRadius: radii.medium,
    paddingHorizontal: 16,
  },
  captureActionDivided: {
    borderTopColor: colors.mist,
    borderTopWidth: 1,
  },
  captureCopy: {
    flex: 1,
    gap: 2,
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
  lockedPerson: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 11,
    padding: 12,
  },
  search: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderColor: colors.mist,
    borderRadius: radii.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 14,
  },
  searchInput: {
    color: colors.ink,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    minHeight: 48,
    paddingRight: 15,
  },
  personOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  personOption: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    flexBasis: "30%",
    flexGrow: 1,
    gap: 7,
    justifyContent: "center",
    maxWidth: "32%",
    minHeight: 92,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  personOptionSelected: {
    backgroundColor: colors.sage,
  },
  personOptionName: {
    maxWidth: "100%",
    textAlign: "center",
  },
  selectedPersonName: {
    color: colors.sageStrong,
    fontFamily: fontFamilies.bodySemibold,
  },
  selectedBadge: {
    alignItems: "center",
    backgroundColor: colors.coral,
    borderRadius: radii.round,
    bottom: -2,
    height: 20,
    justifyContent: "center",
    position: "absolute",
    right: -3,
    width: 20,
  },
  noResults: {
    color: colors.inkMuted,
    paddingVertical: 10,
    textAlign: "center",
  },
  optionGroup: {
    gap: 10,
  },
  fastUpdateInput: {
    minHeight: 88,
  },
  interactionToggle: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 11,
    padding: 13,
  },
  toggleCheck: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 7,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  toggleCheckSelected: {
    backgroundColor: colors.sageStrong,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  optionChipSelected: {
    backgroundColor: colors.ink,
  },
  dueSummary: {
    color: colors.inkMuted,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeOption: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexBasis: "30%",
    flexGrow: 1,
    gap: 5,
    justifyContent: "center",
    maxWidth: "32%",
    minHeight: 74,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  confirmDelete: {
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
    gap: 12,
    padding: 15,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 8,
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
  contextProfile: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    flexDirection: "row",
    gap: 14,
    padding: 16,
  },
  contextProfileCopy: {
    flex: 1,
    gap: 3,
  },
  choosePersonInline: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 5,
    marginTop: 4,
    paddingVertical: 3,
  },
  contextBlock: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 7,
    padding: 17,
  },
  contextBody: {
    color: colors.inkMuted,
  },
  starterSection: {
    backgroundColor: colors.sunSoft,
    borderRadius: radii.large,
    gap: 12,
    padding: 17,
  },
  starterHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  starterRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  privateSuggestion: {
    color: colors.sageStrong,
    marginTop: -6,
  },
  starterDot: {
    backgroundColor: colors.coral,
    borderRadius: radii.round,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  starterCopy: {
    flex: 1,
  },
  contactPerson: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    flexDirection: "row",
    gap: 13,
    padding: 15,
  },
  contactChoices: {
    gap: 10,
  },
  preferredContact: {
    gap: 6,
  },
  contactChoice: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 12,
    minHeight: 68,
    padding: 12,
  },
  brandIcon: {
    alignItems: "center",
    borderRadius: radii.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  contactChoiceCopy: {
    flex: 1,
    gap: 2,
  },
  contactNote: {
    color: colors.inkMuted,
    textAlign: "center",
  },
});
