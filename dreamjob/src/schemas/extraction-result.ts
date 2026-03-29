import { Type, type Static } from "@sinclair/typebox";
import { ProfileDataSchema } from "./profile.js";

// --- Confidence ---

export const ConfidenceSourceEnum = Type.Union([
  Type.Literal("extracted"),
  Type.Literal("inferred"),
  Type.Literal("missing"),
]);

export const ConfidenceEntrySchema = Type.Object({
  score: Type.Number({ minimum: 0, maximum: 1 }),
  source: ConfidenceSourceEnum,
});
export type ConfidenceEntry = Static<typeof ConfidenceEntrySchema>;

// Confidence map mirrors Profile data shape with ConfidenceEntry leaves.
// Top-level sections each get a ConfidenceEntry; array sections (experiences,
// education, skills, etc.) use a Record keyed by index or id.

const SectionConfidence = Type.Optional(ConfidenceEntrySchema);
const ArraySectionConfidence = Type.Optional(
  Type.Record(Type.String(), ConfidenceEntrySchema),
);

export const ConfidenceMapSchema = Type.Object({
  identity: SectionConfidence,
  targetRoles: SectionConfidence,
  professionalSummaryMaster: SectionConfidence,
  experiences: ArraySectionConfidence,
  education: ArraySectionConfidence,
  skills: ArraySectionConfidence,
  certifications: ArraySectionConfidence,
  languages: ArraySectionConfidence,
  projects: ArraySectionConfidence,
  references: ArraySectionConfidence,
  constraints: SectionConfidence,
});
export type ConfidenceMap = Static<typeof ConfidenceMapSchema>;

// --- Review Status ---

export const ReviewStatusSchema = Type.Object({
  identity: Type.Optional(Type.Boolean()),
  targetRoles: Type.Optional(Type.Boolean()),
  professionalSummaryMaster: Type.Optional(Type.Boolean()),
  experiences: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  education: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  skills: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  certifications: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  languages: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  projects: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  references: Type.Optional(Type.Record(Type.String(), Type.Boolean())),
  constraints: Type.Optional(Type.Boolean()),
});
export type ReviewStatus = Static<typeof ReviewStatusSchema>;

// --- Completion Status ---

export const CompletionStatusSchema = Type.Object({
  markedComplete: Type.Boolean(),
  markedCompleteAt: Type.Union([Type.String(), Type.Null()]),
});
export type CompletionStatus = Static<typeof CompletionStatusSchema>;

// --- Full Extraction Result ---

export const ExtractionResultSchema = Type.Object({
  id: Type.String(),
  resumeUploadId: Type.String(),
  extractedAt: Type.String(),
  rawText: Type.String(),
  data: ProfileDataSchema,
  confidence: ConfidenceMapSchema,
  reviewStatus: ReviewStatusSchema,
  completionStatus: CompletionStatusSchema,
});
export type ExtractionResult = Static<typeof ExtractionResultSchema>;
