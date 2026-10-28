import { buildCalendar } from './calendar.ts';
import { ACTIONS, BALANCE } from './config.ts';
import { pickOne, seedRng } from './rng.ts';
import {
  GAME_STATE_SCHEMA_VERSION,
  type ActionCost,
  type DecisionRecord,
  type Effect,
  type GameState,
  type PolicyCommitment,
  type ResourceKey,
  type Resources,
} from './types.ts';
import type { ContentBundle } from '../content/schema.ts';

export type EngineResult = { ok: true; state: GameState } | { ok: false; reason: string };

export interface NewGameOptions {
  seed: string;
  /** 未指定時以種子隨機分配（開發模式可直接指定） */
  candidateId?: string;
}

export function createNewGame(content: ContentBundle, options: NewGameOptions): GameState {
  let rng = seedRng(options.seed);
  let candidate = content.candidates.find((c) => c.id === options.candidateId);
  if (options.candidateId && !candidate) {
    throw new Error(`找不到候選人：${options.candidateId}`);
  }
  if (!candidate) [candidate, rng] = pickOne(rng, content.candidates);

  const district = content.districts.find((d) => d.id === candidate.districtId);
  if (!district) throw new Error(`找不到選區：${candidate.districtId}`);

  const { opponentSupport, undecided } = district.baseline;
  const commitments: PolicyCommitment[] = candidate.initialCommitments.map((seed) => ({
    id: seed.id,
    issue: seed.issue,
    goal: seed.goal,
    tool: seed.tool,
    history: [
      {
        round: 0,
        strength: seed.strength,
        scale: seed.scale,
        funding: seed.funding,
        deadline: seed.deadline,
        wording: seed.wording,
        status: seed.status,
        sourceDecisionId: null,
      },
    ],
  }));

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    seed: options.seed,
    rng,
    revision: 0,
    phase: 'campaign',
    round: 1,
    calendar: buildCalendar(district.electionDate),
    candidateId: candidate.id,
    districtId: district.id,
    resources: { ...candidate.startingResources },
    actionPoints: BALANCE.actionPointsPerRound,
    commitments,
    pendingEffects: [],
    decisions: [],
    flags: {},
    hidden: { ourSupport: 1 - opponentSupport - undecided, opponentSupport, undecided },
  };
}

function clampResource(key: ResourceKey, value: number): number {
  const { min, max } = BALANCE.resourceBounds[key];
  return Math.min(max, Math.max(min, value));
}

/** 套用效果並回傳實際變化量（受上下限截斷後）。 */
function applyEffects(resources: Resources, effects: readonly Effect[]): [Resources, Partial<Resources>] {
  const next = { ...resources };
  const delta: Partial<Resources> = {};
  for (const effect of effects) {
    const before = next[effect.key];
    next[effect.key] = clampResource(effect.key, before + effect.delta);
    delta[effect.key] = (delta[effect.key] ?? 0) + (next[effect.key] - before);
  }
  return [next, delta];
}

function checkRevision(state: GameState, expectedRevision: number): string | null {
  if (state.revision !== expectedRevision) return '此操作已處理或畫面已過期，請重新整理後再試。';
  return null;
}

function checkAffordable(state: GameState, cost: ActionCost): string | null {
  if (state.phase !== 'campaign') return '選戰已結束，無法再安排行動。';
  if (state.actionPoints < cost.actionPoints) return `行動點不足：需要 ${cost.actionPoints}，剩餘 ${state.actionPoints}。`;
  if (state.resources.funds < cost.funds) return `經費不足：需要 ${cost.funds} 萬，剩餘 ${state.resources.funds} 萬。`;
  return null;
}

interface DecisionInput {
  kind: DecisionRecord['kind'];
  ref: string;
  cost: ActionCost;
  effects: readonly Effect[];
  delayed?: { afterRounds: number; effects: Effect[] };
  setFlags?: readonly string[];
  summary: string;
}

/** 一次性產生新狀態與決策紀錄；呼叫前須已通過所有檢查。 */
function commitDecision(state: GameState, input: DecisionInput): GameState {
  const decisionId = `d${state.decisions.length + 1}`;
  const costEffect: Effect = { kind: 'resource', key: 'funds', delta: -input.cost.funds };
  const [resources, resourceDelta] = applyEffects(state.resources, [costEffect, ...input.effects]);

  const pendingEffects = input.delayed
    ? [
        ...state.pendingEffects,
        {
          id: `p${decisionId}`,
          dueRound: state.round + input.delayed.afterRounds,
          effects: input.delayed.effects,
          sourceDecisionId: decisionId,
        },
      ]
    : state.pendingEffects;

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

export function submitAction(state: GameState, actionId: string, expectedRevision: number): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };

  const action = ACTIONS.find((a) => a.id === actionId);
  if (!action) return { ok: false, reason: `未知的行動：${actionId}` };

  const costError = checkAffordable(state, action.cost);
  if (costError) return { ok: false, reason: costError };

  return {
    ok: true,
    state: commitDecision(state, {
      kind: 'action',
      ref: action.id,
      cost: action.cost,
      effects: action.effects,
      delayed: action.delayed,
      summary: action.label,
    }),
  };
}

/** 結束本回合：結算到期的延遲效果、推進日期並重置行動點；第12回合後進入投票階段。 */
export function endRound(state: GameState, expectedRevision: number): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };
  if (state.phase !== 'campaign') return { ok: false, reason: '選戰已結束。' };

  if (state.round >= BALANCE.totalRounds) {
    return { ok: true, state: { ...state, revision: state.revision + 1, phase: 'election', actionPoints: 0 } };
  }

  const nextRound = state.round + 1;
  let resources = state.resources;
  const decisions = [...state.decisions];
  const remaining = [];
  for (const pending of state.pendingEffects) {
    if (pending.dueRound > nextRound) {
      remaining.push(pending);
      continue;
    }
    const [applied, resourceDelta] = applyEffects(resources, pending.effects);
    resources = applied;
    decisions.push({
      id: `d${decisions.length + 1}`,
      round: nextRound,
      kind: 'delayed-effect',
      ref: pending.sourceDecisionId,
      resourceDelta,
      summary: `先前決策 ${pending.sourceDecisionId} 的後續影響`,
    });
  }

  return {
    ok: true,
    state: {
      ...state,
      revision: state.revision + 1,
      round: nextRound,
      actionPoints: BALANCE.actionPointsPerRound,
      resources,
      pendingEffects: remaining,
      decisions,
    },
  };
}
