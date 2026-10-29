import { describe, expect, it } from 'vitest';
import {
  MASK,
  buildRounds,
  excludedCandidacies,
  maskTermsFor,
  maskText,
  normalizeText,
  primaryQuote,
  tally,
} from '../../src/content/compare.ts';
import { validateContent } from '../../src/content/validate.ts';
import { seedRng } from '../../src/engine/rng.ts';
import { loadFixture, rawFixture } from '../fixtures/content.ts';

const content = loadFixture();
const comparison = content.comparisons[0]!;

describe('遮蔽', () => {
  it('「臺」統一寫成「台」', () => {
    expect(normalizeText('臺北市')).toBe('台北市');
  });

  it('較長的字詞先遮，不留下半截', () => {
    expect(maskText('民主進步黨與民進黨', ['民進黨', '民主進步黨'])).toBe(`${MASK}與${MASK}`);
  });

  it('姓名與黨名遮在所有段落，陣營專屬字詞只遮自己的段落', () => {
    const forA = maskTermsFor(content, comparison, 'cand-a');
    const forB = maskTermsFor(content, comparison, 'cand-b');
    expect(forA).toEqual(expect.arrayContaining(['測試候選人甲', '測試黨', '測試候選人乙']));
    expect(forA).not.toContain('乙陣營');
    expect(forB).toContain('乙陣營');
    // 無黨籍不是身分線索，不遮
    expect(forB).not.toContain('無黨籍');
  });

  it('段落中提到對手或自己陣營的字詞都被遮蔽', () => {
    const { rounds } = buildRounds(content, comparison, seedRng(1));
    const segment = rounds.flatMap((r) => r.segments).find((s) => s.policyId === 'b-transit');
    expect(segment?.maskedText).toBe(`不同於${MASK}與${MASK}，${MASK}主張台北捷運延伸`);
  });

  it('優先使用非媒體來源中最長的引文', () => {
    const policy = content.policies.find((p) => p.id === 'a-transit')!;
    expect(primaryQuote(content, policy)).toBe('增加公車班次');
  });
});

describe('出題', () => {
  const { rounds } = buildRounds(content, comparison, seedRng(7));

  it('共同議題各一輪，最後一輪是各自的特色政見', () => {
    const shared = rounds.filter((r) => r.kind === 'shared').map((r) => r.topicId);
    expect(shared.sort()).toEqual(['housing', 'transit']);
    const signature = rounds.at(-1)!;
    expect(signature.kind).toBe('signature');
    expect(signature.segments.map((s) => s.policyId).sort()).toEqual(['a-parks', 'b-youth']);
  });

  it('每輪每位候選人只出一段，且不含歷史立場或比較外的候選人', () => {
    for (const round of rounds) {
      const ids = round.segments.map((s) => s.candidacyId);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const all = rounds.flatMap((r) => r.segments.map((s) => s.policyId));
    expect(all).not.toContain('a-old');
    expect(all).not.toContain('c-governance');
  });

  it('相同種子出相同的題，共同議題數受上限限制', () => {
    expect(buildRounds(content, comparison, seedRng(3)).rounds).toEqual(buildRounds(content, comparison, seedRng(3)).rounds);
    expect(buildRounds(content, comparison, seedRng(3), 1).rounds.filter((r) => r.kind === 'shared')).toHaveLength(1);
  });
});

describe('計分與收錄範圍', () => {
  it('蓋章得 1 分，重要議題 2 分，跳過不計分', () => {
    const { rounds } = buildRounds(content, comparison, seedRng(7));
    const picks = rounds.map((r) => r.segments.find((s) => s.candidacyId === 'cand-a')?.policyId ?? null);
    picks[0] = null;
    const important = new Set([rounds[1]!.topicId]);
    const scores = tally(rounds, picks, important);
    expect(scores.get('cand-a')).toBe(2 + (rounds.length - 2));
    expect(scores.get('cand-b')).toBe(0);
  });

  it('列出同選區未納入比較的參選人', () => {
    expect(excludedCandidacies(content, comparison)).toEqual(['cand-c']);
  });

  it('驗證器指出未知議題與跨選區的比較設定', () => {
    const broken = structuredClone(rawFixture);
    (broken.policies[0] as { topic: string }).topic = 'ghost-topic';
    broken.comparisons[0]!.candidacyIds = ['cand-a', 'cand-missing'];
    const messages = validateContent(broken).issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('ghost-topic'))).toBe(true);
    expect(messages.some((m) => m.includes('cand-missing'))).toBe(true);
  });
});
