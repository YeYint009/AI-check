import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob } from '../../lib/job';
import { runCheckJob } from '../../lib/checkRunner';

export async function POST(req: NextRequest) {
  const { urls, sheetUrl, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY!;

  if (!apiKey) {
    return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
  }

  const filteredUrls = urls.filter((u: string) => u.trim());
  if (filteredUrls.length === 0) {
    return NextResponse.json({ error: 'URLが指定されていません' }, { status: 400 });
  }

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await createJob(jobId, sheetUrl, filteredUrls.length);

  // after()を使うことで、レスポンスを返した後もVercelが処理の継続を保証する
  after(async () => {
    try {
      await runCheckJob(jobId, filteredUrls, sheetUrl, context, apiKey);
    } catch (e) {
      console.error(`[JOB ${jobId}] 致命的エラー:`, e);
    }
  });

  return NextResponse.json({ jobId });
}

export const maxDuration = 60;