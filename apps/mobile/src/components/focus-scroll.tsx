import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  TextInput,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInputProps,
} from "react-native";
import { useKeyboardHeight } from "@/hooks/use-keyboard";

/**
 * Keeping the field you are typing in on screen, by construction.
 *
 * Nothing here trusts a sheet or a `KeyboardAvoidingView` to lift far enough.
 * A field says "I have focus", the scrolling area it sits in measures where it
 * actually landed on the glass, and scrolls until it clears the keyboard and
 * whatever is pinned above it.
 */

/** Breathing room between the field and whatever is covering the screen. */
const revealMargin = 16;

/**
 * The keyboard, the sheet and any lifting layout are all still animating when
 * focus lands, so the first measurement would be of where things used to be.
 */
const settleDelayMs = 260;

type Measurable = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

type Scrollable = {
  scrollTo?: (options: { y?: number; animated?: boolean }) => void;
};

/**
 * Where the scrolling area has to be scrolled to for a field to be fully
 * visible. Everything is in window points, and the answer is a content offset.
 *
 * The clamp against `viewportTop` matters for a field taller than the space
 * left over: showing its bottom would push the line being typed off the top,
 * so the top wins.
 */
export function scrollOffsetToRevealField({
  currentOffset,
  fieldTop,
  fieldHeight,
  viewportTop,
  viewportBottom,
  margin = revealMargin,
}: {
  currentOffset: number;
  fieldTop: number;
  fieldHeight: number;
  viewportTop: number;
  viewportBottom: number;
  margin?: number;
}) {
  const hiddenBelow = fieldTop + fieldHeight + margin - viewportBottom;
  const hiddenAbove = viewportTop + margin - fieldTop;

  if (hiddenBelow > 0) {
    const roomAboveTheField = Math.max(0, fieldTop - margin - viewportTop);
    return Math.max(0, currentOffset + Math.min(hiddenBelow, roomAboveTheField));
  }
  if (hiddenAbove > 0) {
    return Math.max(0, currentOffset - hiddenAbove);
  }
  return currentOffset;
}

type FocusScrollValue = {
  /** Called by a field when it takes focus. */
  reveal: (field: Measurable | null | undefined) => void;
};

const FocusScrollContext = createContext<FocusScrollValue | null>(null);

/** Null outside a scrolling area, so a field can be used anywhere. */
export function useFocusScroll() {
  return useContext(FocusScrollContext);
}

export function FocusScrollProvider({
  value,
  children,
}: {
  value: FocusScrollValue;
  children: ReactNode;
}) {
  return (
    <FocusScrollContext.Provider value={value}>
      {children}
    </FocusScrollContext.Provider>
  );
}

/**
 * Props for a plain `TextInput` that is not a `FormField`, so search boxes and
 * one-off inputs get the same treatment without repeating the wiring.
 */
export function useRevealOnFocus() {
  const focusScroll = useFocusScroll();
  const field = useRef<Measurable | null>(null);

  return {
    ref: (input: Measurable | null | undefined) => {
      field.current = input ?? null;
    },
    onFocus: () => focusScroll?.reveal(field.current),
  };
}

/**
 * A `TextInput` that scrolls itself into view, for the search boxes and inline
 * inputs that are not `FormField`s. It has to be a component rather than props
 * spread at the call site: a screen builds its own body outside the scrolling
 * area's provider, so a hook up there would find nothing to talk to.
 */
export function RevealingTextInput({ onFocus, ...props }: TextInputProps) {
  const revealOnFocus = useRevealOnFocus();

  return (
    <TextInput
      {...props}
      onFocus={(event) => {
        revealOnFocus.onFocus();
        onFocus?.(event);
      }}
      ref={revealOnFocus.ref}
    />
  );
}

/**
 * Wires a scrolling area up to the fields inside it. Spread `scrollProps` onto
 * the `ScrollView` (or `BottomSheetScrollView`) and put `focusScroll` on a
 * `FocusScrollProvider` around its children.
 *
 * `bottomInset` is whatever is pinned over the bottom of the area — a sticky
 * footer — measured from the keyboard up.
 */
export function useFocusScrollArea({
  bottomInset = 0,
}: { bottomInset?: number } = {}) {
  const scroller = useRef<(Scrollable & Measurable) | null>(null);
  const focusedField = useRef<Measurable | null>(null);
  const contentOffset = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const keyboardHeight = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();

  // Read inside a measurement callback that fires long after this render.
  const covered = useRef({ keyboardHeight, windowHeight, bottomInset });
  covered.current = { keyboardHeight, windowHeight, bottomInset };

  const scrollFocusedFieldIntoView = useCallback(() => {
    const field = focusedField.current;
    const area = scroller.current;
    if (!field?.measureInWindow || !area?.scrollTo) return;

    field.measureInWindow((_x, fieldTop, _width, fieldHeight) => {
      if (!fieldHeight) return;
      const { keyboardHeight: keyboard, windowHeight: window, bottomInset: inset } =
        covered.current;
      const viewportBottom = window - keyboard - inset;

      const scrollToReveal = (viewportTop: number) => {
        const offset = scrollOffsetToRevealField({
          currentOffset: contentOffset.current,
          fieldTop,
          fieldHeight,
          viewportTop,
          viewportBottom,
        });
        if (Math.abs(offset - contentOffset.current) < 1) return;
        contentOffset.current = offset;
        area.scrollTo?.({ y: offset, animated: true });
      };

      // The top of the area is only needed to stop an overlong field being
      // scrolled past. Not every scroll view can measure itself; without it the
      // field is simply revealed from the bottom, which is the case that hurts.
      if (area.measureInWindow) {
        area.measureInWindow((_areaX, areaTop) => scrollToReveal(areaTop));
      } else {
        scrollToReveal(0);
      }
    });
  }, []);

  const settleThenScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(
      scrollFocusedFieldIntoView,
      settleDelayMs,
    );
  }, [scrollFocusedFieldIntoView]);

  const reveal = useCallback(
    (field: Measurable | null | undefined) => {
      focusedField.current = field ?? null;
      settleThenScroll();
    },
    [settleThenScroll],
  );

  // The keyboard growing (a suggestion bar, a switch to emoji) covers more of
  // the field than it did a moment ago, so the same question is asked again.
  useEffect(() => {
    if (keyboardHeight === 0) {
      focusedField.current = null;
      return;
    }
    if (!focusedField.current) return;
    settleThenScroll();
  }, [keyboardHeight, settleThenScroll]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const focusScroll = useMemo<FocusScrollValue>(() => ({ reveal }), [reveal]);

  const scrollProps = useMemo(
    () => ({
      ref: (instance: (Scrollable & Measurable) | null) => {
        scroller.current = instance;
      },
      onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        contentOffset.current = event.nativeEvent.contentOffset.y;
      },
      scrollEventThrottle: 16,
    }),
    [],
  );

  return { focusScroll, scrollProps };
}
