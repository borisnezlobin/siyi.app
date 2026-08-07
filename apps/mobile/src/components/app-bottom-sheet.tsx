import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardHeight } from "@/components/keyboard-aware-form";
import { colors, radii } from "@/constants/theme";

/**
 * Every sheet in the app is this one: the same handle, corners, background and
 * backdrop, swipe-to-close from the library, and a backdrop that fades on its
 * own rather than sliding in attached to the sheet.
 */
export const AppBottomSheet = forwardRef<
  BottomSheetModal,
  { children: ReactNode; onDismiss?: () => void }
>(function AppBottomSheet({ children, onDismiss }, ref) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();

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

  return (
    <BottomSheetModal
      // "extend" grew the sheet to full height behind the keyboard, which put
      // the field being typed in and the save button underneath it.
      // "interactive" lifts the sheet by the keyboard instead.
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      enableDynamicSizing
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
      {children}
    </BottomSheetModal>
  );
});

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
});
