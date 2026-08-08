/**
 * The entrance the person screen's avatar and name play as the screen arrives.
 *
 * It is deliberately small: the avatar swells the last little way up to its
 * full size while the name settles down onto it, so the header reads as having
 * come from somewhere rather than having been painted in place. Nothing about
 * it points at the People list, because the screen is opened from search, from
 * Today and from reminder notifications too, and a movement aimed at a row
 * that isn't on screen would look wrong.
 */
export type ProfileIntro = {
  /** False means every value below is already at rest. */
  animate: boolean;
  durationMs: number;
  /** The avatar starts a touch small and grows into place. */
  avatarFromScale: number;
  /** The name starts slightly low and rises. */
  nameFromTranslateY: number;
  /** The name follows the avatar rather than moving with it. */
  nameDelayMs: number;
};

const atRest: ProfileIntro = {
  animate: false,
  durationMs: 0,
  avatarFromScale: 1,
  nameFromTranslateY: 0,
  nameDelayMs: 0,
};

const moving: ProfileIntro = {
  animate: true,
  durationMs: 260,
  avatarFromScale: 0.86,
  nameFromTranslateY: 12,
  nameDelayMs: 60,
};

export function profileIntro(reduceMotion: boolean): ProfileIntro {
  return reduceMotion ? atRest : moving;
}
