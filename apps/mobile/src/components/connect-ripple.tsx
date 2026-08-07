import {
  Canvas,
  Fill,
  Shader,
  Skia,
  useClock,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";
import { skiaShaderSource } from "@/lib/connect-shader";

/**
 * The ripple behind a QR code, running the same shader body as the web.
 *
 * If the shader fails to compile — an old device, a Skia version that parses
 * SkSL differently — nothing is drawn. The code underneath is the point.
 */
export function ConnectRipple({ size }: { size: number }) {
  const effect = useMemo(() => Skia.RuntimeEffect.Make(skiaShaderSource), []);
  const clock = useClock();

  const uniforms = useDerivedValue(
    () => ({ time: clock.value / 1000, resolution: [size, size] }),
    [clock, size],
  );

  if (!effect) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frame]}>
      <Canvas style={{ height: size, width: size }}>
        <Fill>
          <Shader source={effect} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
  },
});
