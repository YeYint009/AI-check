import { appendResultToJob, getJob } from "./job";
import { captureScreenshot } from "./screenshot";
import { checkImageWithGemini } from "./imageChecker";

async function fetchH1(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return "H1なし";
    const html = await res.text();
    const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!match) return "H1なし";
    return match[1].replace(/<[^>]+>/g, "").trim();
  } catch {
    return "H1なし";
  }
}

export async function runScreenshotJob(
  jobId: string,
  urls: string[],
  sheetUrl: string,
  context: string,
  apiKey: string,
): Promise<void> {
  const CONCURRENCY = 1;
  const queue = [...urls];
  let index = 0;
  let active = 0;

  await new Promise<void>((resolve) => {
    function next() {
      while (active < CONCURRENCY && index < queue.length) {
        const url = queue[index++].trim();
        active++;

        const startTime = Date.now();
        console.log(`[SCREENSHOT JOB ${jobId}] CHECK START ${url}`);

        Promise.all([captureScreenshot(url), fetchH1(url)])
          .then(async ([{ fullImage, thumbnail }, h1]) => {
            console.log(
              `[SCREENSHOT JOB ${jobId}] CAPTURE OK ${url} - full:${fullImage.length}bytes, thumb:${thumbnail.length}bytes, H1: ${h1}`,
            );
            const result = await checkImageWithGemini(
              fullImage,
              sheetUrl,
              url,
              context,
              apiKey,
            );
            console.log(`[SCREENSHOT JOB ${jobId}] GEMINI OK ${url}`);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            const screenshotBase64 = thumbnail.toString("base64");

            await appendResultToJob(jobId, {
              url,
              h1,
              status: "success",
              result,
              elapsed,
              screenshotBase64,
            });
          })
          .catch(async (e: any) => {
            console.error(`[SCREENSHOT JOB ${jobId}] ERROR ${url}:`, e.message);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            await appendResultToJob(jobId, {
              url,
              h1: "エラー",
              status: "error",
              result: e.message,
              elapsed,
            });
          })
          .finally(async () => {
            active--;

            const currentJob = await getJob(jobId);
            if (currentJob?.status === "cancelled") {
              console.log(`[SCREENSHOT JOB ${jobId}] CANCELLED`);
              if (active === 0) resolve();
              return;
            }

            if (index < queue.length) {
              next();
            } else if (active === 0) {
              resolve();
            }
          });
      }
    }
    next();
  });

  console.log(`[SCREENSHOT JOB ${jobId}] BATCH DONE`);
}
