import {
  Blur,
  Canvas,
  Circle,
  Group,
  Image as SkiaImage,
  LinearGradient,
  Paint,
  Rect,
  useImage,
  vec,
} from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions } from "react-native";
import { colors } from "@/constants/theme";
import { avatarColorFor } from "@/lib/avatar-colors";

/**
 * The wash of colour behind the top of someone's profile.
 *
 * It is their photo, drawn much larger than the space and blurred until only
 * the colours are left — the same trick as the glow around a video. Without a
 * photo it falls back to the colour they already carry everywhere else in the
 * app, as a few soft shapes rather than a flat panel.
 *
 * The bottom fades into the page so the effect has no edge to notice.
 */
export function AmbientHeader({
  name,
  uri,
  height,
}: {
  name: string;
  uri?: string | null;
  height: number;
}) {
  const { width } = useWindowDimensions();
  const image = useImage(uri ?? null);
  const color = avatarColorFor(name);

  return (
    <Canvas pointerEvents="none" style={[styles.canvas, { height, width }]}>
      <Group layer={<Paint><Blur blur={52} /></Paint>}>
        {image ? (
          // Drawn well outside the frame: a blur this heavy would otherwise
          // thin out towards the edges and show where the image stops.
          <SkiaImage
            fit="cover"
            height={height * 1.6}
            image={image}
            width={width * 1.4}
            x={-width * 0.2}
            y={-height * 0.4}
          />
        ) : (
          <Group opacity={0.5}>
            <Circle
              color={color.ink}
              cx={width * 0.26}
              cy={height * 0.3}
              r={height * 0.46}
            />
            <Circle
              color={color.ink}
              cx={width * 0.84}
              cy={height * 0.16}
              opacity={0.7}
              r={height * 0.36}
            />
            <Circle
              color={color.background}
              cx={width * 0.6}
              cy={height * 0.66}
              r={height * 0.34}
            />
          </Group>
        )}
      </Group>

      <Rect height={height} width={width} x={0} y={0}>
        <LinearGradient
          colors={[
            "rgba(244, 247, 244, 0)",
            "rgba(244, 247, 244, 0.72)",
            colors.porcelain,
          ]}
          end={vec(0, height)}
          positions={[0, 0.62, 1]}
          start={vec(0, 0)}
        />
      </Rect>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    left: 0,
    position: "absolute",
    top: 0,
  },
});
