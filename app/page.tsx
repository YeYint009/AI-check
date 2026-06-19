"use client";

import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Header from "./components/Header";
import InputForm from "./components/InputForm";
import ResultSummary from "./components/ResultSummary";
import ResultItem from "./components/ResultItem";
import { useRouter } from "next/navigation";

const DEFAULT_CONTEXT = `顧客のサイト作成を行っています。
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

type Result = {
  url: string;
  h1: string;
  status: "success" | "error";
  result: string;
  elapsed: string;
};

export default function Home() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [totalElapsed, setTotalElapsed] = useState("");
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());
  const startTimeRef = useRef<number>(0);
  const [recheckingUrls, setRecheckingUrls] = useState<Set<string>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

useEffect(() => {
  const raw = sessionStorage.getItem("check_results");
  const sUrl = sessionStorage.getItem("check_sheet_url");
  if (raw) {
    try {
      setResults(JSON.parse(raw));
      if (sUrl) setSheetUrl(sUrl);
    } catch (e) {}
  }

  const jobId = sessionStorage.getItem("active_job_id");
  if (jobId) setActiveJobId(jobId);
}, []);

  const router = useRouter();

  function goToWorkPage() {
    sessionStorage.setItem("check_results", JSON.stringify(results));
    sessionStorage.setItem("check_sheet_url", sheetUrl);
    router.push("/work");
  }

  const urls = urlInput
    .split(/[\n,\s]+/)
    .map((u) => u.trim())
    .filter((u) => u.startsWith("http"));

  async function startCheck() {
    if (!sheetUrl) return alert("コンセプトシートURLを入力してください");
    if (!urls.length) return alert("チェックするURLを入力してください");

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

      // sheetUrlも保存しておく（作業ページで使う）
sessionStorage.setItem("check_sheet_url", sheetUrl);
sessionStorage.setItem("active_job_id", data.jobId);
router.push(`/work?jobId=${data.jobId}`);
    } catch (e: any) {
      alert("エラーが発生しました: " + e.message);
    }
  }
  function toggleOpen(i: number) {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  async function recheckSingle(url: string) {
    setRecheckingUrls((prev) => new Set(prev).add(url));

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url], sheetUrl, context }),
      });

      if (!res.body) throw new Error("ストリームが取得できません");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const item = JSON.parse(trimmed);
              // 該当URLの結果を更新
              setResults((prev) => prev.map((r) => (r.url === url ? item : r)));
            } catch (e) {}
          }
        }
        if (done) break;
      }
    } catch (e: any) {
      console.error("recheck error:", e);
    } finally {
      setRecheckingUrls((prev) => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  }

  function exportToXlsx() {
    const rows = results.map((r) => ({
      "ページ名(H1)": r.h1,
      URL: r.url,
      ステータス:
        r.status === "error"
          ? "エラー"
          : r.result.trim() === "問題なし"
            ? "問題なし"
            : "要修正",
      チェック結果: r.result,
      "所要時間(秒)": r.elapsed,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "チェック結果");
    XLSX.writeFile(
      wb,
      `チェック結果_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  const ngCount = results.filter(
    (r) => r.status === "success" && r.result.trim() !== "問題なし",
  ).length;
  const okCount = results.filter(
    (r) => r.status === "success" && r.result.trim() === "問題なし",
  ).length;
  const errCount = results.filter((r) => r.status === "error").length;

  return (
    <main className="min-h-screen bg-gray-50">
      <Header
        context={context}
        setContext={setContext}
        defaultContext={DEFAULT_CONTEXT}
      />
        {activeJobId && (
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <button
          onClick={() => router.push(`/work?jobId=${activeJobId}`)}
          className="w-full bg-blue-50 border border-blue-300 text-blue-700 font-bold py-3 rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2"
        >
          🔄 進行中のチェックに戻る（Job: {activeJobId.slice(-6)}）
        </button>
      </div>
    )}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <InputForm
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          loading={loading}
          progress={progress}
          onStart={startCheck}
        />
        {results.length > 0 && (
          <div className="space-y-4">
            <ResultSummary
              total={results.length}
              ngCount={ngCount}
              okCount={okCount}
              errCount={errCount}
              totalElapsed={totalElapsed}
              onExport={exportToXlsx}
              onGoToWork={goToWorkPage}
            />
            {/* スクロールエリア */}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {results.map((item, i) => (
                <ResultItem
                  key={i}
                  item={item}
                  index={i}
                  isOpen={openIndexes.has(i)}
                  onToggle={() => toggleOpen(i)}
                  onRecheck={recheckSingle}
                  isRechecking={recheckingUrls.has(item.url)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
