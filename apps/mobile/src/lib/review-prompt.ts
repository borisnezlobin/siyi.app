/**
 * When to ask someone to rate the app.
 *
 * Apple gives an app three prompts per user per year and silently swallows the
 * rest, so each one has to be spent on a moment when the person has just had
 * the app work for them — never on launch, never after an error, and never
 * while they are in the middle of something.
 *
 * All the deciding happens here, with no imports, so the rules are testable
 * without a device.
 */

export type ReviewPromptState = {
  /** When we last put the prompt in front of them, if ever. */
  lastPromptedAt: string | null;
  /** Set once someone acts on the prompt; after that we stop asking. */
  respondedAt: string | null;
  /** Interactions logged since installing. The proxy for "this app is working". */
  successCount: number;
};

export const emptyReviewPromptState: ReviewPromptState = {
  lastPromptedAt: null,
  respondedAt: null,
  successCount: 0,
};

/**
 * Enough uses that the app has demonstrably worked, and not so many that the
 * ask arrives long after the person stopped being delighted.
 */
export const SUCCESSES_BEFORE_FIRST_PROMPT = 5;

/** Apple's own window is a year; leaving four months between asks stays well inside it. */
export const DAYS_BETWEEN_PROMPTS = 120;

const dayInMs = 24 * 60 * 60 * 1000;

export function shouldAskForReview(
  state: ReviewPromptState,
  now: Date = new Date(),
): boolean {
  // Someone who has already answered is never asked again. Not a cooldown —
  // a decision.
  if (state.respondedAt) return false;

  if (state.successCount < SUCCESSES_BEFORE_FIRST_PROMPT) return false;

  if (!state.lastPromptedAt) return true;

  const last = new Date(state.lastPromptedAt).getTime();
  // An unparseable timestamp means we cannot show that enough time has passed,
  // so we do not ask. Failing towards silence is the right way to fail here.
  if (Number.isNaN(last)) return false;

  return now.getTime() - last >= DAYS_BETWEEN_PROMPTS * dayInMs;
}

export function recordSuccess(state: ReviewPromptState): ReviewPromptState {
  return { ...state, successCount: state.successCount + 1 };
}

export function recordPrompted(
  state: ReviewPromptState,
  now: Date = new Date(),
): ReviewPromptState {
  return { ...state, lastPromptedAt: now.toISOString() };
}

export function recordResponded(
  state: ReviewPromptState,
  now: Date = new Date(),
): ReviewPromptState {
  return { ...state, respondedAt: now.toISOString() };
}

/**
 * Stored state is user-writable in the sense that anything on disk can be
 * corrupted or half-written. Anything unreadable falls back to "never asked",
 * which costs at most one extra prompt rather than a crash.
 */
export function parseReviewPromptState(raw: string | null): ReviewPromptState {
  if (!raw) return emptyReviewPromptState;
  try {
    const parsed = JSON.parse(raw) as Partial<ReviewPromptState>;
    return {
      lastPromptedAt:
        typeof parsed.lastPromptedAt === "string" ? parsed.lastPromptedAt : null,
      respondedAt:
        typeof parsed.respondedAt === "string" ? parsed.respondedAt : null,
      successCount:
        typeof parsed.successCount === "number" && parsed.successCount >= 0
          ? Math.floor(parsed.successCount)
          : 0,
    };
  } catch {
    return emptyReviewPromptState;
  }
}
