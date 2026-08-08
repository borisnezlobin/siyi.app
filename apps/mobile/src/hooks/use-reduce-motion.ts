import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system's Reduce Motion setting only reads back from a promise, so the
 * first screen that asks would have started moving before the answer arrived.
 * The answer is cached the moment it is known, which makes every later screen
 * in the session correct on its very first render.
 */
let lastKnown = false;

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(lastKnown);

  useEffect(() => {
    let listening = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      lastKnown = enabled;
      if (listening) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        lastKnown = enabled;
        setReduceMotion(enabled);
      },
    );

    return () => {
      listening = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
