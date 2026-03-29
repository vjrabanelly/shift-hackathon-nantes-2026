import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import type { Profile } from "../schemas/profile.js";
import type { JobPost } from "../schemas/job-post.js";
import type { GeneratedCV } from "../schemas/generated-cv.js";
import type { ATSReview } from "../schemas/ats-review.js";
import type { RecruiterReview } from "../schemas/recruiter-review.js";
import type { ReviewAgreement } from "../schemas/review-agreement.js";
import { IdParamsSchema } from "../schemas/shared.js";
import { readJSON, readCollection, writeCollection } from "../services/store.js";
import {
  PROFILE_PATH,
  JOBS_PATH,
  CVS_PATH,
  ATS_REVIEWS_PATH,
  RECRUITER_REVIEWS_PATH,
  REVIEW_AGREEMENTS_PATH,
} from "../services/paths.js";
import { orchestrate } from "../services/cv-generator.js";
import { exportCvToPdf } from "../services/pdf-export.js";

const GenerateBodySchema = Type.Object({
  jobPostId: Type.String({ minLength: 1 }),
  language: Type.String({ minLength: 1 }),
});

export async function cvsRoutes(app: FastifyInstance) {
  app.get("/api/cvs", async (_request, reply) => {
    const cvs = await readCollection<GeneratedCV>(CVS_PATH);
    return reply.code(200).send(cvs);
  });

  app.get("/api/cvs/:id", { schema: { params: IdParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cvs = await readCollection<GeneratedCV>(CVS_PATH);
    const cv = cvs.find((c) => c.id === id);
    if (!cv) {
      return reply.code(404).send({ error: "CV not found" });
    }
    return reply.code(200).send(cv);
  });

  app.get("/api/cvs/:id/pdf", { schema: { params: IdParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cvs = await readCollection<GeneratedCV>(CVS_PATH);
    const cv = cvs.find((c) => c.id === id);
    if (!cv) {
      return reply.code(404).send({ error: "CV not found" });
    }

    const { buffer } = await exportCvToPdf(cv);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${cv.id}.pdf"`);
    return reply.send(buffer);
  });

  app.post("/api/cvs/generate", { schema: { body: GenerateBodySchema } }, async (request, reply) => {
    const body = request.body as { jobPostId: string; language: string };

    const profile = await readJSON<Profile>(PROFILE_PATH);
    if (!profile) {
      return reply.code(404).send({ error: "No profile found" });
    }

    const jobs = await readCollection<JobPost>(JOBS_PATH);
    const jobPost = jobs.find((j) => j.id === body.jobPostId);
    if (!jobPost) {
      return reply.code(404).send({ error: "Job post not found" });
    }

    const result = await orchestrate(profile, jobPost, body.language!);

    return reply.code(200).send(result);
  });

  app.get("/api/cvs/:id/ats-review", { schema: { params: IdParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const atsReviews = await readCollection<ATSReview>(ATS_REVIEWS_PATH);
    const review = atsReviews.find((r) => r.cvId === id);
    if (!review) {
      return reply.code(404).send({ error: "ATS review not found" });
    }
    return reply.code(200).send(review);
  });

  app.get("/api/cvs/:id/recruiter-review", { schema: { params: IdParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const recruiterReviews = await readCollection<RecruiterReview>(RECRUITER_REVIEWS_PATH);
    const review = recruiterReviews.find((r) => r.cvId === id);
    if (!review) {
      return reply.code(404).send({ error: "Recruiter review not found" });
    }
    return reply.code(200).send(review);
  });

  app.delete("/api/cvs/:id", { schema: { params: IdParamsSchema } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const cvs = await readCollection<GeneratedCV>(CVS_PATH);
    const index = cvs.findIndex((c) => c.id === id);
    if (index === -1) {
      return reply.code(404).send({ error: "CV not found" });
    }

    cvs.splice(index, 1);
    await writeCollection(CVS_PATH, cvs);

    // Clean up associated reviews and agreements
    const atsReviews = await readCollection<ATSReview>(ATS_REVIEWS_PATH);
    const filteredAts = atsReviews.filter((r) => r.cvId !== id);
    await writeCollection(ATS_REVIEWS_PATH, filteredAts);

    const recruiterReviews = await readCollection<RecruiterReview>(RECRUITER_REVIEWS_PATH);
    const filteredRecruiter = recruiterReviews.filter((r) => r.cvId !== id);
    await writeCollection(RECRUITER_REVIEWS_PATH, filteredRecruiter);

    const agreements = await readCollection<ReviewAgreement>(REVIEW_AGREEMENTS_PATH);
    const filteredAgreements = agreements.filter((a) => a.cvId !== id);
    await writeCollection(REVIEW_AGREEMENTS_PATH, filteredAgreements);

    return reply.code(204).send();
  });
}
