import { Type, type Static } from "@sinclair/typebox";

// --- Sub-schemas for Profile core identity ---

export const LinksSchema = Type.Object({
  linkedin: Type.Optional(Type.String()),
  portfolio: Type.Optional(Type.String()),
  github: Type.Optional(Type.String()),
});
export type Links = Static<typeof LinksSchema>;

export const IdentitySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  headline: Type.String({ maxLength: 300 }),
  email: Type.String({ minLength: 1, maxLength: 200 }),
  phone: Type.Optional(Type.String({ maxLength: 50 })),
  location: Type.Optional(Type.String({ maxLength: 200 })),
  links: Type.Optional(LinksSchema),
});
export type Identity = Static<typeof IdentitySchema>;

export const ConstraintsSchema = Type.Object({
  preferredCvLanguage: Type.Optional(Type.String()),
  maxCvPages: Type.Optional(Type.Number()),
  mustNotClaim: Type.Optional(Type.Array(Type.String())),
});
export type Constraints = Static<typeof ConstraintsSchema>;

export const TargetRolesSchema = Type.Array(Type.String());
export type TargetRoles = Static<typeof TargetRolesSchema>;

export const ProfessionalSummaryMasterSchema = Type.String();
export type ProfessionalSummaryMaster = Static<typeof ProfessionalSummaryMasterSchema>;

// --- Experience with achievements and skillsUsed ---

export const AchievementSchema = Type.Object({
  text: Type.String(),
  metric: Type.Optional(Type.String()),
  proofLevel: Type.Optional(Type.String()),
});
export type Achievement = Static<typeof AchievementSchema>;

export const ExperienceSchema = Type.Object({
  experienceId: Type.String(),
  title: Type.String(),
  company: Type.String(),
  location: Type.Optional(Type.String()),
  startDate: Type.String(),
  endDate: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  achievements: Type.Array(AchievementSchema),
  skillsUsed: Type.Array(Type.String()),
});
export type Experience = Static<typeof ExperienceSchema>;

// --- Supporting Profile types ---

export const EducationSchema = Type.Object({
  school: Type.String(),
  degree: Type.String(),
  field: Type.Optional(Type.String()),
  year: Type.Optional(Type.Number()),
});
export type Education = Static<typeof EducationSchema>;

export const SkillSchema = Type.Object({
  name: Type.String(),
  category: Type.Optional(Type.String()),
  level: Type.Optional(Type.String()),
  years: Type.Optional(Type.Number()),
  evidenceRefs: Type.Optional(Type.Array(Type.String())),
});
export type Skill = Static<typeof SkillSchema>;

export const CertificationSchema = Type.Object({
  name: Type.String(),
  issuer: Type.Optional(Type.String()),
  date: Type.Optional(Type.String()),
});
export type Certification = Static<typeof CertificationSchema>;

export const LanguageSchema = Type.Object({
  name: Type.String(),
  level: Type.Optional(Type.String()),
});
export type Language = Static<typeof LanguageSchema>;

export const ProjectSchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  url: Type.Optional(Type.String()),
  technologies: Type.Optional(Type.Array(Type.String())),
});
export type Project = Static<typeof ProjectSchema>;

export const ReferenceSchema = Type.Object({
  name: Type.String(),
  title: Type.Optional(Type.String()),
  company: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  relationship: Type.Optional(Type.String()),
});
export type Reference = Static<typeof ReferenceSchema>;

// --- Full Profile schema ---

export const ProfileDataSchema = Type.Object({
  identity: IdentitySchema,
  targetRoles: TargetRolesSchema,
  professionalSummaryMaster: Type.Optional(ProfessionalSummaryMasterSchema),
  experiences: Type.Array(ExperienceSchema),
  education: Type.Array(EducationSchema),
  skills: Type.Array(SkillSchema),
  certifications: Type.Optional(Type.Array(CertificationSchema)),
  languages: Type.Optional(Type.Array(LanguageSchema)),
  projects: Type.Optional(Type.Array(ProjectSchema)),
  references: Type.Optional(Type.Array(ReferenceSchema)),
  constraints: Type.Optional(ConstraintsSchema),
});
export type ProfileData = Static<typeof ProfileDataSchema>;

export const ProfileSchema = Type.Object({
  id: Type.String(),
  data: ProfileDataSchema,
  createdAt: Type.String(),
  updatedAt: Type.String(),
});
export type Profile = Static<typeof ProfileSchema>;
