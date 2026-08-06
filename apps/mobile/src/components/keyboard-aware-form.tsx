import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInput,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";

/**
 * True while the software keyboard is on screen. iOS gets the "will" events so
 * layout moves with the keyboard instead of after it.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, () => setVisible(true));
    const hidden = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return visible;
}

/**
 * How much of the screen the keyboard is covering, in points. Zero when it is
 * closed. Useful for padding scrollable content so its last control can still
 * be scrolled into view.
 */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // Deliberately the show event rather than willChangeFrame: that one also
    // fires as the keyboard leaves, still reporting its full height, which
    // leaves the measurement stuck open.
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, (event) => {
      setHeight(event?.endCoordinates?.height ?? 0);
    });
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}

type FieldChainProps = {
  ref: (input: TextInput | null | undefined) => void;
  returnKeyType: "next" | "done";
  submitBehavior: "submit" | "blurAndSubmit";
  onSubmitEditing: () => void;
};

/**
 * Wires the return key of one field to the next one, and the last field to the
 * form's own submit. Pass the field names in the order they appear on screen,
 * leaving out any that are currently hidden.
 */
export function useFieldChain(
  fieldNames: readonly string[],
  onSubmit?: () => void,
) {
  const inputs = useRef<Record<string, TextInput | null | undefined>>({});
  const names = useRef(fieldNames);
  const submit = useRef(onSubmit);
  names.current = fieldNames;
  submit.current = onSubmit;

  return function fieldProps(name: string): FieldChainProps {
    const nextName = names.current[names.current.indexOf(name) + 1];
    return {
      ref: (input) => {
        inputs.current[name] = input;
      },
      returnKeyType: nextName ? "next" : "done",
      submitBehavior: nextName ? "submit" : "blurAndSubmit",
      onSubmitEditing: () => {
        const next = nextName ? inputs.current[nextName] : null;
        if (next) {
          next.focus();
          return;
        }
        Keyboard.dismiss();
        submit.current?.();
      },
    };
  };
}

type KeyboardAwareFormProps = ScrollViewProps & {
  /** Primary actions. They stay above the keyboard rather than behind it. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  maxContentWidth?: number;
  /** Extra space between the scrolling content and the footer. */
  bottomInset?: number;
};

export function KeyboardAwareForm({
  children,
  footer,
  contentStyle,
  contentContainerStyle,
  maxContentWidth = 1040,
  bottomInset = 28,
  ...props
}: KeyboardAwareFormProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.fill}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            maxWidth: maxContentWidth,
            paddingTop: Math.max(insets.top + 10, 22),
            paddingBottom: bottomInset + (footer ? 0 : insets.bottom),
          },
          contentContainerStyle,
        ]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode={
          Platform.OS === "ios" ? "interactive" : "on-drag"
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.fill}
        {...props}
      >
        <Pressable
          accessible={false}
          onPress={() => Keyboard.dismiss()}
          style={[styles.stack, contentStyle]}
        >
          {children}
        </Pressable>
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: keyboardVisible
                ? 12
                : Math.max(insets.bottom, 12),
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.porcelain,
    flex: 1,
  },
  content: {
    alignSelf: "center",
    paddingHorizontal: 20,
    width: "100%",
  },
  stack: {
    gap: 22,
    width: "100%",
  },
  footer: {
    backgroundColor: colors.porcelain,
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
