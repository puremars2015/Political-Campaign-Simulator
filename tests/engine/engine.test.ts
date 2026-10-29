import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/engine/config.ts';
import {
  createNewGame,
  endRound,
  setPolicyExposure,
  submitAction,
  type EngineResult,
} from '../../src/engine/engine.ts';
import type { GameState } from '../../src/engine/types.ts';
import { loadFixture } from '../fixtures/content.ts';

const content = loadFixture();

function newGame(seed = 'test-seed'): GameState {
  return createNewGame(content, { seed, districtId: 'test-city', candidacyId: 'cand-a' });
}

function expectOk(result: EngineResult): GameState {
  if (!result.ok) throw new Error(`預期成功，實際失敗：${result.reason}`);
  return result.state;
}

describe('createNewGame', () => {
  it('以指定的參選紀錄開局，並記錄同選區對手', () => {
    const state = newGame();
    expect(state.round).toBe(1);
    expect(state.phase).toBe('campaign');
    expect(state.candidacyId).toBe('cand-a');
    expect(state.opponentCandidacyIds).toEqual(['cand-b', 'cand-c']);
    expect(state.resources.funds).toBe(800);
    expect(state.actionPoints).toBe(BALANCE.actionPointsPerRound);
    expect(state.dataAsOf).toBe('2026-10-01');
  });

  it('只納入我方來源已審閱的當次政見，排除待審閱與歷史立場', () => {
    expect(newGame().campaign.map((c) => c.policyId)).toEqual(['a-transit', 'a-housing']);
  });

  it('隱藏選情比例加總為 1', () => {
    const { support, undecided } = newGame().hidden;
    const total = Object.values(support).reduce((a, b) => a + b, 0) + undecided;
    expect(total).toBeCloseTo(1);
  });

  it('拒絕不存在的參選紀錄', () => {
    expect(() => createNewGame(content, { seed: 'x', districtId: 'test-city', candidacyId: 'nobody' })).toThrow();
  });

  it('拒絕其他縣市的參選紀錄', () => {
    expect(() => createNewGame(content, { seed: 'x', districtId: 'draft-city', candidacyId: 'cand-a' })).toThrow();
  });

  it('拒絕尚未達可玩門檻的縣市', () => {
    expect(() => createNewGame(content, { seed: 'x', districtId: 'draft-city', candidacyId: 'cand-a' })).toThrow(
      /尚不可玩/,
    );
  });
});

describe('setPolicyExposure', () => {
  it('主打政見會扣除成本並保留歷史，不保存政見內容', () => {
    const before = newGame();
    const after = expectOk(setPolicyExposure(before, content, 'a-transit', 'featured', before.revision));
    const entry = after.campaign.find((c) => c.policyId === 'a-transit');
    expect(entry?.status).toBe('featured');
    expect(entry?.history.map((h) => h.status)).toEqual(['pending', 'featured']);
    expect(after.actionPoints).toBe(before.actionPoints - 1);
    expect(after.decisions.at(-1)?.kind).toBe('policy-exposure');
    // GameState 只有政見 ID 與安排狀態，沒有可被改寫的政見欄位
    expect(Object.keys(entry ?? {}).sort()).toEqual(['angle', 'history', 'policyId', 'status']);
  });

  it('不能安排對手、待審閱或不存在的政見', () => {
    const state = newGame();
    for (const policyId of ['b-housing', 'a-parks', 'a-old', 'ghost']) {
      expect(setPolicyExposure(state, content, policyId, 'featured', state.revision).ok).toBe(false);
    }
  });

  it('重複設定相同狀態會被拒絕', () => {
    let state = newGame();
    state = expectOk(setPolicyExposure(state, content, 'a-transit', 'deferred', state.revision));
    expect(setPolicyExposure(state, content, 'a-transit', 'deferred', state.revision).ok).toBe(false);
  });

  it('同時主打數量受上限限制', () => {
    const base = newGame();
    // 加入第三項可安排政見，以測試超過上限的情況
    const extra = { policyId: 'a-parks', status: 'pending' as const, angle: null, history: [] };
    let state: GameState = { ...base, actionPoints: 10, campaign: [...base.campaign, extra] };
    state = expectOk(setPolicyExposure(state, content, 'a-transit', 'featured', state.revision));
    state = expectOk(setPolicyExposure(state, content, 'a-housing', 'featured', state.revision));
    expect(BALANCE.maxFeaturedPolicies).toBe(2);
    const result = setPolicyExposure(state, content, 'a-parks', 'featured', state.revision);
    expect(result.ok).toBe(false);
  });

  it('不改變內容庫中的政見', () => {
    const snapshot = structuredClone(content.policies);
    const state = newGame();
    expectOk(setPolicyExposure(state, content, 'a-transit', 'featured', state.revision));
    expect(content.policies).toEqual(snapshot);
  });
});

