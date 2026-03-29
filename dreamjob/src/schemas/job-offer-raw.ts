import { Type, type Static } from "@sinclair/typebox";

export const JobOfferRawSchema = Type.Object({
  id: Type.String(),
  source: Type.String(),
  sourceUrl: Type.String(),
  capturedAt: Type.String(),
  htmlSnapshotRef: Type.Optional(Type.String()),
  rawText: Type.String(),
  rawFields: Type.Object({
    title: Type.Optional(Type.String()),
    company: Type.Optional(Type.String()),
    location: Type.Optional(Type.String()),
    employment_type: Type.Optional(Type.String()),
    salary: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    requirements: Type.Optional(Type.String()),
    posted_date: Type.Optional(Type.String()),
  }),
});

export type JobOfferRaw = Static<typeof JobOfferRawSchema>;
