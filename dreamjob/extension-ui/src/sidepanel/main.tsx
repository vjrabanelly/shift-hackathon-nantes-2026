import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  CheckCircle2,
  Check,
  Briefcase,
  CircleAlert,
  Clock3,
  FileText,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { apiClient, extractionToResumeMaster } from '../lib/api/client'
import {
  captureCurrentJob,
  type CaptureCurrentJobFailureReason,
} from '../lib/chrome/capture'
import { chromeStorage } from '../lib/chrome/storage'
import { I18nProvider, useI18n } from '../i18n/I18nProvider'
import {
  mockAtsReview,
  mockGeneratedCv,
  mockRecruiterReview,
  mockReviewAgreement,
} from '../shared/mock-data'
import '../shared/styles/global.css'
import '../shared/styles/sidepanel.css'
import type {
  ApplicationItem,
  AtsReview,
  ResumeAwardItem,
  ResumeCertificationItem,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeLanguageItem,
  ResumeMaster,
  ResumeProfileLink,
  ResumeProjectItem,
  ResumePublicationItem,
  ResumeReferenceItem,
  ResumeSkillItem,
  ResumeSourceDocument,
  ResumeVolunteeringItem,
  CapturedJobOffer,
  GeneratedCv,
  RecruiterReview,
  ReviewAgreement,
} from '../shared/types'

type ResumeCollectionKey =
  | 'profiles'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'languages'
  | 'awards'
  | 'certifications'
  | 'publications'
  | 'volunteering'
  | 'references'

