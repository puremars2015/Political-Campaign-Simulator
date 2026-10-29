import { describe, expect, it } from 'vitest';
import { assessPolicy, remainingRisks } from '../../src/content/assess.ts';
import type { Policy } from '../../src/content/schema.ts';
import { loadFixture } from '../fixtures/content.ts';

const content = loadFixture();
const policy = (id: string) => content.policies.find((p) => p.id === id)!;
const opponents = ['cand-b', 'cand-c'];

describe('幕僚評估', () => {
  it('依資料判斷優勢、風險與對手同議題政見', () => {
    const a = assessPolicy(content, policy('a-transit'), opponents);
    expect(a.strengths).toEqual(['head-to-head', 'official-source']);
    expect(a.risks).toEqual(['vague']);
    expect(a.opponentPolicyIds).toEqual(['b-transit']);
    expect(a.angles).toContain('contrast');
    expect(a.angles).not.toContain('continuity');
    expect(a.suggestion).toBe('reframed');
    expect(a.suggestedAngle).toBe('vision');
  });

  it('對手沒有同議題政見時是獨佔議題', () => {
    expect(assessPolicy(content, policy('b-youth'), ['cand-a']).strengths).toContain('unique-issue');
  });

  it('涉及支出卻沒交代財源才算財源風險', () => {
    const base = policy('a-housing');
    const spending: Policy = { ...base, summary: '每月補助 1,500 元' };
    expect(assessPolicy(content, spending, opponents).risks).toContain('costly-unfunded');
    expect(assessPolicy(content, base, opponents).risks).not.toContain('costly-unfunded');
  });

  it('對手在同議題著墨較多時列為風險，建議吞下去且不提供對比角度', () => {
    const intruder: Policy = { ...policy('c-governance'), topic: 'transit' };
    const a = assessPolicy(content, intruder, ['cand-a', 'cand-b']);
    expect(a.risks).toContain('opponent-dominant');
    expect(a.strengths).not.toContain('head-to-head');
    expect(a.angles).not.toContain('contrast');
    expect(a.suggestion).toBe('low-profile');
  });

  it('市府計畫同時帶來資源優勢與選前開支票的風險，並提供延續施政的角度', () => {
    const base = policy('a-housing');
    const risky: Policy = {
      ...base,
      origin: 'government-plan',
      citations: [{ sourceId: 'src-pending', quote: 'x', locator: { kind: 'quote', value: 'x' } }],
      fields: { ...base.fields, deadline: { stated: '2033年完成', citation: base.citations[0]! } },
    };
    const a = assessPolicy(content, risky, opponents);
    expect(a.strengths).toContain('incumbent-resources');
    expect([...a.risks].sort()).toEqual(['government-plan', 'long-horizon', 'thin-source']);
    expect(a.angles).toContain('continuity');
    expect([...remainingRisks(a, 'step-by-step')].sort()).toEqual(['government-plan', 'thin-source']);
  });

  it('沒有風險的政見建議大張旗鼓', () => {
    const base = policy('a-transit');
    const safe: Policy = { ...base, fields: { ...base.fields, funding: { stated: '市府預算', citation: base.citations[0]! } } };
    expect(assessPolicy(content, safe, opponents).suggestion).toBe('featured');
  });
});
