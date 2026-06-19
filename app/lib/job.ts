import { redis } from './redis';
import { Job, CheckResult } from '../types';

const JOB_PREFIX = 'job:';
const JOB_TTL = 60 * 60 * 2; // 2時間で自動削除

export async function createJob(jobId: string, sheetUrl: string, totalUrls: number): Promise<void> {
  const job: Job = {
    id: jobId,
    status: 'running',
    sheetUrl,
    totalUrls,
    results: [],
    createdAt: Date.now(),
  };
  await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), { ex: JOB_TTL });
}

export async function getJob(jobId: string): Promise<Job | null> {
  const raw = await redis.get<string>(`${JOB_PREFIX}${jobId}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw as unknown as Job;
}

export async function appendResultToJob(jobId: string, result: CheckResult): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  job.results.push(result);
  await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), { ex: JOB_TTL });
}

export async function completeJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  job.status = 'completed';
  await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), { ex: JOB_TTL });
}

export async function cancelJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  job.status = 'cancelled';
  await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job), { ex: JOB_TTL });
}

const BATCH_PREFIX = 'job_batches:';

export async function setTotalBatches(jobId: string, totalBatches: number): Promise<void> {
  await redis.set(`${BATCH_PREFIX}${jobId}`, JSON.stringify({ total: totalBatches, completed: 0 }), { ex: JOB_TTL });
}

export async function incrementCompletedBatch(jobId: string): Promise<{ total: number; completed: number }> {
  const raw = await redis.get<string>(`${BATCH_PREFIX}${jobId}`);
  const data = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { total: 0, completed: 0 };
  data.completed += 1;
  await redis.set(`${BATCH_PREFIX}${jobId}`, JSON.stringify(data), { ex: JOB_TTL });
  return data;
}