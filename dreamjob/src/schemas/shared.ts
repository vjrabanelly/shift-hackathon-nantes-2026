import { Type, type Static } from "@sinclair/typebox";

// --- Re-exported enum schemas for reuse across route validation ---

export { RemoteModeEnum, EmploymentTypeEnum, SeniorityEnum } from "./job-post.js";
export { FinalStatusSchema } from "./review-agreement.js";

// --- Level enum for skills and languages ---

export const LevelEnum = Type.Union([
  Type.Literal("beginner"),
  Type.Literal("intermediate"),
  Type.Literal("advanced"),
  Type.Literal("expert"),
  Type.Literal("native"),
]);
export type Level = Static<typeof LevelEnum>;

// --- Shared string length constraints ---

export const NameString = Type.String({ maxLength: 200 });
export const DescriptionString = Type.String({ maxLength: 10000 });

// --- Shared :id param schema for parameterized routes ---

export const IdParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});
export type IdParams = Static<typeof IdParamsSchema>;
