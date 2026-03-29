import type { CapturedJobOffer } from '../shared/types'

type SelectorProbe = {
  selector: string
  text: string
}

type CaptureDebugPayload = {
  url: string
  documentTitle: string
  fields: {
    title: SelectorProbe[]
    company: SelectorProbe[]
    location: SelectorProbe[]
    description: SelectorProbe[]
  }
}

const probeSelectors = (selectors: string[]): SelectorProbe[] =>
  selectors.map((selector) => ({
    selector,
    text: document.querySelector(selector)?.textContent?.trim() ?? '',
  }))

const cleanText = (value: string | null | undefined) => value?.trim() ?? ''

const readText = (selectors: string[]) => {
  for (const selector of selectors) {
    const text = cleanText(document.querySelector(selector)?.textContent)

    if (text) {
      return text
    }
  }

  return ''
}

const titleSelectors = [
  '.job-details-jobs-unified-top-card__job-title h1',
  '.jobs-unified-top-card__job-title h1',
  'h1',
]

const companySelectors = [
  'div[aria-label^="Entreprise"] a[href*="/company/"]',
  'a[href*="/company/"][href*="/life/"]',
  '.job-details-jobs-unified-top-card__company-name a',
  '.jobs-unified-top-card__company-name a',
]

const locationSelectors = [
  'div[aria-label^="Entreprise"] ~ p span:first-child',
  '.job-details-jobs-unified-top-card__primary-description-container',
  '.jobs-unified-top-card__primary-description-container',
]

const descriptionSelectors = [
  '[data-sdui-component*="aboutTheJob"] [data-testid="expandable-text-box"]',
  '[componentkey*="JobDetails_AboutTheJob"] [data-testid="expandable-text-box"]',
  '[data-sdui-component*="aboutTheJob"]',
  '[componentkey*="JobDetails_AboutTheJob"]',
  '.jobs-description-content__text',
  '.jobs-box__html-content',
]

const employmentTypeSelectors = ['a[aria-disabled="false"] span']

const locationPattern = /^(?<location>.+?),\s*(?<region>.+?),\s*(?<country>.+)$/

const extractLocationFromMetadata = () => {
  for (const paragraph of document.querySelectorAll('p')) {
    const spans = Array.from(paragraph.querySelectorAll('span'))
      .map((node) => cleanText(node.textContent))
      .filter(Boolean)

    for (const text of spans) {
      if (locationPattern.test(text)) {
        return text
      }
    }
  }

  return ''
}

const extractEmploymentType = () => {
  const tokens = Array.from(
    document.querySelectorAll(
      'a[aria-disabled="false"] span, button span, p span',
    ),
  )
    .map((node) => cleanText(node.textContent))
    .filter(Boolean)

  return (
    tokens.find((text) =>
      [
        'Full-time',
        'Part-time',
        'Contract',
        'Internship',
        'Temporary',
        'Temps plein',
        'Temps partiel',
        'Freelance',
        'Stage',
        'CDI',
        'CDD',
      ].includes(text),
    ) ?? ''
  )
}

const extractRawText = () =>
  readText(descriptionSelectors) || cleanText(document.body?.innerText)

const getCaptureDebugPayload = (): CaptureDebugPayload => ({
  url: window.location.href,
  documentTitle: document.title.trim(),
  fields: {
    title: probeSelectors(titleSelectors),
    company: probeSelectors(companySelectors),
    location: probeSelectors(locationSelectors),
    description: probeSelectors(descriptionSelectors),
  },
})

const extractJobOffer = (): CapturedJobOffer | null => {
  const title = document.title.trim()
  const company = readText(companySelectors)
  const location = readText(locationSelectors) || extractLocationFromMetadata()
  const employmentType =
    readText(employmentTypeSelectors) || extractEmploymentType()
  const rawText = extractRawText()
  const missingFields = [
    !title ? 'title' : null,
    !company ? 'company' : null,
    !location ? 'location' : null,
    !employmentType ? 'employment_type' : null,
  ].filter(
    (field): field is NonNullable<CapturedJobOffer['missing_fields']>[number] =>
      Boolean(field),
  )

  if (
    !title &&
    !company &&
    !location &&
    !employmentType &&
    !rawText &&
    !document.title.trim()
  ) {
    return null
  }

  return {
    source: 'linkedin',
    source_url: window.location.href,
    captured_at: new Date().toISOString(),
    raw_text: rawText,
    raw_fields: {
      title,
      company,
      location,
      employment_type: employmentType,
      description: rawText,
    },
    missing_fields: missingFields,
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'dreamjob:capture-current-job') {
    sendResponse({
      job: extractJobOffer(),
      debug: getCaptureDebugPayload(),
    })
  }
})
