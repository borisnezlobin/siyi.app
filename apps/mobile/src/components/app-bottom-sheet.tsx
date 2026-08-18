import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FocusScrollProvider,
  useFocusScrollArea,
} from "@/components/focus-scroll";
import { useKeyboardHeight, useKeyboardVisible } from "@/hooks/use-keyboard";
import { colors, radii } from "@/constants/theme";

/**
 * How tall the pinned footer is, so content inside the sheet can be padded to
 * scroll clear of it. Zero when the sheet has no footer.
 */
const SheetFooterHeightContext = createContext(0);

export function useSheetFooterHeight() {
  return useContext(SheetFooterHeightContext);
}

/**
 * Every sheet in the app is this one: the same handle, corners, background and
 * backdrop, swipe-to-close from the library, and a backdrop that fades on its
 * own rather than sliding in attached to the sheet.
 *
 * A sheet with a primary action passes it as `footer`. The library pins the
 * footer above the keyboard, so the action cannot end up below the fold no
 * matter how long the form gets — which is the whole point of it being here
 * rather than as the last thing in the scroll view.
 */
export const AppBottomSheet = forwardRef<
  BottomSheetModal,
  { children: ReactNode; footer?: ReactNode; onDismiss?: () => void }
>(function AppBottomSheet({ children, footer, onDismiss }, ref) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const keyboardVisible = useKeyboardVisible();
  const { height: windowHeight } = useWindowDimensions();
  const [footerHeight, setFooterHeight] = useState(0);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.42}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props}>
        <View
          onLayout={(event: LayoutChangeEvent) =>
            setFooterHeight(event.nativeEvent.layout.height)
          }
          style={[
            styles.footer,
            {
              // The safe-area gap belongs under the home indicator, not on top
              // of a keyboard that has already taken that space.
              paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 12),
            },
          ]}
          testID="sheet-footer"
        >
          {footer}
        </View>
      </BottomSheetFooter>
    ),
    [footer, insets.bottom, keyboardVisible],
  );

  return (
    <BottomSheetModal
      // "extend" grew the sheet to full height behind the keyboard, which put
      // the field being typed in and the save button underneath it.
      // "interactive" lifts the sheet by the keyboard instead.
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      enableDynamicSizing
      footerComponent={footer ? renderFooter : undefined}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      // The ceiling has to come down by the keyboard's height. Left at the full
      // window the sheet is already as tall as it can be, so there is no room
      // for "interactive" to lift it and the fields end up underneath.
      maxDynamicContentSize={windowHeight - insets.top - 12 - keyboardHeight}
      onDismiss={onDismiss}
      ref={ref}
      topInset={insets.top + 8}
    >
      <SheetFooterHeightContext.Provider value={footer ? footerHeight : 0}>
        {children}
      </SheetFooterHeightContext.Provider>
    </BottomSheetModal>
  );
});

/**
 * The scrolling body of a sheet. Pads itself clear of the keyboard and the
 * pinned footer, and scrolls whichever field has focus into what is left.
 */
export function AppBottomSheetScrollView({
  children,
  contentContainerStyle,
  ...props
}: ComponentProps<typeof BottomSheetScrollView>) {
  const insets = useSafeAreaInsets();
  const footerHeight = useSheetFooterHeight();
  const { focusScroll, scrollProps } = useFocusScrollArea({
    bottomInset: footerHeight,
  });

  return (
    <FocusScrollProvider value={focusScroll}>
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.sheetContent,
          {
            // No room is left for the keyboard here. The sheet is already
            // whole-sale above it — "interactive" lifts it, and the ceiling
            // below comes down by the same amount — so padding for it a second
            // time subtracted the keyboard twice and squeezed the form to
            // nothing on a small screen.
            paddingBottom: Math.max(insets.bottom + 24, 36) + footerHeight,
          },
          contentContainerStyle,
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        {...scrollProps}
        {...props}
      >
        {children}
      </BottomSheetScrollView>
    </FocusScrollProvider>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.porcelain,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
  },
  handle: {
    backgroundColor: colors.inkMuted,
    opacity: 0.35,
    width: 44,
  },
  footer: {
    backgroundColor: colors.porcelain,
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetContent: {
    gap: 22,
    // A floor, because the sheet sizes itself to whatever it is holding. While
    // the people were still loading the content was a lone spinner, so the
    // sheet shrank to fit it and the form appeared as a sliver above the
    // keyboard. Whatever the body happens to be at any instant, the sheet stays
    // big enough to be a sheet.
    minHeight: 260,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
