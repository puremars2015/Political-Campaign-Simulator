import type { RoundSpan } from './calendar.ts';
import type { RngState } from './rng.ts';
import type { FramingAngle } from '../content/assess.ts';
import type { DataMode } from '../content/query.ts';

/** 存檔結構版本；變更 GameState 形狀時必須遞增並撰寫遷移。 */
export const GAME_STATE_SCHEMA_VERSION = 4;

export type ResourceKey = 'funds' | 'morale' | 'candidateTrust' | 'publicTrust' | 'policyConsistency';

export type Resources = Record<ResourceKey, number>;

export type Effect = { kind: 'resource'; key: ResourceKey; delta: number };

export interface ActionCost {
  actionPoints: number;
  /** 單位：新台幣萬元 */
  funds: number;
}

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  cost: ActionCost;
  effects: Effect[];
  delayed?: { afterRounds: number; effects: Effect[] };
}

/**
 * 本局對某項真實政見的宣傳安排（計畫 4.3）。
 * 這是模擬中的競選決策，不代表真人實際公布、撤回或改變政策；
 * 政見內容本身只存在唯讀的內容庫，GameState 只保存政見 ID。
 */
export type ExposureStatus = 'pending' | 'internal' | 'featured' | 'reframed' | 'deferred' | 'low-profile';

export interface CampaignPolicyState {
  policyId: string;
  status: ExposureStatus;
  /** 圓滑包裝時選用的說法角度；其他狀態為 null */
  angle: FramingAngle | null;
  history: { round: number; status: ExposureStatus; angle: FramingAngle | null; decisionId: string | null }[];
}

/** 事件綁定的真實政見；事件只顯示這些政見的原文，不另寫主張 */
export interface EventBindingState {
  topicId: string;
  ourPolicyId: string;
  opponentPolicyId: string | null;
}

export interface ActiveEvent {
  eventId: string;
  binding: EventBindingState | null;
}

export interface ScheduledEvent {
  eventId: string;
  dueRound: number;
  /** 沿用觸發它的事件所綁定的政見 */
  binding: EventBindingState | null;
  sourceDecisionId: string;
}

export interface PendingEffect {
  id: string;
  dueRound: number;
  effects: Effect[];
  sourceDecisionId: string;
}

export interface DecisionRecord {
  id: string;
  round: number;
  kind: 'action' | 'event-choice' | 'delayed-effect' | 'policy-exposure';
  /** 行動 ID、「事件ID:選項ID」、政見 ID，或延遲效果的來源決策 ID */
  ref: string;
  resourceDelta: Partial<Resources>;
  summary: string;
}

/** 隱藏選情：一般畫面不得直接顯示。各參選紀錄支持與未表態加總為 1。 */
export interface HiddenElectorate {
  support: Record<string, number>;
  undecided: number;
}

export type GamePhase = 'campaign' | 'election' | 'ended';

export interface GameState {
  schemaVersion: number;
  contentVersion: string;
  seed: string;
  rng: RngState;
  /** 每次成功提交遞增，用於拒絕重複或過期的提交 */
  revision: number;
  phase: GamePhase;
  round: number;
  calendar: RoundSpan[];
  /** 本局固定使用的資料截至日期 */
  dataAsOf: string;
  /** formal：正式資料；preview：預覽資料（名單未公告、來源待審閱） */
  dataMode: DataMode;
  districtId: string;
  /** 玩家輔佐的參選紀錄 */
  candidacyId: string;
  opponentCandidacyIds: string[];
  resources: Resources;
  actionPoints: number;
  campaign: CampaignPolicyState[];
  pendingEffects: PendingEffect[];
  decisions: DecisionRecord[];
  flags: Record<string, boolean>;
  /** 本回合待處理的事件；處理完才能結束回合 */
  activeEvent: ActiveEvent | null;
  /** 已處理的事件紀錄，用於一次性、互斥、冷卻與避免重複綁定同一政見 */
  eventLog: { round: number; eventId: string; ourPolicyId: string | null }[];
  scheduledEvents: ScheduledEvent[];
  hidden: HiddenElectorate;
}
