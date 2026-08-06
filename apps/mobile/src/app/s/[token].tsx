import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { brand } from "@/config/brand";
import { colors, fontFamilies } from "@/constants/theme";
import { buildShareUrl, isValidShareToken } from "@/lib/person-share";

/**
 * Share links are meant to work for anyone, including people who have never
 * heard of Siyi, so /s/ is deliberately left out of the iOS association file
 * and always opens in the browser. Android's intent filter claims the whole
 * domain, though, so a link handed to someone who happens to have the app
 * installed would otherwise dead-end here. This screen hands it straight back
 * to the browser: an in-app browser view does not re-trigger the intent
 * filter, so there is no loop.
 */
export default function SharedContactRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const opened = useRef(false);
  const url = isValidShareToken(token)
    ? buildShareUrl(brand.webUrl || "https://www.siyi.app", token)
    : null;

  useEffect(() => {
    if (!url || opened.current) return;
    opened.current = true;
    void WebBrowser.openBrowserAsync(url).finally(() => router.replace("/"));
  }, [url, router]);

  return (
    <View style={styles.screen}>
      <AppText style={styles.title}>Opening a shared contact</AppText>
      <AppText style={styles.body}>
        Shared cards open in your browser so they work the same for everyone.
      </AppText>
      {url ? (
        <Button
          label="Open it"
          onPress={() => void WebBrowser.openBrowserAsync(url)}
        />
      ) : (
        <Button label="Go to Siyi" onPress={() => router.replace("/")} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.porcelain,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: 28,
    color: colors.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkMuted,
    marginBottom: 8,
  },
});
