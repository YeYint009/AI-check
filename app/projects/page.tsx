"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SavedProject } from "../types";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error("読み込みエラー:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return;

    try {
      await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("削除に失敗しました");
    }
  }

  function openProject(project: SavedProject) {
    sessionStorage.setItem("loaded_project", JSON.stringify(project));
    router.push(`/work?loadProject=${project.id}`);
  }

  function countStats(items: SavedProject["items"]) {
    const ng = items.filter((i) => i.status === "success" && i.result.trim() !== "問題なし").length;
    const ok = items.filter((i) => i.status === "success" && i.result.trim() === "問題なし").length;
    return { ng, ok, total: items.length };
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-indigo-700 text-white px-6 py-4 shadow flex items-center justify-between">
        <h1 className="text-xl font-bold">📂 案件一覧（全員共有）</h1>
        <button
          onClick={() => router.push("/")}
          className="text-sm px-4 py-2 bg-white text-indigo-700 font-bold rounded-lg hover:bg-indigo-50"
        >
          ← チェックページへ戻る
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {loading ? (
          <p className="text-center text-gray-500 py-12">読み込み中...</p>
        ) : projects.length === 0 ? (
          <p className="text-center text-gray-500 py-12">保存された案件はまだありません</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const stats = countStats(p.items);
              return (
                <div
                  key={p.id}
                  className="bg-white rounded-xl shadow p-4 flex items-center justify-between hover:shadow-md transition cursor-pointer"
                  onClick={() => openProject(p)}
                >
                  <div>
                    <div className="font-bold text-gray-800">{p.projectName}</div>
                    <div className="text-xs text-gray-500 mt-1">{p.savedAt}</div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-gray-600">総ページ: {stats.total}</span>
                      <span className="text-red-600">要修正: {stats.ng}</span>
                      <span className="text-green-600">問題なし: {stats.ok}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id, p.projectName);
                    }}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 border border-red-300 rounded-lg hover:bg-red-200"
                  >
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}