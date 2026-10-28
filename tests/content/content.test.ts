import { describe, expect, it } from 'vitest';
import { rawContent } from '../../src/content/index.ts';
import { assessDistrict, isPolicyUsable } from '../../src/content/query.ts';
import { validateContent } from '../../src/content/validate.ts';
import { loadFixture, rawFixture } from '../fixtures/content.ts';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function messages(raw: unknown): string[] {
  return validateContent(raw).issues.map((i) => i.message);
}

describe('正式內容', () => {
  const result = validateContent(rawContent);

  it('通過 schema、引用與發布門檻驗證', () => {
    expect(result.issues).toEqual([]);
  });

  it('縣市目錄涵蓋22個直轄市及縣市', () => {
    const bundle = result.ok ? result.bundle : null;
    expect(bundle?.districts).toHaveLength(22);
    expect(bundle?.districts.filter((d) => d.kind === 'municipality')).toHaveLength(6);
  });

  it('不包含測試資料', () => {
    expect(JSON.stringify(rawContent)).not.toContain('測試資料');
  });
});

describe('validateContent', () => {
  it('測試資料本身有效', () => {
    expect(validateContent(rawFixture).issues).toEqual([]);
  });

  it('指出不存在的來源', () => {
    const broken = clone(rawFixture);
    broken.policies[0]!.citations[0]!.sourceId = 'missing-source';
    expect(messages(broken).some((m) => m.includes('missing-source'))).toBe(true);
  });

  it('指出跨屆誤用的政見', () => {
    const broken = clone(rawFixture);
    broken.policies[0]!.electionId = 'other-election';
    expect(messages(broken).some((m) => m.includes('屆次'))).toBe(true);
  });

  it('指出跨選區誤用的政見', () => {
    const broken = clone(rawFixture);
    broken.policies[0]!.districtId = 'draft-city';
    expect(messages(broken).some((m) => m.includes('選區'))).toBe(true);
  });

  it('指出職位與縣市不符的參選紀錄', () => {
    const broken = clone(rawFixture);
    broken.candidacies[0]!.office = '議員';
    expect(messages(broken).some((m) => m.includes('職位'))).toBe(true);
  });

  it('只能修訂同一參選紀錄的政見', () => {
    const broken = clone(rawFixture);
    Object.assign(broken.policies[4]!, { supersedes: 'a-old' });
    expect(messages(broken).some((m) => m.includes('同一參選紀錄'))).toBe(true);
  });

  it('沒有引用來源的政見無法通過 schema', () => {
    const broken = clone(rawFixture);
    (broken.policies[0] as { citations: unknown[] }).citations = [];
    expect(validateContent(broken).ok).toBe(false);
  });

  it('要求每個事件至少有一個零成本選項', () => {
    const broken = clone(rawFixture);
    broken.events[0]!.choices[0]!.cost.funds = 10;
    expect(messages(broken).some((m) => m.includes('零成本'))).toBe(true);
  });

  it('拒絕超出12回合的觸發窗口', () => {
    const broken = clone(rawFixture);
    broken.events[0]!.window.toRound = 13;
    expect(validateContent(broken).ok).toBe(false);
  });

  it('標示可玩但來源未審閱時不通過', () => {
    const broken = clone(rawFixture);
    broken.sources.find((s) => s.id === 'src-election')!.verification = 'pending-review';
    expect(messages(broken).some((m) => m.includes('標示為可玩但未達門檻'))).toBe(true);
  });

  it('標示可玩但候選人尚非正式候選人時不通過', () => {
    const broken = clone(rawFixture);
    (broken.candidacies[1] as { status: string }).status = 'nominated';
    expect(messages(broken).some((m) => m.includes('正式候選人'))).toBe(true);
  });
});

describe('可玩門檻與政見可用性', () => {
  const content = loadFixture();

  it('資料完整的縣市可玩，蒐集中的縣市列出原因', () => {
    expect(assessDistrict(content, content.districts[0]!).playable).toBe(true);
    const draft = assessDistrict(content, content.districts[1]!);
    expect(draft.playable).toBe(false);
    expect(draft.reasons).toContain('尚未建立候選人名單');
  });

  it('待審閱來源與歷史立場不可在遊戲中使用', () => {
    const byId = (id: string) => content.policies.find((p) => p.id === id)!;
    expect(isPolicyUsable(content, byId('a-transit'))).toBe(true);
    expect(isPolicyUsable(content, byId('a-parks'))).toBe(false);
    expect(isPolicyUsable(content, byId('a-old'))).toBe(false);
  });

  it('來源未說明的欄位保持未知，不補值', () => {
    const policy = content.policies.find((p) => p.id === 'a-transit')!;
    expect(policy.fields.funding).toEqual({ stated: null });
  });
});
