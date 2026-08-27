import { CollegeField } from "@/components/college-field";
import { storedPersonInput } from "@/lib/person-input";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  AddressBook,
  ArrowLeft,
  Camera,
  CaretDown,
  CaretUp,
  Check,
  ImageSquare,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ContactImportSheet } from "@/components/contact-import-sheet";
import { ContactMethodField } from "@/components/contact-method-field";
import { DateField } from "@/components/date-field";
import { FormField } from "@/components/form-field";
import { FormSection } from "@/components/form-section";
import {
  KeyboardAwareForm,
  useFieldChain,
} from "@/components/keyboard-aware-form";
import { PersonNoteSections } from "@/components/person-note-sections";
import { colors, radii } from "@/constants/theme";
import {
  contactFormValues,
  contactMethodKinds,
  emptyContactDrafts,
  initialContactDrafts,
  type ContactMethodDraft,
} from "@/lib/contact-methods";
import { offerContactSyncAfterSave } from "@/lib/contact-sync-flow";
import type { ImportableContact } from "@/lib/device-contacts";
import {
  isFutureDateInput,
  parseDateInput,
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import { hasUnsavedChanges, type FormValues } from "@/lib/form-changes";
import { createPerson, getUsedNoteHeadings, updatePerson } from "@/lib/data";
import {
  isDefaultRelationshipLabel,
  maxRelationshipLabelLength,
  relationshipTierLabels,
} from "@/lib/relationship-labels";
import {
  personStatuses,
  relationshipStrengths,
  type Person,
  type PersonNoteSections as PersonNoteSectionsData,
  type PersonStatus,
  type RelationshipStrength,
} from "@/lib/types";
import type { PersonInput } from "@/lib/validation";
import { useAuth } from "@/providers/auth-provider";

type PhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

const statusLabels: Record<PersonStatus, string> = {
  active: "Active",
  muted: "Muted",
  archived: "Archived",
};

/** Collapsed headers have to say what is inside, so nobody has to open all
 * six looking for one field. */
function listFilled(entries: [string, string | undefined][], empty: string) {
  const filled = entries
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([label]) => label);
  return filled.length ? filled.join(" · ") : empty;
}

