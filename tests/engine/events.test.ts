import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/validate.ts';
import {
  choiceBlocker,
  createNewGame,
  drawEvent,
  endRound,
  resolveEvent,
  type EngineResult,
} from '../../src/engine/engine.ts';
import type { GameState } from '../../src/engine/types.ts';
import { loadFixture, rawFixture } from '../fixtures/content.ts';

const content = loadFixture();
const event = (id: string) => content.events.find((e) => e.id === id)!;
const choice = (eventId: string, choiceId: string) => event(eventId).choices.find((c) => c.id === choiceId)!;

function expectOk(result: EngineResult): GameState {
  if (!result.ok) throw new Error(`預期成功，實際失敗：${result.reason}`);
  return result.state;
}

/** 直接移到指定回合並重新抽事件 */
function atRound(round: number, seed = 'ev', patch: Partial<GameState> = {}): GameState {
  const base = createNewGame(content, { seed, districtId: 'test-city', candidacyId: 'cand-a' });
  return drawEvent({ ...base, round, activeEvent: null, ...patch }, content);
}

describe('抽事件', () => {
  it('第 1 回合沒有符合窗口的事件', () => {
    expect(createNewGame(content, { seed: 'ev', districtId: 'test-city', candidacyId: 'cand-a' }).activeEvent).toBeNull();
  });

  it('依窗口與優先序抽出事件，並綁定我方與對手同議題的真實政見', () => {
    expect(atRound(2).activeEvent?.eventId).toBe('test-event');
    const state = atRound(3);
    expect(state.activeEvent?.eventId).toBe('fx-showdown');
    const binding = state.activeEvent!.binding!;
    const ours = content.policies.find((p) => p.id === binding.ourPolicyId)!;
    const theirs = content.policies.find((p) => p.id === binding.opponentPolicyId)!;
    expect(ours.candidacyId).toBe('cand-a');
    expect(theirs.candidacyId).not.toBe('cand-a');
    expect(theirs.topic).toBe(ours.topic);
  });

  it('資源條件成立時，高優先序事件優先', () => {
    const tired = atRound(3, 'ev', {
      resources: { ...atRound(1).resources, morale: 30 },
    });
    expect(tired.activeEvent?.eventId).toBe('fx-tired');
  });

  it('一次性事件發生過就不再出現', () => {
    expect(atRound(2, 'ev', { eventLog: [{ round: 2, eventId: 'test-event', ourPolicyId: null }] }).activeEvent).toBeNull();
  });

  it('相同種子抽出相同事件與綁定', () => {
    expect(atRound(3, 'same').activeEvent).toEqual(atRound(3, 'same').activeEvent);
  });
});

describe('冷卻與綁定輪替', () => {
  it('可重複事件在冷卻期間不會再出現', () => {
    const broken = structuredClone(rawFixture);
    Object.assign(broken.events.find((e) => e.id === 'fx-showdown')!, { once: false, cooldownRounds: 1 });
    const bundle = validateContent(broken);
    if (!bundle.ok) throw new Error('fixture invalid');
    const base = createNewGame(bundle.bundle, { seed: 'cd', districtId: 'test-city', candidacyId: 'cand-a' });
    const log = [{ round: 3, eventId: 'fx-showdown', ourPolicyId: 'a-transit' }];
    expect(drawEvent({ ...base, round: 4, eventLog: log }, bundle.bundle).activeEvent?.eventId).not.toBe('fx-showdown');
    expect(drawEvent({ ...base, round: 5, eventLog: log }, bundle.bundle).activeEvent?.eventId).toBe('fx-showdown');
  });

  it('優先綁定還沒被事件問過的政見', () => {
    for (let seed = 0; seed < 10; seed++) {
      const state = atRound(3, String(seed), { eventLog: [{ round: 2, eventId: 'test-event', ourPolicyId: 'a-transit' }] });
      expect(state.activeEvent?.binding?.ourPolicyId).toBe('a-housing');
    }
  });
});

describe('處理事件', () => {
  it('有待處理事件時不能結束回合', () => {
    const state = atRound(2);
    expect(endRound(state, content, state.revision).ok).toBe(false);
  });

  it('策略選項會套用到綁定的政見，並記錄為事件決策', () => {
    const before = atRound(3);
    const policyId = before.activeEvent!.binding!.ourPolicyId;
    const after = expectOk(resolveEvent(before, content, 'contrast', before.revision));
    const entry = after.campaign.find((c) => c.policyId === policyId)!;
    expect(entry.status).toBe('reframed');
    expect(entry.angle).toBe('contrast');
    expect(after.actionPoints).toBe(before.actionPoints - 1);
    expect(after.decisions.at(-1)?.kind).toBe('event-choice');
    expect(after.activeEvent).toBeNull();
    expect(after.eventLog.at(-1)).toEqual({ round: 3, eventId: 'fx-showdown', ourPolicyId: policyId });
  });

  it('後續事件在指定回合出現，並沿用原本綁定的政見', () => {
    const start = atRound(3);
    const binding = start.activeEvent!.binding;
    let state = expectOk(resolveEvent(start, content, 'check', start.revision));
    expect(state.scheduledEvents).toHaveLength(1);
    state = expectOk(endRound(state, content, state.revision));
    expect(state.activeEvent).toEqual({ eventId: 'fx-followup', binding });
    expect(state.scheduledEvents).toHaveLength(0);
  });

  it('政見資料撐不起的選項不可選，保底選項永遠可選', () => {
    const state = atRound(6);
    expect(state.activeEvent?.eventId).toBe('fx-numbers');
    expect(choiceBlocker(state, content, choice('fx-numbers', 'numbers'))).not.toBeNull();
    expect(resolveEvent(state, content, 'numbers', state.revision).ok).toBe(false);
    expect(choiceBlocker(state, content, choice('fx-numbers', 'decline'))).toBeNull();
  });

  it('行動點不足時付費選項不可選', () => {
    const state = { ...atRound(2), actionPoints: 0 };
    expect(choiceBlocker(state, content, choice('test-event', 'paid'))).toMatch(/行動點不足/);
    expect(expectOk(resolveEvent(state, content, 'free', state.revision)).activeEvent).toBeNull();
  });
});

describe('事件內容驗證', () => {
  it('沒有綁定政見的事件不能有策略選項', () => {
    const broken = structuredClone(rawFixture);
    const tired = broken.events.find((e) => e.id === 'fx-tired')!;
    Object.assign(tired.choices[0]!, { strategy: { status: 'featured' } });
    expect(validateContent(broken).issues.some((i) => i.message.includes('沒有綁定政見'))).toBe(true);
  });

  it('保底選項不能依賴政見條件', () => {
    const broken = structuredClone(rawFixture);
    const numbers = broken.events.find((e) => e.id === 'fx-numbers')!;
    Object.assign(numbers.choices[1]!, { requiresStrengths: ['concrete'] });
    expect(validateContent(broken).issues.some((i) => i.message.includes('零成本且無條件'))).toBe(true);
  });

  it('後續事件必須存在', () => {
    const broken = structuredClone(rawFixture);
    const showdown = broken.events.find((e) => e.id === 'fx-showdown')!;
    Object.assign(showdown.choices[2]!, { followUp: { eventId: 'ghost', afterRounds: 1 } });
    expect(validateContent(broken).issues.some((i) => i.message.includes('ghost'))).toBe(true);
  });
});
