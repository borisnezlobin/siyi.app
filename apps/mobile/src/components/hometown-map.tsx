import { useWindowDimensions, View, StyleSheet } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { colors, radii } from "@/constants/theme";
import type { HometownPlace } from "@/lib/geocode";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  countryOutlines,
  projectToMap,
} from "@/lib/world-outline";

/** Wider than tall, so the map reads as a strip rather than a poster. */
const mapAspectRatio = 2.4;

/** Never zoom in past roughly a quarter of the world. */
const minimumSpan = MAP_WIDTH / 4;

/**
 * Frames the pins rather than always showing the whole globe: a circle that
 * happens to be entirely Californian gets a map of California. Kept identical to
 * the web version so both apps frame the same set of people the same way.
 */
function fitViewBox(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    const height = MAP_WIDTH / mapAspectRatio;
    return `0 ${(MAP_HEIGHT - height) / 2} ${MAP_WIDTH} ${height}`;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const padding = 0.25;
  const spanX = (Math.max(...xs) - Math.min(...xs)) * (1 + padding);
  const spanY = (Math.max(...ys) - Math.min(...ys)) * (1 + padding);

  let width = Math.max(spanX, spanY * mapAspectRatio, minimumSpan);
  width = Math.min(width, MAP_WIDTH);
  let height = width / mapAspectRatio;
  if (height > MAP_HEIGHT) {
    height = MAP_HEIGHT;
    width = height * mapAspectRatio;
  }

  const centreX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centreY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const clamp = (value: number, limit: number) =>
    Math.max(0, Math.min(value, limit));

  return [
    clamp(centreX - width / 2, MAP_WIDTH - width),
    clamp(centreY - height / 2, MAP_HEIGHT - height),
    width,
    height,
  ].join(" ");
}

function pinRadius(count: number, unit: number) {
  return (7 + Math.sqrt(count - 1) * 5) * unit;
}

/**
 * The map is a picture of the list underneath it, not a replacement for it, so
 * it is hidden from screen readers rather than described badly.
 */
export function HometownMap({ places }: { places: HometownPlace[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const projected = places.map((place) => ({
    ...place,
    ...projectToMap(place.latitude, place.longitude),
  }));
  const viewBox = fitViewBox(projected);
  const viewBoxWidth = Number(viewBox.split(" ")[2]);
  const unit = viewBoxWidth / 560;
  const height = (screenWidth - 40) / mapAspectRatio;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.frame}>
      <Svg height={height} viewBox={viewBox} width="100%">
        <G fill={colors.sage} stroke={colors.paper} strokeWidth={1.5 * unit}>
          {countryOutlines.map((outline, index) => (
            <Path d={outline} key={index} />
          ))}
        </G>
        {projected.map((place) => (
          <Circle
            cx={place.x}
            cy={place.y}
            fill={place.precision === "city" ? colors.coral : colors.paper}
            key={place.key}
            r={pinRadius(place.people.length, unit)}
            stroke={place.precision === "city" ? colors.paper : colors.coral}
            strokeWidth={(place.precision === "city" ? 2.5 : 3) * unit}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    overflow: "hidden",
  },
});
