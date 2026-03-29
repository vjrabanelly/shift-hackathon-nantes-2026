import { writeJSON, writeCollection } from "./services/store.js";
import {
  PROFILE_PATH,
  RESUME_UPLOAD_PATH,
  EXTRACTION_PATH,
  JOBS_RAW_PATH,
  JOBS_PATH,
  CVS_PATH,
  ATS_REVIEWS_PATH,
  RECRUITER_REVIEWS_PATH,
  REVIEW_AGREEMENTS_PATH,
} from "./services/paths.js";

const now = new Date().toISOString();

// --- Profile ---
const profile = {
  id: "profile_01",
  data: {
    identity: {
      name: "Jane Doe",
      headline: "Senior Full-Stack Engineer",
      email: "jane.doe@example.com",
      phone: "+1-555-0123",
      location: "San Francisco, CA",
      links: {
        linkedin: "https://linkedin.com/in/janedoe",
        portfolio: "https://janedoe.dev",
        github: "https://github.com/janedoe",
      },
    },
    targetRoles: ["Senior Software Engineer", "Staff Engineer", "Tech Lead"],
    professionalSummaryMaster:
      "Full-stack engineer with 8+ years building scalable web applications. Expert in TypeScript, React, and Node.js with deep experience in cloud infrastructure and CI/CD pipelines. Led teams of 5-8 engineers delivering mission-critical fintech products.",
    experiences: [
      {
        experienceId: "exp_01",
        title: "Senior Software Engineer",
        company: "TechCorp Inc.",
        location: "San Francisco, CA",
        startDate: "2021-03",
        endDate: "2024-12",
        description: "Led backend platform team for fintech SaaS product.",
        achievements: [
          {
            text: "Reduced API latency by 40% by migrating to event-driven architecture",
            metric: "40% latency reduction",
            proofLevel: "measured",
          },
          {
            text: "Designed and shipped real-time fraud detection pipeline processing 50K events/sec",
            metric: "50K events/sec",
            proofLevel: "measured",
          },
          {
            text: "Mentored 3 junior engineers, all promoted within 18 months",
            metric: "3 promotions",
            proofLevel: "verified",
          },
        ],
        skillsUsed: ["TypeScript", "Node.js", "PostgreSQL", "Kafka", "AWS", "Docker"],
      },
      {
        experienceId: "exp_02",
        title: "Software Engineer",
        company: "StartupXYZ",
        location: "Remote",
        startDate: "2018-06",
        endDate: "2021-02",
        description: "Full-stack development for e-commerce platform.",
        achievements: [
          {
            text: "Built React component library used across 4 product teams",
            metric: "4 teams adopted",
            proofLevel: "verified",
          },
          {
            text: "Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes",
            metric: "87% deployment time reduction",
            proofLevel: "measured",
          },
        ],
        skillsUsed: ["React", "TypeScript", "Node.js", "MongoDB", "GitHub Actions"],
      },
      {
        experienceId: "exp_03",
        title: "Junior Developer",
        company: "WebAgency Co.",
        location: "New York, NY",
        startDate: "2016-09",
        endDate: "2018-05",
        description: "Front-end development for client websites.",
        achievements: [
          {
            text: "Delivered 12 client projects on time and within budget",
            metric: "12 projects",
            proofLevel: "verified",
          },
        ],
        skillsUsed: ["JavaScript", "HTML", "CSS", "jQuery", "WordPress"],
      },
    ],
    education: [
      {
        school: "University of California, Berkeley",
        degree: "B.S.",
        field: "Computer Science",
        year: 2016,
      },
    ],
    skills: [
      { name: "TypeScript", category: "Language", level: "expert", years: 6, evidenceRefs: ["exp_01", "exp_02"] },
      { name: "React", category: "Framework", level: "expert", years: 5, evidenceRefs: ["exp_02"] },
      { name: "Node.js", category: "Runtime", level: "expert", years: 7, evidenceRefs: ["exp_01", "exp_02"] },
      { name: "PostgreSQL", category: "Database", level: "advanced", years: 4, evidenceRefs: ["exp_01"] },
      { name: "AWS", category: "Cloud", level: "advanced", years: 4, evidenceRefs: ["exp_01"] },
      { name: "Docker", category: "DevOps", level: "advanced", years: 4, evidenceRefs: ["exp_01"] },
      { name: "Kafka", category: "Messaging", level: "intermediate", years: 2, evidenceRefs: ["exp_01"] },
      { name: "MongoDB", category: "Database", level: "intermediate", years: 3, evidenceRefs: ["exp_02"] },
      { name: "GitHub Actions", category: "CI/CD", level: "advanced", years: 3, evidenceRefs: ["exp_02"] },
      { name: "Python", category: "Language", level: "intermediate", years: 3, evidenceRefs: [] },
      { name: "GraphQL", category: "API", level: "intermediate", years: 2, evidenceRefs: [] },
    ],
    certifications: [
      { name: "AWS Solutions Architect Associate", issuer: "Amazon Web Services", date: "2022-06" },
    ],
    languages: [
      { name: "English", level: "native" },
      { name: "Spanish", level: "intermediate" },
    ],
    projects: [
      {
        name: "OpenMetrics Dashboard",
        description: "Open-source real-time metrics visualization tool",
        url: "https://github.com/janedoe/openmetrics-dash",
        technologies: ["React", "D3.js", "WebSocket", "Node.js"],
      },
    ],
    references: [],
    constraints: {
      preferredCvLanguage: "en",
      maxCvPages: 2,
      mustNotClaim: ["Machine Learning expertise", "PhD"],
    },
  },
  createdAt: now,
  updatedAt: now,
};

