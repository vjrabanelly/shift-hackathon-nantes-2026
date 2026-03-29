import { appConfig } from '../config'
import { chromeStorage } from '../chrome/storage'
import { mockApplications, mockCapturedJob, mockInterviewPrep, mockResumeMaster } from '../../shared/mock-data'
import type { ApplicationItem, CapturedJobOffer, InterviewPrepPack, ResumeMaster } from '../../shared/types'
import {
  serverProfileToResumeMaster,
  resumeMasterToServerProfile,
  extractionToResumeMaster,
  type ServerProfile,
  type ServerProfileData,
} from './profile-adapter'
import {
  serverApplicationsToApplicationItems,
  serverCapturedJobToCapturedJobOffer,
  type ServerApplicationItem,
  type ServerCapturedJobOffer,
} from './jobs-adapter'
import {
  serverOrchestratorToExtension,
  type ServerOrchestratorResult,
  type CvGenerationResult,
} from './cvs-adapter'

export { extractionToResumeMaster }

export interface ResumeUploadResponse {
  id: string
  status: string
  extractedData: {
    data: ServerProfileData
  }
  error?: string
}

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`)
  }

  return response.json() as Promise<T>
}

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error((errorBody as { error?: string }).error || `Request failed for ${path}`)
  }

  return response.json() as Promise<T>
}

const putJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`)
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  async getResumeMaster(): Promise<ResumeMaster> {
    if (appConfig.useMockData) return mockResumeMaster
    const serverProfile = await getJson<ServerProfile>('/profile')
    return serverProfileToResumeMaster(serverProfile)
  },

  async saveProfile(master: ResumeMaster): Promise<void> {
    const body = resumeMasterToServerProfile(master)
    await putJson('/profile', body)
  },

  async getCapturedJob(): Promise<CapturedJobOffer> {
    if (appConfig.useMockData) return mockCapturedJob
    const serverJob = await getJson<ServerCapturedJobOffer>('/jobs/current')
    return serverCapturedJobToCapturedJobOffer(serverJob)
  },

  async getApplications(): Promise<ApplicationItem[]> {
    if (appConfig.useMockData) return mockApplications
    try {
      const localApplications = await chromeStorage.getApplications()
      const serverItems = await getJson<ServerApplicationItem[]>('/jobs')
      const serverApplications = serverApplicationsToApplicationItems(serverItems)
      const mergedApplications = [...localApplications]

      for (const serverApplication of serverApplications) {
        const existingIndex = mergedApplications.findIndex(
          (item) =>
            item.title === serverApplication.title &&
            item.company === serverApplication.company,
        )

        if (existingIndex === -1) {
          mergedApplications.push(serverApplication)
        }
      }

      return mergedApplications
    } catch {
      return chromeStorage.getApplications()
    }
  },

  async getInterviewPrep(): Promise<InterviewPrepPack> {
    // TODO: replace with real endpoint in next version
    return mockInterviewPrep
  },

  async postJobRaw(offer: CapturedJobOffer): Promise<{ jobPostId: string }> {
    const body = {
      source: offer.source,
      sourceUrl: offer.source_url,
      rawText: offer.raw_text,
      htmlSnapshotRef: offer.html_snapshot_ref,
      rawFields: offer.raw_fields,
    }
    const result = await postJson<{ raw: unknown; normalized: { id: string } }>('/jobs/raw', body)
    return { jobPostId: result.normalized.id }
  },

  async generateCv(jobPostId: string, language: string): Promise<CvGenerationResult> {
    const result = await postJson<ServerOrchestratorResult>('/cvs/generate', { jobPostId, language })
    return serverOrchestratorToExtension(result)
  },

  async uploadResume(file: File): Promise<ResumeUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${appConfig.apiBaseUrl}/resume/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new Error((errorBody as { error?: string }).error || `Upload failed (${response.status})`)
    }

    return response.json() as Promise<ResumeUploadResponse>
  },
}
