'use client';

import { useState } from 'react';

type Props = {
  context: string;
  setContext: (v: string) => void;
  defaultContext: string;
};

export default function ContextEditor({ context, setContext, defaultContext }: Props) {
  const [editing, setEditing] = useState(false);

  function saveAsTxt() {
    const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'html_check_context.txt';
    a.click();
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-800">📝 HTMLチェックコンテキスト</h2>
        <div className="flex gap-2">
          <button
            onClick={saveAsTxt}
            className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            💾 TXTで保存
          </button>
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-400 rounded-lg hover:bg-blue-100"
          >
            {editing ? '✅ 保存' : '✏️ 編集'}
          </button>
          <button
            onClick={() => { setContext(defaultContext); setEditing(false); }}
            className="text-xs px-3 py-1 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            🔄 リセット
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          rows={12}
          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:border-blue-500 resize-y bg-white"
        />
      ) : (
        <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
          {context}
        </pre>
      )}
    </div>
  );
}