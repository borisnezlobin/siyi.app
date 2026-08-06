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
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { Screen } from "@/components/screen";
import { colors, floatShadow, radii } from "@/constants/theme";
import { offerContactSyncAfterSave } from "@/lib/contact-sync-flow";
import { formatPhoneNumberInput } from "@/lib/phone-format";
import { createPerson, updatePerson } from "@/lib/data";
import { normalizeInstagramUsername } from "@/lib/instagram";
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
  const [reminderIntervalDays, setReminderIntervalDays] = useState(
    person?.reminderIntervalDays ? String(person.reminderIntervalDays) : "",
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

  function buildInput(): PersonInput {
    const parsedGraduationYear = Number.parseInt(graduationYear, 10);
    const parsedReminderDays = Number.parseInt(reminderIntervalDays, 10);
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
      reminderIntervalDays: Number.isNaN(parsedReminderDays)
        ? null
        : parsedReminderDays,
    };
  }

  async function save() {
    if (!session) return;
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
            onPress={() => router.back()}
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
              Birthday, school context, and reminder strength
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
              <AppText variant="label">Relationship strength</AppText>
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
                    {relationshipStrength === strength ? (
                      <Check color={colors.paper} size={15} weight="bold" />
                    ) : null}
                    <AppText
                      style={
                        relationshipStrength === strength
                          ? styles.lightText
                          : undefined
                      }
                      variant="label"
                    >
                      {strength}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <AppText variant="caption">
                1 is an occasional connection; 4 is someone you want to stay
                especially close to.
              </AppText>
            </View>
            <FormField
              hint="Leave blank to use your default for this strength."
              keyboardType="number-pad"
              label="Custom reminder interval"
              onChangeText={setReminderIntervalDays}
              placeholder="Days"
              value={reminderIntervalDays}
            />
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
  strengthRow: {
    flexDirection: "row",
    gap: 8,
  },
  strength: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 46,
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
