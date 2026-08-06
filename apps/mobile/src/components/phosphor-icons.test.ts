import {
  BellRinging,
  ClockCountdown,
  House,
  Plus,
  UsersThree,
} from "phosphor-react-native";

describe("Phosphor icon layer", () => {
  it("exports every navigation icon used by the native shell", () => {
    expect(House).toBeDefined();
    expect(UsersThree).toBeDefined();
    expect(Plus).toBeDefined();
    expect(BellRinging).toBeDefined();
    expect(ClockCountdown).toBeDefined();
  });
});
