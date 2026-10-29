import { nextInt, type RngState } from '../engine/rng.ts';
import type { Comparison, ContentBundle, Policy } from './schema.ts';

/**
 * 政見盲測（參考 blindvote.app 的方法）：每輪一個議題，遮住身分後打亂順序，
 * 全部選完才揭曉。只依資料運算，不依賴介面。
 */

export const MASK = '■■';
/** 每局最多抽出的共同議題輪數，不含最後的特色政見輪 */
export const MAX_SHARED_ROUNDS = 7;

/** 用字統一，避免異體字洩漏來源（例如官方新聞稿用「臺」） */
export function normalizeText(text: string): string {
  return text.replaceAll('臺', '台');
}

/** 把會洩漏身分的字詞換成墨塊；較長的字詞先替換，避免只遮掉一半 */
export function maskText(text: string, terms: readonly string[]): string {
  const normalized = [...new Set(terms.map(normalizeText).filter((t) => t.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
  let result = normalizeText(text);
  for (const term of normalized) result = result.replaceAll(term, MASK);
  return result;
}

/** 所有段落都要遮蔽的字詞：每位比較對象的姓名與登記政黨，避免文中提到對手時洩漏 */
export function sharedMaskTerms(bundle: ContentBundle, comparison: Comparison): string[] {
  return comparison.candidacyIds.flatMap((candidacyId) => {
    const candidacy = bundle.candidacies.find((c) => c.id === candidacyId);
    const person = bundle.people.find((p) => p.id === candidacy?.personId);
    return [person?.name, candidacy?.party].filter((t): t is string => !!t && t !== '無黨籍');
  });
}

/**
 * 某參選人段落要遮蔽的字詞：共同字詞，加上比較設定中該陣營專屬的用詞
 * （例如現任者段落中的「市府」），專屬用詞不套用到其他人的段落以免誤遮。
 */
export function maskTermsFor(bundle: ContentBundle, comparison: Comparison, candidacyId: string): string[] {
  return [...sharedMaskTerms(bundle, comparison), ...(comparison.maskTerms[candidacyId] ?? [])];
}

/**
 * 盲測顯示的原文：優先取非媒體來源（候選人、陣營或政府原文）中最長的一則引文，
 * 沒有才用媒體引文；取最長是為了減少各陣營段落長短差異造成的辨識線索。
 */
export function primaryQuote(bundle: ContentBundle, policy: Policy): string {
  const nature = (sourceId: string) => bundle.sources.find((s) => s.id === sourceId)?.nature;
  const official = policy.citations.filter((c) => nature(c.sourceId) !== 'media');
  const pool = official.length > 0 ? official : policy.citations;
  const longest = pool.reduce<(typeof pool)[number] | undefined>(
    (best, c) => (!best || c.quote.length > best.quote.length ? c : best),
    undefined,
  );
  return longest?.quote ?? policy.summary;
}

export interface Segment {
  candidacyId: string;
  policyId: string;
  /** 遮蔽後的顯示文字 */
  maskedText: string;
}

export interface Round {
  topicId: string;
  topicName: string;
  /** shared：多位候選人都有政見的議題；signature：只有一位提出的特色政見 */
  kind: 'shared' | 'signature';
  segments: Segment[];
}

function shuffle<T>(items: readonly T[], rng: RngState): [T[], RngState] {
  const result = [...items];
  let state = rng;
  for (let i = result.length - 1; i > 0; i--) {
    let j: number;
    [j, state] = nextInt(state, 0, i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return [result, state];
}

function pick<T>(items: readonly T[], rng: RngState): [T, RngState] {
  const [index, next] = nextInt(rng, 0, items.length - 1);
  return [items[index] as T, next];
}

/** 比較中各參選紀錄的當次政見，依議題分組 */
export function policiesByTopic(bundle: ContentBundle, comparison: Comparison): Map<string, Map<string, Policy[]>> {
  const byTopic = new Map<string, Map<string, Policy[]>>();
  for (const policy of bundle.policies) {
    if (policy.timeframe !== 'current' || !comparison.candidacyIds.includes(policy.candidacyId)) continue;
    const byCandidacy = byTopic.get(policy.topic) ?? new Map<string, Policy[]>();
    byCandidacy.set(policy.candidacyId, [...(byCandidacy.get(policy.candidacyId) ?? []), policy]);
    byTopic.set(policy.topic, byCandidacy);
  }
  return byTopic;
}

export function buildRounds(
  bundle: ContentBundle,
  comparison: Comparison,
  rng: RngState,
  maxSharedRounds: number = MAX_SHARED_ROUNDS,
): { rounds: Round[]; rng: RngState } {
  const topicName = (id: string) => bundle.topics.find((t) => t.id === id)?.name ?? id;
  const segmentOf = (policy: Policy): Segment => ({
    candidacyId: policy.candidacyId,
    policyId: policy.id,
    maskedText: maskText(primaryQuote(bundle, policy), maskTermsFor(bundle, comparison, policy.candidacyId)),
  });

  let state = rng;
  const byTopic = policiesByTopic(bundle, comparison);
  const sharedTopics = [...byTopic.entries()].filter(([, byCandidacy]) => byCandidacy.size >= 2);
  let chosenTopics: typeof sharedTopics;
  [chosenTopics, state] = shuffle(sharedTopics, state);
  chosenTopics = chosenTopics.slice(0, maxSharedRounds);

  const rounds: Round[] = [];
  for (const [topicId, byCandidacy] of chosenTopics) {
    const segments: Segment[] = [];
    for (const policies of byCandidacy.values()) {
      let policy: Policy;
      [policy, state] = pick(policies, state);
      segments.push(segmentOf(policy));
    }
    let shuffled: Segment[];
    [shuffled, state] = shuffle(segments, state);
    rounds.push({ topicId, topicName: topicName(topicId), kind: 'shared', segments: shuffled });
  }

  // 特色政見：每位候選人從只有自己提出的議題中各出一段
  const signature: Segment[] = [];
  for (const candidacyId of comparison.candidacyIds) {
    const own = [...byTopic.values()]
      .filter((byCandidacy) => byCandidacy.size === 1 && byCandidacy.has(candidacyId))
      .flatMap((byCandidacy) => byCandidacy.get(candidacyId) ?? []);
    if (own.length === 0) continue;
    let policy: Policy;
    [policy, state] = pick(own, state);
    signature.push(segmentOf(policy));
  }
  if (signature.length >= 2) {
    let shuffled: Segment[];
    [shuffled, state] = shuffle(signature, state);
    rounds.push({ topicId: 'signature', topicName: '特色政見', kind: 'signature', segments: shuffled });
  }

  return { rounds, rng: state };
}

/** 計分：每輪蓋章的段落得 1 分，標為重要的議題得 2 分；跳過不計分 */
export function tally(
  rounds: readonly Round[],
  picks: readonly (string | null)[],
  importantTopics: ReadonlySet<string>,
): Map<string, number> {
  const scores = new Map<string, number>();
  rounds.forEach((round, i) => {
    for (const segment of round.segments) scores.set(segment.candidacyId, scores.get(segment.candidacyId) ?? 0);
    const picked = round.segments.find((s) => s.policyId === picks[i]);
    if (picked) {
      const weight = importantTopics.has(round.topicId) ? 2 : 1;
      scores.set(picked.candidacyId, (scores.get(picked.candidacyId) ?? 0) + weight);
    }
  });
  return scores;
}

/** 不在比較中的同選區參選人：只代表尚未收錄，不代表沒有主張 */
export function excludedCandidacies(bundle: ContentBundle, comparison: Comparison): string[] {
  return bundle.candidacies
    .filter((c) => c.districtId === comparison.districtId && c.status !== 'withdrawn')
    .filter((c) => !comparison.candidacyIds.includes(c.id))
    .map((c) => c.id);
}
