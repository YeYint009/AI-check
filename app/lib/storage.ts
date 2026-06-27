import { ProjectHistory } from '../types';

const HISTORY_KEY = 'site_check_history';
const CHECKERS_KEY = 'site_check_checkers';
const MAX_HISTORY = 5;

// 履歴の取得
export function getHistory(): ProjectHistory[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

// 履歴の保存（最大5件、超えたら古いものを削除）
export function saveToHistory(project: ProjectHistory): ProjectHistory[] {
  const history = getHistory();
  const updated = [project, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

// 履歴の削除
export function deleteFromHistory(id: string): ProjectHistory[] {
  const history = getHistory().filter(p => p.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return history;
}

// チェック者一覧の取得
export function getCheckers(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CHECKERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

// チェック者の追加
export function addChecker(name: string): string[] {
  const checkers = getCheckers();
  if (checkers.includes(name)) return checkers;
  const updated = [...checkers, name];
  localStorage.setItem(CHECKERS_KEY, JSON.stringify(updated));
  return updated;
}

import { FixItem } from '../types';

export function parseFixItems(markdown: string): FixItem[] {
  const lines = markdown.trim().split('\n');
  const items: FixItem[] = [];
  let isFirstRow = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    if (/^\|[\s\-\|]+\|$/.test(trimmed)) continue;

    const cells = trimmed.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());

    if (isFirstRow) {
      isFirstRow = false;
      continue; // ヘッダー行をスキップ
    }

    // # | 箇所 | 問題内容 | 修正案 の4列を想定
    if (cells.length >= 4) {
      items.push({
        id: `${Date.now()}-${items.length}`,
        location: cells[1],
        issue: cells[2],
        suggestion: cells[3],
        status: 'pending',
      });
    }
  }

  return items;
}