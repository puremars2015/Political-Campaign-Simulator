import type { Candidacy, Citation, ContentBundle, District, Policy } from './schema.ts';

/**
 * formal：正式資料，名單經選務機關公告、來源皆已人工審閱。
 * preview：預覽資料，名單可為完成登記、來源可為待審閱，只涵蓋縣市設定的收錄範圍，介面須清楚標示。
 */
export type DataMode = 'formal' | 'preview';

function verificationOf(bundle: ContentBundle, sourceId: string) {
  return bundle.sources.find((s) => s.id === sourceId)?.verification;
}

/** 來源全部已人工審閱，才能在正式資料中當作事實使用 */
export function citationsReviewed(bundle: ContentBundle, citations: readonly Citation[]): boolean {
  return citations.every((c) => verificationOf(bundle, c.sourceId) === 'reviewed');
}

/** 預覽可接受待審閱的來源，但排除審閱有疑義或已失效的來源 */
export function citationsPreviewable(bundle: ContentBundle, citations: readonly Citation[]): boolean {
  return citations.every((c) => {
    const verification = verificationOf(bundle, c.sourceId);
    return verification === 'reviewed' || verification === 'pending-review';
  });
}

export function policyCitations(policy: Policy): Citation[] {
  const fieldCitations = Object.values(policy.fields).flatMap((f) => (f.stated === null ? [] : [f.citation]));
  return [...policy.citations, ...fieldCitations];
}

/** 可在遊戲中使用的政見：當次政見，且引用的來源符合資料等級的要求 */
export function isPolicyUsable(bundle: ContentBundle, policy: Policy, mode: DataMode = 'formal'): boolean {
  if (policy.timeframe !== 'current') return false;
  const citations = policyCitations(policy);
  return mode === 'formal' ? citationsReviewed(bundle, citations) : citationsPreviewable(bundle, citations);
}

export function activeCandidacies(bundle: ContentBundle, districtId: string): Candidacy[] {
  const district = bundle.districts.find((d) => d.id === districtId);
  if (!district) return [];
  return bundle.candidacies.filter(
    (c) => c.districtId === districtId && c.electionId === district.electionId && c.status !== 'withdrawn',
  );
}

/** 遊戲中出現的參選紀錄：正式資料為全部參選人；預覽只含縣市設定的收錄範圍 */
export function gameCandidacies(bundle: ContentBundle, district: District, mode: DataMode): Candidacy[] {
  const active = activeCandidacies(bundle, district.id);
  if (mode === 'formal' || !district.focusCandidacyIds) return active;
  return active.filter((c) => district.focusCandidacyIds?.includes(c.id));
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
 * 正式資料要求全部參選人皆為正式候選人且來源已審閱；預覽只檢查收錄範圍內的參選人，
 * 接受完成登記與待審閱來源。回傳所有未達標原因，供介面顯示資料進度。
 */
export function assessDistrict(bundle: ContentBundle, district: District, mode: DataMode = 'formal'): Playability {
  const reasons: string[] = [];
  const election = bundle.elections.find((e) => e.id === district.electionId);
  const sourcesOk = mode === 'formal' ? citationsReviewed : citationsPreviewable;

  if (!election) reasons.push('缺少選舉資料');
  else if (election.citations.length === 0 || !sourcesOk(bundle, election.citations)) {
    reasons.push('選舉日期來源尚未審閱');
  }
  if (!district.dataAsOf) reasons.push('未標示資料截至日期');
  if (!district.simulation) reasons.push('尚未設定模擬參數');
  if (mode === 'formal') {
    if (district.regions.length === 0) reasons.push('缺少行政區資料');
    else if (!district.regions.every((r) => citationsReviewed(bundle, r.citations))) {
      reasons.push('行政區來源尚未審閱');
    }
  }

  const candidacies = gameCandidacies(bundle, district, mode);
  if (candidacies.length === 0) reasons.push('尚未建立候選人名單');
  else if (mode === 'preview' && candidacies.length < 2) reasons.push('預覽至少需要兩位參選人');

  let supportTotal = district.simulation?.undecided ?? 0;
  for (const candidacy of candidacies) {
    const person = bundle.people.find((p) => p.id === candidacy.personId);
    const name = person?.name ?? candidacy.personId;
    if (mode === 'formal' && candidacy.status !== 'certified') {
      reasons.push(`${name}：尚未經選務機關公告為正式候選人`);
    }
    if (mode === 'preview' && candidacy.status !== 'certified' && candidacy.status !== 'registered') {
      reasons.push(`${name}：尚未完成登記`);
    }
    if (!sourcesOk(bundle, candidacy.statusCitations)) reasons.push(`${name}：參選狀態來源尚未審閱`);
    if (mode === 'formal' ? !person?.simulation?.reviewed : !person?.simulation) {
      reasons.push(`${name}：模擬性格參數尚未${mode === 'formal' ? '審閱' : '設定'}`);
    }
    if (!candidacy.simulation) reasons.push(`${name}：尚未設定模擬起始參數`);
    supportTotal += candidacy.simulation?.baselineSupport ?? 0;
    if (!policiesFor(bundle, candidacy.id).some((p) => isPolicyUsable(bundle, p, mode))) {
      reasons.push(`${name}：沒有${mode === 'formal' ? '已審閱來源的' : '可用的'}當次政見`);
    }
  }
  if (candidacies.length > 0 && district.simulation && Math.abs(supportTotal - 1) > 1e-6) {
    reasons.push('模擬起始支持與未表態加總不等於 1');
  }

  return { playable: reasons.length === 0, reasons };
}

/** 縣市目前可開局的資料等級；不可開局時回傳 null 與原因 */
export function startableMode(
  bundle: ContentBundle,
  district: District,
): { mode: DataMode | null; reasons: string[] } {
  if (district.status === 'playable') {
    const formal = assessDistrict(bundle, district, 'formal');
    return { mode: formal.playable ? 'formal' : null, reasons: formal.reasons };
  }
  if (district.status === 'preview') {
    const preview = assessDistrict(bundle, district, 'preview');
    return { mode: preview.playable ? 'preview' : null, reasons: preview.reasons };
  }
  const formal = assessDistrict(bundle, district, 'formal');
  return { mode: null, reasons: formal.reasons.length > 0 ? formal.reasons : ['資料尚未發布'] };
}
