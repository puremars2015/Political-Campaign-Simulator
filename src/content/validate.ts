import { BALANCE } from '../engine/config.ts';
import { contentBundleSchema, type ContentBundle } from './schema.ts';

export interface ContentIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; bundle: ContentBundle; issues: [] }
  | { ok: false; bundle: null; issues: ContentIssue[] };

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

/** 驗證內容的 schema 與跨檔引用；回傳所有問題而非遇到第一個就停止。 */
export function validateContent(raw: unknown): ValidationResult {
  const parsed = contentBundleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      bundle: null,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const bundle = parsed.data;
  const issues: ContentIssue[] = [];
  const districtIds = new Set(bundle.districts.map((d) => d.id));
  const candidateIds = new Set(bundle.candidates.map((c) => c.id));
  const eventIds = new Set(bundle.events.map((e) => e.id));

  for (const [kind, ids] of [
    ['districts', bundle.districts.map((d) => d.id)],
    ['candidates', bundle.candidates.map((c) => c.id)],
    ['events', bundle.events.map((e) => e.id)],
  ] as const) {
    for (const dupe of findDuplicates(ids)) issues.push({ path: kind, message: `ID 重複：${dupe}` });
  }

  bundle.districts.forEach((district, i) => {
    const { opponentSupport, undecided } = district.baseline;
    if (opponentSupport + undecided > 1) {
      issues.push({ path: `districts.${i}.baseline`, message: '對手支持與未表態加總不可超過 1' });
    }
    for (const dupe of findDuplicates(district.regions.map((r) => r.id))) {
      issues.push({ path: `districts.${i}.regions`, message: `地區 ID 重複：${dupe}` });
    }
  });

  bundle.candidates.forEach((candidate, i) => {
    if (!districtIds.has(candidate.districtId)) {
      issues.push({ path: `candidates.${i}.districtId`, message: `找不到選區：${candidate.districtId}` });
    }
    for (const dupe of findDuplicates(candidate.initialCommitments.map((c) => c.id))) {
      issues.push({ path: `candidates.${i}.initialCommitments`, message: `承諾 ID 重複：${dupe}` });
    }
  });

  bundle.events.forEach((event, i) => {
    const { fromRound, toRound } = event.window;
    if (fromRound > toRound || toRound > BALANCE.totalRounds) {
      issues.push({ path: `events.${i}.window`, message: `觸發窗口無效：${fromRound}–${toRound}` });
    }
    for (const ref of event.conditions.candidateIds ?? []) {
      if (!candidateIds.has(ref)) {
        issues.push({ path: `events.${i}.conditions.candidateIds`, message: `找不到候選人：${ref}` });
      }
    }
    for (const dupe of findDuplicates(event.choices.map((c) => c.id))) {
      issues.push({ path: `events.${i}.choices`, message: `選項 ID 重複：${dupe}` });
    }
    event.choices.forEach((choice, j) => {
      if (choice.followUpEventId && !eventIds.has(choice.followUpEventId)) {
        issues.push({
          path: `events.${i}.choices.${j}.followUpEventId`,
          message: `找不到後續事件：${choice.followUpEventId}`,
        });
      }
    });
    // 計畫 4.5：任何資源狀態下都須存在有效選項
    if (!event.choices.some((c) => c.cost.actionPoints === 0 && c.cost.funds === 0)) {
      issues.push({ path: `events.${i}.choices`, message: '至少需要一個零成本選項，避免流程卡死' });
    }
  });

  return issues.length === 0 ? { ok: true, bundle, issues: [] } : { ok: false, bundle: null, issues };
}
