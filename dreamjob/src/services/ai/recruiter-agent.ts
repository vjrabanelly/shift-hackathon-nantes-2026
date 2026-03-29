import { randomUUID } from "node:crypto";
import { chatCompletionJSON } from "./openai.js";
import type { JobPost } from "../../schemas/job-post.js";
import type { GeneratedCV } from "../../schemas/generated-cv.js";
import type { RecruiterReview } from "../../schemas/recruiter-review.js";

export interface RecruiterScoringRules {
  passingScore?: number;
  weightReadability?: number;
  weightCredibility?: number;
  weightCoherence?: number;
  weightEvidence?: number;
}

const DEFAULT_SCORING_RULES: Required<RecruiterScoringRules> = {
  passingScore: 75,
  weightReadability: 0.25,
  weightCredibility: 0.35,
  weightCoherence: 0.2,
  weightEvidence: 0.2,
};

interface RecruiterAgentOutput {
  readabilityScore: number;
  credibilityScore: number;
  coherenceScore: number;
  evidenceScore: number;
  strengths: string[];
  concerns: string[];
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

const SYSTEM_PROMPT = `Tu es l'agent Recruteur.
Analyse le CV comme un recruteur humain.
Concentre-toi sur 4 points: lisibilite, credibilite, coherence, preuve.
Sois direct et tres synthetique.
strengths, concerns et recommendations: 3 elements max.
Chaque phrase doit etre courte, concrete et en francais.
N'ajoute aucune explication hors schema.
Tous les textes de valeur doivent etre en francais, meme si l'offre est en anglais.
Retourne uniquement un JSON valide avec exactement les cles demandees.`;

export async function reviewCVAsRecruiter(
  jobPost: JobPost,
  cv: GeneratedCV,
  scoringRules?: RecruiterScoringRules,
): Promise<RecruiterReview> {
  const rules = { ...DEFAULT_SCORING_RULES, ...scoringRules };

  const userPrompt = `Offre:
${JSON.stringify({
  title: jobPost.title,
  seniority: jobPost.seniority,
  jobSummary: jobPost.jobSummary,
  requirementsMustHave: jobPost.requirementsMustHave,
  requirementsNiceToHave: jobPost.requirementsNiceToHave,
  keywords: jobPost.keywords,
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
  weightCredibility: rules.weightCredibility,
  weightReadability: rules.weightReadability,
  weightCoherence: rules.weightCoherence,
  weightEvidence: rules.weightEvidence,
})}

Retourne le JSON maintenant.`;

  const output = await chatCompletionJSON<RecruiterAgentOutput>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
  });

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n ?? 0)));

  const readabilityScore = clamp(output.readabilityScore);
  const credibilityScore = clamp(output.credibilityScore);
  const coherenceScore = clamp(output.coherenceScore);
  const evidenceScore = clamp(output.evidenceScore);

  const score = clamp(
    credibilityScore * rules.weightCredibility +
      readabilityScore * rules.weightReadability +
      coherenceScore * rules.weightCoherence +
      evidenceScore * rules.weightEvidence,
  );

  const passed = score >= rules.passingScore;

  return {
    id: `rec_${randomUUID().slice(0, 8)}`,
    cvId: cv.id,
    jobPostId: jobPost.id,
    score,
    passed,
    readabilityScore,
    credibilityScore,
    coherenceScore,
    evidenceScore,
    strengths: toStringArray(output.strengths),
    concerns: toStringArray(output.concerns),
    recommendations: toStringArray(output.recommendations),
  };
}
