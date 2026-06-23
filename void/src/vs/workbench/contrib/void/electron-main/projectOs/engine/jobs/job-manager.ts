import type { JobStatus, AnalysisProgress } from '../../../../common/projectOsTypes.js'

const jobs = new Map<string, JobStatus>()
const listeners = new Map<string, Set<(progress: AnalysisProgress) => void>>()

export function createJob(jobId: string): JobStatus {
  const status: JobStatus = {
    jobId,
    status: 'queued',
    progress: 0,
    stage: 'file_scan',
    error: null,
  }
  jobs.set(jobId, status)
  return status
}

export function getJob(jobId: string): JobStatus | null {
  return jobs.get(jobId) ?? null
}

export function updateJob(jobId: string, update: Partial<JobStatus>): void {
  const job = jobs.get(jobId)
  if (!job) return
  Object.assign(job, update)
}

export function failJob(jobId: string, error: string): void {
  updateJob(jobId, { status: 'error', error })
}

export function completeJob(jobId: string): void {
  updateJob(jobId, { status: 'complete', progress: 100 })
}

export function onProgress(jobId: string, listener: (p: AnalysisProgress) => void): () => void {
  if (!listeners.has(jobId)) listeners.set(jobId, new Set())
  listeners.get(jobId)!.add(listener)
  return () => listeners.get(jobId)?.delete(listener)
}

export function emitProgress(progress: AnalysisProgress): void {
  const subs = listeners.get(progress.jobId)
  if (subs) subs.forEach(fn => fn(progress))
}

export function cleanupJob(jobId: string): void {
  jobs.delete(jobId)
  listeners.delete(jobId)
}

export function getAllJobs(): JobStatus[] {
  return Array.from(jobs.values())
}