// --- ResumeUpload ---
const resumeUpload = {
  id: "upload_01",
  originalFilename: "jane_doe_resume.pdf",
  storagePath: "data/uploads/resume.pdf",
  uploadedAt: now,
  status: "confirmed",
};

// --- ExtractionResult ---
const extraction = {
  id: "extract_01",
  resumeUploadId: "upload_01",
  extractedAt: now,
  rawText: "Jane Doe\nSenior Full-Stack Engineer\njane.doe@example.com\n...(extracted resume text)...",
  data: profile.data,
  confidence: {
    identity: { score: 0.95, source: "extracted" },
    targetRoles: { score: 0.8, source: "inferred" },
    professionalSummaryMaster: { score: 0.85, source: "extracted" },
    experiences: {
      exp_01: { score: 0.9, source: "extracted" },
      exp_02: { score: 0.9, source: "extracted" },
      exp_03: { score: 0.85, source: "extracted" },
    },
    education: { edu_01: { score: 0.95, source: "extracted" } },
    skills: {
      TypeScript: { score: 0.9, source: "extracted" },
      React: { score: 0.9, source: "extracted" },
      "Node.js": { score: 0.9, source: "extracted" },
      PostgreSQL: { score: 0.85, source: "extracted" },
      AWS: { score: 0.85, source: "extracted" },
      Docker: { score: 0.8, source: "extracted" },
      Kafka: { score: 0.7, source: "inferred" },
      MongoDB: { score: 0.8, source: "extracted" },
      "GitHub Actions": { score: 0.75, source: "extracted" },
      Python: { score: 0.6, source: "inferred" },
      GraphQL: { score: 0.5, source: "inferred" },
    },
    certifications: { "AWS Solutions Architect Associate": { score: 0.9, source: "extracted" } },
    languages: {
      English: { score: 0.95, source: "extracted" },
      Spanish: { score: 0.7, source: "inferred" },
    },
    projects: { "OpenMetrics Dashboard": { score: 0.8, source: "extracted" } },
  },
  reviewStatus: {
    identity: true,
    targetRoles: true,
    professionalSummaryMaster: true,
    experiences: { exp_01: true, exp_02: true, exp_03: true },
    education: { edu_01: true },
    skills: {
      TypeScript: true, React: true, "Node.js": true, PostgreSQL: true,
      AWS: true, Docker: true, Kafka: true, MongoDB: true,
      "GitHub Actions": true, Python: true, GraphQL: true,
    },
    certifications: { "AWS Solutions Architect Associate": true },
    languages: { English: true, Spanish: true },
    projects: { "OpenMetrics Dashboard": true },
  },
  completionStatus: { markedComplete: false, markedCompleteAt: null },
};

