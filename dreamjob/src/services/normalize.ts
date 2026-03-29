import OpenAI from "openai";
import type { JobOfferRaw } from "../schemas/job-offer-raw.js";
import type { JobPost } from "../schemas/job-post.js";
import { readCollection, writeCollection } from "./store.js";
import { JOBS_PATH } from "./paths.js";
import { AiServiceUnavailableError } from "../errors.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiServiceUnavailableError(
      "OPENAI_API_KEY is not set. Cannot perform job normalization.",
    );
  }
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const NORMALIZATION_PROMPT = `You are a job posting data extraction engine. Given raw text and optional structured fields from a scraped job listing, extract a normalized job post.

Return a JSON object with exactly these fields:

{
  "title": string (job title),
  "company": string (company name),
  "description": string (full job description text),
  "url": string (source URL, use the one provided),
  "salary": string or null (salary range if mentioned),
  "location": string (city/region/country),
  "remoteMode": "onsite" | "hybrid" | "remote",
  "employmentType": "full_time" | "part_time" | "contract" | "internship",
  "seniority": "entry" | "mid" | "senior" | "lead" | "executive",
  "jobSummary": string (2-3 sentence summary of the role),
  "responsibilities": string[] (key responsibilities),
  "requirementsMustHave": string[] (required qualifications),
  "requirementsNiceToHave": string[] (preferred/nice-to-have qualifications),
  "keywords": string[] (relevant keywords for ATS matching),
  "tools": string[] (specific tools, software, platforms mentioned),
  "languages": string[] (programming languages or spoken languages required),
  "yearsExperienceMin": number or null (minimum years of experience if mentioned),
  "postedDate": string or null (posting date in ISO format if available)
}

Rules:
- Extract only what is present or strongly inferable from the text.
- For remoteMode, default to "onsite" if not mentioned.
- For employmentType, default to "full_time" if not mentioned.
- For seniority, infer from title and requirements (e.g. "Senior" in title = "senior", "5+ years" suggests "senior").
- Separate must-have requirements from nice-to-have (look for "preferred", "bonus", "nice to have", "plus" keywords).
- Extract specific tools and technologies into the tools array.
- Extract relevant keywords that a candidate might need for ATS matching.
- If the raw text is in a non-English language, extract in the original language.`;

interface NormalizedFields {
  title: string;
  company: string;
  description: string;
  url: string;
  salary: string | null;
  location: string;
  remoteMode: "onsite" | "hybrid" | "remote";
  employmentType: "full_time" | "part_time" | "contract" | "internship";
  seniority: "entry" | "mid" | "senior" | "lead" | "executive";
  jobSummary: string;
  responsibilities: string[];
  requirementsMustHave: string[];
  requirementsNiceToHave: string[];
  keywords: string[];
  tools: string[];
  languages: string[];
  yearsExperienceMin: number | null;
  postedDate: string | null;
}

async function normalizeViaAI(raw: JobOfferRaw): Promise<NormalizedFields> {
  const userContent = [
    `Source URL: ${raw.sourceUrl}`,
    raw.rawFields.title ? `Title: ${raw.rawFields.title}` : "",
    raw.rawFields.company ? `Company: ${raw.rawFields.company}` : "",
    raw.rawFields.location ? `Location: ${raw.rawFields.location}` : "",
    raw.rawFields.employment_type
      ? `Employment Type: ${raw.rawFields.employment_type}`
      : "",
    raw.rawFields.salary ? `Salary: ${raw.rawFields.salary}` : "",
    raw.rawFields.posted_date
      ? `Posted Date: ${raw.rawFields.posted_date}`
      : "",
    "",
    "Full job posting text:",
    raw.rawText,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await getClient().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: NORMALIZATION_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response during normalization");
  }

  let parsed: NormalizedFields;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      `Failed to parse normalization response as JSON: ${content.slice(0, 200)}`,
    );
  }

  // Validate enum values with fallbacks
  const validRemoteModes = ["onsite", "hybrid", "remote"] as const;
  const validEmploymentTypes = [
    "full_time",
    "part_time",
    "contract",
    "internship",
  ] as const;
  const validSeniorities = [
    "entry",
    "mid",
    "senior",
    "lead",
    "executive",
  ] as const;

  if (!validRemoteModes.includes(parsed.remoteMode as any)) {
    parsed.remoteMode = "onsite";
  }
  if (!validEmploymentTypes.includes(parsed.employmentType as any)) {
    parsed.employmentType = "full_time";
  }
  if (!validSeniorities.includes(parsed.seniority as any)) {
    parsed.seniority = "mid";
  }

  return parsed;
}

function normalizeFallback(raw: JobOfferRaw): Omit<NormalizedFields, "url"> {
  const rf = raw.rawFields;
  return {
    title: rf.title ?? "Untitled",
    company: rf.company ?? "Unknown",
    description: rf.description ?? raw.rawText,
    salary: rf.salary ?? null,
    location: rf.location ?? "Unknown",
    remoteMode: "onsite",
    employmentType: inferEmploymentType(rf.employment_type),
    seniority: "mid",
    jobSummary: rf.description ?? raw.rawText.slice(0, 500),
    responsibilities: [],
    requirementsMustHave: rf.requirements ? [rf.requirements] : [],
    requirementsNiceToHave: [],
    keywords: [],
    tools: [],
    languages: [],
    yearsExperienceMin: null,
    postedDate: rf.posted_date ?? null,
  };
}

function inferEmploymentType(
  value: string | undefined,
): "full_time" | "part_time" | "contract" | "internship" {
  if (!value) return "full_time";
  const v = value.toLowerCase().replace(/[\s-]/g, "_");
  if (v.includes("part_time") || v.includes("part")) return "part_time";
  if (v.includes("contract")) return "contract";
  if (v.includes("internship") || v.includes("intern")) return "internship";
  return "full_time";
}

export async function normalizeJobOffer(raw: JobOfferRaw): Promise<JobPost> {
  const existing = await readCollection<JobPost>(JOBS_PATH);
  const nextNum = existing.length + 1;
  const id = `job_${String(nextNum).padStart(2, "0")}`;

  let fields: Omit<NormalizedFields, "url"> & { url?: string };
  try {
    fields = await normalizeViaAI(raw);
  } catch {
    fields = normalizeFallback(raw);
  }

  const jobPost: JobPost = {
    id,
    jobOfferRawId: raw.id,
    title: fields.title || "Untitled",
    company: fields.company || "Unknown",
    description: fields.description || raw.rawText,
    url: fields.url ?? raw.sourceUrl,
    salary: fields.salary ?? undefined,
    location: fields.location || "Unknown",
    remoteMode: fields.remoteMode,
    employmentType: fields.employmentType,
    seniority: fields.seniority,
    jobSummary: fields.jobSummary || raw.rawText.slice(0, 500),
    responsibilities: fields.responsibilities ?? [],
    requirementsMustHave: fields.requirementsMustHave ?? [],
    requirementsNiceToHave: fields.requirementsNiceToHave ?? [],
    keywords: fields.keywords ?? [],
    tools: fields.tools ?? [],
    languages: fields.languages ?? [],
    yearsExperienceMin: fields.yearsExperienceMin ?? undefined,
    postedDate: fields.postedDate ?? undefined,
  };

  existing.push(jobPost);
  await writeCollection(JOBS_PATH, existing);

  return jobPost;
}
