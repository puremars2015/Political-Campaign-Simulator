import { z } from 'zod';
import { effectSchema, framingAngleSchema } from '../content/schema.ts';
import { BALANCE } from '../engine/config.ts';

const integer = z.number().int().nonnegative();
const id = z.string().min(1);
const ratio = z.number().min(0).max(1);
const exposure = z.enum(['pending', 'internal', 'featured', 'reframed', 'deferred', 'low-profile']);
const resources = z.object({ funds: z.number().min(0).max(99999), morale: z.number().min(0).max(100),
  candidateTrust: z.number().min(0).max(100), publicTrust: z.number().min(0).max(100), policyConsistency: z.number().min(0).max(100) });
const binding = z.object({ topicId: id, ourPolicyId: id, opponentPolicyId: id.nullable() }).nullable();

/** 不信任 localStorage 的 JSON 形狀；完整驗證所有畫面與引擎會讀取的欄位。 */
export const savedStateSchema = z.object({
  schemaVersion: integer, contentVersion: id, seed: id, rng: integer.max(0xffffffff), revision: integer,
  phase: z.enum(['campaign', 'election', 'ended']), round: z.number().int().min(1).max(BALANCE.totalRounds),
  calendar: z.array(z.object({ round: z.number().int().min(1).max(12), startDate: id, endDate: id,
    stage: z.enum(['takeover', 'platform', 'pressure', 'countdown']) })).min(1).max(BALANCE.totalRounds),
  dataAsOf: id, dataMode: z.enum(['formal', 'preview']), districtId: id, candidacyId: id,
  opponentCandidacyIds: z.array(id).min(1), resources,
  actionPoints: integer.max(BALANCE.actionPointsPerRound),
  campaign: z.array(z.object({ policyId: id, status: exposure, angle: framingAngleSchema.nullable(),
    history: z.array(z.object({ round: integer, status: exposure, angle: framingAngleSchema.nullable(), decisionId: id.nullable() })) })),
  pendingEffects: z.array(z.object({ id, dueRound: integer, effects: z.array(effectSchema), sourceDecisionId: id })),
  decisions: z.array(z.object({ id, round: integer, kind: z.enum(['action', 'event-choice', 'delayed-effect', 'policy-exposure']),
    ref: id, resourceDelta: z.partialRecord(z.enum(['funds','morale','candidateTrust','publicTrust','policyConsistency']), z.number()), summary: id })),
  flags: z.record(id, z.boolean()), activeEvent: z.object({ eventId: id, binding }).nullable(),
  eventLog: z.array(z.object({ round: integer, eventId: id, ourPolicyId: id.nullable() })),
  scheduledEvents: z.array(z.object({ eventId: id, dueRound: integer, binding, sourceDecisionId: id })),
  hidden: z.object({ support: z.record(id, ratio), undecided: ratio }),
}).refine((s) => {
  if (s.round > s.calendar.length) return false;
  const ids = [s.candidacyId, ...s.opponentCandidacyIds];
  return new Set(ids).size === ids.length && Object.keys(s.hidden.support).length === ids.length &&
    ids.every((id) => s.hidden.support[id] !== undefined) &&
    Math.abs(Object.values(s.hidden.support).reduce((a,b) => a+b, 0) + s.hidden.undecided - 1) < 1e-6;
}, '模擬支持與名單不一致');
