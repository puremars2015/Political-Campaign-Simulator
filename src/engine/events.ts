import { checkAffordable, checkRevision, commitDecision, type DelayedEffects, type EngineResult } from './core.ts';
import { nextInt, type RngState } from './rng.ts';
import { recordStrategy, strategyBlocker, strategyOutcome } from './strategy.ts';
import type { EventBindingState, GameState } from './types.ts';
import { assessPolicy } from '../content/assess.ts';
import type { ContentBundle, EventChoice, EventDefinition } from '../content/schema.ts';

/**
 * 事件系統（計畫 4.5）：每回合開始抽一個事件，處理完才能結束回合。
 * 事件劇情是模擬，事件中出現的政見一律綁定已收錄的真實政見。
 */

function pick<T>(items: readonly T[], rng: RngState): [T, RngState] {
  const [index, next] = nextInt(rng, 0, items.length - 1);
  return [items[index] as T, next];
}

/** 事件可綁定的政見組合 */
export function eligibleBindings(
  state: GameState,
  content: ContentBundle,
  event: EventDefinition,
): EventBindingState[] {
  if (event.binding === 'none') return [];
  const opponentPolicies = content.policies.filter(
    (p) => p.timeframe === 'current' && state.opponentCandidacyIds.includes(p.candidacyId),
  );
  const result: EventBindingState[] = [];
  for (const entry of state.campaign) {
    const policy = content.policies.find((p) => p.id === entry.policyId);
    if (!policy) continue;
    if (event.bindingRisks.length > 0) {
      const { risks } = assessPolicy(content, policy, state.opponentCandidacyIds);
      if (!event.bindingRisks.some((r) => risks.includes(r))) continue;
    }
    const rivals = opponentPolicies.filter((p) => p.topic === policy.topic);
    if (event.binding === 'our-policy') {
      result.push({ topicId: policy.topic, ourPolicyId: policy.id, opponentPolicyId: null });
    } else if (event.binding === 'head-to-head') {
      for (const rival of rivals) result.push({ topicId: policy.topic, ourPolicyId: policy.id, opponentPolicyId: rival.id });
    } else if (event.binding === 'unique-issue' && rivals.length === 0) {
      result.push({ topicId: policy.topic, ourPolicyId: policy.id, opponentPolicyId: null });
    }
  }
  return result;
}

function conditionsMet(state: GameState, event: EventDefinition): boolean {
  const { flagsAll, flagsNone, resourceAtMost, resourceAtLeast } = event.conditions;
  if (flagsAll?.some((f) => !state.flags[f])) return false;
  if (flagsNone?.some((f) => state.flags[f])) return false;
  for (const [key, max] of Object.entries(resourceAtMost ?? {})) {
    if (state.resources[key as keyof typeof state.resources] > (max as number)) return false;
  }
  for (const [key, min] of Object.entries(resourceAtLeast ?? {})) {
    if (state.resources[key as keyof typeof state.resources] < (min as number)) return false;
  }
  return true;
}

/** 一般抽選中可發生的事件 */
export function eligibleEvents(state: GameState, content: ContentBundle): EventDefinition[] {
  const fired = new Set(state.eventLog.map((e) => e.eventId));
  const firedGroups = new Set(
    [...fired].map((id) => content.events.find((e) => e.id === id)?.exclusiveGroup).filter(Boolean),
  );
  const lastRound = (eventId: string) =>
    Math.max(-Infinity, ...state.eventLog.filter((e) => e.eventId === eventId).map((e) => e.round));
  return content.events.filter(
    (event) =>
      !event.followUpOnly &&
      (!event.districtIds || event.districtIds.includes(state.districtId)) &&
      event.window.fromRound <= state.round &&
      state.round <= event.window.toRound &&
      !((event.once || content.releaseScope !== null) && fired.has(event.id)) &&
      state.round - lastRound(event.id) > event.cooldownRounds &&
      !(event.exclusiveGroup && firedGroups.has(event.exclusiveGroup)) &&
      conditionsMet(state, event) &&
      (event.binding === 'none' || eligibleBindings(state, content, event).length > 0),
  );
}

