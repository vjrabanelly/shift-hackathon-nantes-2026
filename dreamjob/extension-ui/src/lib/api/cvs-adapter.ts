import type {
  GeneratedCv,
  GeneratedCvEducation,
  GeneratedCvExperience,
  GeneratedCvHeader,
  AtsReview,
  AtsHardFilterStatus,
  RecruiterReview,
  ReviewAgreement,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Server-side types (mirrors server schemas — extension-local definitions)
// ---------------------------------------------------------------------------

export interface ServerCvHeader {
  fullName: string
  headline: string
  contact: { email: string; phone?: string; location?: string }
  links?: { linkedin?: string; portfolio?: string; github?: string }
}

export interface ServerExperienceSelected {
  experienceId: string
  rewrittenBullets: string[]
}

export interface ServerGeneratedCV {
  id: string
  profileId: string
  jobPostId: string
  version: number
  language: string
  title: string
  header: ServerCvHeader
  summary: string
  skillsHighlighted: string[]
  experiencesSelected: ServerExperienceSelected[]
  educationSelected: string[]
  certificationsSelected: string[]
  keywordsCovered: string[]
  omittedItems: string[]
  generationNotes: string[]
  coverageMap?: unknown
  selfCheck?: unknown
}

export interface ServerHardFilterStatus {
  filter: string
  status: 'pass' | 'fail' | 'unknown'
  evidence: string
}

export interface ServerATSReview {
  id: string
  cvId: string
  jobPostId: string
  score: number
  passed: boolean
  hardFiltersStatus: ServerHardFilterStatus[]
  matchedKeywords: string[]
  missingKeywords: string[]
  formatFlags: string[]
  recommendations: string[]
}

export interface ServerRecruiterReview {
  id: string
  cvId: string
  jobPostId: string
  score: number
  passed: boolean
  readabilityScore: number
  credibilityScore: number
  coherenceScore: number
  evidenceScore: number
  strengths: string[]
  concerns: string[]
  recommendations: string[]
}

export interface ServerReviewAgreement {
  id: string
  jobPostId: string
  cvId: string
  cvGenerationOk: boolean
  atsOk: boolean
  recruiterOk: boolean
  reviewAgreementOk: boolean
  finalStatus: 'FINAL_APPROVED' | 'REJECTED' | 'NEEDS_REVISION'
  rejectionReasons: string[]
  iterationCount: number
}

export interface ServerOrchestratorResult {
  cv: ServerGeneratedCV
  atsReview: ServerATSReview
  recruiterReview: ServerRecruiterReview
  reviewAgreement: ServerReviewAgreement
  addonResult?: unknown
}

// ---------------------------------------------------------------------------
// Mapping: ServerGeneratedCV -> GeneratedCv
// ---------------------------------------------------------------------------

function parseEducationString(str: string): GeneratedCvEducation {
  // Try "School — Degree (Year)" or "Degree, School, Year" patterns
  const dashMatch = str.match(/^(.+?)\s*[—–-]\s*(.+?)(?:\s*\((\d{4})\))?$/)
  if (dashMatch) {
    return {
      school: dashMatch[1].trim(),
      degree: dashMatch[2].trim(),
      year: dashMatch[3]?.trim() ?? '',
    }
  }

  const commaMatch = str.match(/^(.+?),\s*(.+?)(?:,\s*(\d{4}))?$/)
  if (commaMatch) {
    return {
      school: commaMatch[2].trim(),
      degree: commaMatch[1].trim(),
      year: commaMatch[3]?.trim() ?? '',
    }
  }

  return { school: str, degree: '', year: '' }
}

export function serverCvToGeneratedCv(cv: ServerGeneratedCV): GeneratedCv {
  const header: GeneratedCvHeader = {
    full_name: cv.header.fullName,
    headline: cv.header.headline,
    contact: {
      email: cv.header.contact.email,
      phone: cv.header.contact.phone ?? '',
    },
    links: {},
  }

  if (cv.header.links) {
    const links: Record<string, string> = {}
    if (cv.header.links.linkedin) links.linkedin = cv.header.links.linkedin
    if (cv.header.links.portfolio) links.portfolio = cv.header.links.portfolio
    if (cv.header.links.github) links.github = cv.header.links.github
    header.links = links
  }

  const experiences_selected: GeneratedCvExperience[] = cv.experiencesSelected.map((exp) => ({
    experience_id: exp.experienceId,
    rewritten_bullets: exp.rewrittenBullets,
  }))

  const education_selected: GeneratedCvEducation[] = cv.educationSelected.map(parseEducationString)

  return {
    cv_id: cv.id,
    candidate_id: cv.profileId,
    job_id: cv.jobPostId,
    version: cv.version,
    language: cv.language as 'fr' | 'en',
    title: cv.title,
    header,
    summary: cv.summary,
    skills_highlighted: cv.skillsHighlighted,
    experiences_selected,
    education_selected,
    certifications_selected: cv.certificationsSelected,
    keywords_covered: cv.keywordsCovered,
    omitted_items: cv.omittedItems,
    generation_notes: cv.generationNotes,
  }
}

// ---------------------------------------------------------------------------
// Mapping: ServerATSReview -> AtsReview
// ---------------------------------------------------------------------------

export function serverAtsToAtsReview(review: ServerATSReview): AtsReview {
  const hard_filters_status: AtsHardFilterStatus[] = review.hardFiltersStatus.map((f) => ({
    filter: f.filter,
    status: f.status === 'unknown' ? 'partial' : f.status,
    evidence: f.evidence,
  }))

  return {
    review_id: review.id,
    cv_id: review.cvId,
    job_id: review.jobPostId,
    score: review.score,
    passed: review.passed,
    hard_filters_status,
    matched_keywords: review.matchedKeywords,
    missing_keywords: review.missingKeywords,
    format_flags: review.formatFlags,
    recommendations: review.recommendations,
  }
}

// ---------------------------------------------------------------------------
// Mapping: ServerRecruiterReview -> RecruiterReview
// ---------------------------------------------------------------------------

export function serverRecruiterToRecruiterReview(review: ServerRecruiterReview): RecruiterReview {
  return {
    review_id: review.id,
    cv_id: review.cvId,
    job_id: review.jobPostId,
    score: review.score,
    passed: review.passed,
    readability_score: review.readabilityScore,
    credibility_score: review.credibilityScore,
    coherence_score: review.coherenceScore,
    evidence_score: review.evidenceScore,
    strengths: review.strengths,
    concerns: review.concerns,
    recommendations: review.recommendations,
  }
}

// ---------------------------------------------------------------------------
// Mapping: ServerReviewAgreement -> ReviewAgreement
// ---------------------------------------------------------------------------

export function serverAgreementToReviewAgreement(agreement: ServerReviewAgreement): ReviewAgreement {
  const final_status: ReviewAgreement['final_status'] =
    agreement.finalStatus === 'FINAL_APPROVED' ? 'FINAL_APPROVED' : 'REJECTED_FOR_REVIEW'

  return {
    job_id: agreement.jobPostId,
    cv_id: agreement.cvId,
    cv_generation_ok: agreement.cvGenerationOk,
    ats_ok: agreement.atsOk,
    recruiter_ok: agreement.recruiterOk,
    review_agreement_ok: agreement.reviewAgreementOk,
    final_status,
    rejection_reasons: agreement.rejectionReasons,
    iteration_count: agreement.iterationCount,
  }
}

// ---------------------------------------------------------------------------
// Combined: ServerOrchestratorResult -> extension types
// ---------------------------------------------------------------------------

export interface CvGenerationResult {
  cv: GeneratedCv
  atsReview: AtsReview
  recruiterReview: RecruiterReview
  reviewAgreement: ReviewAgreement
}

export function serverOrchestratorToExtension(result: ServerOrchestratorResult): CvGenerationResult {
  return {
    cv: serverCvToGeneratedCv(result.cv),
    atsReview: serverAtsToAtsReview(result.atsReview),
    recruiterReview: serverRecruiterToRecruiterReview(result.recruiterReview),
    reviewAgreement: serverAgreementToReviewAgreement(result.reviewAgreement),
  }
}
