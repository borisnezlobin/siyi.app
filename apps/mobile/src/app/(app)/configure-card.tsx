import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { GlassIconButton } from "@/components/glass-surface";
import { ErrorState, LoadingState } from "@/components/load-state";
import { OwnCardFields } from "@/components/own-card-fields";
import { Screen } from "@/components/screen";
import { colors, radii } from "@/constants/theme";
import { getAccountSettings, saveOwnCard, type AccountSettings } from "@/lib/data";
import {
  ownCardFields,
  ownCardLabels,
  ownCardShareState,
  ownCardShareStateLabels,
  type OwnCard,
} from "@/lib/own-card";
import { getOwnProfile, saveOwnProfile, type OwnProfile } from "@/lib/profile-data";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Your own details, and which of them a stranger gets to see.
 *
 * The chips come first because they are the question the page is really asking.
 * Each has three answers rather than two: a field you have not filled in cannot
 * be shared at all, and it says so rather than offering a switch that would do
 * nothing. Because the fields below are right there, a chip greys and ungreys
 * as you type, without a save in between.
 */
export default function ConfigureCardScreen() {
  const router = useRouter();
  const { session, profile: account } = useAuth();

  const screenData = useRefreshableData<{
    profile: OwnProfile;
    settings: AccountSettings;
  }>(async () => {
    const [profile, settings] = await Promise.all([
      getOwnProfile(session!.user.id),
      getAccountSettings(session!.user.id),
    ]);
    return { profile, settings };
  });

  const [card, setCard] = useState<OwnCard | null>(null);
  const [publicFields, setPublicFields] = useState<Record<string, boolean> | null>(null);
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

  const loaded = screenData.data!;
  const currentCard = card ?? loaded.settings.ownCard;
  const currentPublicFields = publicFields ?? loaded.profile.publicFields;

  async function saveCard() {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await saveOwnCard(session.user.id, {
        card: currentCard,
        enabled: true,
        defaultUniversity: loaded.settings.defaultUniversity,
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

  async function toggleShared(field: string, next: boolean) {
    if (!session) return;
    const updated = { ...currentPublicFields, [field]: next };
    setPublicFields(updated);
    setError(null);
    try {
      await saveOwnProfile(session.user.id, { publicFields: updated });
    } catch (saveError) {
      setPublicFields(currentPublicFields);
      setError(
        saveError instanceof Error ? saveError.message : "That could not be saved.",
      );
    }
  }

  return (
    <Screen bottomInset={56}>
      <View style={styles.topBar}>
        <GlassIconButton
          accessibilityLabel="Go back"
          fallbackStyle={styles.backFallback}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.ink} size={21} />
        </GlassIconButton>
      </View>

      <View style={styles.header}>
        <AppText variant="display">What gets shared</AppText>
        <AppText style={styles.muted}>
          Your own details, and which of them appear on the page people reach
          through your link.
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="label">What goes on it</AppText>
        <AppText style={styles.muted} variant="caption">
          Tap one to share it or keep it back. A detail you have not filled in
          yet cannot be shared until it has something in it.
        </AppText>
        <View style={styles.chips}>
          {ownCardFields.map((field) => {
            const state = ownCardShareState(currentCard, currentPublicFields, field);
            const unavailable = state === "unavailable";
            const shared = state === "shared";

            return (
              <Pressable
                accessibilityLabel={`${ownCardLabels[field]}, ${ownCardShareStateLabels[state]}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: shared, disabled: unavailable }}
                disabled={unavailable}
                key={field}
                onPress={() => void toggleShared(field, !shared)}
                style={[
                  styles.chip,
                  shared && styles.chipShared,
                  unavailable && styles.chipUnavailable,
                ]}
              >
                {shared ? <Check color={colors.paper} size={13} weight="bold" /> : null}
                <AppText
                  style={[
                    shared && styles.chipSharedText,
                    unavailable && styles.chipUnavailableText,
                    state === "hidden" && styles.chipHiddenText,
                  ]}
                  variant="caption"
                >
                  {ownCardLabels[field]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.section}>
        <AppText variant="label">Your details</AppText>
        <AppText style={styles.muted} variant="caption">
          The same things you would record about anyone else. Fill in what you
          are happy to hand out.
        </AppText>
      </View>

      <OwnCardFields
        accountEmail={account?.email ?? ""}
        card={currentCard}
        onChange={setCard}
      />

      {error ? (
        <AppText style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}

      <Button
        disabled={saving}
        label={saved ? "Saved" : "Save my details"}
        onPress={() => void saveCard()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "flex-start",
  },
  backFallback: {
    backgroundColor: colors.paper,
  },
  back: {
    alignItems: "center",
    borderRadius: radii.round,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  header: {
    gap: 6,
  },
  muted: {
    color: colors.inkMuted,
  },
  section: {
    gap: 7,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 3,
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipShared: {
    backgroundColor: colors.ink,
  },
  chipSharedText: {
    color: colors.paper,
  },
  chipHiddenText: {
    textDecorationLine: "line-through",
  },
  chipUnavailable: {
    backgroundColor: colors.porcelain,
  },
  chipUnavailableText: {
    color: colors.inkMuted,
    opacity: 0.55,
  },
  divider: {
    backgroundColor: colors.mist,
    height: StyleSheet.hairlineWidth,
  },
  error: {
    color: colors.coralStrong,
  },
});
