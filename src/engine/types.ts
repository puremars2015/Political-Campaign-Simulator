import type { RoundSpan } from './calendar.ts';
import type { RngState } from './rng.ts';

/** 存檔結構版本；變更 GameState 形狀時必須遞增並撰寫遷移。 */
export const GAME_STATE_SCHEMA_VERSION = 1;

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

export type CommitmentStrength = 'study' | 'promote' | 'guarantee';
export type CommitmentStatus = 'draft' | 'internal' | 'public' | 'revised' | 'withdrawn';

export interface CommitmentVersion {
  round: number;
  strength: CommitmentStrength;
  scale: string;
  funding: string;
  deadline: string;
  wording: string;
  status: CommitmentStatus;
  /** 造成此版本的決策紀錄 ID；開局既有承諾為 null */
  sourceDecisionId: string | null;
}

export interface PolicyCommitment {
  id: string;
  issue: string;
  goal: string;
  tool: string;
  /** 依時間排序的完整版本歷史，最後一筆為目前版本；不可刪除舊版本。 */
  history: CommitmentVersion[];
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
  kind: 'action' | 'event-choice' | 'delayed-effect';
  /** 行動 ID、「事件ID:選項ID」，或延遲效果的來源決策 ID */
  ref: string;
  resourceDelta: Partial<Resources>;
  summary: string;
}

/** 隱藏選情：一般畫面不得直接顯示。比例加總為 1。 */
export interface HiddenElectorate {
  ourSupport: number;
  opponentSupport: number;
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
  candidateId: string;
  districtId: string;
  resources: Resources;
  actionPoints: number;
  commitments: PolicyCommitment[];
  pendingEffects: PendingEffect[];
  decisions: DecisionRecord[];
  flags: Record<string, boolean>;
  hidden: HiddenElectorate;
}
