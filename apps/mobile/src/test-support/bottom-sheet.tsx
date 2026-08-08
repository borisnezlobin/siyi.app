/**
 * A stand-in for @gorhom/bottom-sheet, which cannot render under jest: its
 * output never reaches the worklets babel plugin, so `useAnimatedScrollHandler`
 * throws before anything is on screen.
 *
 * What it keeps is the shape the app depends on. Nothing shows until the sheet
 * is presented; every way of dismissing it ends in `onDismiss`; and — the part
 * that matters here — the footer is rendered from `footerComponent` as a
 * sibling of the content, never inside the scrolling region, exactly as the
 * library does it.
 */

/** The last props the sheet shell handed to the library. */
export const sheetSpy: { props: Record<string, unknown> } = { props: {} };

/** testID of the region that scrolls. Anything inside it can be below the fold. */
export const sheetScrollTestId = "sheet-scroll";

/** testID of the region the library pins above the keyboard. */
export const sheetFooterTestId = "sheet-footer-container";

export function bottomSheetMock() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput, View } = require("react-native");

  return {
    __esModule: true,
    BottomSheetBackdrop: (props: Record<string, unknown>) =>
      React.createElement(View, props),
    BottomSheetFooter: ({ children }: { children?: unknown }) =>
      React.createElement(View, { testID: sheetFooterTestId }, children),
    BottomSheetModal: React.forwardRef(function BottomSheetModal(
      props: {
        children?: unknown;
        footerComponent?: unknown;
        onDismiss?: () => void;
      },
      ref: unknown,
    ) {
      const [presented, setPresented] = React.useState(false);
      sheetSpy.props = props as Record<string, unknown>;
      React.useImperativeHandle(ref, () => ({
        present: () => setPresented(true),
        dismiss: () => {
          setPresented(false);
          props.onDismiss?.();
        },
      }));
      if (!presented) return null;
      return React.createElement(
        View,
        { testID: "bottom-sheet" },
        React.createElement(
          View,
          { key: "content", testID: "sheet-body" },
          props.children,
        ),
        props.footerComponent
          ? React.createElement(props.footerComponent, {
              key: "footer",
              animatedFooterPosition: { value: 0 },
            })
          : null,
      );
    }),
    BottomSheetScrollView: ({
      children,
      ...rest
    }: {
      children?: unknown;
    }) =>
      React.createElement(
        View,
        { testID: sheetScrollTestId, ...rest },
        children,
      ),
    BottomSheetTextInput: TextInput,
    BottomSheetView: ({ children, ...rest }: { children?: unknown }) =>
      React.createElement(View, rest, children),
  };
}
