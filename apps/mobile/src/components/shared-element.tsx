import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Easing, StyleSheet, View, type View as RNView } from "react-native";

/**
 * A shared element transition, done by hand.
 *
 * Reanimated still exports `sharedTransitionTag`, but on this stack (4.5.1 on
 * the New Architecture) the props are inert — a probe with a deliberate
 * 20-second duration finished in the time an ordinary push takes, with the
 * element already at its destination in the first frame. So the movement is
 * built here instead, the way these were done before libraries offered them:
 *
 *   1. The row measures its avatar in window coordinates as it is tapped.
 *   2. The destination measures its avatar once laid out.
 *   3. A copy is drawn in an overlay above both screens and animated from the
 *      first rectangle to the second, while the real destination avatar is
 *      held invisible.
 *   4. When it lands, the real one appears and the copy is thrown away.
 *
 * The copy is what actually travels, so the element appears to fly out of the
 * list and into the profile rather than fading in where it was going to be.
 */

export type SharedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Flight = {
  id: string;
  from: SharedRect;
  to: SharedRect | null;
  render: (size: number) => ReactNode;
  /** When it was started, so one that never lands cannot ambush a later visit. */
  startedAt: number;
};

/**
 * A flight is only honoured for as long as a push plausibly takes. Without
 * this, tapping a row whose profile then fails to load leaves the id armed;
 * opening that person later from search or a notification would animate an
 * avatar in from a row rectangle measured on another screen minutes ago.
 */
const flightExpiresMs = 1_200;

type SharedElementContextValue = {
  /** Called by the source as it is pressed, before navigation. */
  begin: (flight: Omit<Flight, "to" | "startedAt">) => void;
  /** Called by the destination once it knows where it sits. */
  arriveAt: (id: string, to: SharedRect, onLanded: () => void) => void;
  /** True while `id` is mid-flight, so the destination can stay hidden. */
  isFlying: (id: string) => boolean;
  /** Abandons a flight that never reached a destination. */
  cancel: (id: string) => void;
};

const SharedElementContext = createContext<SharedElementContextValue | null>(null);

const durationMs = 300;

/** One id per person, so two profiles never fight over the same flight. */
export function personAvatarSharedId(personId: string) {
  return `person-avatar:${personId}`;
}

export function useSharedElement() {
  return useContext(SharedElementContext);
}

export function SharedElementProvider({ children }: { children: ReactNode }) {
  const [flight, setFlight] = useState<Flight | null>(null);
  // useState so the value is created once, rather than allocating a throwaway
  // on every render of the provider.
  const [progress] = useState(() => new Animated.Value(0));
  // Read synchronously by isFlying, which callers use during render.
  const flyingId = useRef<string | null>(null);
  const startedAt = useRef(0);

  const clear = useCallback(() => {
    flyingId.current = null;
    setFlight(null);
    progress.setValue(0);
  }, [progress]);

  const begin = useCallback(
    (next: Omit<Flight, "to" | "startedAt">) => {
      flyingId.current = next.id;
      startedAt.current = Date.now();
      progress.setValue(0);
      setFlight({ ...next, to: null, startedAt: startedAt.current });
    },
    [progress],
  );

  const cancel = useCallback(
    (id: string) => {
      if (flyingId.current === id) clear();
    },
    [clear],
  );

  const arriveAt = useCallback(
    (id: string, to: SharedRect, onLanded: () => void) => {
      setFlight((current) => {
        if (!current || current.id !== id || current.to) {
          // Nothing to fly: the caller still has to reveal itself.
          onLanded();
          return current;
        }
        Animated.timing(progress, {
          duration: durationMs,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }).start(() => {
          // Revealed on landing, finished or interrupted. Doing it when the
          // flight *starts* drew the destination and the copy at the same
          // time, which is two of the same avatar for the whole 300ms.
          onLanded();
          clear();
        });
        return { ...current, to };
      });
    },
    [clear, progress],
  );

  const isFlying = useCallback(
    (id: string) =>
      flyingId.current === id &&
      Date.now() - startedAt.current < flightExpiresMs,
    [],
  );

  const value = useMemo(
    () => ({ begin, arriveAt, isFlying, cancel }),
    [arriveAt, begin, cancel, isFlying],
  );

  return (
    <SharedElementContext.Provider value={value}>
      {children}
      {flight?.to ? <FlyingCopy flight={flight} progress={progress} /> : null}
    </SharedElementContext.Provider>
  );
}

/**
 * The copy in flight. It is drawn at the destination's size and scaled down to
 * the source's, rather than the other way round, so the version that lands —
 * the one held still at the end — is rendered at its natural resolution.
 */
function FlyingCopy({
  flight,
  progress,
}: {
  flight: Flight;
  progress: Animated.Value;
}) {
  const { from, to } = flight;
  if (!to) return null;

  const scaleFrom = to.width === 0 ? 1 : from.width / to.width;
  const interpolate = (start: number, end: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [start, end] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={{
          height: to.height,
          left: 0,
          position: "absolute",
          top: 0,
          width: to.width,
          transform: [
            // Centres are what line up; sizes are handled by the scale below.
            {
              translateX: interpolate(
                from.x + from.width / 2 - to.width / 2,
                to.x,
              ),
            },
            {
              translateY: interpolate(
                from.y + from.height / 2 - to.height / 2,
                to.y,
              ),
            },
            { scale: interpolate(scaleFrom, 1) },
          ],
        }}
      >
        {flight.render(to.width)}
      </Animated.View>
    </View>
  );
}

/**
 * Measures a node in window coordinates. Returns null when the node has gone
 * or has no layout yet, which the callers treat as "no transition" rather than
 * guessing at a rectangle.
 */
export function measureSharedRect(
  node: RNView | null,
): Promise<SharedRect | null> {
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => {
      if (width === 0 || height === 0) resolve(null);
      else resolve({ x, y, width, height });
    });
  });
}
