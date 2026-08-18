import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { brand } from "@/config/brand";
import { colors } from "@/constants/theme";
import {
  getReferralCode,
  getReferralCount,
  saveReferralCode,
} from "@/lib/data";
import {
  generateReferralCode,
  referralShareMessage,
  referralUrl,
} from "@/lib/referral";
import { useAuth } from "@/providers/auth-provider";

const webUrl =
  process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "") || "https://www.siyi.app";

/**
 * The web's invite section, on the phone. Same code, same link — an invite sent
 * from either place credits the same account.
 *
 * The phone gets the share sheet, which is the whole reason this is worth
 * having here: sending a link to someone is a thing people do on a phone, in a
 * text, not by copying a URL on a laptop.
 */
export function ReferralSection() {
  const auth = useAuth();
  const userId = auth.session?.user.id;
  const [code, setCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [existing, count] = await Promise.all([
        getReferralCode(userId),
        getReferralCount(),
      ]);
      setJoined(count);
      setCode(
        existing ??
          (await saveReferralCode(
            userId,
            generateReferralCode((length) => Crypto.getRandomBytes(length)),
          )),
      );
    } catch {
      setError("Your invite link could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !code) {
    return (
      <AppText style={styles.note}>
        {error ?? "Loading your invite link…"}
      </AppText>
    );
  }

  async function share() {
    const message = referralShareMessage(code!, webUrl);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({ message });
  }

  async function copyLink() {
    await Clipboard.setStringAsync(referralUrl(webUrl, code!));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.container}>
      <AppText style={styles.note}>
        {brand.shortName} is more useful when the people around you keep track
        too. Send this to someone who keeps saying they should text you back.
      </AppText>

      <View style={styles.codeBox}>
        <AppText style={styles.codeLabel}>Your code</AppText>
        <AppText style={styles.code}>{code}</AppText>
      </View>

      <View style={styles.actions}>
        <Button label="Share invite" onPress={share} />
        <Button
          label={copied ? "Link copied" : "Copy link"}
          variant="secondary"
          onPress={copyLink}
        />
      </View>

      <AppText style={styles.note}>
        {joined === 0
          ? "Nobody has joined on your code yet."
          : `${joined} ${joined === 1 ? "person has" : "people have"} joined on your code.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  note: { color: colors.inkMuted, fontSize: 13, lineHeight: 20 },
  codeBox: {
    backgroundColor: colors.porcelain,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  codeLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: "600" },
  code: { fontSize: 26, letterSpacing: 4 },
  actions: { flexDirection: "row", gap: 8 },
});
