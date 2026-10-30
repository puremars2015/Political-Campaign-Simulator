import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ID 只能使用小寫英數與連字號');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式須為 YYYY-MM-DD');
const ratio = z.number().min(0).max(1);

export const resourceKeySchema = z.enum([
  'funds',
  'morale',
  'candidateTrust',
  'publicTrust',
  'policyConsistency',
]);

export const effectSchema = z.object({
  kind: z.literal('resource'),
  key: resourceKeySchema,
  delta: z.number(),
});

const costSchema = z.object({
  actionPoints: z.number().int().min(0),
  funds: z.number().min(0),
});

// ---------- 來源 ----------

/** 來源的資料性質，對應計畫 8.1 的來源優先序 */
export const sourceNatureSchema = z.enum([
  'election-authority', // 選務機關公告、選舉公報
  'candidate-official', // 候選人官方政見文件、網站、正式記者會
  'public-statement', // 有完整上下文的公開發言
  'media', // 可靠媒體報導，用於交叉查證
  'government-record', // 議事紀錄、政府公開資料
]);

export const verificationSchema = z.enum([
  'pending-review', // 已蒐集、尚未人工審閱
  'reviewed', // 已人工確認引文支持摘要
  'disputed', // 審閱時發現問題
  'unavailable', // 原始來源失效且無合法存檔
]);

/** 原文定位：PDF 頁碼、影片時間碼、網頁段落或可搜尋的引文 */
export const locatorSchema = z.object({
  kind: z.enum(['page', 'timestamp', 'paragraph', 'quote']),
  value: z.string().min(1),
});

export const sourceSchema = z.object({
  id,
  url: z.url(),
  title: z.string().min(1),
  publisher: z.string().min(1),
  publishedAt: isoDate.optional(),
  retrievedAt: isoDate,
  nature: sourceNatureSchema,
  archiveUrl: z.url().optional(),
  verification: verificationSchema,
  reviewLog: z
    .array(z.object({ date: isoDate, reviewer: z.string().min(1), note: z.string().min(1) }))
    .default([]),
});

/** 一筆主張與其來源的連結，含引文與定位 */
export const citationSchema = z.object({
  sourceId: id,
  quote: z.string().min(1),
  locator: locatorSchema,
});

// ---------- 選舉、縣市、人物、參選紀錄 ----------

export const electionSchema = z.object({
  id,
  name: z.string().min(1),
  electionDate: isoDate,
  citations: z.array(citationSchema).default([]),
});

export const districtKindSchema = z.enum(['municipality', 'provincial-city', 'county']);

/** 資料製作進度；只有 playable 能開新局，且須通過驗證器的可玩門檻 */
export const districtStatusSchema = z.enum(['not-started', 'collecting', 'preview', 'playable']);

export const districtSchema = z.object({
  id,
  name: z.string().min(1),
  kind: districtKindSchema,
  office: z.string().min(1),
  electionId: id,
  status: districtStatusSchema,
  dataAsOf: isoDate.optional(),
  regions: z
    .array(z.object({ id, name: z.string().min(1), citations: z.array(citationSchema).min(1) }))
    .default([]),
  /** 模擬參數，屬模型推論，不是真實選情 */
  simulation: z.object({ undecided: ratio }).optional(),
  /** 預覽資料的收錄範圍；只有這些參選紀錄會出現在預覽遊戲中 */
  focusCandidacyIds: z.array(id).min(2).optional(),
});

/** 人物的模擬參數；屬設計推論，需標示並人工審閱（計畫 8.2） */
export const personSimulationSchema = z.object({
  personality: z.array(z.string().min(1)).min(1),
  priorities: z.array(z.string().min(1)).min(1),
  nonNegotiables: z.array(z.string().min(1)),
  reviewed: z.boolean(),
});

export const personSchema = z.object({
  id,
  name: z.string().min(1),
  background: z.array(z.object({ text: z.string().min(1), citation: citationSchema })).default([]),
  simulation: personSimulationSchema.optional(),
});

