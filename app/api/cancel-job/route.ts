import { NextRequest, NextResponse } from 'next/server';
import { cancelJob } from '../../lib/job';

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  if (!jobId) {
    return NextResponse.json({ error: 'jobIdが必要です' }, { status: 400 });
  }
  await cancelJob(jobId);
  return NextResponse.json({ success: true });
}