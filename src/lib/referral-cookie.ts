/**
 * The cookie that carries a referral code from the link someone clicked to the
 * moment they finish signing up — which can be several redirects and an email
 * round-trip later.
 *
 * Its own file because middleware writes it and the server actions read it, and
 * middleware cannot import the server module: that one pulls in `node:crypto`
 * and `next/headers`, neither of which exists in the middleware runtime.
 */
export const REFERRAL_COOKIE = "siyi_ref";

/** Long enough to survive "I'll sign up later", short enough to expire. */
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
