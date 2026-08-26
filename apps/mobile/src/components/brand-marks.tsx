import Svg, { Path } from "react-native-svg";
import { colors } from "@/constants/theme";

// The real Google and Apple marks, rather than the lookalikes in the icon set.
// Both companies require their own artwork on a sign-in button, and a reviewer
// comparing the screen to their guidelines is looking for exactly this.
//
// `weight` is accepted and ignored so these drop into `Button`'s icon slot
// beside the Phosphor icons, which are drawn with a stroke weight. Brand marks
// are fixed artwork and have no such setting.

type MarkProps = {
  size?: number;
  color?: string;
  weight?: string;
};

/**
 * Google's mark keeps its four colours everywhere it appears — their brand
 * terms do not allow recolouring it to match the text beside it, so `color` is
 * accepted for a common signature with the icon set and deliberately unused.
 */
export function GoogleMark({ size = 20 }: MarkProps) {
  return (
    <Svg height={size} viewBox="0 0 48 48" width={size}>
      <Path
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        fill="#4285F4"
      />
      <Path
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        fill="#34A853"
      />
      <Path
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        fill="#FBBC05"
      />
      <Path
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/**
 * Apple's mark is monochrome by design and takes the colour of the text it sits
 * with, which is what their button guidance asks for.
 */
export function AppleMark({ size = 20, color = colors.ink }: MarkProps) {
  return (
    <Svg height={size} viewBox="0 0 24 24" width={size}>
      <Path
        d="M17.05 12.536c-.02-2.09 1.7-3.09 1.78-3.14-.97-1.42-2.48-1.61-3.02-1.63-1.29-.13-2.51.75-3.16.75-.65 0-1.66-.73-2.73-.71-1.4.02-2.7.81-3.42 2.06-1.46 2.53-.37 6.28 1.05 8.34.69 1.01 1.52 2.14 2.6 2.1 1.04-.04 1.44-.67 2.7-.67 1.26 0 1.62.67 2.72.65 1.12-.02 1.83-1.02 2.52-2.03.79-1.17 1.12-2.3 1.14-2.36-.03-.01-2.18-.84-2.2-3.33z"
        fill={color}
      />
      <Path
        d="M15.04 6.1c.57-.69.96-1.65.85-2.6-.83.03-1.83.55-2.42 1.24-.53.61-.99 1.59-.87 2.53.92.07 1.87-.47 2.44-1.17z"
        fill={color}
      />
    </Svg>
  );
}
