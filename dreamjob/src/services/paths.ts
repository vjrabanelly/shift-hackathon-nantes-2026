import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");

export const UPLOADS_DIR = join(DATA_DIR, "uploads");
export const CV_EXPORTS_DIR = join(DATA_DIR, "exports");

export const PROFILE_PATH = join(DATA_DIR, "profile.json");
export const RESUME_UPLOAD_PATH = join(DATA_DIR, "resume-upload.json");
export const EXTRACTION_PATH = join(DATA_DIR, "extraction.json");
export const JOBS_RAW_PATH = join(DATA_DIR, "jobs-raw.json");
export const JOBS_PATH = join(DATA_DIR, "jobs.json");
export const CVS_PATH = join(DATA_DIR, "cvs.json");
export const ATS_REVIEWS_PATH = join(DATA_DIR, "ats-reviews.json");
export const RECRUITER_REVIEWS_PATH = join(DATA_DIR, "recruiter-reviews.json");
export const REVIEW_AGREEMENTS_PATH = join(DATA_DIR, "review-agreements.json");
