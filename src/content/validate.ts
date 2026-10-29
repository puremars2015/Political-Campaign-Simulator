import { BALANCE } from '../engine/config.ts';
import { assessDistrict } from './query.ts';
import { contentBundleSchema, type Citation, type ContentBundle } from './schema.ts';

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

/** 驗證內容的 schema、跨檔引用與發布門檻；回傳所有問題而非遇到第一個就停止。 */
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
  const add = (path: string, message: string) => issues.push({ path, message });

  const ids = {
    elections: new Set(bundle.elections.map((e) => e.id)),
    districts: new Set(bundle.districts.map((d) => d.id)),
    people: new Set(bundle.people.map((p) => p.id)),
    candidacies: new Set(bundle.candidacies.map((c) => c.id)),
    policies: new Set(bundle.policies.map((p) => p.id)),
    sources: new Set(bundle.sources.map((s) => s.id)),
    events: new Set(bundle.events.map((e) => e.id)),
    topics: new Set(bundle.topics.map((t) => t.id)),
  };

  for (const kind of Object.keys(ids) as (keyof typeof ids)[]) {
    const list = (bundle[kind] as { id: string }[]).map((item) => item.id);
    for (const dupe of findDuplicates(list)) add(kind, `ID 重複：${dupe}`);
  }

  const checkCitations = (path: string, citations: readonly Citation[]) => {
    citations.forEach((c, i) => {
      if (!ids.sources.has(c.sourceId)) add(`${path}.${i}.sourceId`, `找不到來源：${c.sourceId}`);
    });
  };

  bundle.elections.forEach((election, i) => checkCitations(`elections.${i}.citations`, election.citations));

  bundle.districts.forEach((district, i) => {
    if (!ids.elections.has(district.electionId)) {
      add(`districts.${i}.electionId`, `找不到選舉：${district.electionId}`);
    }
    for (const dupe of findDuplicates(district.regions.map((r) => r.id))) {
      add(`districts.${i}.regions`, `行政區 ID 重複：${dupe}`);
    }
    district.regions.forEach((r, j) => checkCitations(`districts.${i}.regions.${j}.citations`, r.citations));
    for (const candidacyId of district.focusCandidacyIds ?? []) {
      const candidacy = bundle.candidacies.find((c) => c.id === candidacyId);
      if (!candidacy || candidacy.districtId !== district.id) {
        add(`districts.${i}.focusCandidacyIds`, `收錄範圍中的參選紀錄不屬於${district.name}：${candidacyId}`);
      }
    }
  });

  bundle.people.forEach((person, i) => {
    person.background.forEach((b, j) => checkCitations(`people.${i}.background.${j}`, [b.citation]));
  });

  bundle.candidacies.forEach((candidacy, i) => {
    const path = `candidacies.${i}`;
    if (!ids.people.has(candidacy.personId)) add(`${path}.personId`, `找不到人物：${candidacy.personId}`);
    const district = bundle.districts.find((d) => d.id === candidacy.districtId);
    if (!district) {
      add(`${path}.districtId`, `找不到縣市：${candidacy.districtId}`);
    } else {
      if (district.electionId !== candidacy.electionId) {
        add(`${path}.electionId`, `參選屆次 ${candidacy.electionId} 與縣市的選舉 ${district.electionId} 不符`);
      }
      if (district.office !== candidacy.office) {
        add(`${path}.office`, `參選職位「${candidacy.office}」與縣市職位「${district.office}」不符`);
      }
    }
    checkCitations(`${path}.statusCitations`, candidacy.statusCitations);
  });

  bundle.policies.forEach((policy, i) => {
    const path = `policies.${i}`;
    const candidacy = bundle.candidacies.find((c) => c.id === policy.candidacyId);
    if (!candidacy) {
      add(`${path}.candidacyId`, `找不到參選紀錄：${policy.candidacyId}`);
    } else {
      // 計畫 4.5：不得把其他縣市、不同屆次的政策移植過來
      if (candidacy.electionId !== policy.electionId) {
        add(`${path}.electionId`, `政見屆次 ${policy.electionId} 與參選紀錄 ${candidacy.electionId} 不符`);
      }
      if (candidacy.districtId !== policy.districtId) {
        add(`${path}.districtId`, `政見選區 ${policy.districtId} 與參選紀錄 ${candidacy.districtId} 不符`);
      }
    }
    if (!ids.topics.has(policy.topic)) add(`${path}.topic`, `找不到議題分類：${policy.topic}`);
    if (policy.supersedes) {
      const previous = bundle.policies.find((p) => p.id === policy.supersedes);
      if (!previous) add(`${path}.supersedes`, `找不到被修訂的政見：${policy.supersedes}`);
      else if (previous.candidacyId !== policy.candidacyId) {
        add(`${path}.supersedes`, '只能修訂同一參選紀錄的政見');
      }
    }
    checkCitations(`${path}.citations`, policy.citations);
    for (const [key, field] of Object.entries(policy.fields)) {
      if (field.stated !== null) checkCitations(`${path}.fields.${key}`, [field.citation]);
    }
  });

  bundle.events.forEach((event, i) => {
    const { fromRound, toRound } = event.window;
    if (fromRound > toRound || toRound > BALANCE.totalRounds) {
      add(`events.${i}.window`, `觸發窗口無效：${fromRound}–${toRound}`);
    }
    for (const dupe of findDuplicates(event.choices.map((c) => c.id))) {
      add(`events.${i}.choices`, `選項 ID 重複：${dupe}`);
    }
    event.choices.forEach((choice, j) => {
      if (choice.followUpEventId && !ids.events.has(choice.followUpEventId)) {
        add(`events.${i}.choices.${j}.followUpEventId`, `找不到後續事件：${choice.followUpEventId}`);
      }
    });
    // 計畫 4.5：任何資源狀態下都須存在有效選項
    if (!event.choices.some((c) => c.cost.actionPoints === 0 && c.cost.funds === 0)) {
      add(`events.${i}.choices`, '至少需要一個零成本選項，避免流程卡死');
    }
  });

  // 引用錯誤時門檻檢查沒有意義，避免重複回報
  if (issues.length === 0) {
    bundle.districts.forEach((district, i) => {
      if (district.status !== 'playable' && district.status !== 'preview') return;
      const mode = district.status === 'playable' ? 'formal' : 'preview';
      const label = mode === 'formal' ? '可玩' : '預覽';
      const { reasons } = assessDistrict(bundle, district, mode);
      for (const reason of reasons) add(`districts.${i}`, `${district.name} 標示為${label}但未達門檻：${reason}`);
    });
  }

  return issues.length === 0 ? { ok: true, bundle, issues: [] } : { ok: false, bundle: null, issues };
}
