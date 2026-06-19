import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createJob, setTotalBatches, incrementCompletedBatch, completeJob } from '../../lib/job';
import { runCheckJob } from '../../lib/checkRunner';

const BATCH_SIZE = 4; // 1リクエストあたりの処理件数（60秒以内に収まる目安）

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

  // バッチに分割
  const batches: string[][] = [];
  for (let i = 0; i < filteredUrls.length; i += BATCH_SIZE) {
    batches.push(filteredUrls.slice(i, i + BATCH_SIZE));
  }

  await createJob(jobId, sheetUrl, filteredUrls.length);
  await setTotalBatches(jobId, batches.length);

  // 各バッチを並行して起動（それぞれ独立したafter()で実行）
  batches.forEach((batchUrls) => {
    after(async () => {
      try {
        await runCheckJob(jobId, batchUrls, sheetUrl, context, apiKey);
        const progress = await incrementCompletedBatch(jobId);
        if (progress.completed >= progress.total) {
          await completeJob(jobId);
        }
      } catch (e) {
        console.error(`[JOB ${jobId}] バッチ処理エラー:`, e);
        const progress = await incrementCompletedBatch(jobId);
        if (progress.completed >= progress.total) {
          await completeJob(jobId);
        }
      }
    });
  });

  return NextResponse.json({ jobId });
}

export const maxDuration = 60;