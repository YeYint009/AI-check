"use client";

import { useState, useEffect } from "react";

type Props = {
  context: string;
  setContext: (v: string) => void;
  defaultContext: string;
  open: boolean;
  setOpen: (v: boolean) => void;
};

export default function ImageContextModal({ context, setContext, defaultContext, open, setOpen }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadLatestContext();
    }
  }, [open]);

  async function loadLatestContext() {
    setLoading(true);
    try {
      const res = await fetch("/api/image-context");
      const data = await res.json();
      if (data.context) {
        setContext(data.context);
      }
    } catch (e) {
      console.error("画像コンテキスト取得エラー:", e);
    } finally {
      setLoading(false);
    }
  }

  async function saveContextToServer() {
    setSaving(true);
    try {
      const res = await fetch("/api/image-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      alert("✅ 全社共通の画像チェックコンテキストとして保存しました");
    } catch (e: any) {
      alert("エラー: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function saveAsTxt() {
    const blob = new Blob([context], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "image_check_context.txt";
    a.click();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-bold text-gray-800">
            📸 画像チェックコンテキスト（全社共通）
          </h2>
          <div className="flex gap-2">
            <button
              onClick={saveAsTxt}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
            >
              💾 TXTで保存
            </button>
            <button
              onClick={() => setContext(defaultContext)}
              className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
            >
              🔄 初期値に戻す
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-300 rounded-lg hover:bg-red-100"
            >
              ✕ 閉じる
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          {loading ? (
            <p className="text-gray-400 text-sm">読み込み中...</p>
          ) : (
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={16}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-blue-500 resize-none"
            />
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
          <p className="text-xs text-gray-400">
            「保存する」を押すと全員のチェックに反映されます
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition text-sm"
            >
              キャンセル
            </button>
            <button
              onClick={saveContextToServer}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? "保存中..." : "💾 保存する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}