import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  CaretDown,
  CaretUp,
  Check,
  ImageSquare,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { colors, floatShadow, radii } from "@/constants/theme";
import { offerContactSyncAfterSave } from "@/lib/contact-sync-flow";
import {
  isFutureDateInput,
  isValidDateInput,
  timestampFromDateInput,
  toDateInputValue,
} from "@/lib/date-input";
import { hasUnsavedChanges, type FormValues } from "@/lib/form-changes";
import { formatPhoneNumberInput } from "@/lib/phone-format";
import { createPerson, updatePerson } from "@/lib/data";
import { normalizeInstagramUsername } from "@/lib/instagram";
import {
  isDefaultRelationshipLabel,
  maxRelationshipLabelLength,
  relationshipTierLabels,
} from "@/lib/relationship-labels";
import type { Person, RelationshipStrength } from "@/lib/types";
import type { PersonInput } from "@/lib/validation";
import { useAuth } from "@/providers/auth-provider";

type PhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export function PersonForm({ person }: { person?: Person }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [fullName, setFullName] = useState(person?.fullName || "");
  const [instagramUsername, setInstagramUsername] = useState(
    person?.instagramUsername || "",
  );
  const [phoneNumber, setPhoneNumber] = useState(person?.phoneNumber || "");
  const [firstMetLocation, setFirstMetLocation] = useState(
    person?.firstMetLocation || "",
  );
  const [generalNotes, setGeneralNotes] = useState(person?.generalNotes || "");
  const [preferredName, setPreferredName] = useState(
    person?.preferredName || "",
  );
  const [email, setEmail] = useState(person?.email || "");
  const [birthday, setBirthday] = useState(person?.birthday || "");
  const [hometown, setHometown] = useState(person?.hometown || "");
  const [dormOrResidence, setDormOrResidence] = useState(
    person?.dormOrResidence || "",
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
  const [firstMetOn, setFirstMetOn] = useState(
    toDateInputValue(person?.firstMetAt),
  );
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(person));
  const [photo, setPhoto] = useState<PhotoAsset | null>(null);
  const [saving, setSaving] = useState(false);
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
    setPhoto({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
    });
    void Haptics.selectionAsync();
  }

  const currentValues: FormValues = {
    fullName,
    instagramUsername,
    phoneNumber,
    firstMetLocation,
    generalNotes,
    preferredName,
    email,
    birthday,
    hometown,
    dormOrResidence,
    major,
    graduationYear,
    relationshipStrength: String(relationshipStrength),
    relationshipLabel,
    remindersEnabled: remindersEnabled ? "on" : "off",
    reminderIntervalDays,
    firstMetOn,
    photoUri: photo?.uri ?? "",
  };
  const initialValues = useMemo<FormValues>(
    () => ({
      fullName: person?.fullName || "",
      instagramUsername: person?.instagramUsername || "",
      phoneNumber: person?.phoneNumber || "",
      firstMetLocation: person?.firstMetLocation || "",
      generalNotes: person?.generalNotes || "",
      preferredName: person?.preferredName || "",
      email: person?.email || "",
      birthday: person?.birthday || "",
      hometown: person?.hometown || "",
      dormOrResidence: person?.dormOrResidence || "",
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
      firstMetOn: toDateInputValue(person?.firstMetAt),
      photoUri: "",
    }),
    [person],
  );
  const dirty = hasUnsavedChanges(initialValues, currentValues);
  const usingCustomLabel = relationshipLabel.trim().length > 0;

  function goBack() {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      "Leave without saving?",
      "Your edits here have not been saved yet.",
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
    const firstMetChanged =
      firstMetOn !== initialValues.firstMetOn && isValidDateInput(firstMetOn);
    return {
      fullName,
      instagramUsername,
      phoneNumber,
      firstMetLocation,
      generalNotes,
      preferredName,
      email,
      birthday,
      hometown,
      dormOrResidence,
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
      firstMetAt: firstMetChanged
        ? timestampFromDateInput(firstMetOn)
        : person?.firstMetAt,
    };
  }

  async function save() {
    if (!session) return;
    if (firstMetOn && !isValidDateInput(firstMetOn)) {
      setError("Write the date you met as YYYY-MM-DD.");
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.fill}
    >
      <Screen
        bottomInset={116 + insets.bottom}
        contentContainerStyle={styles.content}
        keyboardAvoiding={false}
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
            {person ? "Edit person" : "Add someone"}
          </AppText>
          <View style={styles.backSpacer} />
        </View>

        <View style={styles.hero}>
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
                <Camera color={colors.sageStrong} size={31} weight="duotone" />
              </View>
            )}
            <View style={styles.photoBadge}>
              <ImageSquare color={colors.paper} size={15} weight="fill" />
            </View>
          </Pressable>
          <View style={styles.heroCopy}>
            <AppText variant="title">
              {person ? "Add what you know" : "Who’d you meet?"}
            </AppText>
            {person ? (
              <AppText style={styles.muted}>
                Keep their interests, stories, and details close at hand.
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <FormField
            autoCapitalize="words"
            autoComplete="name"
            autoFocus={!person}
            label="Name"
            onChangeText={setFullName}
            placeholder="Jordan Lee"
            value={fullName}
          />
          <FormField
            autoCapitalize="none"
            autoCorrect={false}
            label="Instagram"
            onBlur={() =>
              setInstagramUsername(
                normalizeInstagramUsername(instagramUsername),
              )
            }
            onChangeText={setInstagramUsername}
            placeholder="@username or profile link"
            value={instagramUsername}
          />
          <FormField
            autoComplete="tel"
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={(value) =>
              setPhoneNumber(formatPhoneNumberInput(value))
            }
            placeholder="(555) 555-0123"
            value={phoneNumber}
          />
          <FormField
            autoCapitalize="sentences"
            label="Where did you meet?"
            onChangeText={setFirstMetLocation}
            placeholder="Birch Hall lounge"
            value={firstMetLocation}
          />
          <FormField
            autoCapitalize="sentences"
            label="Short note"
            multiline
            onChangeText={setGeneralNotes}
            placeholder="What were you talking about?"
            value={generalNotes}
          />
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
            <AppText variant="heading">More details</AppText>
            <AppText variant="caption">
              Birthday, school context, and reminders
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
            <FormField
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              value={email}
            />
            <FormField
              hint="Use YYYY-MM-DD. The year can be approximate if needed."
              keyboardType="numbers-and-punctuation"
              label="Birthday"
              maxLength={10}
              onChangeText={setBirthday}
              placeholder="2007-04-18"
              value={birthday}
            />
            <FormField
              autoCapitalize="words"
              label="Hometown"
              onChangeText={setHometown}
              value={hometown}
            />
            <FormField
              autoCapitalize="words"
              label="Dorm or residence"
              onChangeText={setDormOrResidence}
              value={dormOrResidence}
            />
            <FormField
              autoCapitalize="words"
              label="Major"
              onChangeText={setMajor}
              value={major}
            />
            <FormField
              keyboardType="number-pad"
              label="Graduation year"
              maxLength={4}
              onChangeText={setGraduationYear}
              value={graduationYear}
            />
            <View style={styles.strengthGroup}>
              <AppText variant="label">What are they to you?</AppText>
              <View style={styles.strengthRow}>
                {([1, 2, 3, 4] as const).map((strength) => {
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
                      style={[
                        styles.strength,
                        selected && styles.strengthSelected,
                      ]}
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
              placeholder="more than very close brochacho"
              value={relationshipLabel}
            />
            <View style={styles.reminderPanel}>
              <View style={styles.reminderHeader}>
                <View style={styles.flex}>
                  <AppText variant="label">Remind me to keep in touch</AppText>
                  <AppText variant="caption">
                    {remindersEnabled
                      ? "We nudge you when it has been a while."
                      : "No nudges about them. Birthdays and follow-ups still come through."}
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
                  <AppText variant="caption">
                    {usingCustomLabel
                      ? `“${relationshipLabel.trim()}” is your name for them. The pace below is what sets the timing.`
                      : `Reminders follow your ${relationshipTierLabels[relationshipStrength]} pace, which you can change in settings.`}
                  </AppText>
                  {usingCustomLabel ? (
                    <View style={styles.strengthRow}>
                      {([1, 2, 3, 4] as const).map((strength) => (
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
                            {relationshipTierLabels[strength]}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <FormField
                    hint="Leave blank to use your default for that pace."
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
              <FormField
                hint="Use YYYY-MM-DD. Change it if you actually met earlier."
                keyboardType="numbers-and-punctuation"
                label="First met"
                maxLength={10}
                onChangeText={setFirstMetOn}
                placeholder="2026-02-14"
                value={firstMetOn}
              />
            ) : null}
          </View>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <AppText style={styles.errorText} variant="caption">
              {error}
            </AppText>
          </View>
        ) : null}
      </Screen>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Button
          disabled={!fullName.trim()}
          label={person ? "Save changes" : "Save person"}
          loading={saving}
          onPress={() => void save()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    gap: 18,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  back: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  backSpacer: {
    width: 44,
  },
  hero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 15,
  },
  photoButton: {
    height: 76,
    width: 76,
  },
  photo: {
    borderRadius: 38,
    height: 76,
    width: 76,
  },
  photoPlaceholder: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: 38,
    height: 76,
    justifyContent: "center",
    width: 76,
  },
  photoBadge: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    bottom: 0,
    height: 28,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 28,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  muted: {
    color: colors.inkMuted,
  },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 16,
    padding: 17,
  },
  advancedToggle: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.small,
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
    gap: 12,
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
  footer: {
    ...floatShadow,
    backgroundColor: colors.paper,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    position: "absolute",
    right: 0,
  },
});