describe('submitAction', () => {
  it('扣除行動點與經費並留下決策紀錄', () => {
    const before = newGame();
    const after = expectOk(submitAction(before, 'team-care', before.revision));
    expect(after.actionPoints).toBe(before.actionPoints - 1);
    expect(after.resources.funds).toBe(before.resources.funds - 10);
    expect(after.resources.morale).toBe(before.resources.morale + 5);
    expect(after.decisions).toHaveLength(1);
    expect(after.revision).toBe(before.revision + 1);
  });

  it('行動點不足時拒絕，且不改變狀態', () => {
    let state = newGame();
    state = expectOk(submitAction(state, 'field-event', state.revision));
    const result = submitAction(state, 'field-event', state.revision);
    expect(result.ok).toBe(false);
    expect(state.actionPoints).toBe(1);
  });

  it('經費不足時拒絕', () => {
    const state = { ...newGame(), resources: { ...newGame().resources, funds: 5 } };
    expect(submitAction(state, 'team-care', state.revision).ok).toBe(false);
  });

  it('重複或過期的提交會被拒絕，不會重複扣款', () => {
    const state = newGame();
    const first = expectOk(submitAction(state, 'team-care', state.revision));
    const duplicate = submitAction(first, 'team-care', state.revision);
    expect(duplicate.ok).toBe(false);
  });

  it('數值受上下限截斷', () => {
    let state = { ...newGame(), resources: { ...newGame().resources, morale: 98 } };
    state = expectOk(submitAction(state, 'team-care', state.revision));
    expect(state.resources.morale).toBe(100);
    expect(state.decisions[0]?.resourceDelta.morale).toBe(2);
  });
});

describe('endRound', () => {
  it('推進回合、重置行動點，並在到期時套用延遲效果', () => {
    let state = newGame();
    state = expectOk(submitAction(state, 'policy-research', state.revision));
    const consistencyBefore = state.resources.policyConsistency;
    expect(state.pendingEffects).toHaveLength(1);

    state = expectOk(endRound(state, state.revision));
    expect(state.round).toBe(2);
    expect(state.actionPoints).toBe(BALANCE.actionPointsPerRound);
    expect(state.pendingEffects).toHaveLength(0);
    expect(state.resources.policyConsistency).toBe(consistencyBefore + 4);
    const delayed = state.decisions.at(-1);
    expect(delayed?.kind).toBe('delayed-effect');
    expect(delayed?.ref).toBe('d1');
  });

  it('第12回合結束後進入投票階段，之後不能再行動', () => {
    let state = newGame();
    for (let i = 0; i < BALANCE.totalRounds; i++) state = expectOk(endRound(state, state.revision));
    expect(state.phase).toBe('election');
    expect(submitAction(state, 'candidate-briefing', state.revision).ok).toBe(false);
    expect(endRound(state, state.revision).ok).toBe(false);
  });
});

describe('確定性', () => {
  it('相同種子與選擇序列得到完全相同的狀態', () => {
    const play = () => {
      let state = newGame('replay');
      state = expectOk(submitAction(state, 'policy-research', state.revision));
      state = expectOk(submitAction(state, 'field-event', state.revision));
      state = expectOk(endRound(state, state.revision));
      state = expectOk(setPolicyExposure(state, content, 'a-housing', 'featured', state.revision));
      return state;
    };
    expect(play()).toEqual(play());
  });

  it('存讀檔（JSON 往返）後的後續結果一致', () => {
    let state = newGame('save-load');
    state = expectOk(submitAction(state, 'policy-research', state.revision));
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    const a = expectOk(endRound(state, state.revision));
    const b = expectOk(endRound(restored, restored.revision));
    expect(b).toEqual(a);
  });
});

describe('政見策略', () => {
  it('主打依優勢增加公共信任，未處理的風險在兩回合後被追問', () => {
    const before = newGame();
    const after = expectOk(setPolicyExposure(before, content, 'a-transit', 'featured', before.revision));
    // a-transit：優勢為「可正面對比」「有官方出處」；風險為「內容籠統」
    expect(after.resources.publicTrust).toBe(before.resources.publicTrust + 2);
    expect(after.pendingEffects).toHaveLength(1);
    expect(after.pendingEffects[0]?.dueRound).toBe(before.round + 2);
    expect(after.pendingEffects[0]?.effects).toEqual([
      { kind: 'resource', key: 'publicTrust', delta: -2 },
      { kind: 'resource', key: 'policyConsistency', delta: -1 },
    ]);
  });

  it('包裝角度化解風險時不會留下被追問的代價', () => {
    const before = newGame();
    const after = expectOk(setPolicyExposure(before, content, 'a-transit', 'reframed', before.revision, 'vision'));
    expect(after.resources.publicTrust).toBe(before.resources.publicTrust + 1);
    expect(after.pendingEffects).toHaveLength(0);
    expect(after.campaign.find((c) => c.policyId === 'a-transit')?.angle).toBe('vision');
  });

  it('包裝角度沒化解的風險仍會被追問，但代價較輕', () => {
    const before = newGame();
    const after = expectOk(setPolicyExposure(before, content, 'a-transit', 'reframed', before.revision, 'contrast'));
    expect(after.pendingEffects[0]?.effects).toEqual([{ kind: 'resource', key: 'publicTrust', delta: -1 }]);
  });

  it('資料不支援的角度與缺少角度的包裝都會被拒絕', () => {
    const state = newGame();
    // 「延續既有施政」只適用於市府計畫
    expect(setPolicyExposure(state, content, 'a-transit', 'reframed', state.revision, 'continuity').ok).toBe(false);
    expect(setPolicyExposure(state, content, 'a-transit', 'reframed', state.revision).ok).toBe(false);
    expect(setPolicyExposure(state, content, 'a-transit', 'featured', state.revision, 'vision').ok).toBe(false);
  });

  it('對手也有同議題政見時，吞下去等於讓出話題', () => {
    const before = newGame();
    const after = expectOk(setPolicyExposure(before, content, 'a-housing', 'low-profile', before.revision));
    expect(after.actionPoints).toBe(before.actionPoints);
    expect(after.pendingEffects[0]?.effects).toEqual([{ kind: 'resource', key: 'publicTrust', delta: -1 }]);
  });
});
