import { randomUUID } from "node:crypto";
import { chatCompletionJSON } from "./openai.js";
import type { JobPost } from "../../schemas/job-post.js";
import type { GeneratedCV } from "../../schemas/generated-cv.js";
import type { ATSReview } from "../../schemas/ats-review.js";

export interface ATSScoringRules {
  passingScore?: number;
  weightKeywords?: number;
  weightHardFilters?: number;
  weightStructure?: number;
}

const DEFAULT_SCORING_RULES: Required<ATSScoringRules> = {
  passingScore: 75,
  weightKeywords: 0.5,
  weightHardFilters: 0.3,
  weightStructure: 0.2,
};

interface ATSAgentOutput {
  score: number;
  hardFiltersStatus: Array<{
    filter: string;
    status: "pass" | "fail" | "unknown";
    evidence: string;
  }>;
  matchedKeywords: string[];
  missingKeywords: string[];
  formatFlags: string[];
  recommendations: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

const SYSTEM_PROMPT = `Tu es l'agent ATS.
Analyse le CV par rapport a l'offre.
Concentre-toi sur 3 points: mots-cles, filtres bloquants, structure.
Sois strict, rapide et synthetique.
Toutes les phrases doivent etre tres courtes, en francais.
formatFlags et recommendations: 3 elements max.
L'evidence doit etre breve.
Tous les textes de valeur doivent etre en francais, meme si l'offre est en anglais.
Retourne uniquement un JSON valide avec exactement les cles demandees.`;

export async function reviewCVAsATS(
  jobPost: JobPost,
  cv: GeneratedCV,
  scoringRules?: ATSScoringRules,
): Promise<ATSReview> {
  const rules = { ...DEFAULT_SCORING_RULES, ...scoringRules };

  const userPrompt = `Offre:
${JSON.stringify({
  title: jobPost.title,
  seniority: jobPost.seniority,
  requirementsMustHave: jobPost.requirementsMustHave,
  requirementsNiceToHave: jobPost.requirementsNiceToHave,
  keywords: jobPost.keywords,
  tools: jobPost.tools,
  languages: jobPost.languages,
  yearsExperienceMin: jobPost.yearsExperienceMin ?? null,
})}

CV:
${JSON.stringify({
  title: cv.title,
  summary: cv.summary,
  skillsHighlighted: cv.skillsHighlighted,
  experiencesSelected: cv.experiencesSelected,
  educationSelected: cv.educationSelected,
  certificationsSelected: cv.certificationsSelected,
  keywordsCovered: cv.keywordsCovered,
})}

Regles:
${JSON.stringify({
  passingScore: rules.passingScore,
  weightKeywords: rules.weightKeywords,
  weightHardFilters: rules.weightHardFilters,
  weightStructure: rules.weightStructure,
})}

Retourne le JSON maintenant.`;

  const output = await chatCompletionJSON<ATSAgentOutput>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
  });

  const score = Math.max(0, Math.min(100, Math.round(output.score ?? 0)));
  const passed = score >= rules.passingScore;

  return {
    id: `ats_${randomUUID().slice(0, 8)}`,
    cvId: cv.id,
    jobPostId: jobPost.id,
    score,
    passed,
    hardFiltersStatus: output.hardFiltersStatus || [],
    matchedKeywords: toStringArray(output.matchedKeywords),
    missingKeywords: toStringArray(output.missingKeywords),
    formatFlags: toStringArray(output.formatFlags),
    recommendations: toStringArray(output.recommendations),
  };
}
