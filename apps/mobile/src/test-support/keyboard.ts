import { act } from "@testing-library/react-native";
import { Keyboard, type EmitterSubscription } from "react-native";

/**
 * Stands in for the software keyboard, which never opens under jest, so a
 * screen's response to it can still be rendered and asserted.
 */
export function mockKeyboardEvents() {
  type Listener = (event?: unknown) => void;
  const listeners: Record<string, Listener[]> = {};

  jest.spyOn(Keyboard, "addListener").mockImplementation(((
    event: string,
    listener: Listener,
  ) => {
    listeners[event] = [...(listeners[event] || []), listener];
    return { remove: () => undefined } as EmitterSubscription;
  }) as typeof Keyboard.addListener);

  async function emit(event: string, payload?: unknown) {
    await act(async () => {
      (listeners[event] || []).forEach((listener) => listener(payload));
    });
  }

  return {
    show: () => emit("keyboardWillShow"),
    hide: () => emit("keyboardWillHide"),
    /** Height in points, as the OS reports it when the keyboard settles. */
    resize: (height: number) =>
      emit("keyboardWillShow", { endCoordinates: { height } }),
    resizeWithoutMeasurements: () => emit("keyboardWillShow", {}),
  };
}
