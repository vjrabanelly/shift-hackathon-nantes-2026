import { randomUUID } from "node:crypto";
import { chatCompletionJSON } from "./openai.js";
import type { Profile } from "../../schemas/profile.js";
import type { JobPost } from "../../schemas/job-post.js";
import type { GeneratedCV } from "../../schemas/generated-cv.js";
import type { ATSReview } from "../../schemas/ats-review.js";
import type { RecruiterReview } from "../../schemas/recruiter-review.js";

export interface GenerationRules {
  language: string;
  maxPages?: number;
  tone?: string;
  truthfulnessMode?: "strict" | "flexible";
}

export interface RevisionContext {
  previousAtsReview?: ATSReview;
  previousRecruiterReview?: RecruiterReview;
}

interface CandidateAgentOutput {
  title: string;
  summary: string;
  skillsHighlighted: string[];
  experiencesSelected: Array<{
    experienceId: string;
    rewrittenBullets: string[];
  }>;
  educationSelected: string[];
  certificationsSelected: string[];
  keywordsCovered: string[];
  omittedItems: string[];
  generationNotes: string[];
  coverageMap: {
    matchedRequirements: Array<{ requirement: string; evidenceRef: string }>;
    uncoveredRequirements: string[];
  };
  selfCheck: {
    unsupportedClaimsFound: boolean;
    warnings: string[];
  };
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

function toExperienceSelectedArray(value: unknown): Array<{
  experienceId: string;
  rewrittenBullets: string[];
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;

      const experienceId =
        typeof record.experienceId === "string" && record.experienceId.trim()
          ? record.experienceId.trim()
          : typeof record.title === "string" && record.title.trim()
            ? record.title.trim()
            : `Experience ${index + 1}`;

      const rewrittenBullets =
        toStringArray(record.rewrittenBullets).length > 0
          ? toStringArray(record.rewrittenBullets)
          : toStringArray(record.achievements);

      return {
        experienceId,
        rewrittenBullets,
      };
    })
    .filter(
      (
        item,
      ): item is {
        experienceId: string;
        rewrittenBullets: string[];
      } => Boolean(item),
    );
}

function normalizeCoverageMap(value: unknown): {
  matchedRequirements: Array<{ requirement: string; evidenceRef: string }>;
  uncoveredRequirements: string[];
} {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.matchedRequirements) || Array.isArray(record.uncoveredRequirements)) {
      const matchedRequirements = Array.isArray(record.matchedRequirements)
        ? record.matchedRequirements
            .map((item) => {
              if (!item || typeof item !== "object") return null;
              const match = item as Record<string, unknown>;
              if (typeof match.requirement !== "string" || typeof match.evidenceRef !== "string") {
                return null;
              }
              return {
                requirement: match.requirement,
                evidenceRef: match.evidenceRef,
              };
            })
            .filter(
              (
                item,
              ): item is {
                requirement: string;
                evidenceRef: string;
              } => Boolean(item),
            )
        : [];

      return {
        matchedRequirements,
        uncoveredRequirements: toStringArray(record.uncoveredRequirements),
      };
    }

    const uncoveredRequirements = Object.entries(record)
      .filter(([, covered]) => covered === false)
      .map(([requirement]) => requirement);

    return {
      matchedRequirements: [],
      uncoveredRequirements,
    };
  }

  return {
    matchedRequirements: [],
    uncoveredRequirements: [],
  };
}

function normalizeSelfCheck(value: unknown): {
  unsupportedClaimsFound: boolean;
  warnings: string[];
} {
  if (Array.isArray(value) || typeof value === "string") {
    const warnings = toStringArray(value);
    return {
      unsupportedClaimsFound: warnings.length > 0,
      warnings,
    };
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const warnings = toStringArray(record.warnings);
    const unsupportedClaimsFound =
      typeof record.unsupportedClaimsFound === "boolean"
        ? record.unsupportedClaimsFound
        : warnings.length > 0;

    return {
      unsupportedClaimsFound,
      warnings,
    };
  }

  return {
    unsupportedClaimsFound: false,
    warnings: [],
  };
}

const SYSTEM_PROMPT = `Tu es l'agent Candidat.
Genere un CV cible, tres synthetique, uniquement a partir du profil fourni.
N'invente rien.
Tous les textes doivent etre en francais.
Resume: 2 phrases max.
Chaque experience: 3 bullets max, phrases tres courtes.
omittedItems, generationNotes, warnings: 3 elements max.
Si une preuve manque, laisse l'element de cote.
Remplis skillsHighlighted, experiencesSelected, educationSelected, certificationsSelected, keywordsCovered, coverageMap et selfCheck des qu'il existe des donnees pertinentes dans le profil ou l'offre. Ne laisse pas ces champs vides sans raison.
Retourne uniquement un JSON valide avec exactement les cles demandees.`;

