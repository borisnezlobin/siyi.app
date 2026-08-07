import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { colors } from "@/constants/theme";
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
  university: "University of California, Berkeley",
  major: "Computer Science",
  graduationYear: "2027",
  dormOrResidence: "Unit 2",
};

/**
 * What you hand out about yourself. Lives inside the card screen rather than on
 * its own, so mobile matches the single section the web shows.
 */
export function OwnCardFields({ disabled = false }: { disabled?: boolean }) {
  const { session } = useAuth();
  const screenData = useRefreshableData<AccountSettings>(() =>
    getAccountSettings(session!.user.id),
  );

  const [card, setCard] = useState<OwnCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings = screenData.data;
  if (!settings) return null;
  const currentCard = card ?? settings.ownCard;

  async function save() {
    if (!session || !settings) return;
    setSaving(true);
    setError(null);
    try {
      await saveOwnCard(session.user.id, {
        card: currentCard,
        enabled: true,
        defaultUniversity: settings.defaultUniversity,
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
    <View style={styles.group}>
      {ownCardFields.map((field) => (
        <FormField
          accessibilityState={{ disabled }}
          editable={!disabled}
          key={field}
          label={ownCardLabels[field]}
          maxLength={200}
          onChangeText={(value) => setCard({ ...currentCard, [field]: value })}
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
        disabled={disabled || saving}
        label={saved ? "Saved" : "Save my details"}
        onPress={() => void save()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 14,
  },
  error: {
    color: colors.coralStrong,
  },
});
