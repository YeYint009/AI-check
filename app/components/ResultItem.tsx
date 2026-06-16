type Result = {
  url: string;
  h1: string;
  status: "success" | "error";
  result: string;
  elapsed: string;
};

type Props = {
  item: Result;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onRecheck: (url: string) => void;
  isRechecking: boolean;
};

function parseMarkdownTable(markdown: string): string {
  const lines = markdown.trim().split("\n");
  let html = "";
  let inTable = false;
  let isFirstRow = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\|[\s\-\|]+\|$/.test(trimmed)) continue;

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .split("|")
        .filter((_, i, a) => i > 0 && i < a.length - 1)
        .map((c) => c.trim());
      if (!inTable) {
        inTable = true;
        isFirstRow = true;
        html +=
          '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;color:#111827;">';
      }
      if (isFirstRow) {
        html +=
          "<thead><tr>" +
          cells
            .map(
              (c) =>
                `<th style="border:1px solid #d1d5db;background:#f3f4f6;padding:8px 10px;text-align:left;color:#111827;font-weight:bold;">${c}</th>`,
            )
            .join("") +
          "</tr></thead><tbody>";
        isFirstRow = false;
      } else {
        html +=
          "<tr>" +
          cells
            .map(
              (c) =>
                `<td style="border:1px solid #d1d5db;padding:8px 10px;vertical-align:top;color:#111827;line-height:1.6;">${c}</td>`,
            )
            .join("") +
          "</tr>";
      }
    } else {
      if (inTable) {
        html += "</tbody></table>";
        inTable = false;
        isFirstRow = true;
      }
      if (trimmed)
        html += `<p style="font-size:13px;margin-bottom:6px;color:#111827;line-height:1.6;">${trimmed}</p>`;
    }
  }
  if (inTable) html += "</tbody></table>";
  return (
    html ||
    `<pre style="font-size:12px;color:#111827;white-space:pre-wrap;">${markdown}</pre>`
  );
}

export default function ResultItem({
  item,
  isOpen,
  onToggle,
  onRecheck,
  isRechecking,
}: Props) {
  const isOk = item.status === "success" && item.result.trim() === "問題なし";
  const isErr = item.status === "error";

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-start gap-3 text-left transition
          ${isOk ? "bg-green-50 hover:bg-green-100" : isErr ? "bg-orange-50 hover:bg-orange-100" : "bg-red-50 hover:bg-red-100"}`}
      >
        <span className="text-lg">
          {isRechecking ? (
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
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
          ) : isOk ? (
            "✅"
          ) : isErr ? (
            "⚠️"
          ) : (
            "❌"
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div
            className={`font-bold text-sm ${isOk ? "text-green-800" : isErr ? "text-orange-800" : "text-red-800"}`}
          >
            {isRechecking ? "再チェック中..." : item.h1}
          </div>
          <div className="text-xs text-gray-600 truncate mt-0.5">
            {item.url}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">⏱ {item.elapsed}秒</span>
          <span
            className={`text-xs px-2 py-1 rounded-full font-bold
            ${isOk ? "bg-green-200 text-green-900" : isErr ? "bg-orange-200 text-orange-900" : "bg-red-200 text-red-900"}`}
          >
            {isOk ? "問題なし" : isErr ? "エラー" : "要修正"}
          </span>
          {/* 再チェックボタン */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onRecheck(item.url);
            }}
            role="button"
            className={`text-xs px-2 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-200 cursor-pointer ${isRechecking ? "opacity-50 pointer-events-none" : ""}`}
          >
            🔄
          </div>
          <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>
      {isOpen && (
        <div
          className="px-5 py-4 border-t border-gray-100 bg-white"
          dangerouslySetInnerHTML={{
            __html: isRechecking
              ? '<p style="color:#3b82f6;">再チェック中...</p>'
              : isOk
                ? '<p style="color:#15803d;font-weight:bold;">✅ 問題なし</p>'
                : parseMarkdownTable(item.result),
          }}
        />
      )}
    </div>
  );
}
