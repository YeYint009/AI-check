type Props = {
  total: number;
  ngCount: number;
  okCount: number;
  errCount: number;
  totalElapsed: string;
  onExport: () => void;
  onGoToWork: () => void;
};

export default function ResultSummary({ total, ngCount, okCount, errCount, totalElapsed, onExport, onGoToWork }: Props) {
  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-6 items-center">
      <div className="text-sm text-gray-600">総ページ数: <span className="font-bold">{total}</span></div>
      <div className="text-sm text-red-600">要修正: <span className="font-bold">{ngCount}</span></div>
      <div className="text-sm text-green-600">問題なし: <span className="font-bold">{okCount}</span></div>
      {errCount > 0 && (
        <div className="text-sm text-orange-500">エラー: <span className="font-bold">{errCount}</span></div>
      )}
      {totalElapsed && (
        <div className="text-sm text-gray-500">⏱ 合計: <span className="font-bold">{totalElapsed}</span></div>
      )}
      <div className="ml-auto flex gap-2">
        <button
          onClick={onExport}
          className="text-sm px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition"
        >
          📊 Excelエクスポート
        </button>
        <button
          onClick={onGoToWork}
          className="text-sm px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition"
        >
          🛠 作業ページへ進む
        </button>
      </div>
    </div>
  );
}