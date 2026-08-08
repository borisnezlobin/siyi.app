import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { GlassIconButton } from "@/components/glass-surface";
import { ArrowLeft, CaretRight, Copy } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import QRCodeView from "react-native-qrcode-svg";
import { ConnectRipple } from "@/components/connect-ripple";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  buildProfileUrl,
  handleProblem,
  handleProblemMessages,
  normalizeHandle,
} from "@/lib/handles";
import { getOwnProfile, saveOwnProfile, type OwnProfile } from "@/lib/profile-data";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Your page, and the code people scan to reach it.
 *
 * The switch is the first thing on the screen because nothing under it exists
 * while it is off — so with it off, the rest is gone rather than greyed. A
 * disabled control still invites you to try it; an absent one asks the only
 * question worth asking, which is whether you want a page at all.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const screenData = useRefreshableData<OwnProfile>(() =>
    getOwnProfile(session!.user.id),
  );

  const [handle, setHandle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const isPublic = screenData.data?.isPublic ?? false;

  // The flourish plays once when the page appears and then gets out of the way.
  // Left running it moves light across the code while somebody is trying to scan.
  useEffect(() => {
    if (!isPublic) {
      setRevealing(false);
      return;
    }
    setRevealing(true);
    const done = setTimeout(() => setRevealing(false), 1100);
    return () => clearTimeout(done);
  }, [isPublic]);

  if (screenData.loading && !screenData.data) {
    return <LoadingState label="Opening your page…" />;
  }
  if (screenData.error && !screenData.data) {
    return (
      <ErrorState message={screenData.error} onRetry={() => void screenData.reload()} />
    );
  }

  const profile = screenData.data!;
  const currentHandle = handle ?? profile.handle;
  const problem = currentHandle ? handleProblem(currentHandle) : null;
  const url =
    profile.handle && profile.tag
      ? buildProfileUrl(brand.webUrl || "https://www.siyi.app", profile.handle, profile.tag)
      : "";

  async function save(changes: Parameters<typeof saveOwnProfile>[1]) {
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await saveOwnProfile(session.user.id, changes);
      await screenData.reload();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "That could not be saved.",
      );
    } finally {
      setSaving(false);
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
        <AppText variant="display">Your card</AppText>
        <AppText style={styles.muted}>
          A code and an address people can reach you at, and the choice of what
          they find there.
        </AppText>
      </View>

      <View style={styles.switchRow}>
        <AppText style={styles.grow} variant="label">
          Enable shareable link
        </AppText>
        <Switch
          accessibilityLabel="Enable shareable link"
          disabled={saving}
          ios_backgroundColor={colors.mist}
          onValueChange={(value) => void save({ isPublic: value })}
          thumbColor={colors.paper}
          trackColor={{ false: colors.mist, true: colors.sageStrong }}
          value={profile.isPublic}
        />
      </View>

      {profile.isPublic ? (
        <View style={styles.group}>
          {profile.tag ? (
            <>
              <View
                accessibilityLabel={`QR code for ${profile.handle}`}
                style={styles.qr}
                testID="profile-qr-code"
              >
                {revealing ? <ConnectRipple size={236} /> : null}
                <QRCodeView
                  backgroundColor={colors.paper}
                  color={colors.ink}
                  size={200}
                  value={url}
                />
              </View>

              <AppText variant="caption">People can find you at {url}</AppText>

              <View style={styles.actions}>
                <Button
                  compact
                  icon={Copy}
                  label="Copy link"
                  onPress={() => void Clipboard.setStringAsync(url)}
                  variant="secondary"
                />
              </View>
            </>
          ) : null}

          <FormField
            autoCapitalize="none"
            autoCorrect={false}
            label="Your handle"
            maxLength={30}
            onChangeText={(value) => setHandle(normalizeHandle(value))}
            placeholder="alex.vale"
            value={currentHandle}
          />
          {problem ? (
            <AppText style={styles.error} variant="caption">
              {handleProblemMessages[problem]}
            </AppText>
          ) : null}

          <Button
            disabled={saving || Boolean(problem) || !currentHandle}
            label={profile.tag ? "Update handle" : "Claim handle"}
            onPress={() => void save({ handle: currentHandle })}
          />

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/configure-card")}
            style={styles.configureRow}
          >
            <AppText style={styles.grow} variant="label">
              Configure what gets shared
            </AppText>
            <CaretRight color={colors.inkMuted} size={16} />
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <AppText style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}
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
  grow: {
    flex: 1,
  },
  switchRow: {
    alignItems: "center",
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingBottom: 16,
  },
  group: {
    gap: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 9,
  },
  qr: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    padding: 18,
  },
  configureRow: {
    alignItems: "center",
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingTop: 16,
  },
  error: {
    color: colors.coralStrong,
  },
});
