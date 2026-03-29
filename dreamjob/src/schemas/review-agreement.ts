import { Type, type Static } from "@sinclair/typebox";

export const FinalStatusSchema = Type.Union([
  Type.Literal("FINAL_APPROVED"),
  Type.Literal("REJECTED"),
  Type.Literal("NEEDS_REVISION"),
]);
export type FinalStatus = Static<typeof FinalStatusSchema>;

export const ReviewAgreementSchema = Type.Object({
  id: Type.String(),
  jobPostId: Type.String(),
  cvId: Type.String(),
  cvGenerationOk: Type.Boolean(),
  atsOk: Type.Boolean(),
  recruiterOk: Type.Boolean(),
  reviewAgreementOk: Type.Boolean(),
  finalStatus: FinalStatusSchema,
  rejectionReasons: Type.Array(Type.String()),
  iterationCount: Type.Integer(),
});
export type ReviewAgreement = Static<typeof ReviewAgreementSchema>;
