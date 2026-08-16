import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { brand } from "@/config/brand";
import { colors } from "@/constants/theme";
import {
  createCalendarToken,
  googleSubscribeUrl,
  httpsFeedUrl,
  webcalFeedUrl,
} from "@/lib/calendar-feed";
import { getCalendarToken, saveCalendarToken } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * The web's calendar section, on the phone. Same link, same three ways to use
 * it — a calendar subscribed from either place is the same subscription.
 */
export function CalendarFeedSection() {
  const auth = useAuth();
  const userId = auth.session?.user.id;
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"on" | "reset" | "off" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setToken(await getCalendarToken(userId));
    } catch {
      setError("The calendar link could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function write(action: "on" | "reset" | "off") {
    if (!userId) return;
    setBusy(action);
    setError(null);
    const next =
      action === "off"
        ? null
        : createCalendarToken((length) =>
            Crypto.getRandomBytes(length),
          );
    try {
      await saveCalendarToken(userId, next);
      setToken(next);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("That could not be saved. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  function confirmThenWrite(action: "reset" | "off") {
    Alert.alert(
      action === "reset" ? "Reset the link?" : "Turn the link off?",
      action === "reset"
        ? "Calendars already subscribed to the old link stop updating. You will need to add the new one."
        : "Calendars already subscribed stop updating.",
      [
        { style: "cancel", text: "Keep it" },
        {
          style: "destructive",
          text: action === "reset" ? "Reset" : "Turn it off",
          onPress: () => void write(action),
        },
      ],
    );
  }

  if (loading) {
    return (
      <AppText style={styles.note} variant="caption">
        Checking your calendar link…
      </AppText>
    );
  }

  if (!brand.webUrl) {
    return (
      <AppText style={styles.note} variant="caption">
        The calendar link needs a web address for this build, and there is not
        one configured.
      </AppText>
    );
  }

  if (!token) {
    return (
      <View style={styles.stack}>
        <AppText style={styles.note} variant="caption">
          {`${brand.shortName} can hand your calendar a private link. Birthdays and reminders then show up next to everything else you have on, and stay in step on their own.`}
        </AppText>
        <Button
          label="Create my calendar link"
          loading={busy === "on"}
          onPress={() => void write("on")}
        />
        {error ? (
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        ) : null}
      </View>
    );
  }

  const httpsUrl = httpsFeedUrl(token, brand.webUrl);

  return (
    <View style={styles.stack}>
      <AppText style={styles.note} variant="caption">
        Add it once and your calendar keeps itself up to date. Anyone with this
        link can read your birthdays and reminders, so keep it to yourself.
      </AppText>

      <Button
        label="Add to Apple Calendar"
        onPress={() =>
          void Linking.openURL(webcalFeedUrl(token, brand.webUrl))
        }
        variant="secondary"
      />
      <Button
        label="Add to Google Calendar"
        onPress={() =>
          void Linking.openURL(googleSubscribeUrl(token, brand.webUrl))
        }
        variant="secondary"
      />

      <View style={styles.linkBox}>
        <AppText numberOfLines={1} style={styles.linkText} variant="caption">
          {httpsUrl}
        </AppText>
      </View>
      <Button
        compact
        label="Copy the link"
        onPress={() => void Clipboard.setStringAsync(httpsUrl)}
        variant="quiet"
      />
      <AppText style={styles.note} variant="caption">
        Outlook and anything else that takes a calendar link will accept this
        one too.
      </AppText>

      <View style={styles.destructiveRow}>
        <Button
          compact
          label="Reset the link"
          loading={busy === "reset"}
          onPress={() => confirmThenWrite("reset")}
          variant="quiet"
        />
        <Button
          compact
          label="Turn it off"
          loading={busy === "off"}
          onPress={() => confirmThenWrite("off")}
          variant="quiet"
        />
      </View>

      {error ? (
        <AppText style={styles.errorText} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 10,
  },
  note: {
    color: colors.inkMuted,
  },
  linkBox: {
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkText: {
    color: colors.inkMuted,
  },
  destructiveRow: {
    flexDirection: "row",
    gap: 12,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
