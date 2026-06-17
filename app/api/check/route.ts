import { NextRequest } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`HTTPエラー: ${res.status}`);
  return res.text();
}

function extractH1(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return 'H1なし';
  return match[1].replace(/<[^>]+>/g, '').trim();
}

async function checkWithGemini(
  html: string,
  sheetUrl: string,
  pageUrl: string,
  context: string,
  apiKey: string
): Promise<string> {
  const maxLength = 80000;
  const truncated = html.length > maxLength
    ? html.substring(0, maxLength) + '\n<!-- 省略 -->'
    : html;

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
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(300000),
  });

  const json = await res.json();
  console.log(`[${pageUrl}] Gemini response:`, JSON.stringify(json).slice(0, 300));

  if (json.error) throw new Error(json.error.message);
  if (!json.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Geminiからの応答が空です: ' + JSON.stringify(json).slice(0, 200));
  }

  return json.candidates[0].content.parts[0].text;
}

export async function POST(req: NextRequest) {
  const { urls, sheetUrl, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY!;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'APIキーが設定されていません' }), { status: 500 });
  }

  // ストリーミングレスポンス：1件完了するたびに送信
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
async start(controller) {
  const CONCURRENCY = 5;
  const queue = urls.filter((u: string) => u.trim());
  let index = 0;
  let active = 0;

  await new Promise<void>((resolve) => {
    function next() {
      while (active < CONCURRENCY && index < queue.length) {
        const url = queue[index++].trim();
        active++;

        const startTime = Date.now();
        console.log(`[CHECK START] ${url}`);

        fetchHtml(url)
          .then(html => {
            console.log(`[HTML OK] ${url} - ${html.length}文字`);
            const h1 = extractH1(html);
            return checkWithGemini(html, sheetUrl, url, context, apiKey)
              .then(result => {
                console.log(`[GEMINI OK] ${url}`);
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                const data = JSON.stringify({ url, h1, status: 'success', result, elapsed });
                controller.enqueue(encoder.encode(data + '\n'));
              });
          })
          .catch((e: any) => {
            console.error(`[ERROR] ${url}:`, e.message);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const data = JSON.stringify({ url, h1: 'エラー', status: 'error', result: e.message, elapsed });
            controller.enqueue(encoder.encode(data + '\n'));
          })
          .finally(() => {
            active--;
            if (index < queue.length) {
              next();
            } else if (active === 0) {
              console.log(`[ALL DONE]`);
              resolve();
            }
          });
      }
    }

    next();
  });

  controller.close();
}
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}

export const maxDuration = 300;