"use client";

import { useState } from "react";

type Props = {
  context: string;
  setContext: (v: string) => void;
  defaultContext: string;
};

export default function Header({ context, setContext, defaultContext }: Props) {
  const [open, setOpen] = useState(false);

  function saveAsTxt() {
    const blob = new Blob([context], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "html_check_context.txt";
    a.click();
  }

  return (
    <>
      <header className="bg-blue-600 text-white px-6 py-4 shadow flex items-center justify-between">
        <h1 className="text-xl font-bold">🔍 サイトHTMLチェックツール</h1>
        <div className="flex gap-2">
          <button
            onClick={() => (window.location.href = "/projects")}
            className="text-sm px-4 py-2 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition"
          >
            📂 案件一覧
          </button>
          <button
            onClick={() => setOpen(true)}
            className="text-sm px-4 py-2 bg-white text-blue-700 font-bold rounded-lg hover:bg-blue-50 transition"
          >
            📝 チェックコンテキスト
          </button>
        </div>
      </header>

      {/* オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ポップアップヘッダー */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-800">
                📝 HTMLチェックコンテキスト
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={saveAsTxt}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  💾 TXTで保存
                </button>
                <button
                  onClick={() => {
                    setContext(defaultContext);
                  }}
                  className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  🔄 リセット
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-300 rounded-lg hover:bg-red-100"
                >
                  ✕ 閉じる
                </button>
              </div>
            </div>

            {/* テキストエリア */}
            <div className="p-6 flex-1 overflow-auto">
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={16}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {/* フッター */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setOpen(false)}
                className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition"
              >
                ✅ 保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
