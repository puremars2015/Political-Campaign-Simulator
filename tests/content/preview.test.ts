import { describe, expect, it } from 'vitest';
import { assessDistrict, startableMode } from '../../src/content/query.ts';
import { validateContent } from '../../src/content/validate.ts';
import { createNewGame } from '../../src/engine/engine.ts';
import { loadFixture, rawFixture } from '../fixtures/content.ts';

const content = loadFixture();
const district = (id: string) => content.districts.find((d) => d.id === id)!;

describe('預覽資料', () => {
  it('收錄範圍內的參選人達標即可預覽，但仍不符合正式門檻', () => {
    expect(assessDistrict(content, district('preview-city'), 'preview').playable).toBe(true);
    expect(assessDistrict(content, district('preview-city'), 'formal').playable).toBe(false);
    expect(startableMode(content, district('preview-city')).mode).toBe('preview');
    expect(startableMode(content, district('test-city')).mode).toBe('formal');
    expect(startableMode(content, district('draft-city')).mode).toBeNull();
  });

  it('預覽開局只納入收錄範圍內的對手，並可使用待審閱來源的政見', () => {
    const state = createNewGame(content, { seed: 'p', districtId: 'preview-city', candidacyId: 'cand-p1' });
    expect(state.dataMode).toBe('preview');
    expect(state.opponentCandidacyIds).toEqual(['cand-p2']);
    expect(state.campaign.map((c) => c.policyId)).toEqual(['p1-transit']);
    const support = Object.values(state.hidden.support).reduce((a, b) => a + b, 0) + state.hidden.undecided;
    expect(support).toBeCloseTo(1);
  });

  it('不在收錄範圍的參選人不能輔佐', () => {
    expect(() => createNewGame(content, { seed: 'p', districtId: 'preview-city', candidacyId: 'cand-p3' })).toThrow();
  });

  it('正式資料仍只使用已審閱來源的政見', () => {
    const state = createNewGame(content, { seed: 'f', districtId: 'test-city', candidacyId: 'cand-a' });
    expect(state.dataMode).toBe('formal');
    expect(state.campaign.map((c) => c.policyId)).not.toContain('a-parks');
  });

  it('標示為預覽但未達門檻時驗證不通過', () => {
    const broken = structuredClone(rawFixture);
    delete (broken.candidacies.find((c) => c.id === 'cand-p2') as { simulation?: unknown }).simulation;
    const messages = validateContent(broken).issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('標示為預覽但未達門檻'))).toBe(true);
  });

  it('收錄範圍不能包含其他縣市的參選紀錄', () => {
    const broken = structuredClone(rawFixture);
    broken.districts.find((d) => d.id === 'preview-city')!.focusCandidacyIds = ['cand-p1', 'cand-a'];
    const messages = validateContent(broken).issues.map((i) => i.message);
    expect(messages.some((m) => m.includes('收錄範圍中的參選紀錄不屬於'))).toBe(true);
  });
});
