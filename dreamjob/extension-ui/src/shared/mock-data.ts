import type {
  ApplicationItem,
  AtsReview,
  CapturedJobOffer,
  GeneratedCv,
  InterviewPrepPack,
  RecruiterReview,
  ReviewAgreement,
  ResumeMaster,
} from './types'

export const mockResumeMaster: ResumeMaster = {
  fullName: 'Camille Martin',
  title: 'Product-focused frontend engineer',
  location: 'Nantes, France',
  summary:
    'Product-minded builder with experience designing user-facing tools, structuring messy information, and shipping fast under delivery constraints.',
  profiles: [
    { id: 'profile-1', label: 'Email', value: 'camille.martin@example.com' },
    { id: 'profile-2', label: 'Phone', value: '+33 6 12 34 56 78' },
    { id: 'profile-3', label: 'LinkedIn', value: 'https://www.linkedin.com/in/camillemartin' },
  ],
  experience: [
    {
      id: 'exp-1',
      role: 'Frontend Engineer',
      company: 'Shift Labs',
      location: 'Nantes, France',
      startDate: '2023-02',
      endDate: '',
      current: true,
      description: 'Built internal tools and prototypes for recruiting and operations teams.',
      highlights: [
        'Created browser-based workflows that reduced repetitive manual work.',
        'Worked with design and product stakeholders to deliver trust-focused interfaces.',
      ],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Université de Nantes',
      degree: 'Master',
      fieldOfStudy: 'Human-Computer Interaction',
      startDate: '2019-09',
      endDate: '2021-06',
      description: 'Focused on interface design, usability testing, and digital product methods.',
    },
  ],
  projects: [
    {
      id: 'proj-1',
      name: 'DreamJob prototype',
      role: 'Frontend lead',
      startDate: '2026-03',
      endDate: '',
      current: true,
      description: 'Hackathon prototype for building a source-of-truth resume and job application workflow.',
      highlights: ['Structured the sidepanel UX and reusable section system.'],
      link: '',
    },
  ],
  skills: [
    { id: 'skill-1', name: 'React', level: 'Advanced', details: 'Production UI and state management' },
    { id: 'skill-2', name: 'TypeScript', level: 'Advanced', details: 'Typed frontend architecture' },
    { id: 'skill-3', name: 'UX design', level: 'Strong', details: 'Flows, wireframes, and product thinking' },
  ],
  languages: [
    { id: 'lang-1', name: 'French', proficiency: 'Native', certification: '' },
    { id: 'lang-2', name: 'English', proficiency: 'Professional working proficiency', certification: 'TOEIC 930' },
  ],
  interests: ['Digital products', 'Career tools', 'Accessibility', 'Visual storytelling'],
  awards: [
    {
      id: 'award-1',
      title: 'Hackathon finalist',
      issuer: 'Nantes Product Sprint',
      date: '2025-11',
      description: 'Recognized for a workflow automation concept.',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'Google UX Design Certificate',
      issuer: 'Google',
      date: '2022-05',
      expiresAt: '',
      credentialId: '',
    },
  ],
  publications: [
    {
      id: 'pub-1',
      title: 'Designing Trust In AI-assisted Workflows',
      publisher: 'Local Product Meetup',
      date: '2024-10',
      link: '',
      description: 'Short talk and written summary on trustworthy product patterns.',
    },
  ],
  volunteering: [
    {
      id: 'vol-1',
      organization: 'Code Club Nantes',
      role: 'Mentor',
      startDate: '2022-09',
      endDate: '',
      current: true,
      description: 'Mentored students on web basics and project presentation.',
    },
  ],
  references: [
    {
      id: 'ref-1',
      name: 'Elise Bernard',
      relationship: 'Former manager',
      company: 'Shift Labs',
      email: 'elise.bernard@example.com',
      phone: '',
      notes: 'Can speak about product delivery and collaboration.',
    },
  ],
}

export const mockCapturedJob: CapturedJobOffer = {
  source: 'linkedin',
  source_url: 'https://linkedin.com/jobs/view/456',
  captured_at: '2026-03-28T10:00:00.000Z',
  html_snapshot_ref: 'mock-linkedin-job-456',
  raw_text:
    'Product Designer senior Entreprise : NovaTech Recherche 5 ans d experience minimum, maitrise de Figma, design systems, collaboration avec les equipes produit et engineering, animation d ateliers, bonne communication avec les parties prenantes.',
  raw_fields: {
    title: 'Product Designer senior',
    company: 'NovaTech',
    location: 'Paris',
    employment_type: 'full_time',
    description:
      'Recherche 5 ans d experience minimum, maitrise de Figma, design systems, collaboration avec les equipes produit et engineering, animation d ateliers, bonne communication avec les parties prenantes.',
  },
  missing_fields: [],
}

