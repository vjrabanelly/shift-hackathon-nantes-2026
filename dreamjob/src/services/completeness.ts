import type { ExtractionResult, ReviewStatus } from "../schemas/extraction-result.js";
import type { ProfileData } from "../schemas/profile.js";

export interface ChecklistItem {
  label: string;
  met: boolean;
}

export interface CompletenessResult {
  progress: number;
  strengthScore: number;
  missingSections: string[];
  unresolvedSections: string[];
  checklist: ChecklistItem[];
  canMarkComplete: boolean;
}

const SCALAR_SECTIONS = ["identity", "targetRoles", "professionalSummaryMaster", "constraints"] as const;
const ARRAY_SECTIONS = ["experiences", "education", "skills", "certifications", "languages", "projects", "references"] as const;

function countReviewItems(reviewStatus: ReviewStatus): { reviewed: number; total: number } {
  let reviewed = 0;
  let total = 0;

  for (const section of SCALAR_SECTIONS) {
    const val = reviewStatus[section];
    if (val !== undefined) {
      total++;
      if (val === true) reviewed++;
    }
  }

  for (const section of ARRAY_SECTIONS) {
    const record = reviewStatus[section];
    if (record) {
      for (const key of Object.keys(record)) {
        total++;
        if (record[key] === true) reviewed++;
      }
    }
  }

  return { reviewed, total };
}

function computeStrengthScore(data: ProfileData): number {
  let score = 0;

  // identity (15 points)
  if (data.identity && data.identity.name) score += 15;

  // 1+ experience (15 points)
  if (data.experiences.length >= 1) score += 15;

  // 2+ experiences (25 points)
  if (data.experiences.length >= 2) score += 25;

  // experiences with 2+ achievements (5 each, max 15)
  let achievementBonus = 0;
  for (const exp of data.experiences) {
    if (exp.achievements && exp.achievements.length >= 2) {
      achievementBonus += 5;
      if (achievementBonus >= 15) break;
    }
  }
  score += achievementBonus;

  // 1+ education (10 points)
  if (data.education.length >= 1) score += 10;

  // 5+ skills (10 points)
  if (data.skills.length >= 5) score += 10;

  // 10+ skills (15 points)
  if (data.skills.length >= 10) score += 15;

  // certifications (5 points)
  if (data.certifications && data.certifications.length > 0) score += 5;

  // projects (5 points)
  if (data.projects && data.projects.length > 0) score += 5;

  // languages (5 points)
  if (data.languages && data.languages.length > 0) score += 5;

  // summary (5 points)
  if (data.professionalSummaryMaster) score += 5;

  return score;
}

function findMissingSections(data: ProfileData): string[] {
  const missing: string[] = [];

  if (!data.identity || !data.identity.name) missing.push("identity");
  if (!data.targetRoles || data.targetRoles.length === 0) missing.push("targetRoles");
  if (!data.professionalSummaryMaster) missing.push("professionalSummaryMaster");
  if (data.experiences.length === 0) missing.push("experiences");
  if (data.education.length === 0) missing.push("education");
  if (data.skills.length === 0) missing.push("skills");
  if (!data.certifications || data.certifications.length === 0) missing.push("certifications");
  if (!data.languages || data.languages.length === 0) missing.push("languages");
  if (!data.projects || data.projects.length === 0) missing.push("projects");
  if (!data.references || data.references.length === 0) missing.push("references");
  if (!data.constraints) missing.push("constraints");

  return missing;
}

function findUnresolvedSections(reviewStatus: ReviewStatus): string[] {
  const unresolved: string[] = [];

  for (const section of SCALAR_SECTIONS) {
    const val = reviewStatus[section];
    if (val !== undefined && val !== true) unresolved.push(section);
  }

  for (const section of ARRAY_SECTIONS) {
    const record = reviewStatus[section];
    if (record) {
      const hasUnreviewed = Object.values(record).some((v) => v !== true);
      if (hasUnreviewed) unresolved.push(section);
    }
  }

  return unresolved;
}

function buildChecklist(data: ProfileData, reviewStatus: ReviewStatus): ChecklistItem[] {
  return [
    { label: "Identity provided", met: !!(data.identity && data.identity.name) },
    { label: "At least 1 experience", met: data.experiences.length >= 1 },
    { label: "At least 1 education", met: data.education.length >= 1 },
    { label: "At least 5 skills", met: data.skills.length >= 5 },
    { label: "Professional summary", met: !!data.professionalSummaryMaster },
    { label: "Identity reviewed", met: reviewStatus.identity === true },
    { label: "All experiences reviewed", met: reviewStatus.experiences ? Object.values(reviewStatus.experiences).every((v) => v === true) : false },
    { label: "All education reviewed", met: reviewStatus.education ? Object.values(reviewStatus.education).every((v) => v === true) : false },
    { label: "All skills reviewed", met: reviewStatus.skills ? Object.values(reviewStatus.skills).every((v) => v === true) : false },
  ];
}

function computeCanMarkComplete(reviewStatus: ReviewStatus): boolean {
  // identity reviewed
  if (reviewStatus.identity !== true) return false;

  // all experiences reviewed
  if (reviewStatus.experiences) {
    if (Object.values(reviewStatus.experiences).some((v) => v !== true)) return false;
  }

  // all education reviewed
  if (reviewStatus.education) {
    if (Object.values(reviewStatus.education).some((v) => v !== true)) return false;
  }

  // all skills reviewed
  if (reviewStatus.skills) {
    if (Object.values(reviewStatus.skills).some((v) => v !== true)) return false;
  }

  return true;
}

export function computeCompleteness(extraction: ExtractionResult): CompletenessResult {
  const { data, reviewStatus } = extraction;
  const { reviewed, total } = countReviewItems(reviewStatus);
  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return {
    progress,
    strengthScore: computeStrengthScore(data),
    missingSections: findMissingSections(data),
    unresolvedSections: findUnresolvedSections(reviewStatus),
    checklist: buildChecklist(data, reviewStatus),
    canMarkComplete: computeCanMarkComplete(reviewStatus),
  };
}
