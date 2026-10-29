import type { ActionCost, ActionDefinition, ExposureStatus, ResourceKey, Resources } from './types.ts';

/**
 * 集中管理的平衡參數。所有數值皆為原型初始值，須經試玩與模擬調整，
 * 不得分散寫死在介面或事件中。
 */
export const BALANCE = {
  campaignDays: 90,
  totalRounds: 12,
  countdownRounds: 3,
  actionPointsPerRound: 3,
  /** 同時主打的政見上限 */
  maxFeaturedPolicies: 2,
  /** 經費以外的起始資源；經費由各參選紀錄的模擬參數提供 */
  startingResources: {
    morale: 60,
    candidateTrust: 50,
    publicTrust: 50,
    policyConsistency: 70,
  } satisfies Omit<Resources, 'funds'>,
  resourceBounds: {
    funds: { min: 0, max: 99_999 },
    morale: { min: 0, max: 100 },
    candidateTrust: { min: 0, max: 100 },
    publicTrust: { min: 0, max: 100 },
    policyConsistency: { min: 0, max: 100 },
  } satisfies Record<ResourceKey, { min: number; max: number }>,
} as const;

/** 原型行動清單；成本與效果為暫定值。 */
export const ACTIONS: readonly ActionDefinition[] = [
  {
    id: 'policy-research',
    label: '政策研究',
    description: '請政策組補強財源與可行性分析。成果需要時間才會反映。',
    cost: { actionPoints: 1, funds: 20 },
    effects: [],
    delayed: { afterRounds: 1, effects: [{ kind: 'resource', key: 'policyConsistency', delta: 4 }] },
  },
  {
    id: 'team-care',
    label: '照顧團隊',
    description: '安排休息與內部溝通，緩解團隊疲勞。',
    cost: { actionPoints: 1, funds: 10 },
    effects: [{ kind: 'resource', key: 'morale', delta: 5 }],
  },
  {
    id: 'candidate-briefing',
    label: '與候選人對焦',
    description: '花時間和候選人確認優先事項，累積協商空間。',
    cost: { actionPoints: 1, funds: 0 },
    effects: [{ kind: 'resource', key: 'candidateTrust', delta: 3 }],
  },
  {
    id: 'field-event',
    label: '基層行程',
    description: '安排地方走訪。耗費經費與人力，團隊會更疲累。',
    cost: { actionPoints: 2, funds: 60 },
    effects: [
      { kind: 'resource', key: 'publicTrust', delta: 3 },
      { kind: 'resource', key: 'morale', delta: -3 },
    ],
  },
];

/** 調整政見宣傳安排的成本；只改變曝光，不改變政見內容。 */
export const EXPOSURE_COSTS: Record<Exclude<ExposureStatus, 'pending'>, ActionCost> = {
  internal: { actionPoints: 0, funds: 0 },
  featured: { actionPoints: 1, funds: 10 },
  reframed: { actionPoints: 1, funds: 0 },
  deferred: { actionPoints: 0, funds: 0 },
  'low-profile': { actionPoints: 0, funds: 0 },
};

/**
 * 政見策略的效果（暫定值）。主打放大優勢但未處理的風險會在之後被追問；
 * 包裝可化解部分風險；低調處理在對手也有同議題政見時等於讓出話題。
 */
export const STRATEGY_EFFECTS = {
  featuredTrustPerStrength: 1,
  featuredTrustCap: 3,
  reframedTrust: 1,
  /** 風險被追問的延遲回合數 */
  scrutinyDelay: 2,
  /** 主打時每個未化解風險的懲罰 */
  featuredRiskPenalty: { publicTrust: -2, policyConsistency: -1 },
  /** 包裝後每個未化解風險的懲罰 */
  reframedRiskPenalty: { publicTrust: -1, policyConsistency: 0 },
  /** 低調處理但對手在同議題有政見時，讓出話題的代價 */
  concedeIssuePenalty: { publicTrust: -1 },
} as const;