export const mockApplications: ApplicationItem[] = [
  {
    id: 'app-1',
    title: 'Frontend Developer',
    company: 'Shift Labs',
    status: 'applied',
    appliedAt: '2026-03-28',
    followUpAt: '2026-04-01',
    matchScore: 88,
  },
  {
    id: 'app-2',
    title: 'Product Engineer',
    company: 'Atlantic Product',
    status: 'interviewing',
    appliedAt: '2026-03-24',
    followUpAt: '2026-03-31',
    interviewAt: '2026-04-02T13:30:00.000Z',
    matchScore: 79,
  },
  {
    id: 'app-3',
    title: 'UX Researcher',
    company: 'North Studio',
    status: 'saved',
    appliedAt: '2026-03-27',
    followUpAt: '',
    matchScore: 0,
  },
  {
    id: 'app-4',
    title: 'Design Systems Lead',
    company: 'Pixel Foundry',
    status: 'offered',
    appliedAt: '2026-03-18',
    followUpAt: '2026-03-30',
    matchScore: 91,
  },
  {
    id: 'app-5',
    title: 'Product Designer',
    company: 'Studio Merge',
    status: 'rejected',
    appliedAt: '2026-03-12',
    followUpAt: '',
    matchScore: 67,
  },
  {
    id: 'app-6',
    title: 'Frontend Engineer',
    company: 'Canvas Works',
    status: 'withdrawn',
    appliedAt: '2026-03-09',
    followUpAt: '',
    matchScore: 72,
  },
]

export const mockInterviewPrep: InterviewPrepPack = {
  companySnapshot:
    'Shift Labs is likely optimizing candidate operations. Expect emphasis on usability, speed of execution, and measurable workflow gains.',
  likelyQuestions: [
    'How would you tailor a browser extension UX for frequent job applicants?',
    'How do you balance fast delivery and maintainable frontend architecture?',
    'How would you validate that AI-generated resume content is accurate?',
  ],
  storiesToPrepare: [
    'A project where you simplified a multi-step workflow.',
    'A time you shipped under extreme time pressure.',
    'A case where you improved product trust with better UX safeguards.',
  ],
  followUpDraft:
    'Thank you for the interview. I appreciated the discussion around user trust, structured generation, and shipping an assistant that stays in the loop without over-automating.',
}

export const mockAtsReview: AtsReview = {
  review_id: 'rev_cv_cand_001_job_ffbe94f3e8_v1',
  cv_id: 'cv_cand_001_job_ffbe94f3e8_v1',
  job_id: 'job_ffbe94f3e8',
  score: 92,
  passed: true,
  hard_filters_status: [
    {
      filter: '5 years of experience',
      status: 'pass',
      evidence: 'Summary states more than 5 years of experience and the CV explicitly covers that requirement.',
    },
    {
      filter: 'Figma',
      status: 'pass',
      evidence: 'Figma appears in highlighted skills and in the design system accomplishment bullet.',
    },
    {
      filter: 'Senior level',
      status: 'pass',
      evidence: 'The title and headline both position the candidate at senior level.',
    },
    {
      filter: 'Paris / hybrid compatibility',
      status: 'pass',
      evidence: 'The headline includes Paris and the profile appears compatible with a hybrid setup.',
    },
  ],
  matched_keywords: [
    'product',
    'designer',
    'senior',
    'figma',
    'design systems',
    'equipe produit',
    'engineering',
    'SaaS B2B',
    '5 ans d experience',
    'Paris',
    'parties prenantes',
    'recherche utilisateur',
  ],
  missing_keywords: [
    'animation d ateliers',
    "management d equipe",
    'certifications',
    'formation specifique (workshops facilitation)',
    "evidence explicite d'atelier",
  ],
  format_flags: [
    'Structure claire avec header, resume, competences, experiences et education.',
    'Mots-cles listes dans keywords_covered et skills_highlighted.',
    'Omitted_items explicitent les lacunes sur atelier, management et certifications.',
    "Aucune section 'Langues' detaillee alors que l'interface pourrait encore la montrer.",
  ],
  recommendations: [
    "Ajouter une ligne ou bullet explicite sur 'animation d ateliers' si experience existante, avec contexte, public et resultats.",
    "Si la candidate a deja dirige des personnes, mentionner 'management' ou 'lead' pour lever l'item manquant.",
    'Ajouter des certifications pertinentes ou formations UX, facilitation, ou design systems si disponibles.',
    "Inclure dans le header ou le resume les mots exacts de l'offre pour optimiser le matching ATS.",
    "Ajouter une section 'Langues' meme basique pour correspondre a la structure attendue.",
  ],
}

