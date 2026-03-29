import { Type, type Static } from "@sinclair/typebox";

export const RemoteModeEnum = Type.Union([
  Type.Literal("onsite"),
  Type.Literal("hybrid"),
  Type.Literal("remote"),
]);

export const EmploymentTypeEnum = Type.Union([
  Type.Literal("full_time"),
  Type.Literal("part_time"),
  Type.Literal("contract"),
  Type.Literal("internship"),
]);

export const SeniorityEnum = Type.Union([
  Type.Literal("entry"),
  Type.Literal("mid"),
  Type.Literal("senior"),
  Type.Literal("lead"),
  Type.Literal("executive"),
]);

export const JobPostSchema = Type.Object({
  id: Type.String(),
  jobOfferRawId: Type.String(),
  title: Type.String(),
  company: Type.String(),
  description: Type.String(),
  url: Type.String(),
  salary: Type.Optional(Type.String()),
  location: Type.String(),
  remoteMode: RemoteModeEnum,
  employmentType: EmploymentTypeEnum,
  seniority: SeniorityEnum,
  jobSummary: Type.String(),
  responsibilities: Type.Array(Type.String()),
  requirementsMustHave: Type.Array(Type.String()),
  requirementsNiceToHave: Type.Array(Type.String()),
  keywords: Type.Array(Type.String()),
  tools: Type.Array(Type.String()),
  languages: Type.Array(Type.String()),
  yearsExperienceMin: Type.Optional(Type.Number()),
  postedDate: Type.Optional(Type.String()),
});

export type JobPost = Static<typeof JobPostSchema>;
