import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { UPLOADS_DIR, RESUME_UPLOAD_PATH, EXTRACTION_PATH, PROFILE_PATH } from "../services/paths.js";
import { readJSON, writeJSON } from "../services/store.js";
import type { ResumeUpload } from "../schemas/resume-upload.js";
import type { ExtractionResult } from "../schemas/extraction-result.js";
import type { Profile } from "../schemas/profile.js";
import { runExtractionPipeline } from "../services/extraction-pipeline.js";
import { computeCompleteness } from "../services/completeness.js";
import { PdfParseError, AiExtractionError, PostProcessingError, AiServiceUnavailableError } from "../errors.js";

const allSections = [
  "identity", "targetRoles", "professionalSummaryMaster", "constraints",
  "experiences", "education", "skills", "certifications", "languages", "projects", "references",
] as const;

const ReviewBodySchema = Type.Object({
  section: Type.Union(allSections.map((s) => Type.Literal(s))),
  itemId: Type.Optional(Type.String({ minLength: 1 })),
  reviewed: Type.Boolean(),
});
type ReviewBody = Static<typeof ReviewBodySchema>;

export async function resumeRoutes(app: FastifyInstance) {
  app.get("/api/resume/completeness", async (_request, reply) => {
    const extraction = await readJSON<ExtractionResult>(EXTRACTION_PATH);
    if (!extraction) {
      return reply.code(404).send({ error: "No extraction exists" });
    }
    const result = computeCompleteness(extraction);
    return reply.code(200).send(result);
  });

  app.get("/api/resume/extraction", async (_request, reply) => {
    const extraction = await readJSON<ExtractionResult>(EXTRACTION_PATH);
    if (!extraction) {
      return reply.code(404).send({ error: "No extraction exists" });
    }
    return reply.code(200).send(extraction);
  });

  app.get("/api/resume/status", async (_request, reply) => {
    const resumeUpload = await readJSON<ResumeUpload>(RESUME_UPLOAD_PATH);
    if (!resumeUpload) {
      return reply.code(404).send({ error: "No resume has been uploaded" });
    }
    return reply.code(200).send(resumeUpload);
  });

  app.post("/api/resume/extraction/confirm", async (_request, reply) => {
    const extraction = await readJSON<ExtractionResult>(EXTRACTION_PATH);
    if (!extraction) {
      return reply.code(404).send({ error: "No extraction exists" });
    }

    const resumeUpload = await readJSON<ResumeUpload>(RESUME_UPLOAD_PATH);
    if (resumeUpload && resumeUpload.status === "confirmed") {
      return reply.code(409).send({ error: "Extraction already confirmed" });
    }

    const profile: Profile = {
      id: randomUUID(),
      data: extraction.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await writeJSON<Profile>(PROFILE_PATH, profile);

    if (resumeUpload) {
      await writeJSON<ResumeUpload>(RESUME_UPLOAD_PATH, { ...resumeUpload, status: "confirmed" });
    }

    return reply.code(200).send(profile);
  });

  app.put<{ Body: ReviewBody }>("/api/resume/extraction/review", {
    schema: {
      body: ReviewBodySchema,
    },
  }, async (request, reply) => {
    const extraction = await readJSON<ExtractionResult>(EXTRACTION_PATH);
    if (!extraction) {
      return reply.code(404).send({ error: "No extraction exists" });
    }

    const { section, itemId, reviewed } = request.body;

    const scalarSections = ["identity", "targetRoles", "professionalSummaryMaster", "constraints"];
    const arraySections = ["experiences", "education", "skills", "certifications", "languages", "projects", "references"];

    if (!extraction.reviewStatus) {
      extraction.reviewStatus = {};
    }

    if (scalarSections.includes(section)) {
      (extraction.reviewStatus as Record<string, unknown>)[section] = reviewed;
    } else {
      if (!itemId) {
        return reply.code(400).send({ error: "itemId is required for array sections" });
      }
      const sectionRecord = (extraction.reviewStatus as Record<string, Record<string, boolean> | undefined>)[section];
      if (sectionRecord && !(itemId in sectionRecord)) {
        return reply.code(400).send({ error: `Item ${itemId} not found in section ${section}` });
      }
      if (!sectionRecord) {
        (extraction.reviewStatus as Record<string, Record<string, boolean>>)[section] = { [itemId]: reviewed };
      } else {
        sectionRecord[itemId] = reviewed;
      }
    }

    await writeJSON<ExtractionResult>(EXTRACTION_PATH, extraction);

    return reply.code(200).send(extraction.reviewStatus);
  });

  app.post("/api/resume/upload", async (request, reply) => {
    if (!request.isMultipart()) {
      return reply.code(400).send({ error: "Request must be multipart/form-data" });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    if (data.mimetype !== "application/pdf") {
      return reply.code(400).send({ error: "Only PDF files are accepted" });
    }

    const buffer = await data.toBuffer();

    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(400).send({ error: "File size exceeds 10MB limit" });
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const savePath = join(UPLOADS_DIR, "resume.pdf");
    await writeFile(savePath, buffer);

    const resumeUpload: ResumeUpload = {
      id: randomUUID(),
      originalFilename: data.filename,
      storagePath: savePath,
      uploadedAt: new Date().toISOString(),
      status: "uploaded",
    };

    await writeJSON<ResumeUpload>(RESUME_UPLOAD_PATH, resumeUpload);

    // Trigger extraction pipeline
    try {
      const extractionResult = await runExtractionPipeline(resumeUpload);
      return reply.code(200).send({
        id: resumeUpload.id,
        status: "extracted",
        extractedData: extractionResult,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Extraction failed";
      const failed: ResumeUpload = { ...resumeUpload, status: "failed", error: errorMessage };
      await writeJSON<ResumeUpload>(RESUME_UPLOAD_PATH, failed);

      if (err instanceof AiServiceUnavailableError) {
        return reply.code(503).send({
          id: resumeUpload.id,
          status: "failed",
          error: errorMessage,
        });
      }

      if (err instanceof PdfParseError) {
        return reply.code(400).send({
          id: resumeUpload.id,
          status: "failed",
          error: errorMessage,
        });
      }

      if (err instanceof AiExtractionError) {
        return reply.code(500).send({
          id: resumeUpload.id,
          status: "failed",
          error: `AI extraction error: ${errorMessage}`,
        });
      }

      if (err instanceof PostProcessingError) {
        return reply.code(500).send({
          id: resumeUpload.id,
          status: "failed",
          error: `Post-processing error: ${errorMessage}`,
        });
      }

      return reply.code(500).send({
        id: resumeUpload.id,
        status: "failed",
        error: errorMessage,
      });
    }
  });
}
