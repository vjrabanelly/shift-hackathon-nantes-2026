export type JobStatus =
  | 'saved'
  | 'applying'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'rejected'
  | 'withdrawn'

export interface ResumeProfileLink {
  id: string
  label: string
  value: string
}

export interface ResumeExperienceItem {
  id: string
  role: string
  company: string
  location: string
  startDate: string
  endDate: string
  current: boolean
  description: string
  highlights: string[]
}

export interface ResumeEducationItem {
  id: string
  institution: string
  degree: string
  fieldOfStudy: string
  startDate: string
  endDate: string
  description: string
}

export interface ResumeProjectItem {
  id: string
  name: string
  role: string
  startDate: string
  endDate: string
  current: boolean
  description: string
  highlights: string[]
  link: string
}

export interface ResumeSkillItem {
  id: string
  name: string
  level: string
  details: string
}

export interface ResumeLanguageItem {
  id: string
  name: string
  proficiency: string
  certification: string
}

export interface ResumeAwardItem {
  id: string
  title: string
  issuer: string
  date: string
  description: string
}

export interface ResumeCertificationItem {
  id: string
  name: string
  issuer: string
  date: string
  expiresAt: string
  credentialId: string
}

export interface ResumePublicationItem {
  id: string
  title: string
  publisher: string
  date: string
  link: string
  description: string
}

export interface ResumeVolunteeringItem {
  id: string
  organization: string
  role: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

export interface ResumeReferenceItem {
  id: string
  name: string
  relationship: string
  company: string
  email: string
  phone: string
  notes: string
}

export interface ResumeSourceDocument {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  dataUrl: string
}

export interface ServerProfileExtras {
  profileId?: string
  targetRoles?: string[]
  constraints?: {
    preferredCvLanguage?: string
    maxCvPages?: number
    mustNotClaim?: string[]
  }
  experienceMap?: Record<
    string,
    {
      serverExperienceId: string
      achievements: Array<{ text: string; metric?: string; proofLevel?: string }>
      skillsUsed: string[]
    }
  >
  skillExtras?: Record<
    string,
    {
      category?: string
      years?: number
      evidenceRefs?: string[]
    }
  >
  identity?: {
    email: string
    phone?: string
  }
  createdAt?: string
  updatedAt?: string
}

export interface ResumeMaster {
  fullName: string
  title: string
  location: string
  summary: string
  profiles: ResumeProfileLink[]
  experience: ResumeExperienceItem[]
  education: ResumeEducationItem[]
  projects: ResumeProjectItem[]
  skills: ResumeSkillItem[]
  languages: ResumeLanguageItem[]
  interests: string[]
  awards: ResumeAwardItem[]
  certifications: ResumeCertificationItem[]
  publications: ResumePublicationItem[]
  volunteering: ResumeVolunteeringItem[]
  references: ResumeReferenceItem[]
  sourceDocument?: ResumeSourceDocument
  _serverExtras?: ServerProfileExtras
}

export interface CapturedJobOfferRawFields {
  title: string
  company: string
  location: string
  employment_type: string
  description: string
}

export interface CapturedJobOffer {
  source: 'linkedin'
  source_url: string
  captured_at: string
  html_snapshot_ref?: string
  raw_text: string
  raw_fields: CapturedJobOfferRawFields
  missing_fields?: Array<keyof CapturedJobOfferRawFields>
}

export interface GeneratedCvExperience {
  experience_id: string
  rewritten_bullets: string[]
}

export interface GeneratedCvEducation {
  school: string
  degree: string
  year: string
}

export interface GeneratedCvHeader {
  full_name: string
  headline: string
  contact: {
    email: string
    phone: string
  }
  links: Record<string, string>
}

export interface GeneratedCv {
  cv_id: string
  candidate_id: string
  job_id: string
  version: number
  language: 'fr' | 'en'
  title: string
  header: GeneratedCvHeader
  summary: string
  skills_highlighted: string[]
  experiences_selected: GeneratedCvExperience[]
  education_selected: GeneratedCvEducation[]
  certifications_selected: string[]
  keywords_covered: string[]
  omitted_items: string[]
  generation_notes: string[]
}

export interface ReviewAgreement {
  job_id: string
  cv_id: string
  cv_generation_ok: boolean
  ats_ok: boolean
  recruiter_ok: boolean
  review_agreement_ok: boolean
  final_status: 'FINAL_APPROVED' | 'REJECTED_FOR_REVIEW'
  rejection_reasons: string[]
  iteration_count: number
}

export interface AtsHardFilterStatus {
  filter: string
  status: 'pass' | 'fail' | 'partial'
  evidence: string
}

export interface AtsReview {
  review_id: string
  cv_id: string
  job_id: string
  score: number
  passed: boolean
  hard_filters_status: AtsHardFilterStatus[]
  matched_keywords: string[]
  missing_keywords: string[]
  format_flags: string[]
  recommendations: string[]
}

export interface RecruiterReview {
  review_id: string
  cv_id: string
  job_id: string
  score: number
  passed: boolean
  readability_score: number
  credibility_score: number
  coherence_score: number
  evidence_score: number
  strengths: string[]
  concerns: string[]
  recommendations: string[]
}

export interface ApplicationItem {
  id: string
  title: string
  company: string
  status: JobStatus
  appliedAt: string
  followUpAt: string
  interviewAt?: string
  matchScore: number
}

export interface InterviewPrepPack {
  companySnapshot: string
  likelyQuestions: string[]
  storiesToPrepare: string[]
  followUpDraft: string
}
