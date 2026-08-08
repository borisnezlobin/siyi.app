import {
  actionOverhang,
  tabBarHeight,
} from "@/components/app-tab-bar-layout";

/**
 * The add button used to sit at top: -35 inside the bar, so its raised half
 * hung outside its parent. iOS does not deliver touches to a subview outside
 * its parent's bounds, so taps there fell through to whatever was behind —
 * which is how pressing it opened the button underneath instead.
 */
describe("where the add button sits", () => {
  const buttonHeight = 58;

  it("fits inside the shell rather than hanging above it", () => {
    const shellHeight = tabBarHeight + actionOverhang;

    expect(actionOverhang).toBeGreaterThan(0);
    expect(buttonHeight).toBeLessThanOrEqual(shellHeight);
  });

  it("still rises above the bar, without moving the bar", () => {
    // The shell grows by exactly the overhang, so the bar keeps its height.
    expect(tabBarHeight).toBe(70);
    expect(actionOverhang).toBe(35);
  });
});
