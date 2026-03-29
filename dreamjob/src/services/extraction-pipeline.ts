import { randomUUID } from "node:crypto";
import type {
  ExtractionResult,
  ReviewStatus,
  ConfidenceMap,
} from "../schemas/extraction-result.js";
import type { ProfileData } from "../schemas/profile.js";
import { writeJSON } from "./store.js";
import { EXTRACTION_PATH, RESUME_UPLOAD_PATH } from "./paths.js";
import type { ResumeUpload } from "../schemas/resume-upload.js";
import { extractTextFromPDF } from "./extraction.js";
import { extractProfileFromText } from "./ai/openai.js";
import { AiExtractionError, AiServiceUnavailableError, PostProcessingError } from "../errors.js";

/**
 * Assign sequential experienceId values (exp_01, exp_02, ...) to experiences
 * that are missing an ID or have a non-standard one.
 */
function assignExperienceIds(data: ProfileData): void {
  for (let i = 0; i < data.experiences.length; i++) {
    data.experiences[i].experienceId = `exp_${String(i + 1).padStart(2, "0")}`;
  }
}

/**
 * Normalize date strings to ISO partial format (YYYY-MM or YYYY).
 * Handles common patterns: "January 2020", "Jan 2020", "2020-01", "2020/01", "01/2020", "2020".
 */
function normalizeDate(dateStr: string): string {
  const trimmed = dateStr.trim();

  // Already in YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  // Already just YYYY
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  // "YYYY/MM" or "YYYY-MM-DD"
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})(?:[/-]\d{1,2})?$/);
  if (ymdMatch) return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, "0")}`;

  // "MM/YYYY" or "MM-YYYY"
  const myMatch = trimmed.match(/^(\d{1,2})[/-](\d{4})$/);
  if (myMatch) return `${myMatch[2]}-${myMatch[1].padStart(2, "0")}`;

  // "Month YYYY" or "Mon YYYY"
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
    jan: "01", feb: "02", mar: "03", apr: "04",
    jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };
  const monthMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthMatch) {
    const mm = months[monthMatch[1].toLowerCase()];
    if (mm) return `${monthMatch[2]}-${mm}`;
  }

  // Return as-is if no pattern matches
  return trimmed;
}

/**
 * Normalize all date fields in ProfileData to YYYY-MM or YYYY format.
 */
function normalizeDates(data: ProfileData): void {
  for (const exp of data.experiences) {
    exp.startDate = normalizeDate(exp.startDate);
    if (exp.endDate) {
      exp.endDate = normalizeDate(exp.endDate);
    }
  }
  if (data.certifications) {
    for (const cert of data.certifications) {
      if (cert.date) {
        cert.date = normalizeDate(cert.date);
      }
    }
  }
}

/**
 * Initialize reviewStatus with all entries set to false.
 */
function initReviewStatus(data: ProfileData): ReviewStatus {
  const status: ReviewStatus = {
    identity: false,
    targetRoles: false,
    professionalSummaryMaster: false,
    constraints: false,
  };

  // Array sections: create a Record<id, false> for each item
  const experiences: Record<string, boolean> = {};
  for (const exp of data.experiences) {
    experiences[exp.experienceId] = false;
  }
  status.experiences = experiences;

  const education: Record<string, boolean> = {};
  for (let i = 0; i < data.education.length; i++) {
    education[`edu_${String(i + 1).padStart(2, "0")}`] = false;
  }
  status.education = education;

  const skills: Record<string, boolean> = {};
  for (const skill of data.skills) {
    skills[skill.name] = false;
  }
  status.skills = skills;

  if (data.certifications) {
    const certifications: Record<string, boolean> = {};
    for (const cert of data.certifications) {
      certifications[cert.name] = false;
    }
    status.certifications = certifications;
  }

  if (data.languages) {
    const languages: Record<string, boolean> = {};
    for (const lang of data.languages) {
      languages[lang.name] = false;
    }
    status.languages = languages;
  }

  if (data.projects) {
    const projects: Record<string, boolean> = {};
    for (const proj of data.projects) {
      projects[proj.name] = false;
    }
    status.projects = projects;
  }

  if (data.references) {
    const references: Record<string, boolean> = {};
    for (const ref of data.references) {
      references[ref.name] = false;
    }
    status.references = references;
  }

  return status;
}

/**
 * Run the extraction pipeline: read PDF, extract text, call AI extraction,
 * post-process (IDs, dates, review status), persist result, update status.
 */
export async function runExtractionPipeline(
  resumeUpload: ResumeUpload,
): Promise<ExtractionResult> {
  // Update status to extracting
  const extracting: ResumeUpload = { ...resumeUpload, status: "extracting" };
  await writeJSON<ResumeUpload>(RESUME_UPLOAD_PATH, extracting);

  // Extract text from PDF
  const rawText = await extractTextFromPDF(resumeUpload.storagePath);

  // Call AI extraction
  let data: ProfileData;
  let confidence: ConfidenceMap;

  try {
    const extraction = await extractProfileFromText(rawText);
    data = extraction.data;
    confidence = extraction.confidence;
  } catch (err: unknown) {
    if (err instanceof AiServiceUnavailableError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "AI extraction failed";
    throw new AiExtractionError(message);
  }

  // Post-processing
  let reviewStatus: ReviewStatus;
  try {
    assignExperienceIds(data);
    normalizeDates(data);
    reviewStatus = initReviewStatus(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Post-processing failed";
    throw new PostProcessingError(message);
  }

  const result: ExtractionResult = {
    id: randomUUID(),
    resumeUploadId: resumeUpload.id,
    extractedAt: new Date().toISOString(),
    rawText,
    data,
    confidence,
    reviewStatus,
    completionStatus: {
      markedComplete: false,
      markedCompleteAt: null,
    },
  };

  // Persist extraction result
  await writeJSON<ExtractionResult>(EXTRACTION_PATH, result);

  // Update resume-upload status to extracted
  const extracted: ResumeUpload = { ...resumeUpload, status: "extracted" };
  await writeJSON<ResumeUpload>(RESUME_UPLOAD_PATH, extracted);

  return result;
}
