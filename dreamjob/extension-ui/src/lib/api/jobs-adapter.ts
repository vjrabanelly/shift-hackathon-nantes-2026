import type {
  ApplicationItem,
  CapturedJobOffer,
  CapturedJobOfferRawFields,
  JobStatus,
} from '../../shared/types'

// ---------------------------------------------------------------------------
// Server-side types (mirrors server responses — extension-local definitions)
// ---------------------------------------------------------------------------

export interface ServerApplicationItem {
  id: string
  title: string
  company: string
  status: string
  appliedAt: string
}

export interface ServerCapturedJobRawFields {
  title?: string
  company?: string
  location?: string
  employment_type?: string
  salary?: string
  description?: string
  requirements?: string
  posted_date?: string
}

export interface ServerCapturedJobOffer {
  source: string
  source_url: string
  captured_at: string
  html_snapshot_ref?: string
  raw_text: string
  raw_fields: ServerCapturedJobRawFields
  missing_fields?: string[]
}

// ---------------------------------------------------------------------------
// GET /api/jobs -> ApplicationItem[]
// ---------------------------------------------------------------------------

const VALID_RAW_FIELD_KEYS: Array<keyof CapturedJobOfferRawFields> = [
  'title',
  'company',
  'location',
  'employment_type',
  'description',
]

export function serverApplicationsToApplicationItems(
  items: ServerApplicationItem[],
): ApplicationItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    company: item.company,
    status: item.status as JobStatus,
    appliedAt: item.appliedAt,
    followUpAt: '',
    matchScore: 0,
  }))
}

// ---------------------------------------------------------------------------
// GET /api/jobs/current -> CapturedJobOffer
// ---------------------------------------------------------------------------

export function serverCapturedJobToCapturedJobOffer(
  job: ServerCapturedJobOffer,
): CapturedJobOffer {
  return {
    source: job.source as 'linkedin',
    source_url: job.source_url,
    captured_at: job.captured_at,
    html_snapshot_ref: job.html_snapshot_ref,
    raw_text: job.raw_text,
    raw_fields: {
      title: job.raw_fields.title ?? '',
      company: job.raw_fields.company ?? '',
      location: job.raw_fields.location ?? '',
      employment_type: job.raw_fields.employment_type ?? '',
      description: job.raw_fields.description ?? '',
    },
    missing_fields: job.missing_fields?.filter(
      (f): f is keyof CapturedJobOfferRawFields =>
        VALID_RAW_FIELD_KEYS.includes(f as keyof CapturedJobOfferRawFields),
    ),
  }
}
