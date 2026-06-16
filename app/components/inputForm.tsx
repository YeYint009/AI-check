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
  return (
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
        onClick={onStart}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
      >
        {loading ? `チェック中... (${progress.current}/${progress.total})` : '✅ チェック開始'}
      </button>
    </div>
  );
}