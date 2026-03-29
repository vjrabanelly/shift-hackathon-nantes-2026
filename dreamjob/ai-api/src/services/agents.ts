import { config } from "../config";
import {
  ATSReview,
  AddonResult,
  AtsAgentInput,
  AtsAgentOutput,
  CandidateAgentInput,
  CandidateAgentOutput,
  GeneratedCV,
  JobOfferNormalized,
  RecruiterAgentInput,
  RecruiterAgentOutput,
  RecruiterReview
} from "../types";
import { OpenAIJsonService } from "./openai-json-service";

export class AgentsService {
  constructor(private readonly openAiJsonService: OpenAIJsonService) {}

  async runCandidateAgent(
    input: CandidateAgentInput
  ): Promise<CandidateAgentOutput> {
    const result = await this.openAiJsonService.generateJson<CandidateAgentOutput>({
      model: config.models.candidate.model,
      reasoningEffort: config.models.candidate.reasoningEffort,
      instructions: `
Tu es l'agent Candidat dans un workflow de personnalisation de CV.
Construis un CV cible uniquement a partir du profil candidat fourni.
N'invente jamais d'experiences, de competences, de metriques, de diplomes ou de certifications.
Le contenu doit etre concis, credible et directement pertinent pour l'offre.
Tous les champs textuels generes doivent etre rediges en francais.
Le resume doit faire 2 a 3 phrases maximum.
Les listes "omitted_items" et "generation_notes" doivent contenir 3 elements maximum.
Chaque experience de "experiences_selected" doit contenir 3 bullets maximum, courtes et percutantes.
Conserve les cles JSON exactement telles que definies ci-dessous.
Renseigne le champ "language" avec la valeur "fr".
La sortie doit respecter exactement ce format JSON :
{
  "generated_cv": {
    "cv_id": "string",
    "candidate_id": "string",
    "job_id": "string",
    "version": 1,
    "language": "string",
    "title": "string",
    "header": {
      "full_name": "string",
      "headline": "string",
      "contact": { "email": "string", "phone": "string" },
      "links": {}
    },
    "summary": "string",
    "skills_highlighted": ["string"],
    "experiences_selected": [{ "experience_id": "string", "rewritten_bullets": ["string"] }],
    "education_selected": [],
    "certifications_selected": [],
    "keywords_covered": ["string"],
    "omitted_items": ["string"],
    "generation_notes": ["string"]
  },
  "coverage_map": {
    "matched_requirements": [{ "requirement": "string", "evidence_ref": "string" }],
    "uncovered_requirements": ["string"]
  },
  "self_check": {
    "unsupported_claims_found": false,
    "warnings": ["string"]
  }
}`.trim(),
      input
    });

    return {
      ...result,
      generated_cv: {
        ...result.generated_cv,
        experiences_selected: result.generated_cv.experiences_selected.map((experience) => ({
          ...experience,
          rewritten_bullets: limitItems(experience.rewritten_bullets, 3)
        })),
        omitted_items: limitItems(result.generated_cv.omitted_items, 3),
        generation_notes: limitItems(result.generated_cv.generation_notes, 3)
      },
      self_check: {
        ...result.self_check,
        warnings: limitItems(result.self_check.warnings, 3)
      }
    };
  }

  async runAtsAgent(input: AtsAgentInput): Promise<AtsAgentOutput> {
    const result = await this.openAiJsonService.generateJson<AtsAgentOutput>({
      model: config.models.ats.model,
      reasoningEffort: config.models.ats.reasoningEffort,
      instructions: `
Tu es l'agent d'evaluation ATS.
Analyse le CV genere par rapport a l'offre normalisee.
Concentre-toi sur la couverture des mots-cles, les filtres bloquants et la structure.
Tous les champs textuels generes doivent etre rediges en francais.
Si certains mots-cles de l'offre sont en anglais, tu peux les conserver tels quels dans les listes de mots-cles.
Les listes "format_flags", "recommendations" et "blocking_issues" doivent contenir 3 phrases maximum.
Les phrases doivent etre courtes, concretes et sans repetition.
Conserve les cles JSON exactement telles que definies ci-dessous.
La sortie doit respecter exactement ce format JSON :
{
  "ats_review": {
    "review_id": "string",
    "cv_id": "string",
    "job_id": "string",
    "score": 0,
    "passed": true,
    "hard_filters_status": [{ "filter": "string", "status": "pass", "evidence": "string" }],
    "matched_keywords": ["string"],
    "missing_keywords": ["string"],
    "format_flags": ["string"],
    "recommendations": ["string"]
  },
  "decision": {
    "status": "pass",
    "blocking_issues": ["string"]
  }
}`.trim(),
      input
    });

    return {
      ...result,
      ats_review: {
        ...result.ats_review,
        format_flags: limitItems(result.ats_review.format_flags, 3),
        recommendations: limitItems(result.ats_review.recommendations, 3)
      },
      decision: {
        ...result.decision,
        blocking_issues: limitItems(result.decision.blocking_issues, 3)
      }
    };
  }

