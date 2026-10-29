import { BALANCE, EXPOSURE_COSTS, STRATEGY_EFFECTS } from './config.ts';
import { checkAffordable, checkRevision, commitDecision, type DelayedEffects, type EngineResult } from './core.ts';
import type { Effect, ExposureStatus, GameState } from './types.ts';
import { FRAMING_ANGLES, assessPolicy, remainingRisks, type FramingAngle } from '../content/assess.ts';
import type { ContentBundle, Policy } from '../content/schema.ts';

export type StrategyChoice = Exclude<ExposureStatus, 'pending' | 'internal'>;

export const EXPOSURE_LABELS: Record<ExposureStatus, string> = {
  pending: '待宣傳',
  internal: '內部協調',
  featured: '大張旗鼓（主打）',
  reframed: '圓滑包裝',
  deferred: '先擱著（延後）',
  'low-profile': '吞下去（低調處理）',
};

/** 檢查策略是否可行（不含成本）；回傳拒絕原因或 null */
export function strategyBlocker(
  state: GameState,
  content: ContentBundle,
  policyId: string,
  status: StrategyChoice,
  angle: FramingAngle | null,
): string | null {
  const entry = state.campaign.find((c) => c.policyId === policyId);
  const policy = content.policies.find((p) => p.id === policyId);
  if (!entry || !policy) return '只能安排我方已查證的當次政見。';
  if (status === 'reframed') {
    if (!angle) return '圓滑包裝需要選一個說法角度。';
    if (!assessPolicy(content, policy, state.opponentCandidacyIds).angles.includes(angle)) {
      return `這項政見的資料不足以用「${FRAMING_ANGLES[angle].label}」的角度來談。`;
    }
  } else if (angle) {
    return '只有圓滑包裝需要說法角度。';
  }
  if (status === 'featured' && entry.status !== 'featured') {
    const featured = state.campaign.filter((c) => c.status === 'featured').length;
    if (featured >= BALANCE.maxFeaturedPolicies) {
      return `最多同時主打 ${BALANCE.maxFeaturedPolicies} 項政見，請先調整其他項目。`;
    }
  }
  return null;
}

/** 依幕僚評估計算策略效果：當下的聲量變化與之後被追問的代價 */
export function strategyOutcome(
  state: GameState,
  content: ContentBundle,
  policy: Policy,
  status: StrategyChoice,
  angle: FramingAngle | null,
): { effects: Effect[]; delayed: DelayedEffects[] } {
  const assessment = assessPolicy(content, policy, state.opponentCandidacyIds);
  const effects: Effect[] = [];
  const later: Effect[] = [];
  const penalize = (penalty: { publicTrust: number; policyConsistency?: number }, times: number) => {
    if (times === 0) return;
    later.push({ kind: 'resource', key: 'publicTrust', delta: penalty.publicTrust * times });
    if (penalty.policyConsistency) {
      later.push({ kind: 'resource', key: 'policyConsistency', delta: penalty.policyConsistency * times });
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
  return { effects, delayed: later.length > 0 ? [{ afterRounds: STRATEGY_EFFECTS.scrutinyDelay, effects: later }] : [] };
}

/** 更新政見的宣傳安排並記錄歷史 */
export function recordStrategy(
  state: GameState,
  policyId: string,
  status: StrategyChoice,
  angle: FramingAngle | null,
  round: number,
): GameState {
  const decisionId = state.decisions.at(-1)?.id ?? null;
  return {
    ...state,
    campaign: state.campaign.map((c) =>
      c.policyId === policyId
        ? { ...c, status, angle, history: [...c.history, { round, status, angle, decisionId }] }
        : c,
    ),
  };
}

/**
 * 決定我方某項真實政見的宣傳策略。只改變本局的曝光與說法角度，
 * 政見原文、規模、對象、財源、期限與承諾強度都不在 GameState 中，無從修改。
 */
export function setPolicyExposure(
  state: GameState,
  content: ContentBundle,
  policyId: string,
  status: StrategyChoice,
  expectedRevision: number,
  angle: FramingAngle | null = null,
): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };

  const blocker = strategyBlocker(state, content, policyId, status, angle);
  if (blocker) return { ok: false, reason: blocker };
  const entry = state.campaign.find((c) => c.policyId === policyId);
  const policy = content.policies.find((p) => p.id === policyId);
  if (!entry || !policy) return { ok: false, reason: '只能安排我方已查證的當次政見。' };
  if (entry.status === status && entry.angle === angle) {
    return { ok: false, reason: `這項政見已經是「${EXPOSURE_LABELS[status]}」。` };
  }

  const cost = EXPOSURE_COSTS[status];
  const costError = checkAffordable(state, cost);
  if (costError) return { ok: false, reason: costError };

  const { effects, delayed } = strategyOutcome(state, content, policy, status, angle);
  const angleNote = angle ? `（${FRAMING_ANGLES[angle].label}）` : '';
  const next = commitDecision(state, {
    kind: 'policy-exposure',
    ref: policyId,
    cost,
    effects,
    delayed,
    summary: `${policy.issue}政見：${EXPOSURE_LABELS[entry.status]} → ${EXPOSURE_LABELS[status]}${angleNote}`,
  });
  return { ok: true, state: recordStrategy(next, policyId, status, angle, state.round) };
}
