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

export const districtSchema = z.object({
  id,
  name: z.string().min(1),
  /** 原型內容必須為虛構；真人資料包另行規範 */
  fictional: z.literal(true),
  electionDate: isoDate,
  regions: z
    .array(z.object({ id, name: z.string().min(1), registeredVoters: z.number().int().positive() }))
    .min(1),
  baseline: z.object({ opponentSupport: ratio, undecided: ratio }),
});

export const commitmentSeedSchema = z.object({
  id,
  issue: z.string().min(1),
  goal: z.string().min(1),
  tool: z.string().min(1),
  strength: z.enum(['study', 'promote', 'guarantee']),
  scale: z.string().min(1),
  funding: z.string().min(1),
  deadline: z.string().min(1),
  wording: z.string().min(1),
  status: z.enum(['draft', 'internal', 'public']),
});

export const candidateSchema = z.object({
  id,
  name: z.string().min(1),
  fictional: z.literal(true),
  districtId: id,
  background: z.string().min(1),
  personality: z.array(z.string().min(1)).min(1),
  priorities: z.array(z.string().min(1)).min(1),
  /** 無論信任多高都不會讓步的原則，對應計畫 4.2 */
  nonNegotiables: z.array(z.string().min(1)),
  startingResources: z.object({
    funds: z.number().min(0),
    morale: z.number().min(0).max(100),
    candidateTrust: z.number().min(0).max(100),
    publicTrust: z.number().min(0).max(100),
    policyConsistency: z.number().min(0).max(100),
  }),
  initialCommitments: z.array(commitmentSeedSchema),
});

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
  followUpEventId: id.optional(),
});

export const eventSchema = z.object({
  id,
  title: z.string().min(1),
  body: z.string().min(1),
  window: z.object({ fromRound: z.number().int().min(1), toRound: z.number().int().min(1) }),
  priority: z.number().int().default(0),
  once: z.boolean().default(true),
  exclusiveGroup: id.optional(),
  conditions: z
    .object({
      candidateIds: z.array(id).optional(),
      flagsAll: z.array(id).optional(),
      flagsNone: z.array(id).optional(),
    })
    .default({}),
  choices: z.array(eventChoiceSchema).min(2),
});

export const contentBundleSchema = z.object({
  contentVersion: z.string().min(1),
  districts: z.array(districtSchema).min(1),
  candidates: z.array(candidateSchema).min(1),
  events: z.array(eventSchema),
});

export type District = z.infer<typeof districtSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type EventDefinition = z.infer<typeof eventSchema>;
export type EventChoice = z.infer<typeof eventChoiceSchema>;
export type ContentBundle = z.infer<typeof contentBundleSchema>;