// --- JobOfferRaw ---
const jobRaw = {
  id: "raw_01",
  source: "linkedin",
  sourceUrl: "https://www.linkedin.com/jobs/view/123456789",
  capturedAt: now,
  rawText: `Senior Backend Engineer - FinanceFlow
FinanceFlow is hiring a Senior Backend Engineer to build next-generation payment processing infrastructure.

Requirements:
- 5+ years backend development experience
- Strong TypeScript/Node.js skills
- Experience with PostgreSQL and event-driven architectures
- AWS experience required
- Experience with Kafka or similar message brokers preferred
- CI/CD pipeline experience

Responsibilities:
- Design and implement scalable microservices
- Lead technical design reviews
- Mentor junior engineers
- Collaborate with product and design teams

Location: San Francisco, CA (Hybrid)
Employment: Full-time
Seniority: Senior`,
  rawFields: {
    title: "Senior Backend Engineer",
    company: "FinanceFlow",
    location: "San Francisco, CA",
    employment_type: "Full-time",
    description: "Build next-generation payment processing infrastructure.",
  },
};

// --- JobPost (normalized) ---
const jobPost = {
  id: "job_01",
  jobOfferRawId: "raw_01",
  title: "Senior Backend Engineer",
  company: "FinanceFlow",
  description:
    "FinanceFlow is hiring a Senior Backend Engineer to build next-generation payment processing infrastructure.",
  url: "https://www.linkedin.com/jobs/view/123456789",
  location: "San Francisco, CA",
  remoteMode: "hybrid" as const,
  employmentType: "full_time" as const,
  seniority: "senior" as const,
  jobSummary:
    "Senior Backend Engineer role focused on building scalable payment processing microservices using TypeScript, Node.js, PostgreSQL, and AWS.",
  responsibilities: [
    "Design and implement scalable microservices",
    "Lead technical design reviews",
    "Mentor junior engineers",
    "Collaborate with product and design teams",
  ],
  requirementsMustHave: [
    "5+ years backend development experience",
    "Strong TypeScript/Node.js skills",
    "Experience with PostgreSQL and event-driven architectures",
    "AWS experience",
  ],
  requirementsNiceToHave: [
    "Experience with Kafka or similar message brokers",
    "CI/CD pipeline experience",
  ],
  keywords: [
    "TypeScript", "Node.js", "PostgreSQL", "AWS", "microservices",
    "event-driven", "payment processing", "backend",
  ],
  tools: ["PostgreSQL", "AWS", "Kafka", "Docker", "CI/CD"],
  languages: ["TypeScript", "JavaScript"],
  yearsExperienceMin: 5,
};

// --- GeneratedCV ---
const generatedCv = {
  id: "cv_seed0001",
  profileId: "profile_01",
  jobPostId: "job_01",
  version: 1,
  language: "en",
  title: "Jane Doe - Senior Backend Engineer",
  header: {
    fullName: "Jane Doe",
    headline: "Senior Full-Stack Engineer",
    contact: {
      email: "jane.doe@example.com",
      phone: "+1-555-0123",
      location: "San Francisco, CA",
    },
    links: {
      linkedin: "https://linkedin.com/in/janedoe",
      portfolio: "https://janedoe.dev",
      github: "https://github.com/janedoe",
    },
  },
  summary:
    "Results-driven Senior Engineer with 8+ years of experience building scalable backend systems. Expert in TypeScript and Node.js with proven track record in event-driven architectures, PostgreSQL optimization, and AWS cloud infrastructure. Led platform team delivering mission-critical fintech products processing 50K events/sec.",
  skillsHighlighted: [
    "TypeScript", "Node.js", "PostgreSQL", "AWS", "Docker",
    "Kafka", "Event-Driven Architecture", "Microservices", "CI/CD",
  ],
  experiencesSelected: [
    {
      experienceId: "exp_01",
      rewrittenBullets: [
        "Reduced API latency by 40% through migration to event-driven architecture using Kafka and microservices",
        "Designed and deployed real-time fraud detection pipeline processing 50K events/sec on AWS infrastructure",
        "Mentored 3 junior engineers, all achieving promotion within 18 months",
      ],
    },
    {
      experienceId: "exp_02",
      rewrittenBullets: [
        "Architected reusable React component library adopted across 4 product teams, improving development velocity",
        "Implemented CI/CD pipeline with GitHub Actions, reducing deployment time by 87% (2 hours to 15 minutes)",
      ],
    },
  ],
  educationSelected: ["B.S. Computer Science - University of California, Berkeley (2016)"],
  certificationsSelected: ["AWS Solutions Architect Associate"],
  keywordsCovered: [
    "TypeScript", "Node.js", "PostgreSQL", "AWS", "event-driven",
    "microservices", "backend", "Kafka",
  ],
  omittedItems: [
    "exp_03: Junior Developer at WebAgency Co. - less relevant to senior backend role",
    "MongoDB skill - not required for this position",
    "jQuery/WordPress skills - not relevant",
  ],
  generationNotes: [
    "Emphasized event-driven architecture and Kafka experience to match job requirements",
    "Highlighted AWS certification to strengthen cloud infrastructure credibility",
    "Focused on backend achievements, de-emphasized frontend work",
  ],
  coverageMap: {
    matchedRequirements: [
      { requirement: "5+ years backend development experience", evidenceRef: "exp_01 + exp_02: 6 years combined backend experience" },
      { requirement: "Strong TypeScript/Node.js skills", evidenceRef: "exp_01, exp_02: 6+ years TypeScript, 7 years Node.js" },
      { requirement: "Experience with PostgreSQL and event-driven architectures", evidenceRef: "exp_01: PostgreSQL + Kafka event-driven pipeline" },
      { requirement: "AWS experience", evidenceRef: "exp_01: AWS infrastructure + AWS Solutions Architect certification" },
    ],
    uncoveredRequirements: [],
  },
  selfCheck: { unsupportedClaimsFound: false, warnings: [] },
};

