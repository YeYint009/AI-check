type Props = {
  sheetUrl: string;
  setSheetUrl: (v: string) => void;
  urlInput: string;
  setUrlInput: (v: string) => void;
  loading: boolean;
  progress: { current: number; total: number };
  onStart: () => void;
};

export default function InputForm({ sheetUrl, setSheetUrl, urlInput, setUrlInput, loading, progress, onStart }: Props) {
  const percent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl shadow p-6 space-y-5">
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          制作コンセプトシートURL
          <span className="font-normal text-gray-500 ml-2">案件ごとに変更してください</span>
        </label>
        <input
          type="text"
          value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none focus:border-blue-500 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          チェックするページURL
          <span className="font-normal text-gray-500 ml-2">1行に1URL</span>
        </label>
        <textarea
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          rows={6}
          placeholder={'https://example.com/page1\nhttps://example.com/page2'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 font-mono focus:outline-none focus:border-blue-500 resize-y bg-white"
        />
      </div>

      {/* チェック中アニメーション */}
      {loading && (
        <div className="space-y-2">
          {/* プログレスバー */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-2">
              {/* スピナー */}
              <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-blue-600 font-medium">チェック中...</span>
            </div>
            <span>{progress.current} / {progress.total} ページ完了（{percent}%）</span>
          </div>
        </div>
      )}

      <button
        onClick={onStart}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            チェック中... ({progress.current}/{progress.total})
          </>
        ) : '✅ チェック開始'}
      </button>
    </div>
  );
}