export function PersonForm({
  person,
  noteSections,
  defaultUniversity = "",
}: {
  person?: Person;
  noteSections?: PersonNoteSectionsData;
  defaultUniversity?: string;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [fullName, setFullName] = useState(person?.fullName || "");
  const [contactDrafts, setContactDrafts] = useState<ContactMethodDraft[]>(() =>
    person ? initialContactDrafts(person) : emptyContactDrafts(),
  );
  // The rows the form opened with. A replay deletes only these, so a number
  // added on the web meanwhile is not swept away.
  const knownContactMethods = useMemo(
    () => (person ? initialContactDrafts(person) : []),
    [person],
  );
  const [headingsUsedElsewhere, setHeadingsUsedElsewhere] = useState<string[]>(
    [],
  );
  const [firstMetLocation, setFirstMetLocation] = useState(
    person?.firstMetLocation || "",
  );
  const [generalNotes, setGeneralNotes] = useState(person?.generalNotes || "");
  const [preferredName, setPreferredName] = useState(
    person?.preferredName || "",
  );
  const [birthday, setBirthday] = useState(person?.birthday || "");
  const [hometown, setHometown] = useState(person?.hometown || "");
  const [dormOrResidence, setDormOrResidence] = useState(
    person?.dormOrResidence || "",
  );
  // A new person starts at your default school; an existing one keeps theirs.
  const [university, setUniversity] = useState(
    person?.university || (person ? "" : defaultUniversity),
  );
  const [major, setMajor] = useState(person?.major || "");
  const [graduationYear, setGraduationYear] = useState(
    person?.graduationYear ? String(person.graduationYear) : "",
  );
  const [relationshipStrength, setRelationshipStrength] =
    useState<RelationshipStrength>(person?.relationshipStrength || 2);
  const [relationshipLabel, setRelationshipLabel] = useState(
    person?.relationshipLabel &&
      !isDefaultRelationshipLabel(person.relationshipLabel)
      ? person.relationshipLabel
      : "",
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    person?.remindersEnabled ?? true,
  );
  const [reminderIntervalDays, setReminderIntervalDays] = useState(
    person?.reminderIntervalDays ? String(person.reminderIntervalDays) : "",
  );
  const [status, setStatus] = useState<PersonStatus>(person?.status ?? "active");
  const [firstMetOn, setFirstMetOn] = useState(
    person ? toDateInputValue(person.firstMetAt) : todayDateInputValue(),
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  /**
   * Fills the form from an address-book entry. Everything it writes is a field
   * the user can still change, and it only ever fills a blank one — reopening
   * the picker after typing a name should not throw that name away.
   */
  function applyImportedContact(contact: ImportableContact) {
    if (!fullName.trim()) setFullName(contact.name);
    if (!birthday && contact.birthday) setBirthday(contact.birthday);
    if (!photo && contact.imageUri) {
      setPhoto({ uri: contact.imageUri, fileName: `${contact.id}.jpg` });
    }

    const phone = contact.phoneNumbers[0];
    const email = contact.emails[0];
    setContactDrafts((drafts) =>
      drafts.map((draft) => {
        if (draft.value.trim()) return draft;
        if (draft.kind === "phone" && phone) return { ...draft, value: phone };
        if (draft.kind === "email" && email) return { ...draft, value: email };
        return draft;
      }),
    );
  }
  const [namedSectionCount, setNamedSectionCount] = useState(
    noteSections?.sections.length ?? 0,
  );
  const [saving, setSaving] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const picked = {
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    };
    setPhoto(picked);
    void Haptics.selectionAsync();

    // A photo is a whole decision on its own, so it saves the moment it is
    // chosen. A new person has no row to attach it to yet, so theirs still
    // goes up with the rest of the form.
    if (!person || !session) return;
    setSavingPhoto(true);
    setError(null);
    try {
      await updatePerson(
        session.user.id,
        person.id,
        storedPersonInput(person),
        picked,
        person.profilePhotoPath,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "That photo did not save.",
      );
    }
    setSavingPhoto(false);
  }

  // The default arrives after the form is on screen, so it is applied then —
  // but only to a new person who has not typed anything, never over an edit.
  useEffect(() => {
    if (person || !defaultUniversity) return;
    setUniversity((current) => current || defaultUniversity);
  }, [defaultUniversity, person]);

  useEffect(() => {
    if (!userId) return;
    let stillMounted = true;
    void getUsedNoteHeadings(userId, person?.id).then((headings) => {
      if (stillMounted) setHeadingsUsedElsewhere(headings);
    });
    return () => {
      stillMounted = false;
    };
  }, [person?.id, userId]);

  const contactValues = contactFormValues(contactDrafts);
  const currentValues: FormValues = {
    fullName,
    instagramUsername: contactValues.instagramUsername,
    phoneNumber: contactValues.phoneNumber,
    contactMethods: contactValues.contactMethods,
    firstMetLocation,
    generalNotes,
    preferredName,
    email: contactValues.email,
    birthday,
    hometown,
    dormOrResidence,
    university,
    major,
    graduationYear,
    relationshipStrength: String(relationshipStrength),
    relationshipLabel,
    remindersEnabled: remindersEnabled ? "on" : "off",
    reminderIntervalDays,
    status,
    firstMetOn,
    photoUri: photo?.uri ?? "",
  };
  const initialValues = useMemo<FormValues>(() => {
    const initialContacts = contactFormValues(
      person ? initialContactDrafts(person) : emptyContactDrafts(),
    );
    return {
      fullName: person?.fullName || "",
      instagramUsername: initialContacts.instagramUsername,
      phoneNumber: initialContacts.phoneNumber,
      contactMethods: initialContacts.contactMethods,
      firstMetLocation: person?.firstMetLocation || "",
      generalNotes: person?.generalNotes || "",
      preferredName: person?.preferredName || "",
      email: initialContacts.email,
      birthday: person?.birthday || "",
      hometown: person?.hometown || "",
      dormOrResidence: person?.dormOrResidence || "",
      university: person?.university || "",
      major: person?.major || "",
      graduationYear: person?.graduationYear
        ? String(person.graduationYear)
        : "",
      relationshipStrength: String(person?.relationshipStrength || 2),
      relationshipLabel:
        person?.relationshipLabel &&
        !isDefaultRelationshipLabel(person.relationshipLabel)
          ? person.relationshipLabel
          : "",
      remindersEnabled: (person?.remindersEnabled ?? true) ? "on" : "off",
      reminderIntervalDays: person?.reminderIntervalDays
        ? String(person.reminderIntervalDays)
        : "",
      status: person?.status ?? "active",
      firstMetOn: person
        ? toDateInputValue(person.firstMetAt)
        : todayDateInputValue(),
      photoUri: "",
    };
  }, [person]);
  const dirty = hasUnsavedChanges(initialValues, currentValues);
  const usingCustomLabel = relationshipLabel.trim().length > 0;

  function goBack() {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      "Leave without saving?",
      "You have edits here that have not been saved yet.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => router.back(),
        },
      ],
      { cancelable: true },
    );
  }

  function buildInput(): PersonInput {
    const parsedGraduationYear = Number.parseInt(graduationYear, 10);
    const parsedReminderDays = Number.parseInt(reminderIntervalDays, 10);
    const firstMetDay = parseDateInput(firstMetOn);
    const firstMetChanged =
      firstMetDay !== null && firstMetDay !== initialValues.firstMetOn;
    return {
      fullName,
      // The primary of each kind keeps the field it has always had, so
      // everything that reads a person still finds one number and one email.
      instagramUsername: contactValues.instagramUsername,
      phoneNumber: contactValues.phoneNumber,
      firstMetLocation,
      generalNotes,
      preferredName,
      email: contactValues.email,
      birthday: parseDateInput(birthday) ?? "",
      hometown,
      dormOrResidence,
      university,
      major,
      graduationYear: Number.isNaN(parsedGraduationYear)
        ? null
        : parsedGraduationYear,
      relationshipStrength,
      relationshipLabel:
        relationshipLabel.trim() || relationshipTierLabels[relationshipStrength],
      remindersEnabled,
      reminderIntervalDays: Number.isNaN(parsedReminderDays)
        ? null
        : parsedReminderDays,
      status,
      firstMetAt: firstMetChanged
        ? timestampFromDateInput(firstMetDay)
        : person?.firstMetAt,
    };
  }

  async function save() {
    if (!session) return;
    if (birthday.trim() && !parseDateInput(birthday)) {
      setError("We couldn’t read that birthday. Try “April 18, 2007”.");
      return;
    }
    if (firstMetOn.trim() && !parseDateInput(firstMetOn)) {
      setError("We couldn’t read the date you met. Try “February 14, 2026”.");
      return;
    }
    if (isFutureDateInput(firstMetOn)) {
      setError("You can’t have met them later than today.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (person) {
        await updatePerson(
          session.user.id,
          person.id,
          buildInput(),
          photo || undefined,
          person.profilePhotoPath,
          contactDrafts,
          knownContactMethods,
        );
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        void offerContactSyncAfterSave({ ...person, ...buildInput() } as Person);
        router.back();
      } else {
        const created = await createPerson(
          session.user.id,
          buildInput(),
          photo || undefined,
          contactDrafts,
        );
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        void offerContactSyncAfterSave(created);
        router.replace(`/people/${created.id}`);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "This person could not be saved.",
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  const photoUri = photo?.uri || person?.profilePhotoUrl;
  const detailField = useFieldChain([
    "hometown",
    "university",
    "major",
    "graduationYear",
    "dormOrResidence",
    "birthday",
  ]);
  const displayName = preferredName.trim() || fullName || "Them";

  const photoBlock = (
    <View style={styles.photoRow}>
      <Pressable
        accessibilityLabel={
          photoUri ? "Change profile photo" : "Add profile photo"
        }
        accessibilityRole="button"
        onPress={() => void choosePhoto()}
        style={styles.photoButton}
      >
        {photoUri ? (
          <Image
            accessibilityLabel={`${fullName || "Person"} profile photo`}
            alt={`${fullName || "Person"} profile photo`}
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: photoUri }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Camera color={colors.inkMuted} size={26} />
          </View>
        )}
        <View style={styles.photoBadge}>
          <ImageSquare color={colors.paper} size={14} weight="fill" />
        </View>
      </Pressable>
      <View style={styles.photoCopy}>
        <AppText variant="label">{person ? "Photo" : "Add a photo"}</AppText>
        <AppText variant="caption">
          {savingPhoto
            ? "Saving…"
            : person
              ? "Tap to pick a new one. It saves on its own."
              : "Optional, but useful when you just met."}
        </AppText>
      </View>
    </View>
  );

  const nameFields = (
    <>
      {person ? null : (
        <Button
          compact
          icon={AddressBook}
          label="Import from Contacts"
          onPress={() => setImportOpen(true)}
          variant="quiet"
        />
      )}
      <FormField
        autoCapitalize="words"
        autoComplete="name"
        autoFocus={!person}
        label="Full name"
        onChangeText={setFullName}
        placeholder="Jordan Lee"
        value={fullName}
      />
      <FormField
        autoCapitalize="words"
        label="Preferred name"
        onChangeText={setPreferredName}
        value={preferredName}
      />
    </>
  );

  const contactFields = contactMethodKinds.map((kind) => (
    <ContactMethodField
      drafts={contactDrafts}
      key={kind}
      kind={kind}
      onChange={setContactDrafts}
    />
  ));

  const aboutFields = (
    <>
      <FormField
        autoCapitalize="words"
        label="Hometown"
        onChangeText={setHometown}
        value={hometown}
        {...detailField("hometown")}
      />
      <CollegeField
        onChangeText={setUniversity}
        value={university}
        {...detailField("university")}
      />
      <FormField
        autoCapitalize="words"
        label="Major"
        onChangeText={setMajor}
        value={major}
        {...detailField("major")}
      />
      <FormField
        keyboardType="number-pad"
        label="Graduation year"
        maxLength={4}
        onChangeText={setGraduationYear}
        value={graduationYear}
        {...detailField("graduationYear")}
      />
      <FormField
        autoCapitalize="words"
        label="Dorm or residence"
        onChangeText={setDormOrResidence}
        value={dormOrResidence}
        {...detailField("dormOrResidence")}
      />
      <DateField
        hint="Type it any way you like, or pick it from the calendar."
        label="Birthday"
        onChangeText={setBirthday}
        placeholder="April 18, 2007"
        value={birthday}
        {...detailField("birthday")}
      />
    </>
  );

  const metFields = (
    <>
      <DateField
        hint="Type it any way you like, or pick it from the calendar."
        label="When did you meet?"
        maximumDate={new Date()}
        onChangeText={setFirstMetOn}
        placeholder="February 14, 2026"
        value={firstMetOn}
      />
      <FormField
        autoCapitalize="sentences"
        label="Where did you meet?"
        onChangeText={setFirstMetLocation}
        placeholder="Birch Hall lounge"
        value={firstMetLocation}
      />
    </>
  );

  const shortNoteField = (
    <FormField
      autoCapitalize="sentences"
      label="Short note"
      multiline
      onChangeText={setGeneralNotes}
      placeholder="What were you talking about? Anything to remember?"
      value={generalNotes}
    />
  );

  const reminderFields = (
    <>
      <View style={styles.strengthGroup}>
        <AppText variant="label">What are they to you?</AppText>
        <View style={styles.strengthRow}>
          {relationshipStrengths.map((strength) => {
            const selected =
              !usingCustomLabel && relationshipStrength === strength;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={strength}
                onPress={() => {
                  setRelationshipStrength(strength);
                  setRelationshipLabel("");
                  void Haptics.selectionAsync();
                }}
                style={[styles.strength, selected && styles.strengthSelected]}
              >
                {selected ? (
                  <Check color={colors.paper} size={14} weight="bold" />
                ) : null}
                <AppText
                  style={selected ? styles.lightText : undefined}
                  variant="caption"
                >
                  {relationshipTierLabels[strength]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FormField
        hint="Anything you like, up to 40 characters."
        label="Or call it something of your own"
        maxLength={maxRelationshipLabelLength}
        onChangeText={setRelationshipLabel}
        placeholder="college roommate"
        value={relationshipLabel}
      />
      <View style={styles.reminderPanel}>
        <View style={styles.reminderHeader}>
          <View style={styles.flex}>
            <AppText variant="label">Remind me to keep in touch</AppText>
            <AppText variant="caption">
              {remindersEnabled
                ? "We nudge you when it has been a while."
                : `No nudges about ${displayName}. Birthdays and reminders still come through.`}
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Remind me to keep in touch"
            ios_backgroundColor={colors.mist}
            onValueChange={(value) => {
              setRemindersEnabled(value);
              void Haptics.selectionAsync();
            }}
            thumbColor={colors.paper}
            trackColor={{ false: colors.mist, true: colors.sageStrong }}
            value={remindersEnabled}
          />
        </View>

        {remindersEnabled ? (
          <View style={styles.reminderBody}>
            <AppText variant="label">How often should we nudge you?</AppText>
            <AppText variant="caption">
              {usingCustomLabel
                ? `“${relationshipLabel.trim()}” is your name for them. The pace below is what actually sets the timing.`
                : `Reminders follow your ${relationshipTierLabels[relationshipStrength]} pace, which you can change in settings.`}
            </AppText>
            {usingCustomLabel ? (
              <View style={styles.strengthRow}>
                {relationshipStrengths.map((strength) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: relationshipStrength === strength,
                    }}
                    key={strength}
                    onPress={() => {
                      setRelationshipStrength(strength);
                      void Haptics.selectionAsync();
                    }}
                    style={[
                      styles.strength,
                      relationshipStrength === strength &&
                        styles.strengthSelected,
                    ]}
                  >
                    <AppText
                      style={
                        relationshipStrength === strength
                          ? styles.lightText
                          : undefined
                      }
                      variant="caption"
                    >
                      {relationshipTierLabels[strength]} pace
                    </AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <FormField
              hint="Leave blank to use the default for the pace you picked."
              keyboardType="number-pad"
              label="Custom reminder interval"
              onChangeText={setReminderIntervalDays}
              placeholder="Days"
              value={reminderIntervalDays}
            />
          </View>
        ) : null}
      </View>
      {person ? (
        <View style={styles.strengthGroup}>
          <AppText variant="label">Reminder status</AppText>
          <View style={styles.strengthRow}>
            {personStatuses.map((value) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: status === value }}
                key={value}
                onPress={() => {
                  setStatus(value);
                  void Haptics.selectionAsync();
                }}
                style={[
                  styles.strength,
                  status === value && styles.strengthSelected,
                ]}
              >
                <AppText
                  style={status === value ? styles.lightText : undefined}
                  variant="caption"
                >
                  {statusLabels[value]}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <>
    <KeyboardAwareForm
      contentStyle={styles.content}
      footer={
        <View style={styles.footerRow}>
          <Button
            label="Cancel"
            onPress={goBack}
            style={styles.flex}
            variant="secondary"
          />
          <Button
            disabled={!fullName.trim()}
            label={person ? "Save changes" : "Save person"}
            loading={saving}
            onPress={() => void save()}
            style={styles.flex}
          />
        </View>
      }
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={goBack}
          style={styles.back}
        >
          <ArrowLeft color={colors.ink} size={21} />
        </Pressable>
        <AppText variant="heading">
          {person ? `Edit ${displayName}` : "Add someone"}
        </AppText>
        <View style={styles.backSpacer} />
      </View>

      <AppText style={styles.muted}>
        {person
          ? "Update the details that make the next conversation easier."
          : "Start with the details you remember now. You can fill in the rest later."}
      </AppText>

      {person ? (
        <>
          <FormSection defaultOpen summary={displayName} title="Who they are">
            {photoBlock}
            {nameFields}
          </FormSection>

          <FormSection
            summary={listFilled(
              [
                ["Phone", contactValues.phoneNumber],
                ["Email", contactValues.email],
                ["Instagram", contactValues.instagramUsername],
              ],
              "Nothing saved yet",
            )}
            title="How to reach them"
          >
            {contactFields}
          </FormSection>

          <FormSection
            summary={listFilled(
              [
                ["Hometown", hometown],
                ["University", university],
                ["Major", major],
                ["Class year", graduationYear],
                ["Residence", dormOrResidence],
                ["Birthday", birthday],
              ],
              "Nothing saved yet",
            )}
            title="About them"
          >
            {aboutFields}
          </FormSection>

          <FormSection
            summary={listFilled(
              [
                ["Date", firstMetOn],
                ["Place", firstMetLocation],
              ],
              "Nothing saved yet",
            )}
            title="How you met"
          >
            {metFields}
          </FormSection>

          <FormSection
            summary={
              namedSectionCount
                ? `${namedSectionCount} ${namedSectionCount === 1 ? "section" : "sections"}`
                : generalNotes.trim()
                  ? "Written down"
                  : "Nothing saved yet"
            }
            title="Notes"
          >
            {shortNoteField}
            {userId ? (
              <PersonNoteSections
                available={noteSections?.available ?? false}
                headingsUsedElsewhere={headingsUsedElsewhere}
                initialSections={noteSections?.sections ?? []}
                onSectionCountChange={setNamedSectionCount}
                personId={person.id}
                userId={userId}
              />
            ) : null}
          </FormSection>

          <FormSection
            summary={`${
              relationshipLabel.trim() ||
              relationshipTierLabels[relationshipStrength]
            } · ${remindersEnabled ? "Nudges on" : "Nudges off"}`}
            title="Reminders"
          >
            {reminderFields}
          </FormSection>
        </>
      ) : (
        <>
          <View style={styles.card}>
            {photoBlock}
            <FormField
              autoCapitalize="words"
              autoComplete="name"
              autoFocus
              label="Full name"
              onChangeText={setFullName}
              placeholder="Jordan Lee"
              value={fullName}
            />
            {contactFields}
            <FormField
              autoCapitalize="sentences"
              label="Where did you meet?"
              onChangeText={setFirstMetLocation}
              placeholder="Birch Hall lounge"
              value={firstMetLocation}
            />
            <DateField
              hint="Type it any way you like, or pick it from the calendar."
              label="When did you meet?"
              maximumDate={new Date()}
              onChangeText={setFirstMetOn}
              placeholder="February 14, 2026"
              value={firstMetOn}
            />
            {shortNoteField}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            onPress={() => {
              setAdvancedOpen((open) => !open);
              void Haptics.selectionAsync();
            }}
            style={styles.advancedToggle}
          >
            <View>
              <AppText variant="label">More details</AppText>
              <AppText variant="caption">
                Preferred name, birthday, school, reminders
              </AppText>
            </View>
            {advancedOpen ? (
              <CaretUp color={colors.inkMuted} size={20} />
            ) : (
              <CaretDown color={colors.inkMuted} size={20} />
            )}
          </Pressable>

          {advancedOpen ? (
            <View style={styles.card}>
              <FormField
                autoCapitalize="words"
                label="Preferred name"
                onChangeText={setPreferredName}
                value={preferredName}
              />
              {aboutFields}
              {reminderFields}
            </View>
          ) : null}
        </>
      )}

      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        </View>
      ) : null}
    </KeyboardAwareForm>
    {person ? null : (
      <ContactImportSheet
        onClose={() => setImportOpen(false)}
        onPick={applyImportedContact}
        visible={importOpen}
      />
    )}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  back: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.round,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backSpacer: {
    width: 44,
  },
  muted: {
    color: colors.inkMuted,
  },
  photoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  photoButton: {
    height: 64,
    width: 64,
  },
  photo: {
    borderRadius: 32,
    height: 64,
    width: 64,
  },
  photoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  photoBadge: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    bottom: 0,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 24,
  },
  photoCopy: {
    flex: 1,
    gap: 3,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 16,
    padding: 17,
  },
  advancedToggle: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 17,
  },
  strengthGroup: {
    gap: 9,
  },
  flex: {
    flex: 1,
  },
  reminderPanel: {
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    gap: 14,
    padding: 15,
  },
  reminderHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  reminderBody: {
    gap: 10,
  },
  strengthRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  strength: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 13,
  },
  strengthSelected: {
    backgroundColor: colors.sageStrong,
  },
  lightText: {
    color: colors.paper,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 13,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