function useAsyncValue<T>(loader: () => Promise<T>) {
  const [data, setData] = React.useState<T | null>(null)

  React.useEffect(() => {
    let active = true

    loader()
      .then((value) => {
        if (active) {
          setData(value)
        }
      })
      .catch(() => {
        if (active) {
          setData(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return data
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function getDefaultFollowUpDate(daysFromNow = 3) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().slice(0, 10)
}

function getScorePillClass(score: number) {
  return score >= 75 ? 'score-pill score-pill-good' : 'score-pill score-pill-bad'
}

function getReviewTagClass(status: string) {
  if (status === 'pass') return 'tag tag-pass'
  if (status === 'fail') return 'tag tag-fail'
  return 'tag'
}

function getPassedStateClass(passed: boolean) {
  return passed ? 'review-state review-state-pass' : 'review-state review-state-fail'
}

function normalizeCoveredKeywords(keywords: string[]) {
  const seen = new Set<string>()

  return keywords
    .flatMap((keyword) => keyword.split(/[|,;]/))
    .map((keyword) => keyword.replace(/\s+/g, ' ').trim())
    .filter((keyword) => keyword.length > 0)
    .filter((keyword) => {
      const words = keyword.split(' ').filter(Boolean)
      return keyword.length <= 48 && words.length <= 5
    })
    .filter((keyword) => {
      const normalized = keyword.toLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

function buildFallbackGeneratedCv(
  resumeMaster: ResumeMaster,
  offer: CapturedJobOffer,
): GeneratedCv {
  const email =
    resumeMaster.profiles.find((item) => item.label.toLowerCase() === 'email')
      ?.value ?? ''
  const phone =
    resumeMaster.profiles.find((item) => item.label.toLowerCase() === 'phone')
      ?.value ?? ''
  const links = Object.fromEntries(
    resumeMaster.profiles
      .filter((item) => {
        const label = item.label.toLowerCase()
        return label !== 'email' && label !== 'phone' && item.value.trim().length > 0
      })
      .map((item) => [item.label.toLowerCase() || 'link', item.value]),
  )

  return {
    cv_id: `cv-fallback-${Date.now()}`,
    candidate_id: 'local-candidate',
    job_id: `job-fallback-${offer.captured_at}`,
    version: 1,
    language: 'fr',
    title: `CV cible - ${offer.raw_fields.title || resumeMaster.title || 'Resume'}`,
    header: {
      full_name: resumeMaster.fullName,
      headline: resumeMaster.title,
      contact: {
        email,
        phone,
      },
      links,
    },
    summary: resumeMaster.summary,
    skills_highlighted: resumeMaster.skills
      .map((skill) => skill.name)
      .filter(Boolean)
      .slice(0, 8),
    experiences_selected: resumeMaster.experience.slice(0, 3).map((experience) => ({
      experience_id: experience.role || experience.company || experience.id,
      rewritten_bullets: experience.highlights.length > 0
        ? experience.highlights
        : experience.description
          ? [experience.description]
          : [],
    })),
    education_selected: resumeMaster.education.slice(0, 2).map((education) => ({
      school: education.institution,
      degree: [education.degree, education.fieldOfStudy].filter(Boolean).join(' - '),
      year: education.endDate || education.startDate,
    })),
    certifications_selected: resumeMaster.certifications
      .map((certification) => certification.name)
      .filter(Boolean),
    keywords_covered: [
      offer.raw_fields.title,
      offer.raw_fields.company,
      offer.raw_fields.location,
      ...resumeMaster.skills.map((skill) => skill.name),
    ].filter(Boolean).slice(0, 10),
    omitted_items: [],
    generation_notes: [
      'Fallback generated locally from the saved Master CV.',
      'This preview uses your local profile data because live generation failed.',
    ],
  }
}

function getResumeCompletion(resumeMaster: ResumeMaster) {
  const checks = [
    resumeMaster.fullName.trim().length > 0,
    resumeMaster.summary.trim().length > 0,
    resumeMaster.profiles.some((item) => item.value.trim().length > 0),
    resumeMaster.experience.length > 0,
    resumeMaster.education.length > 0,
    resumeMaster.skills.length > 0,
    resumeMaster.languages.length > 0,
    Boolean(resumeMaster.sourceDocument),
  ]

  const completed = checks.filter(Boolean).length
  return Math.round((completed / checks.length) * 100)
}

function Shell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n()
  const location = useLocation()
  const showInterviewNav = location.pathname === '/interview'

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-head">
          <nav className="nav-list">
            <NavLink to="/" end className="nav-link">
              <LayoutDashboard size={16} />
              {t.nav.dashboard}
            </NavLink>
            <NavLink to="/offer" className="nav-link">
              <Briefcase size={16} />
              {t.nav.selectedOffer}
            </NavLink>
            <NavLink to="/resume" className="nav-link">
              <FileText size={16} />
              {t.nav.masterResume}
            </NavLink>
            {showInterviewNav ? (
              <NavLink to="/interview" className="nav-link">
                <Sparkles size={16} />
                {t.nav.interviewPrep}
              </NavLink>
            ) : null}
          </nav>

          <div className="locale-switcher">
            <div className="locale-actions">
              <button
                type="button"
                className={`locale-button${locale === 'fr' ? ' active' : ''}`}
                onClick={() => setLocale('fr')}
              >
                {t.common.french}
              </button>
              <button
                type="button"
                className={`locale-button${locale === 'en' ? ' active' : ''}`}
                onClick={() => setLocale('en')}
              >
                {t.common.english}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function ItemCard({
  title,
  subtitle,
  removeLabel,
  onRemove,
  children,
}: {
  title: string
  subtitle?: string
  removeLabel: string
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <article className="item-card">
      <div className="item-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onRemove}
          aria-label={`${removeLabel} ${title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>
      {children}
    </article>
  )
}

function ListEditor({
  label,
  items,
  onChange,
  addLabel,
  placeholder,
  emptyLabel,
  removeLabel,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  addLabel: string
  placeholder: string
  emptyLabel: string
  removeLabel: string
}) {
  const updateItem = (index: number, value: string) => {
    onChange(
      items.map((item, itemIndex) => (itemIndex === index ? value : item)),
    )
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="list-editor">
      <div className="list-editor-head">
        <strong>{label}</strong>
        <button
          type="button"
          className="secondary-button inline-button"
          onClick={() => onChange([...items, ''])}
        >
          <Plus size={14} />
          {addLabel}
        </button>
      </div>

      <div className="stack-sm">
        {items.length === 0 ? <p className="muted-text">{emptyLabel}</p> : null}
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="inline-input-row">
            <input
              value={item}
              onChange={(event) => updateItem(index, event.target.value)}
              placeholder={placeholder}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => removeItem(index)}
              aria-label={`${removeLabel} ${label}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function MasterResumePage() {
  const { t } = useI18n()
  const [resumeMaster, setResumeMaster] = React.useState<ResumeMaster | null>(
    null,
  )
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>(
    'idle',
  )
  const [extractionState, setExtractionState] = React.useState<
    'idle' | 'extracting' | 'done' | 'error'
  >('idle')
  const [extractionError, setExtractionError] = React.useState('')
  const lastUploadedFileRef = React.useRef<File | null>(null)

  React.useEffect(() => {
    chromeStorage.getResumeMaster().then(setResumeMaster)
  }, [])

  React.useEffect(() => {
    if (!resumeMaster) return

    setSaveState('saving')
    const timeoutId = window.setTimeout(() => {
      chromeStorage.saveResumeMaster(resumeMaster).then(() => {
        setSaveState('saved')
      })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [resumeMaster])

  const updateResumeMaster = <K extends keyof ResumeMaster>(
    key: K,
    value: ResumeMaster[K],
  ) => {
    setResumeMaster((current) =>
      current ? { ...current, [key]: value } : current,
    )
  }

  const updateCollectionItem = <T extends { id: string }>(
    key: ResumeCollectionKey,
    id: string,
    updater: (item: T) => T,
  ) => {
    setResumeMaster((current) => {
      if (!current) return current

      const collection = current[key] as unknown as T[]
      return {
        ...current,
        [key]: collection.map((item) =>
          item.id === id ? updater(item) : item,
        ),
      }
    })
  }

  const addCollectionItem = <T extends { id: string }>(
    key: ResumeCollectionKey,
    item: T,
  ) => {
    setResumeMaster((current) => {
      if (!current) return current

      const collection = current[key] as unknown as T[]
      return {
        ...current,
        [key]: [...collection, item],
      }
    })
  }

  const removeCollectionItem = (key: ResumeCollectionKey, id: string) => {
    setResumeMaster((current) => {
      if (!current) return current

      const collection = current[key] as { id: string }[]
      return {
        ...current,
        [key]: collection.filter((item) => item.id !== id),
      }
    })
  }

  const runExtraction = async (file: File) => {
    setExtractionState('extracting')
    setExtractionError('')
    try {
      const result = await apiClient.uploadResume(file)
      const mapped = extractionToResumeMaster(
        result.extractedData.data,
        resumeMaster ?? undefined,
      )
      setResumeMaster(mapped)
      setExtractionState('done')
    } catch (err) {
      setExtractionState('error')
      setExtractionError(
        err instanceof Error ? err.message : 'Extraction failed',
      )
    }
  }

  const handleSourceDocumentUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setExtractionState('error')
      setExtractionError('Only PDF files are accepted')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setExtractionState('error')
      setExtractionError('File size exceeds 10MB limit')
      return
    }

    lastUploadedFileRef.current = file

    // Store locally as DataURL
    const reader = new FileReader()
    reader.onload = () => {
      const sourceDocument: ResumeSourceDocument = {
        id: createId('file'),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl: typeof reader.result === 'string' ? reader.result : '',
      }

      updateResumeMaster('sourceDocument', sourceDocument)
    }
    reader.readAsDataURL(file)
    event.target.value = ''

    // Send to backend for extraction
    runExtraction(file)
  }

  if (!resumeMaster)
    return <div className="panel">{t.resumeMaster.loading}</div>

  const completion = getResumeCompletion(resumeMaster)
  const r = t.resumeMaster

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-head">
          <div>
            <span className="eyebrow">{r.eyebrow}</span>
            <h1>{resumeMaster.fullName || r.untitledProfile}</h1>
            <p>{resumeMaster.title || r.heroFallback}</p>
          </div>
          <div className="hero-meta">
            <strong>{`${completion}% ${r.completionSuffix}`}</strong>
            <span>{saveState === 'saving' ? r.saving : r.saved}</span>
          </div>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${completion}%` }} />
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.sourceFile.title}
          description={r.sourceFile.description}
          action={
            <label className="secondary-button inline-button upload-button">
              <Upload size={14} />
              {r.sourceFile.upload}
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleSourceDocumentUpload}
              />
            </label>
          }
        />

        {resumeMaster.sourceDocument ? (
          <div className="document-card">
            <div>
              <strong>{resumeMaster.sourceDocument.name}</strong>
              <p>{`${resumeMaster.sourceDocument.type} • ${formatFileSize(resumeMaster.sourceDocument.size)}`}</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => updateResumeMaster('sourceDocument', undefined)}
              aria-label={r.sourceFile.remove}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <p className="muted-text">{r.sourceFile.empty}</p>
        )}

        {extractionState === 'extracting' && (
          <p className="muted-text">Extracting resume data…</p>
        )}
        {extractionState === 'done' && (
          <p className="muted-text">Resume data extracted successfully.</p>
        )}
        {extractionState === 'error' && (
          <div className="stack-sm">
            <p
              className="muted-text"
              style={{ color: 'var(--color-danger, #c0392b)' }}
            >
              {extractionError}
            </p>
            {lastUploadedFileRef.current && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => runExtraction(lastUploadedFileRef.current!)}
              >
                Retry extraction
              </button>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <SectionHeader
          title={r.summary.title}
          description={r.summary.description}
        />
        <div className="grid two-col">
          <Field
            label={r.summary.fullName}
            value={resumeMaster.fullName}
            onChange={(value) => updateResumeMaster('fullName', value)}
            placeholder={r.summary.fullNamePlaceholder}
          />
          <Field
            label={r.summary.profileTitle}
            value={resumeMaster.title}
            onChange={(value) => updateResumeMaster('title', value)}
            placeholder={r.summary.profileTitlePlaceholder}
          />
        </div>
        <div className="grid one-col">
          <Field
            label={r.summary.location}
            value={resumeMaster.location}
            onChange={(value) => updateResumeMaster('location', value)}
            placeholder={r.summary.locationPlaceholder}
          />
          <TextAreaField
            label={r.summary.professionalSummary}
            value={resumeMaster.summary}
            onChange={(value) => updateResumeMaster('summary', value)}
            placeholder={r.summary.professionalSummaryPlaceholder}
            rows={5}
          />
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.profiles.title}
          description={r.profiles.description}
          action={
            <button
              type="button"
              className="secondary-button inline-button"
              onClick={() =>
                addCollectionItem<ResumeProfileLink>('profiles', {
                  id: createId('profile'),
                  label: '',
                  value: '',
                })
              }
            >
              <Plus size={14} />
              {r.profiles.add}
            </button>
          }
        />
        <div className="stack-md">
          {resumeMaster.profiles.map((profile) => (
            <ItemCard
              key={profile.id}
              title={profile.label || r.profiles.newItem}
              subtitle={profile.value || r.profiles.itemSubtitle}
              removeLabel={r.remove}
              onRemove={() => removeCollectionItem('profiles', profile.id)}
            >
              <div className="grid two-col">
                <Field
                  label={r.profiles.label}
                  value={profile.label}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProfileLink>(
                      'profiles',
                      profile.id,
                      (item) => ({
                        ...item,
                        label: value,
                      }),
                    )
                  }
                  placeholder={r.profiles.labelPlaceholder}
                />
                <Field
                  label={r.profiles.value}
                  value={profile.value}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProfileLink>(
                      'profiles',
                      profile.id,
                      (item) => ({
                        ...item,
                        value,
                      }),
                    )
                  }
                  placeholder={r.profiles.valuePlaceholder}
                />
              </div>
            </ItemCard>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.experience.title}
          description={r.experience.description}
          action={
            <button
              type="button"
              className="secondary-button inline-button"
              onClick={() =>
                addCollectionItem<ResumeExperienceItem>('experience', {
                  id: createId('experience'),
                  role: '',
                  company: '',
                  location: '',
                  startDate: '',
                  endDate: '',
                  current: false,
                  description: '',
                  highlights: [],
                })
              }
            >
              <Plus size={14} />
              {r.experience.add}
            </button>
          }
        />
        <div className="stack-md">
          {resumeMaster.experience.map((experience) => (
            <ItemCard
              key={experience.id}
              title={experience.role || r.experience.newItem}
              subtitle={experience.company || r.experience.itemSubtitle}
              removeLabel={r.remove}
              onRemove={() => removeCollectionItem('experience', experience.id)}
            >
              <div className="grid two-col">
                <Field
                  label={r.experience.role}
                  value={experience.role}
                  onChange={(value) =>
                    updateCollectionItem<ResumeExperienceItem>(
                      'experience',
                      experience.id,
                      (item) => ({
                        ...item,
                        role: value,
                      }),
                    )
                  }
                  placeholder={r.experience.rolePlaceholder}
                />
                <Field
                  label={r.experience.company}
                  value={experience.company}
                  onChange={(value) =>
                    updateCollectionItem<ResumeExperienceItem>(
                      'experience',
                      experience.id,
                      (item) => ({
                        ...item,
                        company: value,
                      }),
                    )
                  }
                  placeholder={r.experience.companyPlaceholder}
                />
                <Field
                  label={r.experience.location}
                  value={experience.location}
                  onChange={(value) =>
                    updateCollectionItem<ResumeExperienceItem>(
                      'experience',
                      experience.id,
                      (item) => ({
                        ...item,
                        location: value,
                      }),
                    )
                  }
                  placeholder={r.experience.locationPlaceholder}
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={experience.current}
                    onChange={(event) =>
                      updateCollectionItem<ResumeExperienceItem>(
                        'experience',
                        experience.id,
                        (item) => ({
                          ...item,
                          current: event.target.checked,
                          endDate: event.target.checked ? '' : item.endDate,
                        }),
                      )
                    }
                  />
                  <span>{r.experience.current}</span>
                </label>
                <Field
                  label={r.experience.startDate}
                  type="month"
                  value={experience.startDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeExperienceItem>(
                      'experience',
                      experience.id,
                      (item) => ({
                        ...item,
                        startDate: value,
                      }),
                    )
                  }
                />
                <Field
                  label={r.experience.endDate}
                  type="month"
                  value={experience.endDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeExperienceItem>(
                      'experience',
                      experience.id,
                      (item) => ({
                        ...item,
                        endDate: value,
                      }),
                    )
                  }
                />
              </div>
              <TextAreaField
                label={r.experience.descriptionLabel}
                value={experience.description}
                onChange={(value) =>
                  updateCollectionItem<ResumeExperienceItem>(
                    'experience',
                    experience.id,
                    (item) => ({
                      ...item,
                      description: value,
                    }),
                  )
                }
                placeholder={r.experience.descriptionPlaceholder}
              />
              <ListEditor
                label={r.experience.highlights}
                items={experience.highlights}
                onChange={(items) =>
                  updateCollectionItem<ResumeExperienceItem>(
                    'experience',
                    experience.id,
                    (item) => ({
                      ...item,
                      highlights: items,
                    }),
                  )
                }
                addLabel={r.experience.addHighlight}
                placeholder={r.experience.highlightPlaceholder}
                emptyLabel={r.noItems}
                removeLabel={r.remove}
              />
            </ItemCard>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.education.title}
          description={r.education.description}
          action={
            <button
              type="button"
              className="secondary-button inline-button"
              onClick={() =>
                addCollectionItem<ResumeEducationItem>('education', {
                  id: createId('education'),
                  institution: '',
                  degree: '',
                  fieldOfStudy: '',
                  startDate: '',
                  endDate: '',
                  description: '',
                })
              }
            >
              <Plus size={14} />
              {r.education.add}
            </button>
          }
        />
        <div className="stack-md">
          {resumeMaster.education.map((education) => (
            <ItemCard
              key={education.id}
              title={education.institution || r.education.newItem}
              subtitle={education.degree || r.education.itemSubtitle}
              removeLabel={r.remove}
              onRemove={() => removeCollectionItem('education', education.id)}
            >
              <div className="grid two-col">
                <Field
                  label={r.education.institution}
                  value={education.institution}
                  onChange={(value) =>
                    updateCollectionItem<ResumeEducationItem>(
                      'education',
                      education.id,
                      (item) => ({
                        ...item,
                        institution: value,
                      }),
                    )
                  }
                  placeholder={r.education.institutionPlaceholder}
                />
                <Field
                  label={r.education.degree}
                  value={education.degree}
                  onChange={(value) =>
                    updateCollectionItem<ResumeEducationItem>(
                      'education',
                      education.id,
                      (item) => ({
                        ...item,
                        degree: value,
                      }),
                    )
                  }
                  placeholder={r.education.degreePlaceholder}
                />
                <Field
                  label={r.education.fieldOfStudy}
                  value={education.fieldOfStudy}
                  onChange={(value) =>
                    updateCollectionItem<ResumeEducationItem>(
                      'education',
                      education.id,
                      (item) => ({
                        ...item,
                        fieldOfStudy: value,
                      }),
                    )
                  }
                  placeholder={r.education.fieldOfStudyPlaceholder}
                />
                <Field
                  label={r.education.startDate}
                  type="month"
                  value={education.startDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeEducationItem>(
                      'education',
                      education.id,
                      (item) => ({
                        ...item,
                        startDate: value,
                      }),
                    )
                  }
                />
                <Field
                  label={r.education.endDate}
                  type="month"
                  value={education.endDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeEducationItem>(
                      'education',
                      education.id,
                      (item) => ({
                        ...item,
                        endDate: value,
                      }),
                    )
                  }
                />
              </div>
              <TextAreaField
                label={r.education.descriptionLabel}
                value={education.description}
                onChange={(value) =>
                  updateCollectionItem<ResumeEducationItem>(
                    'education',
                    education.id,
                    (item) => ({
                      ...item,
                      description: value,
                    }),
                  )
                }
                placeholder={r.education.descriptionPlaceholder}
              />
            </ItemCard>
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.projects.title}
          description={r.projects.description}
          action={
            <button
              type="button"
              className="secondary-button inline-button"
              onClick={() =>
                addCollectionItem<ResumeProjectItem>('projects', {
                  id: createId('project'),
                  name: '',
                  role: '',
                  startDate: '',
                  endDate: '',
                  current: false,
                  description: '',
                  highlights: [],
                  link: '',
                })
              }
            >
              <Plus size={14} />
              {r.projects.add}
            </button>
          }
        />
        <div className="stack-md">
          {resumeMaster.projects.map((project) => (
            <ItemCard
              key={project.id}
              title={project.name || r.projects.newItem}
              subtitle={project.role || r.projects.itemSubtitle}
              removeLabel={r.remove}
              onRemove={() => removeCollectionItem('projects', project.id)}
            >
              <div className="grid two-col">
                <Field
                  label={r.projects.name}
                  value={project.name}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProjectItem>(
                      'projects',
                      project.id,
                      (item) => ({
                        ...item,
                        name: value,
                      }),
                    )
                  }
                  placeholder={r.projects.namePlaceholder}
                />
                <Field
                  label={r.projects.role}
                  value={project.role}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProjectItem>(
                      'projects',
                      project.id,
                      (item) => ({
                        ...item,
                        role: value,
                      }),
                    )
                  }
                  placeholder={r.projects.rolePlaceholder}
                />
                <Field
                  label={r.projects.startDate}
                  type="month"
                  value={project.startDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProjectItem>(
                      'projects',
                      project.id,
                      (item) => ({
                        ...item,
                        startDate: value,
                      }),
                    )
                  }
                />
                <Field
                  label={r.projects.endDate}
                  type="month"
                  value={project.endDate}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProjectItem>(
                      'projects',
                      project.id,
                      (item) => ({
                        ...item,
                        endDate: value,
                      }),
                    )
                  }
                />
                <Field
                  label={r.projects.link}
                  value={project.link}
                  onChange={(value) =>
                    updateCollectionItem<ResumeProjectItem>(
                      'projects',
                      project.id,
                      (item) => ({
                        ...item,
                        link: value,
                      }),
                    )
                  }
                  placeholder={r.projects.linkPlaceholder}
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={project.current}
                    onChange={(event) =>
                      updateCollectionItem<ResumeProjectItem>(
                        'projects',
                        project.id,
                        (item) => ({
                          ...item,
                          current: event.target.checked,
                          endDate: event.target.checked ? '' : item.endDate,
                        }),
                      )
                    }
                  />
                  <span>{r.projects.current}</span>
                </label>
              </div>
              <TextAreaField
                label={r.projects.descriptionLabel}
                value={project.description}
                onChange={(value) =>
                  updateCollectionItem<ResumeProjectItem>(
                    'projects',
                    project.id,
                    (item) => ({
                      ...item,
                      description: value,
                    }),
                  )
                }
                placeholder={r.projects.descriptionPlaceholder}
              />
              <ListEditor
                label={r.projects.highlights}
                items={project.highlights}
                onChange={(items) =>
                  updateCollectionItem<ResumeProjectItem>(
                    'projects',
                    project.id,
                    (item) => ({
                      ...item,
                      highlights: items,
                    }),
                  )
                }
                addLabel={r.projects.addHighlight}
                placeholder={r.projects.highlightPlaceholder}
                emptyLabel={r.noItems}
                removeLabel={r.remove}
              />
            </ItemCard>
          ))}
        </div>
      </section>

      <section className="grid two-col">
        <article className="panel">
          <SectionHeader
            title={r.skills.title}
            description={r.skills.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumeSkillItem>('skills', {
                    id: createId('skill'),
                    name: '',
                    level: '',
                    details: '',
                  })
                }
              >
                <Plus size={14} />
                {r.skills.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.skills.map((skill) => (
              <ItemCard
                key={skill.id}
                title={skill.name || r.skills.newItem}
                subtitle={skill.level || r.skills.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() => removeCollectionItem('skills', skill.id)}
              >
                <div className="grid one-col">
                  <Field
                    label={r.skills.name}
                    value={skill.name}
                    onChange={(value) =>
                      updateCollectionItem<ResumeSkillItem>(
                        'skills',
                        skill.id,
                        (item) => ({
                          ...item,
                          name: value,
                        }),
                      )
                    }
                    placeholder={r.skills.namePlaceholder}
                  />
                  <Field
                    label={r.skills.level}
                    value={skill.level}
                    onChange={(value) =>
                      updateCollectionItem<ResumeSkillItem>(
                        'skills',
                        skill.id,
                        (item) => ({
                          ...item,
                          level: value,
                        }),
                      )
                    }
                    placeholder={r.skills.levelPlaceholder}
                  />
                  <TextAreaField
                    label={r.skills.details}
                    value={skill.details}
                    onChange={(value) =>
                      updateCollectionItem<ResumeSkillItem>(
                        'skills',
                        skill.id,
                        (item) => ({
                          ...item,
                          details: value,
                        }),
                      )
                    }
                    placeholder={r.skills.detailsPlaceholder}
                    rows={3}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>

        <article className="panel">
          <SectionHeader
            title={r.languages.title}
            description={r.languages.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumeLanguageItem>('languages', {
                    id: createId('language'),
                    name: '',
                    proficiency: '',
                    certification: '',
                  })
                }
              >
                <Plus size={14} />
                {r.languages.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.languages.map((language) => (
              <ItemCard
                key={language.id}
                title={language.name || r.languages.newItem}
                subtitle={language.proficiency || r.languages.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() => removeCollectionItem('languages', language.id)}
              >
                <div className="grid one-col">
                  <Field
                    label={r.languages.name}
                    value={language.name}
                    onChange={(value) =>
                      updateCollectionItem<ResumeLanguageItem>(
                        'languages',
                        language.id,
                        (item) => ({
                          ...item,
                          name: value,
                        }),
                      )
                    }
                    placeholder={r.languages.namePlaceholder}
                  />
                  <Field
                    label={r.languages.proficiency}
                    value={language.proficiency}
                    onChange={(value) =>
                      updateCollectionItem<ResumeLanguageItem>(
                        'languages',
                        language.id,
                        (item) => ({
                          ...item,
                          proficiency: value,
                        }),
                      )
                    }
                    placeholder={r.languages.proficiencyPlaceholder}
                  />
                  <Field
                    label={r.languages.certification}
                    value={language.certification}
                    onChange={(value) =>
                      updateCollectionItem<ResumeLanguageItem>(
                        'languages',
                        language.id,
                        (item) => ({
                          ...item,
                          certification: value,
                        }),
                      )
                    }
                    placeholder={r.languages.certificationPlaceholder}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.interests.title}
          description={r.interests.description}
        />
        <ListEditor
          label={r.interests.title}
          items={resumeMaster.interests}
          onChange={(items) => updateResumeMaster('interests', items)}
          addLabel={r.interests.add}
          placeholder={r.interests.placeholder}
          emptyLabel={r.noItems}
          removeLabel={r.remove}
        />
      </section>

      <section className="grid two-col">
        <article className="panel">
          <SectionHeader
            title={r.awards.title}
            description={r.awards.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumeAwardItem>('awards', {
                    id: createId('award'),
                    title: '',
                    issuer: '',
                    date: '',
                    description: '',
                  })
                }
              >
                <Plus size={14} />
                {r.awards.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.awards.map((award) => (
              <ItemCard
                key={award.id}
                title={award.title || r.awards.newItem}
                subtitle={award.issuer || r.awards.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() => removeCollectionItem('awards', award.id)}
              >
                <div className="grid one-col">
                  <Field
                    label={r.awards.titleLabel}
                    value={award.title}
                    onChange={(value) =>
                      updateCollectionItem<ResumeAwardItem>(
                        'awards',
                        award.id,
                        (item) => ({
                          ...item,
                          title: value,
                        }),
                      )
                    }
                    placeholder={r.awards.titlePlaceholder}
                  />
                  <Field
                    label={r.awards.issuer}
                    value={award.issuer}
                    onChange={(value) =>
                      updateCollectionItem<ResumeAwardItem>(
                        'awards',
                        award.id,
                        (item) => ({
                          ...item,
                          issuer: value,
                        }),
                      )
                    }
                    placeholder={r.awards.issuerPlaceholder}
                  />
                  <Field
                    label={r.awards.date}
                    type="month"
                    value={award.date}
                    onChange={(value) =>
                      updateCollectionItem<ResumeAwardItem>(
                        'awards',
                        award.id,
                        (item) => ({
                          ...item,
                          date: value,
                        }),
                      )
                    }
                  />
                  <TextAreaField
                    label={r.awards.descriptionLabel}
                    value={award.description}
                    onChange={(value) =>
                      updateCollectionItem<ResumeAwardItem>(
                        'awards',
                        award.id,
                        (item) => ({
                          ...item,
                          description: value,
                        }),
                      )
                    }
                    placeholder={r.awards.descriptionPlaceholder}
                    rows={3}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>

        <article className="panel">
          <SectionHeader
            title={r.certifications.title}
            description={r.certifications.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumeCertificationItem>('certifications', {
                    id: createId('certification'),
                    name: '',
                    issuer: '',
                    date: '',
                    expiresAt: '',
                    credentialId: '',
                  })
                }
              >
                <Plus size={14} />
                {r.certifications.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.certifications.map((certification) => (
              <ItemCard
                key={certification.id}
                title={certification.name || r.certifications.newItem}
                subtitle={certification.issuer || r.certifications.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() =>
                  removeCollectionItem('certifications', certification.id)
                }
              >
                <div className="grid one-col">
                  <Field
                    label={r.certifications.name}
                    value={certification.name}
                    onChange={(value) =>
                      updateCollectionItem<ResumeCertificationItem>(
                        'certifications',
                        certification.id,
                        (item) => ({
                          ...item,
                          name: value,
                        }),
                      )
                    }
                    placeholder={r.certifications.namePlaceholder}
                  />
                  <Field
                    label={r.certifications.issuer}
                    value={certification.issuer}
                    onChange={(value) =>
                      updateCollectionItem<ResumeCertificationItem>(
                        'certifications',
                        certification.id,
                        (item) => ({
                          ...item,
                          issuer: value,
                        }),
                      )
                    }
                    placeholder={r.certifications.issuerPlaceholder}
                  />
                  <Field
                    label={r.certifications.issuedOn}
                    type="month"
                    value={certification.date}
                    onChange={(value) =>
                      updateCollectionItem<ResumeCertificationItem>(
                        'certifications',
                        certification.id,
                        (item) => ({
                          ...item,
                          date: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={r.certifications.expiresOn}
                    type="month"
                    value={certification.expiresAt}
                    onChange={(value) =>
                      updateCollectionItem<ResumeCertificationItem>(
                        'certifications',
                        certification.id,
                        (item) => ({
                          ...item,
                          expiresAt: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={r.certifications.credentialId}
                    value={certification.credentialId}
                    onChange={(value) =>
                      updateCollectionItem<ResumeCertificationItem>(
                        'certifications',
                        certification.id,
                        (item) => ({
                          ...item,
                          credentialId: value,
                        }),
                      )
                    }
                    placeholder={r.certifications.credentialIdPlaceholder}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>
      </section>

      <section className="grid two-col">
        <article className="panel">
          <SectionHeader
            title={r.publications.title}
            description={r.publications.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumePublicationItem>('publications', {
                    id: createId('publication'),
                    title: '',
                    publisher: '',
                    date: '',
                    link: '',
                    description: '',
                  })
                }
              >
                <Plus size={14} />
                {r.publications.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.publications.map((publication) => (
              <ItemCard
                key={publication.id}
                title={publication.title || r.publications.newItem}
                subtitle={publication.publisher || r.publications.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() =>
                  removeCollectionItem('publications', publication.id)
                }
              >
                <div className="grid one-col">
                  <Field
                    label={r.publications.titleLabel}
                    value={publication.title}
                    onChange={(value) =>
                      updateCollectionItem<ResumePublicationItem>(
                        'publications',
                        publication.id,
                        (item) => ({
                          ...item,
                          title: value,
                        }),
                      )
                    }
                    placeholder={r.publications.titlePlaceholder}
                  />
                  <Field
                    label={r.publications.publisher}
                    value={publication.publisher}
                    onChange={(value) =>
                      updateCollectionItem<ResumePublicationItem>(
                        'publications',
                        publication.id,
                        (item) => ({
                          ...item,
                          publisher: value,
                        }),
                      )
                    }
                    placeholder={r.publications.publisherPlaceholder}
                  />
                  <Field
                    label={r.publications.date}
                    type="month"
                    value={publication.date}
                    onChange={(value) =>
                      updateCollectionItem<ResumePublicationItem>(
                        'publications',
                        publication.id,
                        (item) => ({
                          ...item,
                          date: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={r.publications.link}
                    value={publication.link}
                    onChange={(value) =>
                      updateCollectionItem<ResumePublicationItem>(
                        'publications',
                        publication.id,
                        (item) => ({
                          ...item,
                          link: value,
                        }),
                      )
                    }
                    placeholder={r.publications.linkPlaceholder}
                  />
                  <TextAreaField
                    label={r.publications.descriptionLabel}
                    value={publication.description}
                    onChange={(value) =>
                      updateCollectionItem<ResumePublicationItem>(
                        'publications',
                        publication.id,
                        (item) => ({
                          ...item,
                          description: value,
                        }),
                      )
                    }
                    placeholder={r.publications.descriptionPlaceholder}
                    rows={3}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>

        <article className="panel">
          <SectionHeader
            title={r.volunteering.title}
            description={r.volunteering.description}
            action={
              <button
                type="button"
                className="secondary-button inline-button"
                onClick={() =>
                  addCollectionItem<ResumeVolunteeringItem>('volunteering', {
                    id: createId('volunteering'),
                    organization: '',
                    role: '',
                    startDate: '',
                    endDate: '',
                    current: false,
                    description: '',
                  })
                }
              >
                <Plus size={14} />
                {r.volunteering.add}
              </button>
            }
          />
          <div className="stack-md">
            {resumeMaster.volunteering.map((volunteering) => (
              <ItemCard
                key={volunteering.id}
                title={volunteering.organization || r.volunteering.newItem}
                subtitle={volunteering.role || r.volunteering.itemSubtitle}
                removeLabel={r.remove}
                onRemove={() =>
                  removeCollectionItem('volunteering', volunteering.id)
                }
              >
                <div className="grid one-col">
                  <Field
                    label={r.volunteering.organization}
                    value={volunteering.organization}
                    onChange={(value) =>
                      updateCollectionItem<ResumeVolunteeringItem>(
                        'volunteering',
                        volunteering.id,
                        (item) => ({
                          ...item,
                          organization: value,
                        }),
                      )
                    }
                    placeholder={r.volunteering.organizationPlaceholder}
                  />
                  <Field
                    label={r.volunteering.role}
                    value={volunteering.role}
                    onChange={(value) =>
                      updateCollectionItem<ResumeVolunteeringItem>(
                        'volunteering',
                        volunteering.id,
                        (item) => ({
                          ...item,
                          role: value,
                        }),
                      )
                    }
                    placeholder={r.volunteering.rolePlaceholder}
                  />
                  <Field
                    label={r.volunteering.startDate}
                    type="month"
                    value={volunteering.startDate}
                    onChange={(value) =>
                      updateCollectionItem<ResumeVolunteeringItem>(
                        'volunteering',
                        volunteering.id,
                        (item) => ({
                          ...item,
                          startDate: value,
                        }),
                      )
                    }
                  />
                  <Field
                    label={r.volunteering.endDate}
                    type="month"
                    value={volunteering.endDate}
                    onChange={(value) =>
                      updateCollectionItem<ResumeVolunteeringItem>(
                        'volunteering',
                        volunteering.id,
                        (item) => ({
                          ...item,
                          endDate: value,
                        }),
                      )
                    }
                  />
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={volunteering.current}
                      onChange={(event) =>
                        updateCollectionItem<ResumeVolunteeringItem>(
                          'volunteering',
                          volunteering.id,
                          (item) => ({
                            ...item,
                            current: event.target.checked,
                            endDate: event.target.checked ? '' : item.endDate,
                          }),
                        )
                      }
                    />
                    <span>{r.volunteering.current}</span>
                  </label>
                  <TextAreaField
                    label={r.volunteering.descriptionLabel}
                    value={volunteering.description}
                    onChange={(value) =>
                      updateCollectionItem<ResumeVolunteeringItem>(
                        'volunteering',
                        volunteering.id,
                        (item) => ({
                          ...item,
                          description: value,
                        }),
                      )
                    }
                    placeholder={r.volunteering.descriptionPlaceholder}
                    rows={3}
                  />
                </div>
              </ItemCard>
            ))}
          </div>
        </article>
      </section>

      <section className="panel">
        <SectionHeader
          title={r.references.title}
          description={r.references.description}
          action={
            <button
              type="button"
              className="secondary-button inline-button"
              onClick={() =>
                addCollectionItem<ResumeReferenceItem>('references', {
                  id: createId('reference'),
                  name: '',
                  relationship: '',
                  company: '',
                  email: '',
                  phone: '',
                  notes: '',
                })
              }
            >
              <Plus size={14} />
              {r.references.add}
            </button>
          }
        />
        <div className="stack-md">
          {resumeMaster.references.map((reference) => (
            <ItemCard
              key={reference.id}
              title={reference.name || r.references.newItem}
              subtitle={reference.relationship || r.references.itemSubtitle}
              removeLabel={r.remove}
              onRemove={() => removeCollectionItem('references', reference.id)}
            >
              <div className="grid two-col">
                <Field
                  label={r.references.name}
                  value={reference.name}
                  onChange={(value) =>
                    updateCollectionItem<ResumeReferenceItem>(
                      'references',
                      reference.id,
                      (item) => ({
                        ...item,
                        name: value,
                      }),
                    )
                  }
                  placeholder={r.references.namePlaceholder}
                />
                <Field
                  label={r.references.relationship}
                  value={reference.relationship}
                  onChange={(value) =>
                    updateCollectionItem<ResumeReferenceItem>(
                      'references',
                      reference.id,
                      (item) => ({
                        ...item,
                        relationship: value,
                      }),
                    )
                  }
                  placeholder={r.references.relationshipPlaceholder}
                />
                <Field
                  label={r.references.company}
                  value={reference.company}
                  onChange={(value) =>
                    updateCollectionItem<ResumeReferenceItem>(
                      'references',
                      reference.id,
                      (item) => ({
                        ...item,
                        company: value,
                      }),
                    )
                  }
                  placeholder={r.references.companyPlaceholder}
                />
                <Field
                  label={r.references.email}
                  value={reference.email}
                  onChange={(value) =>
                    updateCollectionItem<ResumeReferenceItem>(
                      'references',
                      reference.id,
                      (item) => ({
                        ...item,
                        email: value,
                      }),
                    )
                  }
                  placeholder={r.references.emailPlaceholder}
                />
                <Field
                  label={r.references.phone}
                  value={reference.phone}
                  onChange={(value) =>
                    updateCollectionItem<ResumeReferenceItem>(
                      'references',
                      reference.id,
                      (item) => ({
                        ...item,
                        phone: value,
                      }),
                    )
                  }
                  placeholder={r.references.phonePlaceholder}
                />
              </div>
              <TextAreaField
                label={r.references.notes}
                value={reference.notes}
                onChange={(value) =>
                  updateCollectionItem<ResumeReferenceItem>(
                    'references',
                    reference.id,
                    (item) => ({
                      ...item,
                      notes: value,
                    }),
                  )
                }
                placeholder={r.references.notesPlaceholder}
                rows={3}
              />
            </ItemCard>
          ))}
        </div>
      </section>
    </div>
  )
}

function SelectedOfferPage() {
  const { t } = useI18n()
  const [offer, setOffer] = React.useState<CapturedJobOffer | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  const [generationState, setGenerationState] = React.useState<
    'idle' | 'generating' | 'generated'
  >('idle')
  const [atsReview, setAtsReview] = React.useState<AtsReview | null>(null)
  const [recruiterReview, setRecruiterReview] =
    React.useState<RecruiterReview | null>(null)
  const [generatedCv, setGeneratedCv] = React.useState<GeneratedCv | null>(null)
  const [reviewAgreement, setReviewAgreement] =
    React.useState<ReviewAgreement | null>(null)
  const [saveState, setSaveState] = React.useState<'idle' | 'saved' | 'error'>(
    'idle',
  )
  const [saveError, setSaveError] = React.useState<{
    reason: CaptureCurrentJobFailureReason
    details?: string
  } | null>(null)
  const [dashboardSaveState, setDashboardSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  React.useEffect(() => {
    chromeStorage
      .getCapturedJob()
      .then((job) => {
        setOffer(job)
      })
      .catch(() => {
        setOffer(null)
      })
  }, [])

  React.useEffect(() => {
    if (dashboardSaveState !== 'saved') return

    const timeoutId = window.setTimeout(() => {
      setDashboardSaveState('idle')
    }, 1800)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [dashboardSaveState])

  if (!offer) return <div className="panel">{t.common.loadingJob}</div>

  const displayTitle = offer.raw_fields.title || offer.source_url
  const offerMeta = [offer.raw_fields.company, offer.raw_fields.employment_type]
    .filter(Boolean)
    .join(' | ')
  const offerDescription = offer.raw_fields.description || offer.raw_text
  const missingFieldsText = offer.missing_fields?.join(', ')
  const getCaptureErrorMessage = (reason: CaptureCurrentJobFailureReason) => {
    switch (reason) {
      case 'no-active-tab':
        return t.selectedOffer.storeErrorNoActiveTab
      case 'message-failed':
        return t.selectedOffer.storeErrorMessageFailed
      case 'no-job-found':
        return t.selectedOffer.storeErrorNoJobFound
      case 'cache-failed':
        return t.selectedOffer.storeErrorCacheFailed
      default:
        return t.selectedOffer.storeError
    }
  }

  const handleStoreCurrentOffer = async () => {
    setIsSaving(true)
    setSaveState('idle')
    setSaveError(null)

    const result = await captureCurrentJob()

    if (result.ok) {
      setOffer(result.job)
      setSaveState('saved')
    } else {
      setSaveState('error')
      setSaveError({
        reason: result.reason,
        details: result.details,
      })
    }

    setIsSaving(false)
  }

  const handleGenerateResume = async () => {
    if (generationState === 'generating') return

    setGenerationState('generating')
    setAtsReview(null)
    setRecruiterReview(null)
    setGeneratedCv(null)
    setReviewAgreement(null)

    try {
      const resumeMaster = await chromeStorage.getResumeMaster()
      await apiClient.saveProfile(resumeMaster)
      const { jobPostId } = await apiClient.postJobRaw(offer!)
      const result = await apiClient.generateCv(jobPostId, 'fr')
      setGeneratedCv(result.cv)
      setAtsReview(result.atsReview)
      setRecruiterReview(result.recruiterReview)
      setReviewAgreement(result.reviewAgreement)
      setGenerationState('generated')
    } catch {
      const resumeMaster = await chromeStorage.getResumeMaster()
      setGeneratedCv(buildFallbackGeneratedCv(resumeMaster, offer))
      setAtsReview(mockAtsReview)
      setRecruiterReview(mockRecruiterReview)
      setReviewAgreement(mockReviewAgreement)
      setGenerationState('generated')
    }
  }

  const handleSaveDashboard = async () => {
    setDashboardSaveState('saving')

    try {
      const title = offer.raw_fields.title || offer.source_url
      const company = offer.raw_fields.company || 'Unknown company'
      const appliedAt = new Date().toISOString().slice(0, 10)
      const matchScore = atsReview?.score ?? recruiterReview?.score ?? 0

      const nextItem: ApplicationItem = {
        id: `app-${offer.captured_at || Date.now()}`,
        title,
        company,
        status: 'applied',
        appliedAt,
        followUpAt: getDefaultFollowUpDate(),
        matchScore,
      }

      const currentApplications = await chromeStorage.getApplications()
      const existingIndex = currentApplications.findIndex(
        (item) => item.title === title && item.company === company,
      )

      const updatedApplications =
        existingIndex === -1
          ? [nextItem, ...currentApplications]
          : currentApplications.map((item, index) =>
              index === existingIndex
                ? { ...item, ...nextItem, id: item.id }
                : item,
            )

      await chromeStorage.saveApplications(updatedApplications)
      setDashboardSaveState('saved')
    } catch {
      setDashboardSaveState('error')
    }
  }

  const renderList = (items: string[], emptyLabel?: string) => {
    if (items.length === 0) {
      return (
        <p className="muted-text">{emptyLabel ?? t.resumeMaster.noItems}</p>
      )
    }

    return (
      <ul className="simple-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }

  const showGeneratedLayout = generationState !== 'idle'
  const showDecisionBanner =
    generationState === 'generated' && Boolean(reviewAgreement)
  const isApproved = reviewAgreement?.final_status === 'FINAL_APPROVED'
  const coveredKeywords = normalizeCoveredKeywords(
    generatedCv?.keywords_covered ?? [],
  )

  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <div className="selected-offer-hero-head">
          <div>
            <span className="eyebrow">{t.selectedOffer.eyebrow}</span>
            <h1>{displayTitle}</h1>
            <p>{offerMeta}</p>
            {offerDescription ? (
              <p className="offer-description-preview">{offerDescription}</p>
            ) : null}
            {saveState === 'error' ? (
              <div className="panel-note">
                <p>
                  {getCaptureErrorMessage(saveError?.reason ?? 'no-job-found')}
                </p>
                {saveError?.details ? (
                  <pre className="debug-block">{saveError.details}</pre>
                ) : null}
              </div>
            ) : null}
            {missingFieldsText ? (
              <p className="panel-note">
                {`${t.selectedOffer.missingFieldsLabel}: ${missingFieldsText}`}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="secondary-button refresh-offer-button"
            onClick={() => void handleStoreCurrentOffer()}
            disabled={isSaving}
            aria-label={t.selectedOffer.storeCurrentOffer}
            title={t.selectedOffer.storeCurrentOffer}
          >
            <RefreshCw
              size={16}
              className={isSaving ? 'refresh-offer-button-icon is-spinning' : 'refresh-offer-button-icon'}
            />
          </button>
        </div>
      </section>

      <section>
        <article className="panel">
          <div className="action-bar">
            <button
              className="primary-button"
              onClick={handleGenerateResume}
              disabled={generationState === 'generating'}
            >
              {t.selectedOffer.generateResume}
            </button>
            <button
              className={`secondary-button save-dashboard-button${
                dashboardSaveState === 'saved' ? ' is-saved' : ''
              }`}
              onClick={() => void handleSaveDashboard()}
              disabled={dashboardSaveState === 'saving'}
            >
              {dashboardSaveState === 'saved' ? (
                <Check size={16} className="save-dashboard-button-icon" />
              ) : null}
              {t.selectedOffer.saveDashboard}
            </button>
          </div>
          {dashboardSaveState === 'error' ? (
            <p className="panel-note">{t.selectedOffer.saveDashboardError}</p>
          ) : null}
        </article>
      </section>

      {showDecisionBanner ? (
        <section
          className={`result-banner ${isApproved ? 'approved' : 'rejected'}`}
        >
          <strong>
            {isApproved
              ? t.selectedOffer.approvedBanner
              : t.selectedOffer.rejectedBanner}
          </strong>
        </section>
      ) : null}

      {showGeneratedLayout ? (
        <section className="panel tailored-preview-panel">
          <h2>
            {generationState === 'generated'
              ? t.selectedOffer.previewTitle
              : t.selectedOffer.generatingTitle}
          </h2>

          {generationState === 'generating' ? (
            <div className="generation-progress-block">
              <div className="progress-track">
                <div className="progress-fill progress-fill-animated" />
              </div>
            </div>
          ) : (
            <div className="resume-preview-sheet">
              <header className="resume-preview-header">
                <div>
                  <h3>{generatedCv?.header.full_name}</h3>
                  <p>{generatedCv?.header.headline}</p>
                </div>
                <div className="resume-contact-list">
                  <span>{generatedCv?.header.contact.email}</span>
                  <span>{generatedCv?.header.contact.phone}</span>
                  {Object.entries(generatedCv?.header.links ?? {}).map(
                    ([key, value]) => (
                      <span key={key}>{value}</span>
                    ),
                  )}
                </div>
              </header>

              <div className="resume-preview-section">
                <h4>{t.selectedOffer.resumeSummaryTitle}</h4>
                <p>
                  {generatedCv?.summary ?? t.selectedOffer.previewPlaceholder}
                </p>
              </div>

              <div className="resume-preview-section">
                <h4>{t.selectedOffer.resumeSkillsTitle}</h4>
                <div className="tag-list">
                  {(generatedCv?.skills_highlighted ?? []).map((skill) => (
                    <span key={skill} className="tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="resume-preview-section">
                <h4>{t.selectedOffer.resumeExperienceTitle}</h4>
                <div className="stack-sm">
                  {(generatedCv?.experiences_selected ?? []).map((experience) => (
                    <div
                      key={experience.experience_id}
                      className="resume-preview-block"
                    >
                      <strong>{experience.experience_id}</strong>
                      <ul className="simple-list">
                        {(experience.rewritten_bullets ?? []).map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid two-col">
                <div className="resume-preview-section">
                  <h4>{t.selectedOffer.resumeEducationTitle}</h4>
                  <div className="stack-sm">
                    {(generatedCv?.education_selected ?? []).map((education) => (
                      <div key={`${education.school}-${education.year}`}>
                        <strong>{education.school}</strong>
                        <p>{`${education.degree} | ${education.year}`}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="resume-preview-section">
                  <h4>{t.selectedOffer.resumeKeywordsTitle}</h4>
                  {coveredKeywords.length > 0 ? (
                    <div className="keyword-cloud">
                      {coveredKeywords.map((keyword) => (
                        <span key={keyword} className="keyword-pill">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted-text">{t.resumeMaster.noItems}</p>
                  )}
                </div>
              </div>

              <div className="grid two-col">
                <div className="resume-preview-section">
                  <h4>{t.selectedOffer.resumeNotesTitle}</h4>
                  {renderList(generatedCv?.generation_notes ?? [])}
                </div>

                <div className="resume-preview-section">
                  <h4>{t.selectedOffer.resumeOmittedTitle}</h4>
                  {renderList(generatedCv?.omitted_items ?? [])}
                </div>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {showGeneratedLayout ? (
        <section className="grid two-col">
          <article className="panel review-card">
            {generationState === 'generating' ? (
              <>
                <h2>{t.selectedOffer.generatingTitle}</h2>
                <p>{t.selectedOffer.generatingBody}</p>
                <div className="progress-track">
                  <div className="progress-fill progress-fill-animated" />
                </div>
              </>
            ) : (
              <>
                <div className="review-card-head">
                  <h2>{t.selectedOffer.atsPanelTitle}</h2>
                  <span className={`status-pill ${getScorePillClass(atsReview?.score ?? 0)}`}>
                    {`${t.selectedOffer.scoreLabel}: ${atsReview?.score ?? 0}`}
                  </span>
                </div>
                <p className="panel-note">
                  {t.selectedOffer.passedLabel}:{' '}
                  <span className={getPassedStateClass(Boolean(atsReview?.passed))}>
                    {atsReview?.passed ? t.selectedOffer.yes : t.selectedOffer.no}
                  </span>
                </p>
                <h3>{t.selectedOffer.hardFiltersTitle}</h3>
                <div className="stack-sm">
                  {(atsReview?.hard_filters_status ?? []).map((item) => (
                    <div key={item.filter} className="hard-filter-card">
                      <div className="hard-filter-head">
                        <strong>{item.filter}</strong>
                        <span className={getReviewTagClass(item.status)}>{item.status}</span>
                      </div>
                      <p>{item.evidence}</p>
                    </div>
                  ))}
                </div>
                <h3>{t.selectedOffer.matchedKeywordsTitle}</h3>
                <div className="tag-list">
                  {(atsReview?.matched_keywords ?? []).map((keyword) => (
                    <span key={keyword} className="tag">
                      {keyword}
                    </span>
                  ))}
                </div>
                <h3>{t.selectedOffer.missingKeywordsTitle}</h3>
                <div className="tag-list">
                  {(atsReview?.missing_keywords ?? []).map((keyword) => (
                    <span key={keyword} className="tag">
                      {keyword}
                    </span>
                  ))}
                </div>
                <h3>{t.selectedOffer.formatFlagsTitle}</h3>
                {renderList(
                  atsReview?.format_flags ?? [],
                  t.selectedOffer.noFormatFlags,
                )}
                <h3>{t.selectedOffer.recommendationsTitle}</h3>
                {renderList(atsReview?.recommendations ?? [])}
              </>
            )}
          </article>

          <article className="panel review-card">
            {generationState === 'generating' ? (
              <>
                <h2>{t.selectedOffer.generatingTitle}</h2>
                <p>{t.selectedOffer.generatingBody}</p>
                <div className="progress-track">
                  <div className="progress-fill progress-fill-animated" />
                </div>
              </>
            ) : (
              <>
                <div className="review-card-head">
                  <h2>{t.selectedOffer.recruiterPanelTitle}</h2>
                  <span className={`status-pill ${getScorePillClass(recruiterReview?.score ?? 0)}`}>
                    {`${t.selectedOffer.scoreLabel}: ${recruiterReview?.score ?? 0}`}
                  </span>
                </div>
                <p className="panel-note">
                  {t.selectedOffer.passedLabel}:{' '}
                  <span className={getPassedStateClass(Boolean(recruiterReview?.passed))}>
                    {recruiterReview?.passed
                      ? t.selectedOffer.yes
                      : t.selectedOffer.no}
                  </span>
                </p>
                <div className="review-score-grid">
                  <span>{`${t.selectedOffer.readabilityLabel}: ${recruiterReview?.readability_score ?? 0}`}</span>
                  <span>{`${t.selectedOffer.credibilityLabel}: ${recruiterReview?.credibility_score ?? 0}`}</span>
                  <span>{`${t.selectedOffer.coherenceLabel}: ${recruiterReview?.coherence_score ?? 0}`}</span>
                  <span>{`${t.selectedOffer.evidenceLabel}: ${recruiterReview?.evidence_score ?? 0}`}</span>
                </div>
                <h3>{t.selectedOffer.strengthsTitle}</h3>
                {renderList(recruiterReview?.strengths ?? [])}
                <h3>{t.selectedOffer.concernsTitle}</h3>
                {renderList(recruiterReview?.concerns ?? [])}
                <h3>{t.selectedOffer.recommendationsTitle}</h3>
                {renderList(recruiterReview?.recommendations ?? [])}
              </>
            )}
          </article>
        </section>
      ) : null}

    </div>
  )
}

function DashboardPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [applications, setApplications] = React.useState<ApplicationItem[] | null>(
    null,
  )

  React.useEffect(() => {
    apiClient
      .getApplications()
      .then(setApplications)
      .catch(() => setApplications([]))
  }, [])

  if (!applications) return <div className="panel">{t.common.loadingApplications}</div>

  const getFollowUpState = (followUpAt: string) => {
    if (!followUpAt) {
      return {
        tone: 'clear' as const,
        label: t.dashboard.noFollowUp,
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const followUpDate = new Date(followUpAt)
    followUpDate.setHours(0, 0, 0, 0)

    const diffDays = Math.round(
      (followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (diffDays <= 0) {
      return {
        tone: 'now' as const,
        label: t.dashboard.followUpNow,
      }
    }

    if (diffDays <= 3) {
      return {
        tone: 'soon' as const,
        label: `${t.dashboard.followUpSoon} ${followUpAt}`,
      }
    }

    return {
      tone: 'clear' as const,
      label: `${t.dashboard.followUpLater} ${followUpAt}`,
    }
  }

  const handleStatusChange = async (
    applicationId: string,
    nextStatus: ApplicationItem['status'],
  ) => {
    const nextApplications = applications.map((application) =>
      application.id === applicationId
        ? { ...application, status: nextStatus }
        : application,
    )

    setApplications(nextApplications)
    await chromeStorage.saveApplications(nextApplications)
  }

  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <span className="eyebrow">{t.dashboard.eyebrow}</span>
        <h1>{`${applications.length} ${t.dashboard.heroSuffix}`}</h1>
      </section>

      <section className="panel">
        <div className="table-head">
          <span>{t.dashboard.role}</span>
          <span>{t.dashboard.status}</span>
          <span>{t.dashboard.followUp}</span>
          <span>{t.dashboard.actions}</span>
        </div>
        <div className="table-body">
          {applications.map((application: ApplicationItem) => {
            const followUpState = getFollowUpState(application.followUpAt)

            return (
              <div key={application.id} className="table-row">
                <div>
                  <strong>{application.title}</strong>
                  <span>{application.company}</span>
                </div>
                <label className="dashboard-status-field">
                  <span className="sr-only">{t.dashboard.status}</span>
                  <select
                    className="dashboard-status-select"
                    value={application.status}
                    onChange={(event) =>
                      void handleStatusChange(
                        application.id,
                        event.target.value as ApplicationItem['status'],
                      )
                    }
                  >
                    <option value="saved">{t.dashboard.statusPending}</option>
                    <option value="applied">{t.dashboard.statusSent}</option>
                    <option value="interviewing">
                      {t.dashboard.statusInterviewSet}
                    </option>
                    <option value="offered">{t.dashboard.statusOffer}</option>
                    <option value="rejected">{t.dashboard.statusRejected}</option>
                    <option value="withdrawn">
                      {t.dashboard.statusWithdrawn}
                    </option>
                  </select>
                </label>
                <span
                  className={`dashboard-follow-up dashboard-follow-up-${followUpState.tone}`}
                >
                  {followUpState.tone === 'now' ? (
                    <CircleAlert size={16} />
                  ) : followUpState.tone === 'soon' ? (
                    <Clock3 size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>{followUpState.label}</span>
                </span>
                <button
                  type="button"
                  className="secondary-button dashboard-action-button"
                  onClick={() => navigate('/interview')}
                >
                  {t.dashboard.openInterviewPrep}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function InterviewPrepPage() {
  const { t } = useI18n()
  const prep = useAsyncValue(() => apiClient.getInterviewPrep())

  if (!prep) return <div className="panel">{t.common.loadingInterviewPrep}</div>

  return (
    <div className="page-stack">
      <section className="hero-card compact">
        <span className="eyebrow">{t.interviewPrep.eyebrow}</span>
        <h1>{t.interviewPrep.title}</h1>
        <p>{t.interviewPrep.intro}</p>
      </section>

      <section className="grid two-col">
        <article className="panel">
          <h2>{t.interviewPrep.snapshotTitle}</h2>
          <p>{prep.companySnapshot}</p>

          <h2>{t.interviewPrep.questionsTitle}</h2>
          <ul className="simple-list">
            {prep.likelyQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <h2>{t.interviewPrep.storiesTitle}</h2>
          <ul className="simple-list">
            {prep.storiesToPrepare.map((story) => (
              <li key={story}>{story}</li>
            ))}
          </ul>

          <h2>{t.interviewPrep.followUpDraftTitle}</h2>
          <p>{prep.followUpDraft}</p>
        </article>
      </section>
    </div>
  )
}

function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/offer" element={<SelectedOfferPage />} />
            <Route path="/resume" element={<MasterResumePage />} />
            <Route path="/interview" element={<InterviewPrepPage />} />
          </Routes>
        </Shell>
      </HashRouter>
    </I18nProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)



