import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/content/index.ts';
import { BALANCE } from '../../src/engine/config.ts';
import { createNewGame, endRound, submitAction, type EngineResult } from '../../src/engine/engine.ts';
import type { GameState } from '../../src/engine/types.ts';

const content = loadContent();

function newGame(seed = 'test-seed'): GameState {
  return createNewGame(content, { seed });
}

function expectOk(result: EngineResult): GameState {
  if (!result.ok) throw new Error(`預期成功，實際失敗：${result.reason}`);
  return result.state;
}

describe('createNewGame', () => {
  it('以候選人起始資源與完整行動點開局', () => {
    const state = newGame();
    expect(state.round).toBe(1);
    expect(state.phase).toBe('campaign');
    expect(state.actionPoints).toBe(BALANCE.actionPointsPerRound);
    expect(state.commitments[0]?.history).toHaveLength(1);
  });

  it('隱藏選情比例加總為 1', () => {
    const { ourSupport, opponentSupport, undecided } = newGame().hidden;
    expect(ourSupport + opponentSupport + undecided).toBeCloseTo(1);
  });

  it('指定不存在的候選人時拋出錯誤', () => {
    expect(() => createNewGame(content, { seed: 'x', candidateId: 'nobody' })).toThrow();
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
      state = expectOk(submitAction(state, 'team-care', state.revision));
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
