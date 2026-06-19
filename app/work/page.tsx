"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
  getCheckers,
  addChecker,
  getHistory,
  saveToHistory,
  deleteFromHistory,
  parseFixItems,
} from "../lib/storage";
import { CheckResult, WorkItem, ProjectHistory, FixItem } from "../types";
import * as XLSX from "xlsx";
import React from "react";
import { useSearchParams } from "next/navigation";

function WorkPageContent() {
  const router = useRouter();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [sheetUrl, setSheetUrl] = useState("");
  const [checkers, setCheckers] = useState<string[]>([]);
  const [newCheckerName, setNewCheckerName] = useState("");
  const [showAddChecker, setShowAddChecker] = useState(false);
  const [, forceUpdate] = useState(0);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [history, setHistory] = useState<ProjectHistory[]>([]);
  const [openRows, setOpenRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  console.log("DEBUG jobId:", jobId);
  const loadProjectId = searchParams.get("loadProject");
  const [jobStatus, setJobStatus] = useState<"running" | "completed" | null>(
    null,
  );
  const [jobTotal, setJobTotal] = useState(0);

useEffect(() => {
  const sUrl = sessionStorage.getItem("check_sheet_url");
  setSheetUrl(sUrl || "");
  setCheckers(getCheckers());
  setHistory(getHistory());

  if (loadProjectId) {
    // 保存済み案件を開く場合
    const raw = sessionStorage.getItem("loaded_project");
    if (raw) {
      const project = JSON.parse(raw);
      setItems(project.items);
      setSheetUrl(project.sheetUrl);
    }
  } else if (!jobId) {
    const raw = sessionStorage.getItem("check_results");
    if (raw) {
      const results: CheckResult[] = JSON.parse(raw);
      setItems(
        results.map((r) => ({
          ...r,
          checker: "",
          note: "",
          estimatedMinutes: "",
          actualSeconds: 0,
          isTracking: false,
          trackingStartedAt: null,
        })),
      );
    } else {
      router.push("/");
    }
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
  if (!confirm("チェックを停止しますか？現在処理中のページが終わったら止まります。")) return;

  try {
    await fetch("/api/cancel-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    setJobStatus("completed"); // UI上は完了扱いにする
  } catch (e) {
    console.error("cancel error:", e);
  }
}

  function toggleFixItemCompleted(itemIndex: number, fixId: string) {
    const item = items[itemIndex];
    if (!item.fixItems) return;
    const updatedFixItems = item.fixItems.map((f) =>
      f.id === fixId ? { ...f, completed: !f.completed } : f,
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

// 変更後
async function handleSaveProject() {
  const name = projectName.trim();
  if (!name) {
    alert("案件名を入力してください");
    return;
  }

  const project = {
    id: Date.now().toString(),
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

    setShowSaveDialog(false);
    setProjectName("");
    alert("✅ サーバーに保存しました（全員が閲覧できます）");
  } catch (e: any) {
    alert("エラー: " + e.message);
  }
}

  function handleDeleteHistory(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`))
      return;
    const updated = deleteFromHistory(id);
    setHistory(updated);
  }

  function loadFromHistory(project: ProjectHistory) {
    setItems(project.items);
    setSheetUrl(project.sheetUrl);
    setShowHistoryPanel(false);
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
    XLSX.utils.book_append_sheet(wb, ws, "作業結果");
    XLSX.writeFile(
      wb,
      `作業結果_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function exportAllHistoryToXlsx() {
    if (history.length === 0) {
      alert("履歴がありません");
      return;
    }

    const wb = XLSX.utils.book_new();

    history.forEach((h) => {
      const rows = h.items.map((item) => {
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
          "実工数(秒)": item.actualSeconds,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const safeName =
        h.projectName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });

    XLSX.writeFile(
      wb,
      `全案件履歴_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        <h1 className="text-xl font-bold">🛠 作業管理ページ</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistoryPanel(true)}
            className="text-sm px-4 py-2 bg-purple-500 text-white font-bold rounded-lg hover:bg-purple-400"
          >
            📁 履歴 ({history.length}/5)
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
            💾 案件として保存
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

            {history.length >= 5 && (
              <p className="text-red-600 text-sm font-bold mb-3">
                ⚠️ 注意事項：6案件目から履歴が消えます
              </p>
            )}

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

      {showHistoryPanel && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowHistoryPanel(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">
                📁 案件履歴（最大5件）
              </h2>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-300 rounded-lg hover:bg-red-100"
              >
                ✕ 閉じる
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {history.length > 0 && (
                <button
                  onClick={exportAllHistoryToXlsx}
                  className="w-full mb-3 text-sm px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700"
                >
                  📊 全履歴をまとめてExcel出力（案件ごとに別タブ）
                </button>
              )}

              {history.length >= 5 && (
                <p className="text-red-600 text-sm font-bold mb-3">
                  ⚠️ 注意事項：6案件目から履歴が消えます
                </p>
              )}

              {history.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">
                  保存された履歴はありません
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="border border-gray-200 rounded-lg p-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-bold text-gray-800 text-sm">
                          {h.projectName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {h.savedAt} ・ {h.items.length}ページ
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => loadFromHistory(h)}
                          className="text-xs px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200"
                        >
                          開く
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteHistory(h.id, h.projectName)
                          }
                          className="text-xs px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
{jobId && jobStatus === "running" && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
    <div className="flex items-center gap-3 mb-2">
      <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <span className="text-blue-700 font-bold text-sm">チェック実行中...</span>
      <span className="text-blue-600 text-sm ml-auto">{items.length} / {jobTotal} 件完了</span>
      <button
        onClick={handleCancelJob}
        className="text-xs px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200"
      >
        ⏹ 停止
      </button>
    </div>
    <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
      <div
        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
        style={{ width: `${jobTotal > 0 ? (items.length / jobTotal) * 100 : 0}%` }}
      />
    </div>
    <p className="text-xs text-blue-500 mt-2">このページを閉じても、同じURLを開けば続きから確認できます</p>
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
                  item.fixItems?.filter((f) => f.completed).length ?? 0;
                const totalFixCount = item.fixItems?.length ?? 0;

                return (
                  <React.Fragment key={i}>
                    <tr
                      key={i}
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
                        </div>
                      </td>
                    </tr>

                    {/* アコーディオン展開部分 */}
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
                                  <th className="px-3 py-2 text-left border-b w-12">
                                    完了
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
                                {item.fixItems.map((fix) => (
                                  <tr
                                    key={fix.id}
                                    className={
                                      fix.completed ? "bg-green-50" : ""
                                    }
                                  >
                                    <td className="px-3 py-2 border-b text-center">
                                      <input
                                        type="checkbox"
                                        checked={fix.completed}
                                        onChange={() =>
                                          toggleFixItemCompleted(i, fix.id)
                                        }
                                        className="w-4 h-4 cursor-pointer"
                                      />
                                    </td>
                                    <td
                                      className={`px-3 py-2 border-b text-gray-800 ${fix.completed ? "line-through text-gray-400" : ""}`}
                                    >
                                      {fix.location}
                                    </td>
                                    <td
                                      className={`px-3 py-2 border-b text-gray-800 ${fix.completed ? "line-through text-gray-400" : ""}`}
                                    >
                                      {fix.issue}
                                    </td>
                                    <td
                                      className={`px-3 py-2 border-b text-gray-800 ${fix.completed ? "line-through text-gray-400" : ""}`}
                                    >
                                      {fix.suggestion}
                                    </td>
                                  </tr>
                                ))}
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

export default function WorkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">
          読み込み中...
        </div>
      }
    >
      <WorkPageContent />
    </Suspense>
  );
}
