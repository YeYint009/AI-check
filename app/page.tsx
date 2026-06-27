"use client";

import { useState, useEffect } from "react";
import Header from "./components/Header";
import InputForm from "./components/InputForm";
import ImageContextModal from "./components/ImageContextModal";
import { useRouter } from "next/navigation";

const DEFAULT_CONTEXT = `現在の日付を基準にチェックしてください。

顧客のサイト作成を行っています。
サイトに不備がないようにしたいです。
以下のhtmlをチェックしてください。
チェックの対象はこのhtmlだけにしてください。
修正すべき点があれば、その箇所を具体的に提示し、必ず表形式でまとめてください。
提示する修正点は今回のhtmlに含まれるものだけにしてください。
問題がなければ「問題なし」と一言だけ返してください。

# チェック内容
- 「サンプルテキスト」などのサンプルが残っていないか
- 文章の内容に「制作コンセプトシート」との相違はないか
- 会社名や会社住所等の会社に関わる重要な情報に誤りはないか
- 会社の商圏（エリア）とページの内容に相違はないか
- 誤字・脱字はないか
- 表記揺れはないか（例：「お問い合わせ」「お問合せ」）
- 外部サイトへのリンクのtarget属性は"_blank"となっているか
- 日本語が自然的に書かれているか
- altに不適切な名前が入っていないか

# 出力形式
修正点がある場合は以下のMarkdown表形式で出力してください：
| # | 箇所 | 問題内容 | 修正案 |
|---|------|----------|--------|
問題がなければ「問題なし」と一言だけ返してください。`;

const DEFAULT_IMAGE_CONTEXT = `顧客のサイト作成を行っています。
サイトに不備がないようにしたいです。
ページのキャプチャを送るので、このキャプチャのチェックをしてください。
チェックの対象はこのキャプチャ1つだけにしてください。
修正すべき点があれば、その箇所を具体的に提示し、表形式でまとめてください。
提示する修正点は今回のキャプチャに含まれるものだけにしてください。

# チェック内容
- 画像がテキストの内容に合っているか
- 「制作コンセプトシート」のデザインコンセプトと合致しているか
- 単語の途中で見出しを改行している、文節の途中で見出しを改行しているものはないか
- 「画像のチェックポイント」と照らし合わせ、基準に適った画像が使用されているか

# 画像のチェックポイント

## ボケていない
- ボケている画像はNG

## 人の顔が切れている
- 人の顔が途中で切れている、文字と顔が重なっている画像はNGです。

## イラストのテイストがあっているか
1つのセクション内でイラストを複数使用している場合、そのイラストのテイストがバラバラなのはNG。

## AI生成で変になっている・AIっぽくて違和感
- 手が変なところにあるなどのAI生成によって変になっている画像はNG
- いかにもAIで生成した違和感のある画像はNGです。

## エリアと写真があっていない
- 雪が降らないエリアなのに、外が雪景色の写真となっているなどはNG
- エリアと写真は一致している必要があります。

## 文章と画像が一致しているか
- 文章と画像が一致していないのはNG。

## 誤解の余地がないこと
- 100人が見て、100人が誤解余地なく認識できることが必須です

### ポジティブかネガティブか
文章の内容がポジティブな内容かネガティブな内容かによって、画像もそれに対応したものにする必要があります。

### 閲覧者が主題となるか、会社が主題となるか
文章が顧客の悩みやベネフィットに関わる内容の場合は閲覧者が主題、会社の商品・サービス紹介の場合は会社側が主題になっている必要があります。

### フローなどの起承転結がある場合、それに沿った画像にする

## 対象顧客と画像が一致しているか
対象の顧客と画像の主題は一致している必要があります。

## 図解の場合文字化けしていないか・視認性は担保されているか

## 他社のロゴが写り込んでいないか

## SNSアイコンのサイズ
- スマホ時にアイコンの大きさは40px、周りの余白が20px以上であることが必要

## カラーが全体と調和しているか

## 会社名・サービス名が正しいか

# 出力形式
修正点がある場合は以下のMarkdown表形式で出力してください：
| # | 箇所 | 問題内容 | 修正案 |
|---|------|----------|--------|
問題がなければ「問題なし」と一言だけ返してください。`;

