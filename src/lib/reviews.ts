import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

export type PublishedReview = {
  id: string;
  rating: number;
  body: string;
  authorLabel: string;
  publishedAt: string | null;
};

/**
 * Published reviews, newest first. RLS already restricts an anonymous read to
 * rows whose status is 'published', so the filter here is for the query planner
 * rather than for safety.
 *
 * Deliberately not the cookie-backed server client: reading a session would
 * make /reviews dynamic, and this page is the same for everyone. Anonymous
 * means it can be rendered once and revalidated.
 */
export async function getPublishedReviews(): Promise<PublishedReview[]> {
  if (!isSupabaseConfigured()) return [];

  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, body, author_label, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body,
    authorLabel: row.author_label,
    publishedAt: row.published_at,
  }));
}

/**
 * The average, and the count it was taken over.
 *
 * Returned only when there are enough reviews for an average to mean anything.
 * A single five-star review is a true fact that reads as a manufactured one,
 * and marking it up as an `AggregateRating` would put a rating star in a search
 * result on the strength of one person.
 */
export const MINIMUM_RATINGS_TO_AGGREGATE = 5;

export function aggregateRating(reviews: PublishedReview[]) {
  if (reviews.length < MINIMUM_RATINGS_TO_AGGREGATE) return null;

  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return {
    ratingValue: Math.round((total / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
  };
}
