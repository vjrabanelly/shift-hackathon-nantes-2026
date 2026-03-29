import { Type, type Static } from "@sinclair/typebox";

// --- Header sub-schema ---

export const CvHeaderSchema = Type.Object({
  fullName: Type.String(),
  headline: Type.String(),
  contact: Type.Object({
    email: Type.String(),
    phone: Type.Optional(Type.String()),
    location: Type.Optional(Type.String()),
  }),
  links: Type.Optional(
    Type.Object({
      linkedin: Type.Optional(Type.String()),
      portfolio: Type.Optional(Type.String()),
      github: Type.Optional(Type.String()),
    })
  ),
});
export type CvHeader = Static<typeof CvHeaderSchema>;

// --- Experience selected sub-schema ---

export const ExperienceSelectedSchema = Type.Object({
  experienceId: Type.String(),
  rewrittenBullets: Type.Array(Type.String()),
});
export type ExperienceSelected = Static<typeof ExperienceSelectedSchema>;

// --- Coverage map sub-schemas ---

export const MatchedRequirementSchema = Type.Object({
  requirement: Type.String(),
  evidenceRef: Type.String(),
});
export type MatchedRequirement = Static<typeof MatchedRequirementSchema>;

export const CoverageMapSchema = Type.Object({
  matchedRequirements: Type.Array(MatchedRequirementSchema),
  uncoveredRequirements: Type.Array(Type.String()),
});
export type CoverageMap = Static<typeof CoverageMapSchema>;

// --- Self-check sub-schema ---

export const SelfCheckSchema = Type.Object({
  unsupportedClaimsFound: Type.Boolean(),
  warnings: Type.Array(Type.String()),
});
export type SelfCheck = Static<typeof SelfCheckSchema>;

// --- Full GeneratedCV schema ---

export const GeneratedCVSchema = Type.Object({
  id: Type.String(),
  profileId: Type.String(),
  jobPostId: Type.String(),
  version: Type.Number(),
  language: Type.String(),
  title: Type.String(),
  header: CvHeaderSchema,
  summary: Type.String(),
  skillsHighlighted: Type.Array(Type.String()),
  experiencesSelected: Type.Array(ExperienceSelectedSchema),
  educationSelected: Type.Array(Type.String()),
  certificationsSelected: Type.Array(Type.String()),
  keywordsCovered: Type.Array(Type.String()),
  omittedItems: Type.Array(Type.String()),
  generationNotes: Type.Array(Type.String()),
  coverageMap: Type.Optional(CoverageMapSchema),
  selfCheck: Type.Optional(SelfCheckSchema),
});
export type GeneratedCV = Static<typeof GeneratedCVSchema>;
