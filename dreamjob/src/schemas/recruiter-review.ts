import { Type, type Static } from "@sinclair/typebox";

export const RecruiterReviewSchema = Type.Object({
  id: Type.String(),
  cvId: Type.String(),
  jobPostId: Type.String(),
  score: Type.Number({ minimum: 0, maximum: 100 }),
  passed: Type.Boolean(),
  readabilityScore: Type.Number({ minimum: 0, maximum: 100 }),
  credibilityScore: Type.Number({ minimum: 0, maximum: 100 }),
  coherenceScore: Type.Number({ minimum: 0, maximum: 100 }),
  evidenceScore: Type.Number({ minimum: 0, maximum: 100 }),
  strengths: Type.Array(Type.String()),
  concerns: Type.Array(Type.String()),
  recommendations: Type.Array(Type.String()),
});
export type RecruiterReview = Static<typeof RecruiterReviewSchema>;