export const candidacyStatusSchema = z.enum([
  'announced', // 宣布參選
  'nominated', // 獲政黨提名
  'registered', // 完成登記
  'certified', // 選務機關公告為正式候選人
  'withdrawn', // 退選或未獲登記
]);

export const candidacySchema = z.object({
  id,
  personId: id,
  electionId: id,
  districtId: id,
  office: z.string().min(1),
  /** 政黨名稱或「無黨籍」，以選務機關登記為準 */
  party: z.string().min(1),
  ballotNumber: z.number().int().positive().optional(),
  status: candidacyStatusSchema,
  statusCitations: z.array(citationSchema).min(1),
  /** 模擬起始支持，屬模型參數 */
  simulation: z.object({ baselineSupport: ratio, startingFunds: z.number().min(0) }).optional(),
});

// ---------- 唯讀政見 ----------

/** 來源未交代的欄位必須明確標示，不得補成事實（計畫 4.3） */
export const policyFieldSchema = z.union([
  z.object({ stated: z.string().min(1), citation: citationSchema }),
  z.object({ stated: z.null() }),
]);

export const policySchema = z.object({
  id,
  candidacyId: id,
  /** 冗餘保存屆次與選區，用來偵測跨屆或跨選區誤用 */
  electionId: id,
  districtId: id,
  issue: z.string().min(1),
  /** 忠實摘要；不得超出引文內容 */
  summary: z.string().min(1),
  citations: z.array(citationSchema).min(1),
  fields: z.object({
    tool: policyFieldSchema,
    scale: policyFieldSchema,
    funding: policyFieldSchema,
    deadline: policyFieldSchema,
  }),
  /** 對應 topics 的議題分類，用於跨候選人比較 */
  topic: id,
  /** campaign：候選人提出的競選政見；government-plan：現任者以市府名義宣布、尚未完成的計畫 */
  origin: z.enum(['campaign', 'government-plan']).default('campaign'),
  /** current：當次競選政見；historical：過去立場，僅供對照 */
  timeframe: z.enum(['current', 'historical']),
  /** 公開來源證實的修訂，指向被取代的版本 */
  supersedes: id.optional(),
});

// ---------- 政見策略（幕僚評估與包裝角度的識別碼） ----------

export const strengthIdSchema = z.enum(['concrete', 'unique-issue', 'head-to-head', 'official-source', 'incumbent-resources']);
export const riskIdSchema = z.enum([
  'costly-unfunded',
  'vague',
  'long-horizon',
  'government-plan',
  'thin-source',
  'opponent-dominant',
]);
export const framingAngleSchema = z.enum(['beneficiaries', 'numbers', 'contrast', 'vision', 'step-by-step', 'continuity']);
export const strategySchema = z.enum(['featured', 'reframed', 'low-profile', 'deferred']);

// ---------- 事件模板 ----------

/**
 * 事件劇情是虛構的模擬情境；事件中出現的政見一律綁定已收錄的真實政見並顯示原文，
 * 不在事件文字中寫入任何候選人的主張（計畫 4.5、4.6）。
 */
export const eventBindingSchema = z.enum([
  'none',
  /** 我方任一可用政見 */
  'our-policy',
  /** 我方與對手在同一議題都有政見 */
  'head-to-head',
  /** 只有我方在該議題有政見 */
  'unique-issue',
]);

export const eventChoiceSchema = z.object({
  id,
  label: z.string().min(1),
  /** 確認前向玩家說明的已知代價，不揭露隱藏數值 */
  knownCost: z.string().min(1),
  cost: costSchema,
  effects: z.array(effectSchema),
  delayed: z
    .object({ afterRounds: z.number().int().min(1), effects: z.array(effectSchema).min(1) })
    .optional(),
  setFlags: z.array(id).default([]),
  /** 對綁定的我方政見採取策略；效果依幕僚評估計算，成本以本選項為準 */
  strategy: z.object({ status: strategySchema, angle: framingAngleSchema.optional() }).optional(),
  /** 綁定政見須具備的優勢，否則選項不可用（例如「引用數字」需要政見寫明數字） */
  requiresStrengths: z.array(strengthIdSchema).default([]),
  followUp: z.object({ eventId: id, afterRounds: z.number().int().min(1).default(1) }).optional(),
});

