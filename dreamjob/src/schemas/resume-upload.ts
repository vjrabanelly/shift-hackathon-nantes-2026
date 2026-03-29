import { Type, type Static } from "@sinclair/typebox";

export const ResumeUploadStatusEnum = Type.Union([
  Type.Literal("uploaded"),
  Type.Literal("extracting"),
  Type.Literal("extracted"),
  Type.Literal("confirmed"),
  Type.Literal("failed"),
]);

export const ResumeUploadSchema = Type.Object({
  id: Type.String(),
  originalFilename: Type.String(),
  storagePath: Type.String(),
  uploadedAt: Type.String(),
  status: ResumeUploadStatusEnum,
  error: Type.Optional(Type.String()),
});

export type ResumeUpload = Static<typeof ResumeUploadSchema>;