/** 回合開始時抽事件：先處理到期的後續事件，否則依優先序抽選，同優先序以亂數決定 */
export function drawEvent(state: GameState, content: ContentBundle): GameState {
  if (state.phase !== 'campaign' || state.activeEvent) return state;
  let rng = state.rng;

  const due = state.scheduledEvents.find((s) => s.dueRound <= state.round);
  if (due) {
    return {
      ...state,
      activeEvent: { eventId: due.eventId, binding: due.binding },
      scheduledEvents: state.scheduledEvents.filter((s) => s !== due),
    };
  }

  const candidates = eligibleEvents(state, content);
  if (candidates.length === 0) return state;
  const top = Math.max(...candidates.map((e) => e.priority));
  let event: EventDefinition;
  [event, rng] = pick(
    candidates.filter((e) => e.priority === top),
    rng,
  );
  let binding: EventBindingState | null = null;
  if (event.binding !== 'none') {
    // 優先綁定還沒被事件問過的政見，避免同一項政見被連續追問
    const bindings = eligibleBindings(state, content, event);
    const used = new Set(state.eventLog.map((e) => e.ourPolicyId));
    const fresh = bindings.filter((b) => !used.has(b.ourPolicyId));
    [binding, rng] = pick(fresh.length > 0 ? fresh : bindings, rng);
  }
  return { ...state, rng, activeEvent: { eventId: event.id, binding } };
}

/** 選項目前是否可選；回傳不可選的原因或 null */
export function choiceBlocker(state: GameState, content: ContentBundle, choice: EventChoice): string | null {
  const binding = state.activeEvent?.binding ?? null;
  const costError = checkAffordable(state, choice.cost);
  if (costError) return costError;
  if (choice.requiresStrengths.length > 0 || choice.strategy) {
    const policy = binding && content.policies.find((p) => p.id === binding.ourPolicyId);
    if (!policy) return '這個事件沒有綁定我方政見。';
    const { strengths } = assessPolicy(content, policy, state.opponentCandidacyIds);
    if (choice.requiresStrengths.some((s) => !strengths.includes(s))) return '這項政見的資料撐不起這個說法。';
    if (choice.strategy) {
      return strategyBlocker(state, content, policy.id, choice.strategy.status, choice.strategy.angle ?? null);
    }
  }
  return null;
}

export function resolveEvent(
  state: GameState,
  content: ContentBundle,
  choiceId: string,
  expectedRevision: number,
): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };
  const active = state.activeEvent;
  const event = active && content.events.find((e) => e.id === active.eventId);
  if (!active || !event) return { ok: false, reason: '目前沒有待處理的事件。' };
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return { ok: false, reason: `未知的選項：${choiceId}` };
  const blocker = choiceBlocker(state, content, choice);
  if (blocker) return { ok: false, reason: blocker };

  const effects = [...choice.effects];
  const delayed: DelayedEffects[] = choice.delayed ? [choice.delayed] : [];
  const policy = active.binding && content.policies.find((p) => p.id === active.binding?.ourPolicyId);
  if (choice.strategy && policy) {
    const outcome = strategyOutcome(state, content, policy, choice.strategy.status, choice.strategy.angle ?? null);
    effects.push(...outcome.effects);
    delayed.push(...outcome.delayed);
  }

  let next = commitDecision(state, {
    kind: 'event-choice',
    ref: `${event.id}:${choice.id}`,
    cost: choice.cost,
    effects,
    delayed,
    setFlags: choice.setFlags,
    summary: `${event.title}：${choice.label}`,
  });
  if (choice.strategy && policy) {
    next = recordStrategy(next, policy.id, choice.strategy.status, choice.strategy.angle ?? null, state.round);
  }
  const decisionId = next.decisions.at(-1)?.id ?? '';
  return {
    ok: true,
    state: {
      ...next,
      activeEvent: null,
      eventLog: [...next.eventLog, { round: state.round, eventId: event.id, ourPolicyId: active.binding?.ourPolicyId ?? null }],
      scheduledEvents: choice.followUp
        ? [
            ...next.scheduledEvents,
            {
              eventId: choice.followUp.eventId,
              dueRound: state.round + choice.followUp.afterRounds,
              binding: active.binding,
              sourceDecisionId: decisionId,
            },
          ]
        : next.scheduledEvents,
    },
  };
}
