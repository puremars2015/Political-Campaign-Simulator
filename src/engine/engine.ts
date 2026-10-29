import { buildCalendar } from './calendar.ts';
import { ACTIONS, BALANCE, EXPOSURE_COSTS, STRATEGY_EFFECTS } from './config.ts';
import { seedRng } from './rng.ts';
import {
  GAME_STATE_SCHEMA_VERSION,
  type ActionCost,
  type DecisionRecord,
  type Effect,
  type ExposureStatus,
  type GameState,
  type ResourceKey,
  type Resources,
} from './types.ts';
import { FRAMING_ANGLES, assessPolicy, remainingRisks, type FramingAngle } from '../content/assess.ts';
import { activeCandidacies, assessDistrict, isPolicyUsable, policiesFor } from '../content/query.ts';
import type { ContentBundle } from '../content/schema.ts';

export type EngineResult = { ok: true; state: GameState } | { ok: false; reason: string };

export interface NewGameOptions {
  seed: string;
  districtId: string;
  candidacyId: string;
}

/** 建立新局。只接受已達可玩門檻的縣市與其當屆正式參選紀錄，不隨機分配候選人。 */
export function createNewGame(content: ContentBundle, options: NewGameOptions): GameState {
  const district = content.districts.find((d) => d.id === options.districtId);
  if (!district) throw new Error(`找不到縣市：${options.districtId}`);
  const playability = assessDistrict(content, district);
  if (district.status !== 'playable' || !playability.playable) {
    throw new Error(`${district.name} 尚不可玩：${playability.reasons.join('；') || '資料尚未發布'}`);
  }
  const election = content.elections.find((e) => e.id === district.electionId);
  const candidacies = activeCandidacies(content, district.id);
  const candidacy = candidacies.find((c) => c.id === options.candidacyId);
  if (!candidacy) throw new Error(`${district.name} 沒有參選紀錄：${options.candidacyId}`);
  // 以下欄位已由 assessDistrict 保證存在
  if (!election || !district.dataAsOf || !district.simulation || !candidacy.simulation) {
    throw new Error('內容資料不完整');
  }

  const support: Record<string, number> = {};
  for (const c of candidacies) support[c.id] = c.simulation?.baselineSupport ?? 0;

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    seed: options.seed,
    rng: seedRng(options.seed),
    revision: 0,
    phase: 'campaign',
    round: 1,
    calendar: buildCalendar(election.electionDate),
    dataAsOf: district.dataAsOf,
    districtId: district.id,
    candidacyId: candidacy.id,
    opponentCandidacyIds: candidacies.filter((c) => c.id !== candidacy.id).map((c) => c.id),
    resources: { funds: candidacy.simulation.startingFunds, ...BALANCE.startingResources },
    actionPoints: BALANCE.actionPointsPerRound,
    campaign: policiesFor(content, candidacy.id)
      .filter((p) => isPolicyUsable(content, p))
      .map((p) => ({
        policyId: p.id,
        status: 'pending',
        angle: null,
        history: [{ round: 1, status: 'pending', angle: null, decisionId: null }],
      })),
    pendingEffects: [],
    decisions: [],
    flags: {},
    hidden: { support, undecided: district.simulation.undecided },
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

export const EXPOSURE_LABELS: Record<ExposureStatus, string> = {
  pending: '待宣傳',
  internal: '內部協調',
  featured: '大張旗鼓（主打）',
  reframed: '圓滑包裝',
  deferred: '先擱著（延後）',
  'low-profile': '吞下去（低調處理）',
};

/**
 * 決定我方某項真實政見的宣傳策略。只改變本局的曝光與說法角度，
 * 政見原文、規模、對象、財源、期限與承諾強度都不在 GameState 中，無從修改。
 */
export function setPolicyExposure(
  state: GameState,
  content: ContentBundle,
  policyId: string,
  status: Exclude<ExposureStatus, 'pending'>,
  expectedRevision: number,
  angle: FramingAngle | null = null,
): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };

  const entry = state.campaign.find((c) => c.policyId === policyId);
  const policy = content.policies.find((p) => p.id === policyId);
  if (!entry || !policy) return { ok: false, reason: '只能安排我方已查證的當次政見。' };
  const assessment = assessPolicy(content, policy, state.opponentCandidacyIds);

  if (status === 'reframed') {
    if (!angle) return { ok: false, reason: '圓滑包裝需要選一個說法角度。' };
    if (!assessment.angles.includes(angle)) {
      return { ok: false, reason: `這項政見的資料不足以用「${FRAMING_ANGLES[angle].label}」的角度來談。` };
    }
  } else if (angle) {
    return { ok: false, reason: '只有圓滑包裝需要說法角度。' };
  }
  if (entry.status === status && entry.angle === angle) {
    return { ok: false, reason: `這項政見已經是「${EXPOSURE_LABELS[status]}」。` };
  }
  if (status === 'featured') {
    const featured = state.campaign.filter((c) => c.status === 'featured').length;
    if (featured >= BALANCE.maxFeaturedPolicies) {
      return { ok: false, reason: `最多同時主打 ${BALANCE.maxFeaturedPolicies} 項政見，請先調整其他項目。` };
    }
  }

  const cost = EXPOSURE_COSTS[status];
  const costError = checkAffordable(state, cost);
  if (costError) return { ok: false, reason: costError };

  // 依幕僚評估決定效果：當下的聲量變化與之後被追問的代價
  const effects: Effect[] = [];
  const delayedEffects: Effect[] = [];
  const penalize = (penalty: { publicTrust: number; policyConsistency?: number }, times: number) => {
    if (times === 0) return;
    delayedEffects.push({ kind: 'resource', key: 'publicTrust', delta: penalty.publicTrust * times });
    if (penalty.policyConsistency) {
      delayedEffects.push({ kind: 'resource', key: 'policyConsistency', delta: penalty.policyConsistency * times });
    }
  };
  if (status === 'featured') {
    const gain = Math.min(
      STRATEGY_EFFECTS.featuredTrustCap,
      assessment.strengths.length * STRATEGY_EFFECTS.featuredTrustPerStrength,
    );
    effects.push({ kind: 'resource', key: 'publicTrust', delta: gain });
    penalize(STRATEGY_EFFECTS.featuredRiskPenalty, assessment.risks.length);
  } else if (status === 'reframed') {
    effects.push({ kind: 'resource', key: 'publicTrust', delta: STRATEGY_EFFECTS.reframedTrust });
    penalize(STRATEGY_EFFECTS.reframedRiskPenalty, remainingRisks(assessment, angle).length);
  } else if (status === 'low-profile' && assessment.opponentPolicyIds.length > 0) {
    penalize(STRATEGY_EFFECTS.concedeIssuePenalty, 1);
  }

  const angleNote = angle ? `（${FRAMING_ANGLES[angle].label}）` : '';
  const next = commitDecision(state, {
    kind: 'policy-exposure',
    ref: policyId,
    cost,
    effects,
    delayed:
      delayedEffects.length > 0 ? { afterRounds: STRATEGY_EFFECTS.scrutinyDelay, effects: delayedEffects } : undefined,
    summary: `${policy.issue}政見：${EXPOSURE_LABELS[entry.status]} → ${EXPOSURE_LABELS[status]}${angleNote}`,
  });
  const decisionId = next.decisions.at(-1)?.id ?? null;
  return {
    ok: true,
    state: {
      ...next,
      campaign: next.campaign.map((c) =>
        c.policyId === policyId
          ? { ...c, status, angle, history: [...c.history, { round: state.round, status, angle, decisionId }] }
          : c,
      ),
    },
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
