import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTPエラー: ${res.status}`);
  return res.text();
}

function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (!match) return 'H1なし';
  return match[1].replace(/<[^>]+>/g, '').trim();
}

async function checkWithGemini(html: string, sheetUrl: string, pageUrl: string, context: string, apiKey: string): Promise<string> {
  const maxLength = 80000;
  const truncated = html.length > maxLength ? html.substring(0, maxLength) + '\n<!-- 省略 -->' : html;

  const prompt = `${context}

# 対象ページURL
${pageUrl}

# 制作コンセプトシート（「新制作コンセプトシート」のタブのみ参照してください）
- ${sheetUrl}

# チェック対象HTML
\`\`\`html
${truncated}
\`\`\``;

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
    }),
    signal: AbortSignal.timeout(120000),
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.candidates[0].content.parts[0].text;
}

export async function POST(req: NextRequest) {
  const { urls, sheetUrl, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY!;

  const results = [];

  for (const url of urls) {
    const startTime = Date.now();
    try {
      const html = await fetchHtml(url);
      const h1 = extractH1(html);
      const result = await checkWithGemini(html, sheetUrl, url, context, apiKey);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      results.push({ url, h1, status: 'success', result, elapsed });
    } catch (e: any) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      results.push({ url, h1: 'エラー', status: 'error', result: e.message, elapsed });
    }

    // レート制限対策
    await new Promise(r => setTimeout(r, 1000));
  }

  return NextResponse.json(results);
}