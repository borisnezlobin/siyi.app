import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";
import { colors, radii } from "@/constants/theme";

/**
 * Offered, never applied.
 *
 * A picture found somewhere else is a guess about who someone is, so it is
 * shown before it is saved and the person doing the saving gets to look at it
 * first. Nothing appears at all unless there is a picture to show — a failed
 * or refused lookup leaves the screen exactly as it was.
 */
export function FoundPhotoSheet({
  visible,
  photoUri,
  source,
  saving = false,
  onUse,
  onDismiss,
}: {
  visible: boolean;
  photoUri: string | null;
  source: "instagram" | "contacts";
  saving?: boolean;
  onUse: () => void;
  onDismiss: () => void;
}) {
  if (!photoUri) return null;

  return (
    <Sheet onRequestClose={onDismiss} visible={visible}>
      <AppText variant="title">Save profile picture?</AppText>
      <AppText style={styles.body}>
        {source === "instagram"
          ? "Siyi found this profile picture on Instagram. Use it?"
          : "Siyi found this picture on your contact for them. Use it?"}
      </AppText>

      <View style={styles.preview}>
        <Image
          accessibilityIgnoresInvertColors
          alt="The profile picture Siyi found"
          contentFit="cover"
          source={{ uri: photoUri }}
          style={styles.photo}
          transition={140}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label="Don't use"
          onPress={onDismiss}
          variant="quiet"
        />
        <Button label="Use" loading={saving} onPress={onUse} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.inkMuted,
  },
  preview: {
    alignItems: "center",
    paddingVertical: 8,
  },
  photo: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 132,
    width: 132,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
});