// --- ATSReview ---
const atsReview = {
  id: "ats_seed0001",
  cvId: "cv_seed0001",
  jobPostId: "job_01",
  score: 88,
  passed: true,
  hardFiltersStatus: [
    { filter: "5+ years backend experience", status: "pass", evidence: "6 years combined backend experience at TechCorp and StartupXYZ" },
    { filter: "TypeScript/Node.js skills", status: "pass", evidence: "Listed as expert-level skills with 6+ years experience" },
    { filter: "PostgreSQL experience", status: "pass", evidence: "Listed in exp_01 skillsUsed, advanced level" },
    { filter: "AWS experience", status: "pass", evidence: "Listed in skills + AWS Solutions Architect certification" },
  ],
  matchedKeywords: ["TypeScript", "Node.js", "PostgreSQL", "AWS", "microservices", "event-driven", "Kafka", "backend"],
  missingKeywords: ["payment processing"],
  formatFlags: [],
  recommendations: [
    "Consider adding 'payment processing' keyword if applicable to past work",
  ],
};

// --- RecruiterReview ---
const recruiterReview = {
  id: "rec_seed0001",
  cvId: "cv_seed0001",
  jobPostId: "job_01",
  score: 82,
  passed: true,
  readabilityScore: 85,
  credibilityScore: 80,
  coherenceScore: 84,
  evidenceScore: 78,
  strengths: [
    "Strong quantified achievements (40% latency reduction, 50K events/sec)",
    "Clear career progression from junior to senior",
    "Relevant AWS certification backs cloud infrastructure claims",
  ],
  concerns: [
    "No direct payment processing experience mentioned",
    "Summary could more directly address the specific role requirements",
  ],
  recommendations: [
    "Highlight any payment or financial system experience more prominently",
    "Tighten summary to lead with backend/infrastructure focus",
  ],
};

// --- ReviewAgreement ---
const reviewAgreement = {
  id: "ra_seed0001",
  jobPostId: "job_01",
  cvId: "cv_seed0001",
  cvGenerationOk: true,
  atsOk: true,
  recruiterOk: true,
  reviewAgreementOk: true,
  finalStatus: "FINAL_APPROVED",
  rejectionReasons: [],
  iterationCount: 1,
};

async function seed() {
  console.log("Seeding demo data...");

  await writeJSON(PROFILE_PATH, profile);
  console.log("  -> profile.json");

  await writeJSON(RESUME_UPLOAD_PATH, resumeUpload);
  console.log("  -> resume-upload.json");

  await writeJSON(EXTRACTION_PATH, extraction);
  console.log("  -> extraction.json");

  await writeCollection(JOBS_RAW_PATH, [jobRaw]);
  console.log("  -> jobs-raw.json");

  await writeCollection(JOBS_PATH, [jobPost]);
  console.log("  -> jobs.json");

  await writeCollection(CVS_PATH, [generatedCv]);
  console.log("  -> cvs.json");

  await writeCollection(ATS_REVIEWS_PATH, [atsReview]);
  console.log("  -> ats-reviews.json");

  await writeCollection(RECRUITER_REVIEWS_PATH, [recruiterReview]);
  console.log("  -> recruiter-reviews.json");

  await writeCollection(REVIEW_AGREEMENTS_PATH, [reviewAgreement]);
  console.log("  -> review-agreements.json");

  console.log("\nSeed complete! All data files populated.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
