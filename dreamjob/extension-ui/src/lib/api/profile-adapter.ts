import type {
  ResumeMaster,
  ResumeProfileLink,
  ResumeExperienceItem,
  ResumeEducationItem,
  ResumeProjectItem,
  ResumeSkillItem,
  ResumeLanguageItem,
  ResumeCertificationItem,
  ResumeReferenceItem,
  ServerProfileExtras,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Server-side types (mirrors server schemas — extension-local definitions)
// ---------------------------------------------------------------------------

export interface ServerIdentity {
  name: string
  headline: string
  email: string
  phone?: string
  location?: string
  links?: { linkedin?: string; portfolio?: string; github?: string }
}

export interface ServerAchievement {
  text: string
  metric?: string
  proofLevel?: string
}

export interface ServerExperience {
  experienceId: string
  title: string
  company: string
  location?: string
  startDate: string
  endDate?: string
  description?: string
  achievements: ServerAchievement[]
  skillsUsed: string[]
}

export interface ServerEducation {
  school: string
  degree: string
  field?: string
  year?: number
}

export interface ServerSkill {
  name: string
  category?: string
  level?: string
  years?: number
  evidenceRefs?: string[]
}

export interface ServerCertification {
  name: string
  issuer?: string
  date?: string
}

export interface ServerLanguage {
  name: string
  level?: string
}

export interface ServerProject {
  name: string
  description?: string
  url?: string
  technologies?: string[]
}

export interface ServerReference {
  name: string
  title?: string
  company?: string
  email?: string
  phone?: string
  relationship?: string
}

export interface ServerConstraints {
  preferredCvLanguage?: string
  maxCvPages?: number
  mustNotClaim?: string[]
}

export interface ServerProfileData {
  identity: ServerIdentity
  targetRoles: string[]
  professionalSummaryMaster?: string
  experiences: ServerExperience[]
  education: ServerEducation[]
  skills: ServerSkill[]
  certifications?: ServerCertification[]
  languages?: ServerLanguage[]
  projects?: ServerProject[]
  references?: ServerReference[]
  constraints?: ServerConstraints
}

export interface ServerProfile {
  id: string
  data: ServerProfileData
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function linksToProfiles(
  links?: { linkedin?: string; portfolio?: string; github?: string },
  email?: string,
  phone?: string,
): ResumeProfileLink[] {
  const profiles: ResumeProfileLink[] = []
  if (links?.linkedin) profiles.push({ id: createId('link'), label: 'LinkedIn', value: links.linkedin })
  if (links?.portfolio) profiles.push({ id: createId('link'), label: 'Portfolio', value: links.portfolio })
  if (links?.github) profiles.push({ id: createId('link'), label: 'GitHub', value: links.github })
  if (email) profiles.push({ id: createId('link'), label: 'Email', value: email })
  if (phone) profiles.push({ id: createId('link'), label: 'Phone', value: phone })
  return profiles
}

function mapServerExperiences(
  experiences: ServerExperience[],
): { items: ResumeExperienceItem[]; experienceMap: NonNullable<ServerProfileExtras['experienceMap']> } {
  const items: ResumeExperienceItem[] = []
  const experienceMap: NonNullable<ServerProfileExtras['experienceMap']> = {}

  for (const exp of experiences) {
    const id = createId('exp')
    items.push({
      id,
      role: exp.title,
      company: exp.company,
      location: exp.location ?? '',
      startDate: exp.startDate,
      endDate: exp.endDate ?? '',
      current: !exp.endDate,
      description: exp.description ?? '',
      highlights: exp.achievements.map((a) => a.text),
    })
    experienceMap[id] = {
      serverExperienceId: exp.experienceId,
      achievements: exp.achievements,
      skillsUsed: exp.skillsUsed,
    }
  }

  return { items, experienceMap }
}

function mapServerEducation(education: ServerEducation[]): ResumeEducationItem[] {
  return education.map((edu) => ({
    id: createId('edu'),
    institution: edu.school,
    degree: edu.degree,
    fieldOfStudy: edu.field ?? '',
    startDate: '',
    endDate: edu.year ? String(edu.year) : '',
    description: '',
  }))
}

function mapServerSkills(
  skills: ServerSkill[],
): { items: ResumeSkillItem[]; skillExtras: NonNullable<ServerProfileExtras['skillExtras']> } {
  const items: ResumeSkillItem[] = []
  const skillExtras: NonNullable<ServerProfileExtras['skillExtras']> = {}

  for (const s of skills) {
    const id = createId('skill')
    items.push({
      id,
      name: s.name,
      level: s.level ?? '',
      details: s.category ?? '',
    })
    if (s.category || s.years || s.evidenceRefs?.length) {
      skillExtras[id] = {
        category: s.category,
        years: s.years,
        evidenceRefs: s.evidenceRefs,
      }
    }
  }

  return { items, skillExtras }
}

function mapServerLanguages(languages?: ServerLanguage[]): ResumeLanguageItem[] {
  return (languages ?? []).map((l) => ({
    id: createId('lang'),
    name: l.name,
    proficiency: l.level ?? '',
    certification: '',
  }))
}

function mapServerProjects(projects?: ServerProject[]): ResumeProjectItem[] {
  return (projects ?? []).map((p) => ({
    id: createId('proj'),
    name: p.name,
    role: '',
    startDate: '',
    endDate: '',
    current: false,
    description: p.description ?? '',
    highlights: p.technologies ?? [],
    link: p.url ?? '',
  }))
}

function mapServerCertifications(certifications?: ServerCertification[]): ResumeCertificationItem[] {
  return (certifications ?? []).map((c) => ({
    id: createId('cert'),
    name: c.name,
    issuer: c.issuer ?? '',
    date: c.date ?? '',
    expiresAt: '',
    credentialId: '',
  }))
}

function mapServerReferences(references?: ServerReference[]): ResumeReferenceItem[] {
  return (references ?? []).map((r) => ({
    id: createId('ref'),
    name: r.name,
    relationship: r.relationship ?? '',
    company: r.company ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    notes: '',
  }))
}

// ---------------------------------------------------------------------------
// Server Profile -> ResumeMaster
// ---------------------------------------------------------------------------

export function serverProfileToResumeMaster(profile: ServerProfile): ResumeMaster {
  const { data } = profile
  const { items: experience, experienceMap } = mapServerExperiences(data.experiences)
  const { items: skills, skillExtras } = mapServerSkills(data.skills)

  return {
    fullName: data.identity.name,
    title: data.identity.headline,
    location: data.identity.location ?? '',
    summary: data.professionalSummaryMaster ?? '',
    profiles: linksToProfiles(data.identity.links, data.identity.email, data.identity.phone),
    experience,
    education: mapServerEducation(data.education),
    projects: mapServerProjects(data.projects),
    skills,
    languages: mapServerLanguages(data.languages),
    interests: [],
    awards: [],
    certifications: mapServerCertifications(data.certifications),
    publications: [],
    volunteering: [],
    references: mapServerReferences(data.references),
    _serverExtras: {
      profileId: profile.id,
      targetRoles: data.targetRoles,
      constraints: data.constraints,
      experienceMap,
      skillExtras: Object.keys(skillExtras).length > 0 ? skillExtras : undefined,
      identity: {
        email: data.identity.email,
        phone: data.identity.phone,
      },
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  }
}

// ---------------------------------------------------------------------------
// ResumeMaster -> Server Profile (for PUT /api/profile)
// ---------------------------------------------------------------------------

export function resumeMasterToServerProfile(master: ResumeMaster): { data: ServerProfileData } {
  const extras = master._serverExtras

  // Extract email/phone from profiles array or serverExtras
  const emailProfile = master.profiles.find((p) => p.label === 'Email')
  const phoneProfile = master.profiles.find((p) => p.label === 'Phone')
  const email = emailProfile?.value ?? extras?.identity?.email ?? ''
  const phone = phoneProfile?.value ?? extras?.identity?.phone

  // Extract links from profiles array
  const linkedinProfile = master.profiles.find((p) => p.label === 'LinkedIn')
  const portfolioProfile = master.profiles.find((p) => p.label === 'Portfolio')
  const githubProfile = master.profiles.find((p) => p.label === 'GitHub')
  const links =
    linkedinProfile || portfolioProfile || githubProfile
      ? {
          linkedin: linkedinProfile?.value,
          portfolio: portfolioProfile?.value,
          github: githubProfile?.value,
        }
      : undefined

  const experiences: ServerExperience[] = master.experience.map((exp) => {
    const mapped = extras?.experienceMap?.[exp.id]
    return {
      experienceId: mapped?.serverExperienceId ?? exp.id,
      title: exp.role,
      company: exp.company,
      location: exp.location || undefined,
      startDate: exp.startDate,
      endDate: exp.current ? undefined : exp.endDate || undefined,
      description: exp.description || undefined,
      achievements: mapped?.achievements ?? exp.highlights.map((text) => ({ text })),
      skillsUsed: mapped?.skillsUsed ?? [],
    }
  })

  const skills: ServerSkill[] = master.skills.map((s) => {
    const extra = extras?.skillExtras?.[s.id]
    return {
      name: s.name,
      category: extra?.category ?? (s.details || undefined),
      level: s.level || undefined,
      years: extra?.years,
      evidenceRefs: extra?.evidenceRefs,
    }
  })

  const education: ServerEducation[] = master.education.map((edu) => ({
    school: edu.institution,
    degree: edu.degree,
    field: edu.fieldOfStudy || undefined,
    year: edu.endDate ? parseInt(edu.endDate, 10) || undefined : undefined,
  }))

  const certifications: ServerCertification[] | undefined =
    master.certifications.length > 0
      ? master.certifications.map((c) => ({
          name: c.name,
          issuer: c.issuer || undefined,
          date: c.date || undefined,
        }))
      : undefined

  const languages: ServerLanguage[] | undefined =
    master.languages.length > 0
      ? master.languages.map((l) => ({
          name: l.name,
          level: l.proficiency || undefined,
        }))
      : undefined

  const projects: ServerProject[] | undefined =
    master.projects.length > 0
      ? master.projects.map((p) => ({
          name: p.name,
          description: p.description || undefined,
          url: p.link || undefined,
          technologies: p.highlights.length > 0 ? p.highlights : undefined,
        }))
      : undefined

  const references: ServerReference[] | undefined =
    master.references.length > 0
      ? master.references.map((r) => ({
          name: r.name,
          company: r.company || undefined,
          email: r.email || undefined,
          phone: r.phone || undefined,
          relationship: r.relationship || undefined,
        }))
      : undefined

  return {
    data: {
      identity: {
        name: master.fullName,
        headline: master.title,
        email,
        phone: phone || undefined,
        location: master.location || undefined,
        links,
      },
      targetRoles: extras?.targetRoles ?? [],
      professionalSummaryMaster: master.summary || undefined,
      experiences,
      education,
      skills,
      certifications,
      languages,
      projects,
      references,
      constraints: extras?.constraints,
    },
  }
}

// ---------------------------------------------------------------------------
// Extraction response -> ResumeMaster (replaces inline mapExtractionToResumeMaster)
// ---------------------------------------------------------------------------

export function extractionToResumeMaster(
  data: ServerProfileData,
  existing?: ResumeMaster,
): ResumeMaster {
  const { items: experience, experienceMap } = mapServerExperiences(data.experiences)
  const { items: skills, skillExtras } = mapServerSkills(data.skills)

  return {
    fullName: data.identity.name,
    title: data.identity.headline,
    location: data.identity.location ?? '',
    summary: data.professionalSummaryMaster ?? '',
    profiles: linksToProfiles(data.identity.links, data.identity.email, data.identity.phone),
    experience,
    education: mapServerEducation(data.education),
    projects: mapServerProjects(data.projects),
    skills,
    languages: mapServerLanguages(data.languages),
    // Preserve extension-only fields from existing master
    interests: existing?.interests ?? [],
    awards: existing?.awards ?? [],
    certifications: mapServerCertifications(data.certifications),
    publications: existing?.publications ?? [],
    volunteering: existing?.volunteering ?? [],
    references: mapServerReferences(data.references),
    sourceDocument: existing?.sourceDocument,
    _serverExtras: {
      targetRoles: data.targetRoles,
      constraints: data.constraints,
      experienceMap,
      skillExtras: Object.keys(skillExtras).length > 0 ? skillExtras : undefined,
      identity: {
        email: data.identity.email,
        phone: data.identity.phone,
      },
    },
  }
}
