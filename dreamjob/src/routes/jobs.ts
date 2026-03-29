import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import type { JobOfferRaw } from "../schemas/job-offer-raw.js";
import type { JobPost } from "../schemas/job-post.js";
import {
  RemoteModeEnum,
  EmploymentTypeEnum,
  SeniorityEnum,
  IdParamsSchema,
} from "../schemas/shared.js";
import { readCollection, writeCollection } from "../services/store.js";
import { JOBS_RAW_PATH, JOBS_PATH } from "../services/paths.js";
import { normalizeJobOffer } from "../services/normalize.js";

const RawJobBodySchema = Type.Object({
  source: Type.String({ minLength: 1 }),
  sourceUrl: Type.String({ minLength: 1 }),
  rawText: Type.String({ minLength: 1 }),
  htmlSnapshotRef: Type.Optional(Type.String()),
  rawFields: Type.Optional(
    Type.Object({
      title: Type.Optional(Type.String()),
      company: Type.Optional(Type.String()),
      location: Type.Optional(Type.String()),
      employment_type: Type.Optional(Type.String()),
      salary: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      requirements: Type.Optional(Type.String()),
      posted_date: Type.Optional(Type.String()),
    })
  ),
});
type RawJobBody = Static<typeof RawJobBodySchema>;

const PutJobBodySchema = Type.Object({
  title: Type.Optional(Type.String({ maxLength: 200 })),
  company: Type.Optional(Type.String({ maxLength: 200 })),
  description: Type.Optional(Type.String({ maxLength: 10000 })),
  url: Type.Optional(Type.String()),
  salary: Type.Optional(Type.String()),
  location: Type.Optional(Type.String({ maxLength: 200 })),
  remoteMode: Type.Optional(RemoteModeEnum),
  employmentType: Type.Optional(EmploymentTypeEnum),
  seniority: Type.Optional(SeniorityEnum),
  jobSummary: Type.Optional(Type.String({ maxLength: 10000 })),
  responsibilities: Type.Optional(Type.Array(Type.String())),
  requirementsMustHave: Type.Optional(Type.Array(Type.String())),
  requirementsNiceToHave: Type.Optional(Type.Array(Type.String())),
  keywords: Type.Optional(Type.Array(Type.String())),
  tools: Type.Optional(Type.Array(Type.String())),
  languages: Type.Optional(Type.Array(Type.String())),
  yearsExperienceMin: Type.Optional(Type.Number()),
  postedDate: Type.Optional(Type.String()),
});

export async function jobsRoutes(app: FastifyInstance) {
  app.post("/api/jobs/raw", {
    schema: { body: RawJobBodySchema },
  }, async (request, reply) => {
    const body = request.body as RawJobBody;

    const existing = await readCollection<JobOfferRaw>(JOBS_RAW_PATH);
    const nextNum = existing.length + 1;
    const id = `raw_${String(nextNum).padStart(2, "0")}`;

    const rawEntry: JobOfferRaw = {
      id,
      source: body.source,
      sourceUrl: body.sourceUrl,
      capturedAt: new Date().toISOString(),
      htmlSnapshotRef: body.htmlSnapshotRef,
      rawText: body.rawText,
      rawFields: body.rawFields ?? {} as JobOfferRaw["rawFields"],
    };

    existing.push(rawEntry);
    await writeCollection(JOBS_RAW_PATH, existing);

    const normalizedJob = await normalizeJobOffer(rawEntry);

    return reply.code(201).send({
      raw: rawEntry,
      normalized: normalizedJob,
    });
  });

  app.get("/api/jobs/current", async (_request, reply) => {
    const rawJobs = await readCollection<JobOfferRaw>(JOBS_RAW_PATH);
    if (rawJobs.length === 0) {
      return reply.code(404).send({ error: "No captured jobs" });
    }

    const latest = rawJobs.reduce((a, b) =>
      new Date(a.capturedAt) > new Date(b.capturedAt) ? a : b
    );

    const expectedFields = ["title", "company", "location", "employment_type", "salary", "description", "requirements", "posted_date"] as const;
    const missingFields = expectedFields.filter(
      (f) => !latest.rawFields[f]
    );

    return reply.send({
      source: latest.source,
      source_url: latest.sourceUrl,
      captured_at: latest.capturedAt,
      html_snapshot_ref: latest.htmlSnapshotRef,
      raw_text: latest.rawText,
      raw_fields: latest.rawFields,
      missing_fields: missingFields,
    });
  });

  app.get("/api/jobs", async (_request, reply) => {
    const jobs = await readCollection<JobPost>(JOBS_PATH);
    const rawJobs = await readCollection<JobOfferRaw>(JOBS_RAW_PATH);
    const rawById = new Map(rawJobs.map((r) => [r.id, r]));

    const applications = jobs.map((job) => {
      const raw = rawById.get(job.jobOfferRawId);
      return {
        id: job.id,
        title: job.title,
        company: job.company,
        status: "saved" as const,
        appliedAt: raw?.capturedAt ?? new Date().toISOString(),
      };
    });

    return reply.send(applications);
  });

  app.get("/api/jobs/:id", {
    schema: { params: IdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await readCollection<JobPost>(JOBS_PATH);
    const item = collection.find((entry) => entry.id === id);
    if (!item) {
      return reply.code(404).send({ error: "Job post not found" });
    }
    return reply.send(item);
  });

  app.put("/api/jobs/:id", {
    schema: { params: IdParamsSchema, body: PutJobBodySchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await readCollection<JobPost>(JOBS_PATH);
    const index = collection.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: "Job post not found" });
    }
    const updates = request.body as Partial<JobPost>;
    collection[index] = { ...collection[index], ...updates, id };
    await writeCollection(JOBS_PATH, collection);
    return reply.send(collection[index]);
  });

  app.delete("/api/jobs/:id", {
    schema: { params: IdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await readCollection<JobPost>(JOBS_PATH);
    const index = collection.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: "Job post not found" });
    }
    collection.splice(index, 1);
    await writeCollection(JOBS_PATH, collection);
    return reply.code(204).send();
  });

  app.get("/api/jobs/raw", async (_request, reply) => {
    const collection = await readCollection<JobOfferRaw>(JOBS_RAW_PATH);
    return reply.send(collection);
  });

  app.get("/api/jobs/raw/:id", {
    schema: { params: IdParamsSchema },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await readCollection<JobOfferRaw>(JOBS_RAW_PATH);
    const item = collection.find((entry) => entry.id === id);
    if (!item) {
      return reply.code(404).send({ error: "Raw job offer not found" });
    }
    return reply.send(item);
  });
}