export const mockGeneratedCv: GeneratedCv = {
  cv_id: 'cv_cand_001_job_ffbe94f3e8_v1',
  candidate_id: 'cand_001',
  job_id: 'job_ffbe94f3e8',
  version: 1,
  language: 'fr',
  title: 'CV cible - Product Designer senior',
  header: {
    full_name: 'Jane Doe',
    headline: 'Senior Product Designer | SaaS B2B | Figma & design systems | Paris',
    contact: {
      email: 'jane@example.com',
      phone: '+33 6 00 00 00 00',
    },
    links: {
      linkedin: 'https://linkedin.com/in/janedoe',
      portfolio: 'https://janedoe.com',
    },
  },
  summary:
    "Product Designer avec plus de 5 ans d'experience sur des produits SaaS B2B. Maitrise avancee de Figma et des design systems, avec collaboration etroite avec les equipes produit, engineering et les parties prenantes. Experience sur onboarding, billing, activation et amelioration mesurable de la delivery design.",
  skills_highlighted: [
    'Figma',
    'Design systems',
    'SaaS B2B',
    'Collaboration produit et engineering',
    'Gestion des parties prenantes',
    'Recherche utilisateur',
  ],
  experiences_selected: [
    {
      experience_id: 'exp_01',
      rewritten_bullets: [
        'Responsable des parcours onboarding, billing et collaboration sur un produit SaaS B2B.',
        "Amelioration de l'activation de 18 %.",
        'Reduction de 25 % du temps de delivery design grace a un design system partage sous Figma.',
      ],
    },
    {
      experience_id: 'exp_02',
      rewritten_bullets: [
        'Conception de parcours utilisateurs end-to-end avec les equipes produit et engineering.',
        'Travail en coordination avec les parties prenantes pour faire evoluer les flux utilisateurs dans Figma.',
        "Augmentation de 9 % de la conversion essai vers payant.",
      ],
    },
  ],
  education_selected: [
    {
      school: 'School X',
      degree: 'Master en design',
      year: '2020',
    },
  ],
  certifications_selected: [],
  keywords_covered: [
    'Product Designer senior',
    "5 ans d'experience minimum",
    'Figma',
    'design systems',
    'equipes produit',
    'engineering',
    'parties prenantes',
    'SaaS B2B',
    'Paris',
  ],
  omitted_items: [
    "Animation d'ateliers, faute de preuve explicite dans le profil",
    "Management d'equipe, non revendique",
    'Certifications, aucune fournie',
  ],
  generation_notes: [
    "CV cible sur l'offre NovaTech en mettant en avant Figma, design systems, SaaS B2B et collaboration produit/engineering.",
    "Aucune experience, competence ou responsabilite non prouvee n'a ete ajoutee.",
    "L'animation d'ateliers n'a pas ete mentionnee car elle n'est pas explicitement etayee par le profil.",
  ],
}

export const mockReviewAgreement: ReviewAgreement = {
  job_id: 'job_ffbe94f3e8',
  cv_id: 'cv_cand_001_job_ffbe94f3e8_v1',
  cv_generation_ok: true,
  ats_ok: true,
  recruiter_ok: true,
  review_agreement_ok: true,
  final_status: 'FINAL_APPROVED',
  rejection_reasons: [],
  iteration_count: 3,
}

export const mockRecruiterReview: RecruiterReview = {
  review_id: 'rev_cv_cand_001_job_ffbe94f3e8_v1',
  cv_id: 'cv_cand_001_job_ffbe94f3e8_v1',
  job_id: 'job_ffbe94f3e8',
  score: 74,
  passed: true,
  readability_score: 85,
  credibility_score: 70,
  coherence_score: 80,
  evidence_score: 60,
  strengths: [
    "Presentation claire et ciblee : le titre, le headline et le resume correspondent precisement a l'offre NovaTech, meme avec une phrase de positionnement assez longue qui cumule le niveau senior, le contexte SaaS B2B, la maitrise de Figma et des design systems, ainsi qu'une collaboration transverse avec les equipes produit et engineering.",
    'Mise en avant des competences cles requises comme Figma, design systems, SaaS B2B, et collaboration produit/engineering.',
    "Chiffres d'impact concrets comme +18 % activation, -25 % temps de delivery, et +9 % conversion qui donnent un bon niveau d'attractivite.",
    'Liens de contact et portfolio fournis, facilitant la verification rapide du travail.',
  ],
  concerns: [
    "Absence de contextes temporels et de noms d'employeurs ou de produits pour les experiences listees, ce qui reduit la verifiabilite.",
    "Les metriques d'impact sont pertinentes mais manquent de sources ou de precision sur la periode, la methode de mesure et la base de reference.",
    "Animation d'ateliers exigee par l'offre explicitement omise pour cause de manque de preuve, ce qui peut etre percu comme un gap fonctionnel.",
    "Aucune mention de management d'equipe ou de responsabilites seniors additionnelles comme roadmap ou priorisation strategique.",
    "Certifications et preuves externes comme cas d'etude detailles, captures datees, ou temoignages non fournies.",
  ],
  recommendations: [
    "Ajouter noms d'entreprises, postes precis et plages de dates pour chaque experience afin d'ameliorer la credibilite.",
    "Pour chaque metrique, preciser la periode, la methode de calcul et la taille de l'echantillon afin d'eviter un effet declaratif trop leger.",
    "Si la candidate a anime des ateliers, l'indiquer clairement avec exemples, nombre de participants, objectif et resultat.",
    'Inclure un ou deux liens directs vers des etudes de cas dans le portfolio montrant le design system sur Figma et le workflow collaboratif avec engineering.',
    "Mentionner toute responsabilite strategique ou expliquer son absence pour ajuster honnetement le positionnement senior.",
  ],
}
