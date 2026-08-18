import {
  DAYS_BETWEEN_PROMPTS,
  SUCCESSES_BEFORE_FIRST_PROMPT,
  emptyReviewPromptState,
  parseReviewPromptState,
  recordPrompted,
  recordResponded,
  recordSuccess,
  shouldAskForReview,
  type ReviewPromptState,
} from "@/lib/review-prompt";

const now = new Date("2026-08-16T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(now.getTime() - days * day).toISOString();
}

function state(overrides: Partial<ReviewPromptState> = {}): ReviewPromptState {
  return { ...emptyReviewPromptState, ...overrides };
}

describe("deciding whether to ask", () => {
  it("does not ask a brand-new user", () => {
    expect(shouldAskForReview(state(), now)).toBe(false);
  });

  it("waits until the app has actually worked a few times", () => {
    expect(
      shouldAskForReview(
        state({ successCount: SUCCESSES_BEFORE_FIRST_PROMPT - 1 }),
        now,
      ),
    ).toBe(false);
    expect(
      shouldAskForReview(
        state({ successCount: SUCCESSES_BEFORE_FIRST_PROMPT }),
        now,
      ),
    ).toBe(true);
  });

  it("never asks again once someone has answered", () => {
    expect(
      shouldAskForReview(
        state({ successCount: 500, respondedAt: daysAgo(900) }),
        now,
      ),
    ).toBe(false);
  });

  it("leaves a long gap between asks", () => {
    const asked = state({
      successCount: 50,
      lastPromptedAt: daysAgo(DAYS_BETWEEN_PROMPTS - 1),
    });
    expect(shouldAskForReview(asked, now)).toBe(false);

    const older = state({
      successCount: 50,
      lastPromptedAt: daysAgo(DAYS_BETWEEN_PROMPTS),
    });
    expect(shouldAskForReview(older, now)).toBe(true);
  });

  it("stays silent when the stored timestamp makes no sense", () => {
    // Better to never ask than to ask on every single interaction because a
    // corrupt date always compares false.
    expect(
      shouldAskForReview(
        state({ successCount: 50, lastPromptedAt: "not a date" }),
        now,
      ),
    ).toBe(false);
  });
});

describe("recording what happened", () => {
  it("counts successes without touching the other fields", () => {
    expect(recordSuccess(state({ successCount: 2 }))).toEqual(
      state({ successCount: 3 }),
    );
  });

  it("stamps the prompt and the response separately", () => {
    const prompted = recordPrompted(state({ successCount: 9 }), now);
    expect(prompted.lastPromptedAt).toBe(now.toISOString());
    expect(prompted.respondedAt).toBeNull();

    const answered = recordResponded(prompted, now);
    expect(answered.respondedAt).toBe(now.toISOString());
    expect(shouldAskForReview(answered, now)).toBe(false);
  });
});

describe("reading stored state", () => {
  it("treats missing or corrupt storage as never asked", () => {
    expect(parseReviewPromptState(null)).toEqual(emptyReviewPromptState);
    expect(parseReviewPromptState("{not json")).toEqual(emptyReviewPromptState);
  });

  it("drops values of the wrong shape rather than trusting them", () => {
    const parsed = parseReviewPromptState(
      JSON.stringify({ successCount: -4, lastPromptedAt: 12, respondedAt: null }),
    );
    expect(parsed).toEqual(emptyReviewPromptState);
  });

  it("keeps a well-formed record", () => {
    const stored = state({ successCount: 7, lastPromptedAt: daysAgo(200) });
    expect(parseReviewPromptState(JSON.stringify(stored))).toEqual(stored);
  });
});
