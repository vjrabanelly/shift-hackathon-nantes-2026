import type { CapturedJobOffer } from '../../shared/types'

export type CaptureCurrentJobFailureReason =
  | 'no-active-tab'
  | 'message-failed'
  | 'no-job-found'
  | 'cache-failed'

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

export type CaptureCurrentJobResult =
  | {
      ok: true
      job: CapturedJobOffer
    }
  | {
      ok: false
      reason: CaptureCurrentJobFailureReason
      details?: string
    }

export const captureCurrentJob = async (): Promise<CaptureCurrentJobResult> => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) {
    return {
      ok: false,
      reason: 'no-active-tab',
    }
  }

  let response:
    | {
        job?: CapturedJobOffer | null
        debug?: CaptureDebugPayload
      }
    | undefined

  try {
    response = await chrome.tabs.sendMessage(tab.id, {
      type: 'dreamjob:capture-current-job',
    })
  } catch (error) {
    return {
      ok: false,
      reason: 'message-failed',
      details: error instanceof Error ? error.message : String(error),
    }
  }

  if (!response?.job) {
    return {
      ok: false,
      reason: 'no-job-found',
      details: response?.debug
        ? JSON.stringify(response.debug, null, 2)
        : 'The LinkedIn page did not return a valid job payload.',
    }
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'dreamjob:cache-captured-job',
      payload: response.job,
    })
  } catch (error) {
    return {
      ok: false,
      reason: 'cache-failed',
      details: error instanceof Error ? error.message : String(error),
    }
  }

  return {
    ok: true,
    job: response.job,
  }
}

export const openSidePanelForCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.id) {
    return
  }

  await chrome.runtime.sendMessage({
    type: 'dreamjob:open-side-panel',
    tabId: tab.id,
  })
}
