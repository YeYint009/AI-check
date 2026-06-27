const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

export async function checkImageWithGemini(
  imageBuffer: Buffer,
  sheetUrl: string,
  pageUrl: string,
  context: string,
  apiKey: string
): Promise<string> {
  const base64Image = imageBuffer.toString('base64');

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const prompt = `現在の日付は${today}です。

${context}

# 対象ページURL
${pageUrl}

# 制作コンセプトシート
- ${sheetUrl}

# 出力形式
修正点がある場合は以下のMarkdown表形式で出力してください：
| # | 箇所 | 問題内容 | 修正案 |
|---|------|----------|--------|
問題がなければ「問題なし」と一言だけ返してください。`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: 'image/jpeg',
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });

  const json = await res.json();
  console.log(`[IMAGE ${pageUrl}] Gemini response:`, JSON.stringify(json).slice(0, 300));

  if (json.error) throw new Error(json.error.message);
  if (!json.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Geminiからの応答が空です: ' + JSON.stringify(json).slice(0, 200));
  }

  return json.candidates[0].content.parts[0].text;
}