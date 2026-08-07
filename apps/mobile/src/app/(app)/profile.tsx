import * as Clipboard from "expo-clipboard";
import { Copy, QrCode } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import { Animated, Pressable, StyleSheet, Switch, View } from "react-native";
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
  formatHandle,
  handleProblem,
  handleProblemMessages,
  normalizeHandle,
} from "@/lib/handles";
import { getOwnProfile, saveOwnProfile, type OwnProfile } from "@/lib/profile-data";
import { ownCardFields, ownCardLabels } from "@/lib/own-card";
import { OwnCardFields } from "@/components/own-card-fields";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Your page, and the code people scan to reach it. The code fades and lifts into
 * place rather than appearing, so it reads as the same object as the address
 * above it.
 */
export default function ProfileScreen() {
  const { session } = useAuth();
  const screenData = useRefreshableData<OwnProfile>(() =>
    getOwnProfile(session!.user.id),
  );

  const [handle, setHandle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const reveal = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(reveal, {
      toValue: showQr ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [reveal, showQr]);

  useEffect(() => {
    if (!showQr) {
      setRevealing(false);
      return;
    }
    setRevealing(true);
    const done = setTimeout(() => setRevealing(false), 1100);
    return () => clearTimeout(done);
  }, [showQr]);

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
    <Screen
      subtitle="What you hand out about yourself, the address people find you at, and a code they can scan."
      title="Your card"
    >
      <FormField
        autoCapitalize="none"
        autoCorrect={false}
        label="Your handle"
        maxLength={30}
        onChangeText={(value) => setHandle(normalizeHandle(value))}
        placeholder="boris.nezlobin"
        value={currentHandle}
      />
      {problem ? (
        <AppText style={styles.error} variant="caption">
          {handleProblemMessages[problem]}
        </AppText>
      ) : null}
      {error ? (
        <AppText style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}

      <Button
        disabled={saving || Boolean(problem) || !currentHandle}
        label={profile.tag ? "Update handle" : "Claim handle"}
        onPress={() => void save({ handle: currentHandle })}
      />

      {profile.tag ? (
        <>
          <AppText variant="caption">
            People can find you as {formatHandle(profile.handle, profile.tag)}.
          </AppText>

          <View style={styles.actions}>
            <Button
              compact
              icon={Copy}
              label="Copy link"
              onPress={() => void Clipboard.setStringAsync(url)}
              variant="secondary"
            />
            <Button
              compact
              icon={QrCode}
              label={showQr ? "Hide code" : "Show code"}
              onPress={() => setShowQr((open) => !open)}
              variant="secondary"
            />
          </View>

          {showQr ? (
            <Animated.View
              style={[
                styles.qr,
                {
                  opacity: reveal,
                  transform: [
                    {
                      translateY: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {revealing ? <ConnectRipple size={236} /> : null}
              <QRCodeView
                backgroundColor={colors.paper}
                color={colors.ink}
                size={200}
                value={url}
              />
            </Animated.View>
          ) : null}

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <AppText variant="label">Show my card on this page</AppText>
              <AppText variant="caption">
                Anyone who opens the address above can read it. While this is
                off the address shows nothing, and the name stays yours.
              </AppText>
            </View>
            <Switch
              onValueChange={(value) => void save({ isPublic: value })}
              trackColor={{ false: colors.mist, true: colors.sageStrong }}
              value={profile.isPublic}
            />
          </View>

          <AppText variant="label">What goes on it</AppText>
          <View style={styles.fields}>
            {ownCardFields.map((field) => {
              const on = profile.publicFields[field] === true;
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  key={field}
                  onPress={() =>
                    void save({
                      publicFields: { ...profile.publicFields, [field]: !on },
                    })
                  }
                  style={[styles.field, on && styles.fieldSelected]}
                >
                  <AppText
                    style={on ? styles.fieldTextSelected : undefined}
                    variant="caption"
                  >
                    {ownCardLabels[field]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.divider} />
      <OwnCardFields />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  field: {
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  fieldSelected: {
    backgroundColor: colors.ink,
  },
  fieldTextSelected: {
    color: colors.paper,
  },
  divider: {
    backgroundColor: colors.mist,
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  error: {
    color: colors.coralStrong,
  },
});
