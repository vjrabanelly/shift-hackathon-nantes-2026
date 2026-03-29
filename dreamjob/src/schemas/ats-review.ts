import { Type, type Static } from "@sinclair/typebox";

// --- Hard filter status sub-schema ---

export const HardFilterStatusSchema = Type.Object({
  filter: Type.String(),
  status: Type.Union([
    Type.Literal("pass"),
    Type.Literal("fail"),
    Type.Literal("unknown"),
  ]),
  evidence: Type.String(),
});
export type HardFilterStatus = Static<typeof HardFilterStatusSchema>;

// --- Full ATSReview schema ---

export const ATSReviewSchema = Type.Object({
  id: Type.String(),
  cvId: Type.String(),
  jobPostId: Type.String(),
  score: Type.Number({ minimum: 0, maximum: 100 }),
  passed: Type.Boolean(),
  hardFiltersStatus: Type.Array(HardFilterStatusSchema),
  matchedKeywords: Type.Array(Type.String()),
  missingKeywords: Type.Array(Type.String()),
  formatFlags: Type.Array(Type.String()),
  recommendations: Type.Array(Type.String()),
});
export type ATSReview = Static<typeof ATSReviewSchema>;
