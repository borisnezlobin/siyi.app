import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";
import {
  emptyReviewPromptState,
  parseReviewPromptState,
  recordPrompted,
  recordSuccess,
  shouldAskForReview,
  type ReviewPromptState,
} from "@/lib/review-prompt";

const STORAGE_KEY = "siyi.review-prompt.v1";

async function read(): Promise<ReviewPromptState> {
  try {
    return parseReviewPromptState(await AsyncStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyReviewPromptState;
  }
}

async function write(state: ReviewPromptState) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Losing the record costs at most one extra prompt later. It must never
    // cost the user the thing they were actually doing.
  }
}

/**
 * Call after something has genuinely worked — right now, after logging that you
 * saw someone. Counts the success, and asks for a review if this is the moment.
 *
 * Deliberately fire-and-forget and completely silent on failure: this runs off
 * the back of a save the user cares about, and nothing here is worth
 * interrupting that.
 *
 * Note that `requestReview` gives no signal about what the person did — Apple
 * does not tell us whether they rated, dismissed, or never saw it. So the only
 * thing that can be recorded here is that we asked; `respondedAt` is reserved
 * for a future in-app step where the person actually answers something.
 */
export async function noteSuccessAndMaybeAskForReview() {
  try {
    const counted = recordSuccess(await read());

    if (!shouldAskForReview(counted)) {
      await write(counted);
      return;
    }

    // Availability is checked every time rather than cached: it depends on the
    // OS, the store build, and how many prompts this user has already had.
    if (!(await StoreReview.hasAction())) {
      await write(counted);
      return;
    }

    await StoreReview.requestReview();
    await write(recordPrompted(counted));
  } catch {
    // Nothing about a review prompt justifies surfacing an error.
  }
}
