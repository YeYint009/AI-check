import { NextRequest, NextResponse } from 'next/server';
import { runScreenshotJob } from '../../lib/screenshotRunner';

export async function POST(req: NextRequest) {
  const { jobId, urls, sheetUrl, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY!;

  if (!apiKey) {
    return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 });
  }

  try {
    await runScreenshotJob(jobId, urls, sheetUrl, context, apiKey);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const maxDuration = 60;