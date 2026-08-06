import { act } from "@testing-library/react-native";
import { Keyboard, type EmitterSubscription } from "react-native";

/**
 * Stands in for the software keyboard, which never opens under jest, so a
 * screen's response to it can still be rendered and asserted.
 */
export function mockKeyboardEvents() {
  const listeners: Record<string, (() => void)[]> = {};

  jest.spyOn(Keyboard, "addListener").mockImplementation(((
    event: string,
    listener: () => void,
  ) => {
    listeners[event] = [...(listeners[event] || []), listener];
    return { remove: () => undefined } as EmitterSubscription;
  }) as typeof Keyboard.addListener);

  async function emit(event: string) {
    await act(async () => {
      (listeners[event] || []).forEach((listener) => listener());
    });
  }

  return {
    show: () => emit("keyboardWillShow"),
    hide: () => emit("keyboardWillHide"),
  };
}
