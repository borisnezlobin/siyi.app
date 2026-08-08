/**
 * How far the add button rises above the bar, and therefore how much taller
 * the shell is than the bar itself.
 *
 * The button must stay inside the shell's bounds: iOS does not deliver touches
 * to a subview outside its parent, so a button positioned above its parent
 * draws normally but passes taps through to whatever is behind it.
 */
export const actionOverhang = 35;
export const tabBarHeight = 70;
