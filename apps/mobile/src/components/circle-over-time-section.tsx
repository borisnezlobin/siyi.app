import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Avatar } from "@/components/avatar";
import { colors, radii } from "@/constants/theme";
import {
  circleMonthFaces,
  circleMonthHeight,
  circleOverTime,
  circleScale,
  hasCircleHistory,
  type CircleMember,
} from "@/lib/circle-over-time";

/**
 * Your circle, month by month. The web draws the same thing from the same
 * library — height says how many, a face says who.
 *
 * A face per person was the first idea and it only reads up to about six. A
 * circle here passes a hundred, so a busy month holds thirty, and a stack that
 * tall either runs off the top or gets capped — either way a month of twenty
 * and a month of thirty-four draw identically, which is the one comparison this
 * exists to make. A bar measured against the busiest month holds at any size.
 *
 * Nothing is counted at the reader: no total, no average, no "up from last
 * month". The strongest claim is that one month was fuller than another.
 */
const chartHeight = 118;

export function CircleOverTimeSection({
  people,
  now = new Date(),
}: {
  people: CircleMember[];
  now?: Date;
}) {
  const months = circleOverTime(people, now);
  if (!hasCircleHistory(months)) return null;

  const scale = circleScale(months);

  return (
    <View style={styles.card}>
      <View style={styles.months}>
        {months.map((month) => {
          const { faces } = circleMonthFaces(month);
          const height = circleMonthHeight(month, scale);
          const met = month.people.length;

          return (
            <View
              accessibilityLabel={
                met === 0
                  ? `${month.label}, nobody new`
                  : met === 1
                    ? `${month.label}, one person`
                    : `${month.label}, ${met} people`
              }
              accessible
              key={month.key}
              style={styles.month}
            >
              <View style={styles.stalk}>
                {faces.length ? (
                  <View style={styles.faces}>
                    {faces.map((person, index) => (
                      <View
                        key={person.id}
                        style={index === 0 ? undefined : styles.behind}
                      >
                        <Avatar
                          name={person.preferredName || person.fullName}
                          size={25}
                          uri={person.profilePhotoUrl}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.quiet} />
                )}
                {height > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      month.current && styles.barNow,
                      // Leaves room for the faces sitting on top, so a full
                      // month cannot push them out of the card.
                      { height: Math.round(height * (chartHeight - 26)) },
                    ]}
                  />
                ) : null}
              </View>
              <AppText
                style={month.current ? styles.monthNow : styles.monthName}
                variant="caption"
              >
                {month.label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    padding: 16,
  },
  months: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 7,
    height: chartHeight,
  },
  month: {
    alignItems: "center",
    flex: 1,
    gap: 7,
    height: "100%",
    justifyContent: "flex-end",
  },
  stalk: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
  },
  faces: {
    alignItems: "center",
    marginBottom: -4,
    zIndex: 1,
  },
  behind: {
    marginTop: -13,
    opacity: 0.85,
  },
  quiet: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 5,
    marginBottom: 4,
    width: 5,
  },
  bar: {
    backgroundColor: colors.sage,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    width: 22,
  },
  barNow: {
    backgroundColor: colors.sageStrong,
  },
  monthName: {
    color: colors.inkMuted,
  },
  monthNow: {
    color: colors.ink,
    fontWeight: "600",
  },
});
