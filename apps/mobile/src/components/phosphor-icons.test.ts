import {
  Bell,
  BellRinging,
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
    // Reminders. A clock said "time"; what it actually does is tell you.
    expect(Bell).toBeDefined();
  });

  it("exports the plain Share arrow the share button uses", () => {
    expect(Share).toBeDefined();
  });
});
