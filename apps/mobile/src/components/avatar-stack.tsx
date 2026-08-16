import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { colors, fontFamilies } from "@/constants/theme";

type StackPerson = {
  id: string;
  fullName: string;
  profilePhotoUrl: string | null;
};

/**
 * Everyone a row is about, overlapping, rather than whoever happened to be
 * first. The web's `AvatarStack` is the same component — keep the two in step.
 */
export function AvatarStack({
  people,
  size = 40,
  max = 3,
  ringColor = colors.porcelain,
}: {
  people: StackPerson[];
  size?: number;
  max?: number;
  ringColor?: string;
}) {
  if (people.length === 0) {
    return <Avatar name="Someone" size={size} />;
  }

  const shown = people.slice(0, max);
  const spare = people.length - shown.length;
  const overlap = -Math.round(size * 0.3);
  // A ring rather than a border on the Avatar itself: the disc is round, and a
  // coloured edge on a round element anti-aliases unevenly at the curve.
  const ring = 2;

  return (
    <View
      accessibilityLabel={people.map((person) => person.fullName).join(", ")}
      style={styles.row}
    >
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={[
            {
              backgroundColor: ringColor,
              borderRadius: (size + ring * 2) / 2,
              padding: ring,
            },
            index > 0 && { marginLeft: overlap },
          ]}
        >
          <Avatar
            name={person.fullName}
            size={size}
            uri={person.profilePhotoUrl}
          />
        </View>
      ))}
      {spare > 0 ? (
        <View
          style={[
            {
              backgroundColor: ringColor,
              borderRadius: (size + ring * 2) / 2,
              marginLeft: overlap,
              padding: ring,
            },
          ]}
        >
          <View
            style={[
              styles.spare,
              { borderRadius: size / 2, height: size, width: size },
            ]}
          >
            <AppText style={[styles.spareText, { fontSize: size * 0.3 }]}>
              {`+${spare}`}
            </AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
  },
  spare: {
    alignItems: "center",
    backgroundColor: colors.mist,
    justifyContent: "center",
  },
  spareText: {
    color: colors.inkMuted,
    fontFamily: fontFamilies.bodySemibold,
  },
});
