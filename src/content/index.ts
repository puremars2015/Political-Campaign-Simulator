// 「@content-data」在正式建置指向 src/content/data；e2e 建置改指向測試專用資料（見 vite.config.ts）
import { rawContent } from '@content-data';
import type { ContentBundle } from './schema.ts';
import { validateContent } from './validate.ts';

export { rawContent };

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
