import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '../../lib/job';

export async function POST(req: NextRequest) {
  const { sheetUrl, totalUrls } = await req.json();

  const jobId = `ss-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await createJob(jobId, sheetUrl, totalUrls);

  return NextResponse.json({ jobId });
}