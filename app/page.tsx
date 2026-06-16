'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

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
  status: 'success' | 'error';
  result: string;
  elapsed: string;
};

export default function Home() {
  const [sheetUrl, setSheetUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [editingContext, setEditingContext] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [totalElapsed, setTotalElapsed] = useState('');
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());
  const startTimeRef = useRef<number>(0);

  const urls = urlInput.split('\n').map(u => u.trim()).filter(u => u);

  async function startCheck() {
    if (!sheetUrl) return alert('コンセプトシートURLを入力してください');
    if (!urls.length) return alert('チェックするURLを入力してください');

    setLoading(true);
    setResults([]);
    setProgress({ current: 0, total: urls.length });
    setTotalElapsed('');
    setOpenIndexes(new Set());
    startTimeRef.current = Date.now();

    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, sheetUrl, context }),
      });
      const data: Result[] = await res.json();
      setResults(data);
      setProgress({ current: data.length, total: urls.length });
      const elapsed = Date.now() - startTimeRef.current;
      const min = Math.floor(elapsed / 60000);
      const sec = Math.floor((elapsed % 60000) / 1000);
      setTotalElapsed(`${min}分${sec}秒`);
    } catch (e) {
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  function toggleOpen(i: number) {
    setOpenIndexes(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function saveContextAsTxt() {
    const blob = new Blob([context], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'html_check_context.txt';
    a.click();
  }

  function exportToXlsx() {
    const rows = results.map(r => ({
      'ページ名(H1)': r.h1,
      'URL': r.url,
      'ステータス': r.status === 'error' ? 'エラー' : r.result.trim() === '問題なし' ? '問題なし' : '要修正',
      'チェック結果': r.result,
      '所要時間(秒)': r.elapsed,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'チェック結果');
    XLSX.writeFile(wb, `チェック結果_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function parseMarkdownTable(markdown: string) {
    const lines = markdown.trim().split('\n');
    let html = '';
    let inTable = false;
    let isFirstRow = true;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (trimmed.includes('---')) continue;
        const cells = trimmed.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
        if (!inTable) {
          inTable = true;
          isFirstRow = true;
          html += '<table class="w-full border-collapse text-sm mt-2">';
        }
        if (isFirstRow) {
          html += '<thead><tr>' + cells.map(c => `<th class="border border-gray-300 bg-gray-100 px-3 py-2 text-left">${c.trim()}</th>`).join('') + '</tr></thead><tbody>';
          isFirstRow = false;
        } else {
          html += '<tr>' + cells.map(c => `<td class="border border-gray-300 px-3 py-2 align-top">${c.trim()}</td>`).join('') + '</tr>';
        }
      } else {
        if (inTable) { html += '</tbody></table>'; inTable = false; }
        if (trimmed) html += `<p class="text-sm mb-1">${trimmed}</p>`;
      }
    }
    if (inTable) html += '</tbody></table>';
    return html;
  }

  const ngCount = results.filter(r => r.status === 'success' && r.result.trim() !== '問題なし').length;
  const okCount = results.filter(r => r.status === 'success' && r.result.trim() === '問題なし').length;
  const errCount = results.filter(r => r.status === 'error').length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-blue-600 text-white px-6 py-4 shadow">
        <h1 className="text-xl font-bold">🔍 サイトHTMLチェックツール</h1>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* 入力フォーム */}
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              制作コンセプトシートURL
              <span className="font-normal text-gray-400 ml-2">案件ごとに変更してください</span>
            </label>
            <input
              type="text"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              チェックするページURL
              <span className="font-normal text-gray-400 ml-2">1行に1URL</span>
            </label>
            <textarea
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              rows={6}
              placeholder={'https://example.com/page1\nhttps://example.com/page2'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          <button
            onClick={startCheck}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? `チェック中... (${progress.current}/${progress.total})` : '✅ チェック開始'}
          </button>
        </div>

        {/* プロンプト設定 */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">📝 HTMLチェックコンテキスト</h2>
            <div className="flex gap-2">
              <button
                onClick={saveContextAsTxt}
                className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                💾 TXTで保存
              </button>
              <button
                onClick={() => setEditingContext(!editingContext)}
                className="text-xs px-3 py-1 border border-blue-400 text-blue-600 rounded-lg hover:bg-blue-50"
              >
                {editingContext ? '✅ 保存' : '✏️ 編集'}
              </button>
              <button
                onClick={() => { setContext(DEFAULT_CONTEXT); setEditingContext(false); }}
                className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                🔄 リセット
              </button>
            </div>
          </div>
          {editingContext ? (
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              rows={12}
              className="w-full border border-blue-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 resize-y"
            />
          ) : (
            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
              {context}
            </pre>
          )}
        </div>

        {/* 結果 */}
        {results.length > 0 && (
          <div className="space-y-4">
            {/* サマリー */}
            <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-6 items-center">
              <div className="text-sm text-gray-600">総ページ数: <span className="font-bold">{results.length}</span></div>
              <div className="text-sm text-red-600">要修正: <span className="font-bold">{ngCount}</span></div>
              <div className="text-sm text-green-600">問題なし: <span className="font-bold">{okCount}</span></div>
              {errCount > 0 && <div className="text-sm text-orange-500">エラー: <span className="font-bold">{errCount}</span></div>}
              {totalElapsed && <div className="text-sm text-gray-500">⏱ 合計: <span className="font-bold">{totalElapsed}</span></div>}
              <button
                onClick={exportToXlsx}
                className="ml-auto text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition"
              >
                📊 Excelエクスポート
              </button>
            </div>

            {/* 結果一覧 */}
            {results.map((item, i) => {
              const isOk = item.status === 'success' && item.result.trim() === '問題なし';
              const isErr = item.status === 'error';
              const isOpen = openIndexes.has(i);
              return (
                <div key={i} className="bg-white rounded-xl shadow overflow-hidden">
                  <button
                    onClick={() => toggleOpen(i)}
                    className={`w-full px-5 py-4 flex items-start gap-3 text-left transition
                      ${isOk ? 'bg-green-50 hover:bg-green-100' : isErr ? 'bg-orange-50 hover:bg-orange-100' : 'bg-red-50 hover:bg-red-100'}`}
                  >
                    <span className="text-lg">{isOk ? '✅' : isErr ? '⚠️' : '❌'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-bold text-sm ${isOk ? 'text-green-700' : isErr ? 'text-orange-700' : 'text-red-700'}`}>
                        {item.h1}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{item.url}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">⏱ {item.elapsed}秒</span>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold
                        ${isOk ? 'bg-green-200 text-green-800' : isErr ? 'bg-orange-200 text-orange-800' : 'bg-red-200 text-red-800'}`}>
                        {isOk ? '問題なし' : isErr ? 'エラー' : '要修正'}
                      </span>
                      <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div
                      className="px-5 py-4 border-t border-gray-100 text-sm"
                      dangerouslySetInnerHTML={{ __html: isOk ? '<p class="text-green-600 font-bold">✅ 問題なし</p>' : parseMarkdownTable(item.result) }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}