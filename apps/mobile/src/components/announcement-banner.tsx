import { Megaphone, X } from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  dismissAnnouncement,
  fetchLiveAnnouncements,
  type BannerAnnouncement,
} from "@/lib/announcements";
import { useAuth } from "@/providers/auth-provider";

/**
 * The same banner the web shows, fed by the same endpoint, and dismissed
 * against the same server-side record — so putting the phone away and opening
 * the web does not bring a dismissed announcement back.
 *
 * It renders nothing at all when there is nothing to say, which is also what
 * happens when the endpoint is unreachable or the announcements table has not
 * been migrated yet.
 */
export function AnnouncementBanner() {
  const { session } = useAuth();
  const [announcement, setAnnouncement] = useState<BannerAnnouncement | null>(
    null,
  );

  // Keyed on the token, not the session object, so a fresh context value does
  // not refetch the banner on every render.
  const accessToken = session?.access_token;

  useEffect(() => {
    let cancelled = false;
    if (!session) return;

    void fetchLiveAnnouncements(session, brand.webUrl).then((live) => {
      if (cancelled) return;
      setAnnouncement(live[0] ?? null);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const dismiss = useCallback(() => {
    if (!announcement || !session) return;
    setAnnouncement(null);
    void dismissAnnouncement(session, brand.webUrl, announcement.id);
  }, [announcement, session]);

  if (!announcement) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Megaphone color={colors.sageStrong} size={18} style={styles.icon} />
      <View style={styles.copy}>
        <AppText variant="label">{announcement.title}</AppText>
        <AppText style={styles.body}>{announcement.body}</AppText>
      </View>
      <Pressable
        accessibilityLabel="Dismiss announcement"
        accessibilityRole="button"
        hitSlop={8}
        onPress={dismiss}
        style={styles.dismiss}
      >
        <X color={colors.inkMuted} size={16} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.sage,
    borderRadius: radii.large,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    marginTop: 2,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  body: {
    color: colors.inkMuted,
  },
  dismiss: {
    marginRight: -4,
  },
});
