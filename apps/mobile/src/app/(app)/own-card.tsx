import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { CollegeField } from "@/components/college-field";
import { FormField } from "@/components/form-field";
import { KeyboardAwareForm } from "@/components/keyboard-aware-form";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { colors, radii } from "@/constants/theme";
import { getAccountSettings, saveOwnCard } from "@/lib/data";
import { ownCardFields, ownCardLabels, type OwnCard } from "@/lib/own-card";
import type { AccountSettings } from "@/lib/data";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

const placeholders: Partial<Record<(typeof ownCardFields)[number], string>> = {
  fullName: "Boris Nezlobin",
  preferredName: "Boris",
  phoneNumber: "(555) 555-0123",
  email: "you@example.edu",
  instagramUsername: "@username",
  discordUsername: "username",
  birthday: "2005-04-12",
  hometown: "Berkeley, California",
  major: "Computer Science",
  graduationYear: "2027",
  dormOrResidence: "Unit 2",
};

/**
 * What you hand out about yourself, so you are not retyping it every time you
 * meet someone. Nothing is shown to anyone until the switch is on.
 */
export default function OwnCardScreen() {
  const { session } = useAuth();
  const screenData = useRefreshableData<AccountSettings>(() =>
    getAccountSettings(session!.user.id),
  );

  const [card, setCard] = useState<OwnCard | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [defaultUniversity, setDefaultUniversity] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Opening your details…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  const settings = screenData.data!;
  const currentCard = card ?? settings.ownCard;
  const currentEnabled = enabled ?? settings.ownCardEnabled;
  const currentUniversity = defaultUniversity ?? settings.defaultUniversity;

  async function save() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await saveOwnCard(session.user.id, {
        card: currentCard,
        enabled: currentEnabled,
        defaultUniversity: currentUniversity,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "That could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      eyebrow="Make it yours"
      subtitle="What you hand out about yourself, so you are not retyping it."
      title="Your own details"
    >
      <KeyboardAwareForm>
        <CollegeField
          onChangeText={(value) => setDefaultUniversity(value)}
          value={currentUniversity}
        />
        <AppText style={styles.hint} variant="caption">
          Filled in for you when you add someone new. Leave blank for none.
        </AppText>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <AppText variant="label">Offer my details when sharing</AppText>
            <AppText variant="caption">
              Someone opening your share link can copy what you fill in below.
              Off until you turn it on.
            </AppText>
          </View>
          <Switch
            onValueChange={(value) => setEnabled(value)}
            trackColor={{ false: colors.mist, true: colors.sageStrong }}
            value={currentEnabled}
          />
        </View>

        {ownCardFields
          .filter((field) => field !== "university")
          .map((field) => (
            <FormField
              key={field}
              label={ownCardLabels[field]}
              maxLength={200}
              onChangeText={(value) =>
                setCard({ ...currentCard, [field]: value })
              }
              placeholder={placeholders[field]}
              value={currentCard[field] ?? ""}
            />
          ))}

        {error ? (
          <AppText style={styles.error} variant="caption">
            {error}
          </AppText>
        ) : null}

        <Button
          disabled={saving}
          label={saved ? "Saved" : "Save my details"}
          onPress={() => void save()}
        />
      </KeyboardAwareForm>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginTop: -4,
  },
  toggleRow: {
    alignItems: "center",
    backgroundColor: colors.porcelain,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 14,
    padding: 15,
  },
  toggleCopy: {
    flex: 1,
    gap: 3,
  },
  error: {
    color: colors.coralStrong,
  },
});
