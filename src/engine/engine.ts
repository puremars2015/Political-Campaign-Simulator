import { buildCalendar } from './calendar.ts';
import { ACTIONS, BALANCE } from './config.ts';
import { applyEffects, checkAffordable, checkRevision, commitDecision, type EngineResult } from './core.ts';
import { drawEvent } from './events.ts';
import { seedRng } from './rng.ts';
import { GAME_STATE_SCHEMA_VERSION, type GameState } from './types.ts';
import { gameCandidacies, isPolicyUsable, policiesFor, startableMode } from '../content/query.ts';
import type { ContentBundle } from '../content/schema.ts';

export type { EngineResult } from './core.ts';
export { choiceBlocker, drawEvent, eligibleBindings, eligibleEvents, resolveEvent } from './events.ts';
export { EXPOSURE_LABELS, setPolicyExposure, type StrategyChoice } from './strategy.ts';

export interface NewGameOptions {
  seed: string;
  districtId: string;
  candidacyId: string;
}

/** 建立新局。只接受已達可玩或預覽門檻的縣市與其範圍內的參選紀錄，不隨機分配候選人。 */
export function createNewGame(content: ContentBundle, options: NewGameOptions): GameState {
  const district = content.districts.find((d) => d.id === options.districtId);
  if (!district) throw new Error(`找不到縣市：${options.districtId}`);
  const { mode, reasons } = startableMode(content, district);
  if (!mode) throw new Error(`${district.name} 尚不可玩：${reasons.join('；')}`);
  const election = content.elections.find((e) => e.id === district.electionId);
  const candidacies = gameCandidacies(content, district, mode);
  const candidacy = candidacies.find((c) => c.id === options.candidacyId);
  if (!candidacy) throw new Error(`${district.name} 沒有參選紀錄：${options.candidacyId}`);
  // 以下欄位已由門檻檢查保證存在
  if (!election || !district.dataAsOf || !district.simulation || !candidacy.simulation) {
    throw new Error('內容資料不完整');
  }

  const support: Record<string, number> = {};
  for (const c of candidacies) support[c.id] = c.simulation?.baselineSupport ?? 0;

  const state: GameState = {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    seed: options.seed,
    rng: seedRng(options.seed),
    revision: 0,
    phase: 'campaign',
    round: 1,
    calendar: buildCalendar(election.electionDate),
    dataAsOf: district.dataAsOf,
    dataMode: mode,
    districtId: district.id,
    candidacyId: candidacy.id,
    opponentCandidacyIds: candidacies.filter((c) => c.id !== candidacy.id).map((c) => c.id),
    resources: { funds: candidacy.simulation.startingFunds, ...BALANCE.startingResources },
    actionPoints: BALANCE.actionPointsPerRound,
    campaign: policiesFor(content, candidacy.id)
      .filter((p) => isPolicyUsable(content, p, mode))
      .map((p) => ({
        policyId: p.id,
        status: 'pending',
        angle: null,
        history: [{ round: 1, status: 'pending', angle: null, decisionId: null }],
      })),
    pendingEffects: [],
    decisions: [],
    flags: {},
    activeEvent: null,
    eventLog: [],
    scheduledEvents: [],
    hidden: { support, undecided: district.simulation.undecided },
  };
  return drawEvent(state, content);
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
      delayed: action.delayed ? [action.delayed] : [],
      summary: action.label,
    }),
  };
}

/** 結束本回合：結算到期的延遲效果、推進日期、重置行動點並抽下一回合的事件；第12回合後進入投票階段。 */
export function endRound(state: GameState, content: ContentBundle, expectedRevision: number): EngineResult {
  const revisionError = checkRevision(state, expectedRevision);
  if (revisionError) return { ok: false, reason: revisionError };
  if (state.phase !== 'campaign') return { ok: false, reason: '選戰已結束。' };
  if (state.activeEvent) return { ok: false, reason: '本回合還有待處理的事件，請先做出決定。' };

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

  const advanced: GameState = {
    ...state,
    revision: state.revision + 1,
    round: nextRound,
    actionPoints: BALANCE.actionPointsPerRound,
    resources,
    pendingEffects: remaining,
    decisions,
  };
  return { ok: true, state: drawEvent(advanced, content) };
}