export async function generateTargetedCV(
  profile: Profile,
  jobPost: JobPost,
  rules: GenerationRules,
  revisionContext?: RevisionContext,
): Promise<GeneratedCV> {
  const { language, maxPages, tone, truthfulnessMode } = rules;

  let revisionSection = "";
  if (revisionContext) {
    const parts: string[] = [];

    if (revisionContext.previousAtsReview) {
      const ats = revisionContext.previousAtsReview;
      parts.push(`### Previous ATS Review (Score: ${ats.score}/100, Passed: ${ats.passed})
Hard Filters:
${ats.hardFiltersStatus.map((h) => `- ${h.filter}: ${h.status} â€” ${h.evidence}`).join("\n")}

Missing Keywords: ${ats.missingKeywords.join(", ") || "none"}
Format Flags: ${ats.formatFlags.join(", ") || "none"}
Recommendations:
${ats.recommendations.map((r) => `- ${r}`).join("\n")}`);
    }

    if (revisionContext.previousRecruiterReview) {
      const rec = revisionContext.previousRecruiterReview;
      parts.push(`### Previous Recruiter Review (Score: ${rec.score}/100, Passed: ${rec.passed})
Sub-scores: Readability ${rec.readabilityScore}, Credibility ${rec.credibilityScore}, Coherence ${rec.coherenceScore}, Evidence ${rec.evidenceScore}

Concerns:
${rec.concerns.map((c) => `- ${c}`).join("\n")}

Recommendations:
${rec.recommendations.map((r) => `- ${r}`).join("\n")}`);
    }

    if (parts.length > 0) {
      revisionSection = `

## REVISION CONTEXT
This is a revision attempt. The previous CV was reviewed and did NOT pass. You MUST address the specific feedback below. Focus on fixing the blocking issues while maintaining truthfulness.

${parts.join("\n\n")}

**IMPORTANT**: Address each recommendation and concern listed above. Incorporate missing keywords where truthfully possible. Fix any format flags. Do NOT ignore this feedback.`;
    }
  }

  const userPrompt = `Profil:
${JSON.stringify(profile.data)}

Offre:
${JSON.stringify({
  title: jobPost.title,
  company: jobPost.company,
  seniority: jobPost.seniority,
  location: jobPost.location,
  remoteMode: jobPost.remoteMode,
  employmentType: jobPost.employmentType,
  jobSummary: jobPost.jobSummary,
  responsibilities: jobPost.responsibilities,
  requirementsMustHave: jobPost.requirementsMustHave,
  requirementsNiceToHave: jobPost.requirementsNiceToHave,
  keywords: jobPost.keywords,
  tools: jobPost.tools,
  languages: jobPost.languages,
  yearsExperienceMin: jobPost.yearsExperienceMin ?? null,
})}

Regles:
${JSON.stringify({
  language,
  maxPages: maxPages ?? null,
  tone: tone ?? "professional",
  truthfulnessMode: truthfulnessMode ?? "strict",
})}
${revisionSection ? `\n\nRevision:\n${revisionSection}` : ""}

Retourne le JSON maintenant.`;

  const output = await chatCompletionJSON<CandidateAgentOutput>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.4,
  });

  const cvId = `cv_${randomUUID().slice(0, 8)}`;
  const identity = profile.data.identity;

  const cv: GeneratedCV = {
    id: cvId,
    profileId: profile.id,
    jobPostId: jobPost.id,
    version: 1,
    language,
    title: output.title || `${identity.name} - ${jobPost.title}`,
    header: {
      fullName: identity.name,
      headline: identity.headline,
      contact: {
        email: identity.email,
        phone: identity.phone,
        location: identity.location,
      },
      links: identity.links,
    },
    summary: output.summary || "",
    skillsHighlighted: toStringArray(output.skillsHighlighted),
    experiencesSelected: toExperienceSelectedArray(output.experiencesSelected),
    educationSelected: toStringArray(output.educationSelected),
    certificationsSelected: toStringArray(output.certificationsSelected),
    keywordsCovered: toStringArray(output.keywordsCovered),
    omittedItems: toStringArray(output.omittedItems),
    generationNotes: toStringArray(output.generationNotes),
    coverageMap: normalizeCoverageMap(output.coverageMap),
    selfCheck: normalizeSelfCheck(output.selfCheck),
  };

  return cv;
}
