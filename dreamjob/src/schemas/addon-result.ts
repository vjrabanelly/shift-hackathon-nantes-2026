import { Type, type Static } from "@sinclair/typebox";

export const AddonScoresSchema = Type.Object({
  ats_score: Type.Number({ minimum: 0, maximum: 100 }),
  recruiter_score: Type.Number({ minimum: 0, maximum: 100 }),
});
export type AddonScores = Static<typeof AddonScoresSchema>;

export const AddonResultSchema = Type.Object({
  status: Type.Union([Type.Literal("accepted"), Type.Literal("rejected")]),
  overall_score: Type.Number({ minimum: 0, maximum: 100 }),
  scores: AddonScoresSchema,
  strengths: Type.Array(Type.String()),
  weaknesses: Type.Array(Type.String()),
  recommendations: Type.Array(Type.String()),
  rejection_reasons: Type.Array(Type.String()),
  cv_id: Type.String(),
  job_post_id: Type.String(),
  iteration_count: Type.Integer(),
});
export type AddonResult = Static<typeof AddonResultSchema>;
