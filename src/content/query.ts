import type { Candidacy, Citation, ContentBundle, District, Policy } from './schema.ts';

/** 來源全部已人工審閱，才能在遊戲中當作事實使用 */
export function citationsReviewed(bundle: ContentBundle, citations: readonly Citation[]): boolean {
  return citations.every(
    (c) => bundle.sources.find((s) => s.id === c.sourceId)?.verification === 'reviewed',
  );
}

export function policyCitations(policy: Policy): Citation[] {
  const fieldCitations = Object.values(policy.fields).flatMap((f) => (f.stated === null ? [] : [f.citation]));
  return [...policy.citations, ...fieldCitations];
}

/** 可在遊戲中使用的政見：當次政見，且主張與欄位引用的來源皆已審閱 */
export function isPolicyUsable(bundle: ContentBundle, policy: Policy): boolean {
  return policy.timeframe === 'current' && citationsReviewed(bundle, policyCitations(policy));
}

export function activeCandidacies(bundle: ContentBundle, districtId: string): Candidacy[] {
  const district = bundle.districts.find((d) => d.id === districtId);
  if (!district) return [];
  return bundle.candidacies.filter(
    (c) => c.districtId === districtId && c.electionId === district.electionId && c.status !== 'withdrawn',
  );
}

export function policiesFor(bundle: ContentBundle, candidacyId: string): Policy[] {
  return bundle.policies.filter((p) => p.candidacyId === candidacyId);
}

export interface Playability {
  playable: boolean;
  reasons: string[];
}

/**
 * 依計畫 8.4 的發布門檻檢查選區是否可玩。
 * 回傳所有未達標原因，供介面顯示資料進度。
 */
export function assessDistrict(bundle: ContentBundle, district: District): Playability {
  const reasons: string[] = [];
  const election = bundle.elections.find((e) => e.id === district.electionId);

  if (!election) reasons.push('缺少選舉資料');
  else if (election.citations.length === 0 || !citationsReviewed(bundle, election.citations)) {
    reasons.push('選舉日期來源尚未審閱');
  }
  if (!district.dataAsOf) reasons.push('未標示資料截至日期');
  if (!district.simulation) reasons.push('尚未設定模擬參數');
  if (district.regions.length === 0) reasons.push('缺少行政區資料');
  else if (!district.regions.every((r) => citationsReviewed(bundle, r.citations))) {
    reasons.push('行政區來源尚未審閱');
  }

  const candidacies = activeCandidacies(bundle, district.id);
  if (candidacies.length === 0) reasons.push('尚未建立候選人名單');

  let supportTotal = district.simulation?.undecided ?? 0;
  for (const candidacy of candidacies) {
    const person = bundle.people.find((p) => p.id === candidacy.personId);
    const name = person?.name ?? candidacy.personId;
    if (candidacy.status !== 'certified') reasons.push(`${name}：尚未經選務機關公告為正式候選人`);
    if (!citationsReviewed(bundle, candidacy.statusCitations)) reasons.push(`${name}：參選狀態來源尚未審閱`);
    if (!person?.simulation?.reviewed) reasons.push(`${name}：模擬性格參數尚未審閱`);
    if (!candidacy.simulation) reasons.push(`${name}：尚未設定模擬起始參數`);
    supportTotal += candidacy.simulation?.baselineSupport ?? 0;
    if (!policiesFor(bundle, candidacy.id).some((p) => isPolicyUsable(bundle, p))) {
      reasons.push(`${name}：沒有已審閱來源的當次政見`);
    }
  }
  if (candidacies.length > 0 && district.simulation && Math.abs(supportTotal - 1) > 1e-6) {
    reasons.push('模擬起始支持與未表態加總不等於 1');
  }

  return { playable: reasons.length === 0, reasons };
}
