import candidates from './data/candidates.json';
import districts from './data/districts.json';
import events from './data/events.json';
import type { ContentBundle } from './schema.ts';
import { validateContent } from './validate.ts';

/** 內容版本；內容變更若影響存檔相容性，須同步更新。 */
export const CONTENT_VERSION = '0.1.0-prototype';

export const rawContent = { contentVersion: CONTENT_VERSION, districts, candidates, events };

let cached: ContentBundle | null = null;

/** 載入並驗證內建內容；驗證失敗時拋出包含所有問題的錯誤。 */
export function loadContent(): ContentBundle {
  if (cached) return cached;
  const result = validateContent(rawContent);
  if (!result.ok) {
    const detail = result.issues.map((i) => `- ${i.path}: ${i.message}`).join('\n');
    throw new Error(`內容驗證失敗：\n${detail}`);
  }
  cached = result.bundle;
  return cached;
}
