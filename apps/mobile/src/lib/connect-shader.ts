/**
 * The ripple that sits behind a QR code while it is on screen.
 *
 * Rings travel outward from the middle the way AirDrop's radar does, which reads
 * as "looking for someone" rather than as decoration. The maths lives here in
 * one place because both apps draw it: the web compiles this as GLSL for WebGL,
 * and the phone compiles the same body as SkSL for Skia. Keeping the two in step
 * matters more than either being clever.
 *
 * Written to be cheap: no loops, no texture reads, a handful of trig calls per
 * pixel. It runs on a 320px square, so even a slow phone is filling well under
 * 100k pixels a frame.
 */

/** Seconds for a ring to travel from the centre to the edge. */
export const ringPeriodSeconds = 2.6;

/** How many rings are in flight at once. */
export const ringCount = 3;

/**
 * The shared body, in the subset both GLSL and SkSL understand.
 *
 * `uv` is centred on the middle of the quad and runs -1 to 1 on the short axis.
 * Returns premultiplied colour and alpha packed as rgb + a.
 */
export const connectShaderBody = /* glsl */ `
  float ripple(vec2 uv, float time) {
    float radius = length(uv);
    float wave = 0.0;

    // Each ring is the same travelling pulse, offset in time.
    for (int index = 0; index < ${ringCount}; index++) {
      float phase = fract(time / ${ringPeriodSeconds.toFixed(1)} + float(index) / float(${ringCount}));
      float ringRadius = phase * 1.35;
      // A thin band that fades as it travels, so rings dissolve near the edge
      // rather than stopping at it.
      float band = smoothstep(0.13, 0.0, abs(radius - ringRadius));
      wave += band * (1.0 - phase) * (1.0 - phase);
    }

    // Hollow the middle out so the code itself stays the brightest thing.
    float centreMask = smoothstep(0.20, 0.62, radius);
    return wave * centreMask;
  }

  vec4 connectColour(vec2 uv, float time) {
    float wave = ripple(uv, time);

    // Coral to sage across the ring, the two brand colours the app already uses.
    vec3 coral = vec3(0.937, 0.435, 0.353);
    vec3 sage = vec3(0.612, 0.729, 0.663);
    vec3 tint = mix(coral, sage, clamp(length(uv), 0.0, 1.0));

    float alpha = clamp(wave * 2.2, 0.0, 0.7);
    return vec4(tint * alpha, alpha);
  }
`;

export const webVertexShader = /* glsl */ `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const webFragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float time;
  ${connectShaderBody}
  void main() {
    gl_FragColor = connectColour(vUv, time);
  }
`;

/**
 * Skia hands the shader pixel coordinates rather than a varying, so the same
 * body is wrapped in a main that recreates `uv` from the resolution.
 */
export const skiaShaderSource = `
  uniform float time;
  uniform float2 resolution;
  ${connectShaderBody.replace(/vec2/g, "float2").replace(/vec3/g, "float3").replace(/vec4/g, "float4")}
  half4 main(float2 fragCoord) {
    float2 uv = (fragCoord - resolution * 0.5) / (min(resolution.x, resolution.y) * 0.5);
    float4 colour = connectColour(uv, time);
    return half4(colour);
  }
`;
