// No "use client": the server page calls `toReviewBox`, and a function exported from a client module cannot be called on the server.
export type ReviewBoxKind = "ask" | "rate" | "update";
export type MyReview = { rating: number; body: string };

/** `review_box` comes back from the database as a plain string; keep the three known values. */
export const toReviewBox = (v: string | null | undefined): ReviewBoxKind | null => (v === "ask" || v === "rate" || v === "update" ? v : null);
