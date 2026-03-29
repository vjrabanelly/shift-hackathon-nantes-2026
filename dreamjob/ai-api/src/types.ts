export interface JobOfferRaw {
  source: string;
  source_url: string;
  captured_at?: string;
  html_snapshot_ref?: string;
  raw_text: string;
  raw_fields?: Record<string, string>;
}

export interface JobOfferNormalized {
  job_id: string;
  source: string;
  source_url: string;
  title: string;
  company: string;
  location: string;
  remote_mode: string;
  employment_type: string;
  seniority: string;
  job_summary: string;
  responsibilities: string[];
  requirements_must_have: string[];
  requirements_nice_to_have: string[];
  keywords: string[];
  tools: string[];
  languages: string[];
  years_experience_min: number;
}

export interface CandidateSkill {
  name: string;
  category: string;
  level: string;
  years: number;
  evidence_refs: string[];
}

export interface CandidateAchievement {
  text: string;
  metric?: string;
  proof_level: string;
}

export interface CandidateExperience {
  experience_id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  summary: string;
  achievements: CandidateAchievement[];
  skills_used: string[];
}

export interface CandidateEducation {
  school: string;
  degree: string;
  year: string;
}

export interface CandidateLanguage {
  name: string;
  level: string;
}

export interface CandidateMasterProfile {
  candidate_id: string;
  identity: {
    full_name: string;
    headline: string;
    email: string;
    phone: string;
    location: string;
    links: Record<string, string>;
  };
  target_roles: string[];
  professional_summary_master: string;
  skills: CandidateSkill[];
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  certifications: string[];
  languages: CandidateLanguage[];
  constraints: {
    must_not_claim: string[];
    preferred_cv_language: string;
    max_cv_pages: number;
  };
  free_text_notes?: string;
}

export interface GeneratedCvExperience {
  experience_id: string;
  rewritten_bullets: string[];
}

export interface GeneratedCV {
  cv_id: string;
  candidate_id: string;
  job_id: string;
  version: number;
  language: string;
  title: string;
  header: {
    full_name: string;
    headline: string;
    contact: {
      email: string;
      phone: string;
    };
    links: Record<string, string>;
  };
  summary: string;
  skills_highlighted: string[];
  experiences_selected: GeneratedCvExperience[];
  education_selected: CandidateEducation[];
  certifications_selected: string[];
  keywords_covered: string[];
  omitted_items: string[];
  generation_notes: string[];
}

export interface AtsHardFilterStatus {
  filter: string;
  status: "pass" | "fail";
  evidence: string;
}

export interface ATSReview {
  review_id: string;
  cv_id: string;
  job_id: string;
  score: number;
  passed: boolean;
  hard_filters_status: AtsHardFilterStatus[];
  matched_keywords: string[];
  missing_keywords: string[];
  format_flags: string[];
  recommendations: string[];
}

export interface RecruiterReview {
  review_id: string;
  cv_id: string;
  job_id: string;
  score: number;
  passed: boolean;
  readability_score: number;
  credibility_score: number;
  coherence_score: number;
  evidence_score: number;
  strengths: string[];
  concerns: string[];
  recommendations: string[];
}

export interface ReviewAgreement {
  job_id: string;
  cv_id: string;
  cv_generation_ok: boolean;
  ats_ok: boolean;
  recruiter_ok: boolean;
  review_agreement_ok: boolean;
  final_status: "FINAL_APPROVED" | "REJECTED_FOR_REVIEW";
  rejection_reasons: string[];
  iteration_count: number;
}

export interface AddonResult {
  job_id: string;
  cv_id: string;
  status: "accepted" | "rejected";
  overall_score: number;
  scores: {
    ats_score: number;
    recruiter_score: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  returned_at: string;
}

export interface CandidateAgentInput {
  jobOffer: JobOfferNormalized;
  candidateMasterProfile: CandidateMasterProfile;
  generationRules?: {
    language?: string;
    max_pages?: number;
    tone?: string;
    truthfulness_mode?: string;
  };
  revisionContext?: {
    previous_ats_review?: ATSReview;
    previous_recruiter_review?: RecruiterReview;
  };
}

export interface CandidateAgentOutput {
  generated_cv: GeneratedCV;
  coverage_map: {
    matched_requirements: Array<{
      requirement: string;
      evidence_ref: string;
    }>;
    uncovered_requirements: string[];
  };
  self_check: {
    unsupported_claims_found: boolean;
    warnings: string[];
  };
}

export interface AtsAgentInput {
  jobOffer: JobOfferNormalized;
  generatedCv: GeneratedCV;
  scoringRules?: {
    passing_score?: number;
    weight_keywords?: number;
    weight_hard_filters?: number;
    weight_structure?: number;
  };
}

export interface AtsAgentOutput {
  ats_review: ATSReview;
  decision: {
    status: "pass" | "fail";
    blocking_issues: string[];
  };
}

export interface RecruiterAgentInput {
  jobOffer: JobOfferNormalized;
  generatedCv: GeneratedCV;
  reviewRules?: {
    passing_score?: number;
    weight_readability?: number;
    weight_credibility?: number;
    weight_evidence?: number;
    weight_coherence?: number;
  };
}

export interface RecruiterAgentOutput {
  recruiter_review: RecruiterReview;
  decision: {
    status: "pass" | "fail";
    blocking_issues: string[];
  };
}

export interface WorkflowRunInput {
  jobOfferRaw: JobOfferRaw;
  candidateId?: string;
  candidateMasterProfile?: CandidateMasterProfile;
}

export interface WorkflowRunResult {
  status: "FINAL_APPROVED" | "REJECTED_FOR_REVIEW";
  job_offer: JobOfferNormalized;
  generated_cv: GeneratedCV;
  ats_review: ATSReview;
  recruiter_review: RecruiterReview;
  review_agreement: ReviewAgreement;
  addon_result: AddonResult;
  iterations: number;
}

export interface CandidateFileStore {
  candidates: CandidateMasterProfile[];
}