export const eventSchema = z.object({
  id,
  districtIds: z.array(id).optional(),
  title: z.string().min(1),
  /** 情境敘述；可使用 {topic}（議題名稱）與 {opponent}（對手姓名）佔位字 */
  body: z.string().min(1),
  window: z.object({ fromRound: z.number().int().min(1), toRound: z.number().int().min(1) }),
  priority: z.number().int().default(0),
  once: z.boolean().default(true),
  /** 可重複事件再次發生前至少間隔的回合數 */
  cooldownRounds: z.number().int().min(0).default(0),
  exclusiveGroup: id.optional(),
  /** 只由其他事件的後續觸發，不參與一般抽選 */
  followUpOnly: z.boolean().default(false),
  conditions: z
    .object({
      flagsAll: z.array(id).optional(),
      flagsNone: z.array(id).optional(),
      resourceAtMost: z.partialRecord(resourceKeySchema, z.number()).optional(),
      resourceAtLeast: z.partialRecord(resourceKeySchema, z.number()).optional(),
    })
    .default({}),
  binding: eventBindingSchema.default('none'),
  /** 綁定的我方政見須至少具備其中一項風險（空陣列表示不限） */
  bindingRisks: z.array(riskIdSchema).default([]),
  choices: z.array(eventChoiceSchema).min(2),
});

// ---------- 議題分類與政見比較 ----------

export const topicSchema = z.object({ id, name: z.string().min(1) });

export const newsSnapshotSchema = z.object({
  version: z.string().min(1), sourceUrl: z.literal('https://feeds.feedburner.com/rsscna/politics'), refreshMinutes: z.literal(60),
  lastAttemptAt: z.iso.datetime().nullable(), lastSuccessAt: z.iso.datetime().nullable(),
  status: z.enum(['ok', 'empty', 'stale']),
  items: z.array(z.object({ id, title: z.string().min(1).max(180),
    url: z.url().refine((url) => { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'www.cna.com.tw' && u.pathname.startsWith('/news/'); }),
    publisher: z.literal('中央社'), publishedAt: z.iso.datetime(), districtIds: z.array(id), personNames: z.array(z.string()) })).max(60),
});
export type NewsSnapshot = z.infer<typeof newsSnapshotSchema>;

export const contentBundleSchema = z.object({
  contentVersion: z.string().min(1),
  news: newsSnapshotSchema.nullable().default(null),
  releaseScope: z.object({ districtIds: z.array(id), candidacyIds: z.array(id) }).nullable().default(null),
  elections: z.array(electionSchema),
  districts: z.array(districtSchema).min(1),
  people: z.array(personSchema),
  candidacies: z.array(candidacySchema),
  policies: z.array(policySchema),
  sources: z.array(sourceSchema),
  events: z.array(eventSchema),
  topics: z.array(topicSchema).default([]),
});

export type Source = z.infer<typeof sourceSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Election = z.infer<typeof electionSchema>;
export type District = z.infer<typeof districtSchema>;
export type DistrictStatus = z.infer<typeof districtStatusSchema>;
export type Person = z.infer<typeof personSchema>;
export type Candidacy = z.infer<typeof candidacySchema>;
export type CandidacyStatus = z.infer<typeof candidacyStatusSchema>;
export type Policy = z.infer<typeof policySchema>;
export type PolicyField = z.infer<typeof policyFieldSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type EventDefinition = z.infer<typeof eventSchema>;
export type EventBinding = z.infer<typeof eventBindingSchema>;
export type StrengthId = z.infer<typeof strengthIdSchema>;
export type RiskId = z.infer<typeof riskIdSchema>;
export type FramingAngle = z.infer<typeof framingAngleSchema>;
export type Strategy = z.infer<typeof strategySchema>;
export type EventChoice = z.infer<typeof eventChoiceSchema>;
export type ContentBundle = z.infer<typeof contentBundleSchema>;
/** 未經 zod 預設值補齊的原始輸入形狀，供撰寫 JSON 與測試 fixture 使用 */
export type ContentBundleInput = z.input<typeof contentBundleSchema>;
