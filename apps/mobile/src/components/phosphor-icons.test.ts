import {
  BellRinging,
  ClockCountdown,
  House,
  Plus,
  Share,
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

  it("exports the plain Share arrow the share button uses", () => {
    expect(Share).toBeDefined();
  });
});
