"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCheckers, addChecker, parseFixItems } from "../lib/storage";
import { CheckResult, WorkItem, ProjectHistory } from "../types";
import * as XLSX from "xlsx";
import React from "react";

function ScreenshotWorkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const loadProjectId = searchParams.get("loadProject");

  const [items, setItems] = useState<WorkItem[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [checkers, setCheckers] = useState<string[]>([]);
  const [newCheckerName, setNewCheckerName] = useState("");
  const [showAddChecker, setShowAddChecker] = useState(false);
  const [, forceUpdate] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [recheckingUrls, setRecheckingUrls] = useState<Set<string>>(new Set());
  const [jobStatus, setJobStatus] = useState<
    "running" | "completed" | "cancelled" | null
  >(null);
  const [jobTotal, setJobTotal] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const sUrl = sessionStorage.getItem("check_sheet_url");
    setSheetUrl(sUrl || "");
    setCheckers(getCheckers());

    if (loadProjectId) {
      const raw = sessionStorage.getItem("loaded_project");
      if (raw) {
        const project = JSON.parse(raw);
        setItems(project.items);
        setSheetUrl(project.sheetUrl);
        setCurrentProjectId(project.id);
        setProjectName(project.projectName);
      }
    } else if (!jobId) {
      router.push("/");
    }
  }, [router, jobId, loadProjectId]);

  // ジョブのポーリング
  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/job-status?jobId=${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        if (cancelled) return;

        setJobStatus(job.status);
        setJobTotal(job.totalUrls);
        setSheetUrl(job.sheetUrl);

        setItems((prev) => {
          const existingUrls = new Set(prev.map((p) => p.url));
          const newOnes = job.results.filter(
            (r: CheckResult) => !existingUrls.has(r.url),
          );
          if (newOnes.length === 0) return prev;
          const converted: WorkItem[] = newOnes.map((r: CheckResult) => ({
            ...r,
            checker: "",
            note: "",
            estimatedMinutes: "",
            actualSeconds: 0,
            isTracking: false,
            trackingStartedAt: null,
          }));
          return [...prev, ...converted];
        });

        if (job.status !== "completed" && !cancelled) {
          setTimeout(poll, 3000);
        }
      } catch (e) {
        console.error("polling error:", e);
        if (!cancelled) setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  function updateItem(index: number, patch: Partial<WorkItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );

    if (currentProjectId) {
      fetch("/api/projects/update-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: currentProjectId,
          itemIndex: index,
          patch,
        }),
      }).catch((e) => console.error("auto-save error:", e));
    }
  }

  function toggleRow(i: number) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
        if (!items[i].fixItems) {
          const isOk =
            items[i].status === "success" &&
            items[i].result.trim() === "問題なし";
          if (!isOk && items[i].status === "success") {
            const fixItems = parseFixItems(items[i].result);
            updateItem(i, { fixItems });
          }
        }
      }
      return next;
    });
  }

  async function handleCancelJob() {
    if (!jobId) return;
    if (
      !confirm(
        "チェックを停止しますか？現在処理中のページが終わったら止まります。",
      )
    )
      return;
    try {
      await fetch("/api/cancel-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      setJobStatus("completed");
    } catch (e) {
      console.error("cancel error:", e);
    }
  }

  async function recheckSingleItem(index: number) {
    const item = items[index];
    setRecheckingUrls((prev) => new Set(prev).add(item.url));

    try {
      const createRes = await fetch("/api/create-screenshot-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, totalUrls: 1 }),
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.jobId) {
        throw new Error(createData.error || "再チェックに失敗しました");
      }

      const recheckJobId = createData.jobId;

      await fetch("/api/run-screenshot-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: recheckJobId,
          urls: [item.url],
          sheetUrl,
          context: "",
        }),
      });

      await pollSingleResult(recheckJobId, index);
    } catch (e: any) {
      console.error("recheck error:", e);
      alert("再チェックに失敗しました: " + e.message);
    } finally {
      setRecheckingUrls((prev) => {
        const next = new Set(prev);
        next.delete(item.url);
        return next;
      });
    }
  }

  async function pollSingleResult(
    recheckJobId: string,
    index: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      async function poll() {
        try {
          const res = await fetch(`/api/job-status?jobId=${recheckJobId}`);
          if (!res.ok) {
            resolve();
            return;
          }
          const job = await res.json();

          if (job.results && job.results.length > 0) {
            const newResult = job.results[0];
            updateItem(index, {
              h1: newResult.h1,
              status: newResult.status,
              result: newResult.result,
              elapsed: newResult.elapsed,
              fixItems: undefined,
            });
          }

          if (job.status === "completed") {
            resolve();
          } else {
            setTimeout(poll, 2000);
          }
        } catch (e) {
          resolve();
        }
      }
      poll();
    });
  }

  function updateFixItemStatus(
    itemIndex: number,
    fixId: string,
    status: "pending" | "completed" | "not_needed",
  ) {
    const item = items[itemIndex];
    if (!item.fixItems) return;
    const updatedFixItems = item.fixItems.map((f) =>
      f.id === fixId ? { ...f, status } : f,
    );
    updateItem(itemIndex, { fixItems: updatedFixItems });
  }

  function handleAddChecker() {
    const name = newCheckerName.trim();
    if (!name) return;
    const updated = addChecker(name);
    setCheckers(updated);
    setNewCheckerName("");
    setShowAddChecker(false);
  }

  function startTracking(index: number) {
    updateItem(index, { isTracking: true, trackingStartedAt: Date.now() });
  }

  function stopTracking(index: number) {
    const item = items[index];
    if (!item.trackingStartedAt) return;
    const elapsedSec = Math.floor((Date.now() - item.trackingStartedAt) / 1000);
    updateItem(index, {
      isTracking: false,
      trackingStartedAt: null,
      actualSeconds: item.actualSeconds + elapsedSec,
    });
  }

  async function handleSaveProject() {
    const name = projectName.trim();
    if (!name) {
      alert("案件名を入力してください");
      return;
    }

    const project = {
      id: currentProjectId || `ss-${Date.now()}`,
      projectName: name,
      sheetUrl,
      items,
      savedAt: new Date().toLocaleString("ja-JP"),
    };

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });

      if (!res.ok) throw new Error("保存に失敗しました");

      setCurrentProjectId(project.id);
      setShowSaveDialog(false);

      if (currentProjectId) {
        alert("✅ 更新しました");
      } else {
        alert("✅ 新規保存しました（全員が閲覧できます）");
      }
    } catch (e: any) {
      alert("エラー: " + e.message);
    }
  }

  function exportCurrentToXlsx() {
    const rows = items.map((item) => {
      const isOk =
        item.status === "success" && item.result.trim() === "問題なし";
      return {
        ページ名: item.h1,
        URL: item.url,
        ステータス:
          item.status === "error" ? "エラー" : isOk ? "問題なし" : "要修正",
        チェック結果: item.result,
        チェック者: item.checker,
        備考: item.note,
        "目安工数(分)": item.estimatedMinutes,
        実工数: formatSeconds(item.actualSeconds),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "画像チェック結果");
    XLSX.writeFile(
      wb,
      `画像チェック結果_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function formatSeconds(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}分${s}秒`;
  }

  const totalEstimated = items.reduce(
    (sum, i) => sum + (parseFloat(i.estimatedMinutes) || 0),
    0,
  );
  const totalActual = items.reduce((sum, i) => sum + i.actualSeconds, 0);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-purple-700 text-white px-6 py-4 shadow flex items-center justify-between">
        <h1 className="text-xl font-bold">📸 画像チェック作業管理ページ</h1>
        <div className="flex gap-2">
          <button
            onClick={() => (window.location.href = "/projects")}
            className="text-sm px-4 py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400"
          >
            📂 案件一覧
          </button>
          <button
            onClick={exportCurrentToXlsx}
            className="text-sm px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-400"
          >
            📊 現在の表をExcel出力
          </button>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="text-sm px-4 py-2 bg-yellow-400 text-purple-900 font-bold rounded-lg hover:bg-yellow-300"
          >
            💾 案件保存
          </button>
          <button
            onClick={() => router.push("/")}
            className="text-sm px-4 py-2 bg-white text-purple-700 font-bold rounded-lg hover:bg-purple-50"
          >
            ← チェックページへ戻る
          </button>
        </div>
      </header>

      {showSaveDialog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-gray-800 mb-4">💾 案件として保存</h2>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="案件名を入力（例：株式会社〇〇）"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveProject}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-bold"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {jobId && jobStatus === "running" && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <svg
                className="animate-spin h-5 w-5 text-purple-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-purple-700 font-bold text-sm">
                スクショ取得・チェック実行中...
              </span>
              <span className="text-purple-600 text-sm ml-auto">
                {items.length} / {jobTotal} 件完了
              </span>
              <button
                onClick={handleCancelJob}
                className="text-xs px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200"
              >
                ⏹ 停止
              </button>
            </div>
            <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${jobTotal > 0 ? (items.length / jobTotal) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-purple-500 mt-2">
              このページを閉じても、同じURLを開けば続きから確認できます
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow p-4 mb-4 flex flex-wrap gap-6 items-center">
          <div className="text-sm text-gray-600">
            合計目安工数: <span className="font-bold">{totalEstimated}分</span>
          </div>
          <div className="text-sm text-gray-600">
            合計実工数:{" "}
            <span className="font-bold">{formatSeconds(totalActual)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowAddChecker(!showAddChecker)}
              className="text-xs px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200"
            >
              + チェック者を追加
            </button>
            {showAddChecker && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newCheckerName}
                  onChange={(e) => setNewCheckerName(e.target.value)}
                  placeholder="名前を入力"
                  className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-800"
                />
                <button
                  onClick={handleAddChecker}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded"
                >
                  追加
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="px-3 py-3 text-left border-b w-8"></th>
                <th className="px-3 py-3 text-left border-b">ページ名</th>
                <th className="px-3 py-3 text-left border-b">結果</th>
                <th className="px-3 py-3 text-left border-b w-32">
                  チェック者
                </th>
                <th className="px-3 py-3 text-left border-b w-48">備考</th>
                <th className="px-3 py-3 text-left border-b w-20">目安(分)</th>
                <th className="px-3 py-3 text-left border-b w-40">実工数</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isOk =
                  item.status === "success" &&
                  item.result.trim() === "問題なし";
                const isErr = item.status === "error";
                const isOpen = openRows.has(i);
                const completedCount =
                  item.fixItems?.filter(
                    (f) =>
                      f.status === "completed" || f.status === "not_needed",
                  ).length ?? 0;
                const totalFixCount = item.fixItems?.length ?? 0;

                return (
                  <React.Fragment key={i}>
                    <tr
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRow(i)}
                    >
                      <td className="px-3 py-3 text-center text-gray-400">
                        <span
                          className={`inline-block transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          ▶
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-gray-800">{item.h1}</div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {item.url}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-bold
                          ${isOk ? "bg-green-200 text-green-900" : isErr ? "bg-orange-200 text-orange-900" : "bg-red-200 text-red-900"}`}
                        >
                          {isOk ? "問題なし" : isErr ? "エラー" : "要修正"}
                        </span>
                        {!isOk && totalFixCount > 0 && (
                          <span className="ml-2 text-xs text-gray-500">
                            {completedCount}/{totalFixCount}件完了
                          </span>
                        )}
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <select
                          value={item.checker}
                          onChange={(e) =>
                            updateItem(i, { checker: e.target.value })
                          }
                          className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-800 w-full"
                        >
                          <option value="">選択</option>
                          {checkers.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={item.note}
                          onChange={(e) =>
                            updateItem(i, { note: e.target.value })
                          }
                          placeholder="備考"
                          className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-800 w-full"
                        />
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          value={item.estimatedMinutes}
                          onChange={(e) =>
                            updateItem(i, { estimatedMinutes: e.target.value })
                          }
                          placeholder="0"
                          className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-800 w-16"
                        />
                      </td>
                      <td
                        className="px-3 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-20">
                            {formatSeconds(
                              item.isTracking && item.trackingStartedAt
                                ? item.actualSeconds +
                                    Math.floor(
                                      (Date.now() - item.trackingStartedAt) /
                                        1000,
                                    )
                                : item.actualSeconds,
                            )}
                          </span>
                          {item.isTracking ? (
                            <button
                              onClick={() => stopTracking(i)}
                              className="text-xs px-2 py-1 bg-red-500 text-white rounded font-bold"
                            >
                              ⏹ 終了
                            </button>
                          ) : (
                            <button
                              onClick={() => startTracking(i)}
                              className="text-xs px-2 py-1 bg-green-500 text-white rounded font-bold"
                            >
                              ▶ 開始
                            </button>
                          )}
                          <button
                            onClick={() => recheckSingleItem(i)}
                            disabled={recheckingUrls.has(item.url)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded disabled:opacity-50"
                          >
                            {recheckingUrls.has(item.url) ? "..." : "🔄"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          {isOk ? (
                            <p className="text-green-700 font-bold text-sm">
                              ✅ 問題なし
                            </p>
                          ) : isErr ? (
                            <p className="text-orange-700 text-sm">
                              {item.result}
                            </p>
                          ) : item.fixItems && item.fixItems.length > 0 ? (
                            <table className="w-full text-sm bg-white rounded-lg overflow-hidden border border-gray-200">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-2 text-left border-b w-28">
                                    状態
                                  </th>
                                  <th className="px-3 py-2 text-left border-b">
                                    箇所
                                  </th>
                                  <th className="px-3 py-2 text-left border-b">
                                    問題内容
                                  </th>
                                  <th className="px-3 py-2 text-left border-b">
                                    修正案
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.fixItems.map((fix) => {
                                  const rowBg =
                                    fix.status === "completed"
                                      ? "bg-green-50"
                                      : fix.status === "not_needed"
                                        ? "bg-gray-100"
                                        : "bg-yellow-50";
                                  const isStruck = fix.status === "completed";
                                  const isMuted = fix.status === "not_needed";
                                  return (
                                    <tr key={fix.id} className={rowBg}>
                                      <td className="px-3 py-2 border-b text-center">
                                        <select
                                          value={fix.status}
                                          onChange={(e) =>
                                            updateFixItemStatus(
                                              i,
                                              fix.id,
                                              e.target.value as
                                                | "pending"
                                                | "completed"
                                                | "not_needed",
                                            )
                                          }
                                          className={`text-xs rounded px-2 py-1 border w-full
                                            ${
                                              fix.status === "completed"
                                                ? "bg-green-100 border-green-300 text-green-800"
                                                : fix.status === "not_needed"
                                                  ? "bg-gray-200 border-gray-300 text-gray-700"
                                                  : "bg-yellow-100 border-yellow-300 text-yellow-800"
                                            }`}
                                        >
                                          <option value="pending">
                                            未対応
                                          </option>
                                          <option value="completed">
                                            完了
                                          </option>
                                          <option value="not_needed">
                                            対応不要
                                          </option>
                                        </select>
                                      </td>
                                      <td
                                        className={`px-3 py-2 border-b ${isStruck ? "line-through text-gray-400" : isMuted ? "text-gray-400" : "text-gray-800"}`}
                                      >
                                        {fix.location}
                                      </td>
                                      <td
                                        className={`px-3 py-2 border-b ${isStruck ? "line-through text-gray-400" : isMuted ? "text-gray-400" : "text-gray-800"}`}
                                      >
                                        {fix.issue}
                                      </td>
                                      <td
                                        className={`px-3 py-2 border-b ${isStruck ? "line-through text-gray-400" : isMuted ? "text-gray-400" : "text-gray-800"}`}
                                      >
                                        {fix.suggestion}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-gray-500 text-sm">
                              修正項目を読み込み中...
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function ScreenshotWorkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
          読み込み中...
        </div>
      }
    >
      <ScreenshotWorkContent />
    </Suspense>
  );
}
