import { BALANCE } from './config.ts';
import type { ActionCost, DecisionRecord, Effect, GameState, ResourceKey, Resources } from './types.ts';

export type EngineResult = { ok: true; state: GameState } | { ok: false; reason: string };

function clampResource(key: ResourceKey, value: number): number {
  const { min, max } = BALANCE.resourceBounds[key];
  return Math.min(max, Math.max(min, value));
}

/** 套用效果並回傳實際變化量（受上下限截斷後）。 */
export function applyEffects(resources: Resources, effects: readonly Effect[]): [Resources, Partial<Resources>] {
  const next = { ...resources };
  const delta: Partial<Resources> = {};
  for (const effect of effects) {
    const before = next[effect.key];
    next[effect.key] = clampResource(effect.key, before + effect.delta);
    delta[effect.key] = (delta[effect.key] ?? 0) + (next[effect.key] - before);
  }
  return [next, delta];
}

export function checkRevision(state: GameState, expectedRevision: number): string | null {
  if (state.revision !== expectedRevision) return '此操作已處理或畫面已過期，請重新整理後再試。';
  return null;
}

export function checkAffordable(state: GameState, cost: ActionCost): string | null {
  if (state.phase !== 'campaign') return '選戰已結束，無法再安排行動。';
  if (state.actionPoints < cost.actionPoints) return `行動點不足：需要 ${cost.actionPoints}，剩餘 ${state.actionPoints}。`;
  if (state.resources.funds < cost.funds) return `經費不足：需要 ${cost.funds} 萬，剩餘 ${state.resources.funds} 萬。`;
  return null;
}

export interface DelayedEffects {
  afterRounds: number;
  effects: readonly Effect[];
}

export interface DecisionInput {
  kind: DecisionRecord['kind'];
  ref: string;
  cost: ActionCost;
  effects: readonly Effect[];
  delayed?: readonly DelayedEffects[];
  setFlags?: readonly string[];
  summary: string;
}

/** 一次性產生新狀態與決策紀錄；呼叫前須已通過所有檢查。 */
export function commitDecision(state: GameState, input: DecisionInput): GameState {
  const decisionId = `d${state.decisions.length + 1}`;
  const costEffect: Effect = { kind: 'resource', key: 'funds', delta: -input.cost.funds };
  const [resources, resourceDelta] = applyEffects(state.resources, [costEffect, ...input.effects]);

  const pendingEffects = [
    ...state.pendingEffects,
    ...(input.delayed ?? [])
      .filter((d) => d.effects.length > 0)
      .map((d, i) => ({
        id: `p${decisionId}${i === 0 ? '' : `-${i}`}`,
        dueRound: state.round + d.afterRounds,
        effects: [...d.effects],
        sourceDecisionId: decisionId,
      })),
  ];

  const flags = { ...state.flags };
  for (const flag of input.setFlags ?? []) flags[flag] = true;

  return {
    ...state,
    revision: state.revision + 1,
    resources,
    actionPoints: state.actionPoints - input.cost.actionPoints,
    pendingEffects,
    flags,
    decisions: [
      ...state.decisions,
      { id: decisionId, round: state.round, kind: input.kind, ref: input.ref, resourceDelta, summary: input.summary },
    ],
  };
}
