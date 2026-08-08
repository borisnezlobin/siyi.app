import { useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type StyleProp,
  type TextInput,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FocusScrollProvider,
  useFocusScrollArea,
} from "@/components/focus-scroll";
import { useKeyboardVisible } from "@/hooks/use-keyboard";
import { colors } from "@/constants/theme";

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
  // The footer sits over the bottom of the scrolling area, so a field is only
  // really visible once it clears the footer as well as the keyboard.
  const [footerHeight, setFooterHeight] = useState(0);
  const { focusScroll, scrollProps } = useFocusScrollArea({
    bottomInset: footer ? footerHeight : 0,
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.fill}
    >
      <FocusScrollProvider value={focusScroll}>
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
          testID="form-scroll"
          {...scrollProps}
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
      </FocusScrollProvider>
      {footer ? (
        <View
          onLayout={(event: LayoutChangeEvent) =>
            setFooterHeight(event.nativeEvent.layout.height)
          }
          style={[
            styles.footer,
            {
              paddingBottom: keyboardVisible
                ? 12
                : Math.max(insets.bottom, 12),
            },
          ]}
          testID="sticky-footer"
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