export default function Home() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [imageContext, setImageContext] = useState(DEFAULT_IMAGE_CONTEXT);
  const [imageContextOpen, setImageContextOpen] = useState(false);
  const [activeHtmlJobId, setActiveHtmlJobId] = useState<string | null>(null);
  const [activeScreenshotJobId, setActiveScreenshotJobId] = useState<
    string | null
  >(null);
  const router = useRouter();

  useEffect(() => {
    const raw = sessionStorage.getItem("check_results");
    const sUrl = sessionStorage.getItem("check_sheet_url");
    if (raw) {
      try {
        if (sUrl) setSheetUrl(sUrl);
      } catch (e) {}
    }

    const htmlJobId = sessionStorage.getItem("active_html_job_id");
    if (htmlJobId) setActiveHtmlJobId(htmlJobId);
    const screenshotJobId = sessionStorage.getItem("active_screenshot_job_id");
    if (screenshotJobId) setActiveScreenshotJobId(screenshotJobId);
    const lastUrlInput = sessionStorage.getItem("last_url_input");
    const lastSheetUrl = sessionStorage.getItem("last_sheet_url");
    if (lastUrlInput) setUrlInput(lastUrlInput);
    if (lastSheetUrl) setSheetUrl(lastSheetUrl);
  }, []);

  useEffect(() => {
    async function loadContext() {
      try {
        const res = await fetch("/api/context");
        const data = await res.json();
        if (data.context) setContext(data.context);
      } catch (e) {
        console.error("コンテキスト取得エラー:", e);
      }
    }
    loadContext();
  }, []);

  useEffect(() => {
    async function loadImageContext() {
      try {
        const res = await fetch("/api/image-context");
        const data = await res.json();
        if (data.context) setImageContext(data.context);
      } catch (e) {
        console.error("画像コンテキスト取得エラー:", e);
      }
    }
    loadImageContext();
  }, []);

  const urls = urlInput
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));

  async function startHtmlCheck() {
    if (!sheetUrl) return alert("コンセプトシートURLを入力してください");
    if (!urls.length) return alert("チェックするURLを入力してください");
    // 入力内容を保存（戻ってきた時に復元するため）
    sessionStorage.setItem("last_url_input", urlInput);
    sessionStorage.setItem("last_sheet_url", sheetUrl);

    try {
      const res = await fetch("/api/start-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, sheetUrl, context }),
      });

      const data = await res.json();
      if (!res.ok || !data.jobId) {
        alert("エラー: " + (data.error || "ジョブを開始できませんでした"));
        return;
      }

      sessionStorage.setItem("check_sheet_url", sheetUrl);
      sessionStorage.setItem("active_html_job_id", data.jobId);
      router.push(`/work?jobId=${data.jobId}`);
    } catch (e: any) {
      alert("エラーが発生しました: " + e.message);
    }
  }

  async function startScreenshotCheck() {
    if (!sheetUrl) return alert("コンセプトシートURLを入力してください");
    if (!urls.length) return alert("チェックするURLを入力してください");

    // 入力内容を保存
    sessionStorage.setItem("last_url_input", urlInput);
    sessionStorage.setItem("last_sheet_url", sheetUrl);

    try {
      const createRes = await fetch("/api/create-screenshot-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, totalUrls: urls.length }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.jobId) {
        alert(
          "エラー: " + (createData.error || "ジョブを開始できませんでした"),
        );
        return;
      }

      const jobId = createData.jobId;
      sessionStorage.setItem("check_sheet_url", sheetUrl);
      sessionStorage.setItem("active_screenshot_job_id", jobId);
      router.push(`/screenshot-work?jobId=${jobId}`);

      // バッチを順番に実行（バックグラウンドで進める、ページ遷移後も継続）
      const BATCH_SIZE = 1; // スクショ+Pro解析は重いので小さめ
      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        await fetch("/api/run-screenshot-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId,
            urls: batch,
            sheetUrl,
            context: imageContext,
          }),
        });
      }
    } catch (e: any) {
      console.error("screenshot check error:", e);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <Header
        context={context}
        setContext={setContext}
        defaultContext={DEFAULT_CONTEXT}
        imageContext={imageContext}
        setImageContext={setImageContext}
        defaultImageContext={DEFAULT_IMAGE_CONTEXT}
      />

      {(activeHtmlJobId || activeScreenshotJobId) && (
        <div className="max-w-4xl mx-auto px-6 pt-4 space-y-2">
          {activeHtmlJobId && (
            <button
              onClick={() => router.push(`/work?jobId=${activeHtmlJobId}`)}
              className="w-full bg-blue-50 border border-blue-300 text-blue-700 font-bold py-3 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2"
            >
              🔄 進行中のHTMLチェックに戻る（Job: {activeHtmlJobId.slice(-6)}）
            </button>
          )}
          {activeScreenshotJobId && (
            <button
              onClick={() =>
                router.push(`/screenshot-work?jobId=${activeScreenshotJobId}`)
              }
              className="w-full bg-purple-50 border border-purple-300 text-purple-700 font-bold py-3 rounded-lg hover:bg-purple-100 transition flex items-center justify-center gap-2"
            >
              🔄 進行中のスクショチェックに戻る（Job:{" "}
              {activeScreenshotJobId.slice(-6)}）
            </button>
          )}
        </div>
      )}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              制作コンセプトシートURL
            </label>
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              チェックするページURL
              <span className="font-normal text-gray-500 ml-2">
                1行に1URL（スペース・カンマ区切りも可）
              </span>
            </label>
            <textarea
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              rows={6}
              placeholder={
                "https://example.com/page1\nhttps://example.com/page2"
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none focus:border-blue-500 resize-y bg-white"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={startHtmlCheck}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
            >
              📝 HTMLチェック開始
            </button>
            <button
              onClick={startScreenshotCheck}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
            >
              📸 スクショチェック開始
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