  async runRecruiterAgent(
    input: RecruiterAgentInput
  ): Promise<RecruiterAgentOutput> {
    const result = await this.openAiJsonService.generateJson<RecruiterAgentOutput>({
      model: config.models.recruiter.model,
      reasoningEffort: config.models.recruiter.reasoningEffort,
      instructions: `
Tu es l'agent d'evaluation Recruteur.
Analyse le CV genere selon sa lisibilite, sa credibilite, sa coherence et le niveau de preuve.
Tous les champs textuels generes doivent etre rediges en francais.
Les listes "strengths", "concerns", "recommendations" et "blocking_issues" doivent contenir 3 phrases maximum.
Chaque phrase doit etre synthetique, concrete et actionnable.
Conserve les cles JSON exactement telles que definies ci-dessous.
La sortie doit respecter exactement ce format JSON :
{
  "recruiter_review": {
    "review_id": "string",
    "cv_id": "string",
    "job_id": "string",
    "score": 0,
    "passed": true,
    "readability_score": 0,
    "credibility_score": 0,
    "coherence_score": 0,
    "evidence_score": 0,
    "strengths": ["string"],
    "concerns": ["string"],
    "recommendations": ["string"]
  },
  "decision": {
    "status": "pass",
    "blocking_issues": ["string"]
  }
}`.trim(),
      input
    });

    return {
      ...result,
      recruiter_review: {
        ...result.recruiter_review,
        strengths: limitItems(result.recruiter_review.strengths, 3),
        concerns: limitItems(result.recruiter_review.concerns, 3),
        recommendations: limitItems(result.recruiter_review.recommendations, 3)
      },
      decision: {
        ...result.decision,
        blocking_issues: limitItems(result.decision.blocking_issues, 3)
      }
    };
  }

  buildAddonResult(
    jobOffer: JobOfferNormalized,
    generatedCv: GeneratedCV,
    atsReview: ATSReview,
    recruiterReview: RecruiterReview,
    accepted: boolean
  ): AddonResult {
    const strengths = limitItems(
      uniqueStrings([
      atsReview.matched_keywords.length > 0
        ? `Bonne couverture des mots-cles : ${atsReview.matched_keywords
            .slice(0, 5)
            .join(", ")}`
        : "",
      ...recruiterReview.strengths
      ]),
      3
    );
    const weaknesses = limitItems(
      uniqueStrings([
      ...atsReview.missing_keywords.map((keyword) => `Mot-cle manquant : ${keyword}`),
      ...recruiterReview.concerns
      ]),
      3
    );
    const recommendations = limitItems(
      uniqueStrings([
      ...atsReview.recommendations,
      ...recruiterReview.recommendations
      ]),
      3
    );

    return {
      job_id: jobOffer.job_id,
      cv_id: generatedCv.cv_id,
      status: accepted ? "accepted" : "rejected",
      overall_score: Math.round((atsReview.score + recruiterReview.score) / 2),
      scores: {
        ats_score: atsReview.score,
        recruiter_score: recruiterReview.score
      },
      strengths,
      weaknesses,
      recommendations,
      returned_at: new Date().toISOString()
    };
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function limitItems(values: string[], maxItems: number): string[] {
  return uniqueStrings(values).slice(0, maxItems);
}
