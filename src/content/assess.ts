import type { ContentBundle, FramingAngle, Policy, RiskId, Strategy, StrengthId } from './schema.ts';

export type { FramingAngle, RiskId, Strategy, StrengthId };

/**
 * 幕僚評估：依政見資料推論宣傳上的優勢與風險。
 * 這是遊戲模型的推論（計畫 4.3），不是對政見本身好壞的判斷，介面須標示為模擬。
 */


export const STRENGTH_LABELS: Record<StrengthId, string> = {
  concrete: '有具體規模、時程或經費，說得出數字',
  'unique-issue': '對手在這個議題沒有收錄政見，可以獨佔話題',
  'head-to-head': '對手在同議題也有政見，可以正面對比',
  'official-source': '有陣營或政府的原始出處，經得起查證',
  'incumbent-resources': '已有市府資源在推動，執行可信度較高',
};

export const RISK_LABELS: Record<RiskId, string> = {
  'costly-unfunded': '涉及支出但來源沒交代財源，容易被追問錢從哪裡來',
  vague: '沒有寫明規模、時程或經費，容易被說空泛',
  'long-horizon': '時程很長，容易被說遠水救不了近火',
  'government-plan': '以市府名義宣布，容易被批評選前開支票',
  'thin-source': '出處只有媒體報導，被質疑時較難回應',
  'opponent-dominant': '對手在這個議題提出的政見比我方多，正面交鋒容易吃虧',
};

/** 圓滑包裝的說法角度：只改變強調重點，引用的仍是原文與有出處的欄位 */
export interface AngleDefinition {
  label: string;
  /** 說明這個角度會引用政見的哪一部分 */
  description: string;
  /** 可以化解的風險 */
  mitigates: RiskId[];
}

export const FRAMING_ANGLES: Record<FramingAngle, AngleDefinition> = {
  beneficiaries: { label: '強調受惠對象', description: '引用來源寫明的適用對象與規模', mitigates: [] },
  numbers: { label: '強調具體數字', description: '引用來源寫明的規模、時程或經費', mitigates: [] },
  contrast: { label: '與對手對比', description: '並列對手在同議題的原文，凸顯差異', mitigates: [] },
  vision: { label: '連結城市願景', description: '把這項政見放進整體市政主軸來談', mitigates: ['vague', 'long-horizon'] },
  'step-by-step': {
    label: '承認限制、說明步驟',
    description: '主動說明尚待規劃的部分與推動順序',
    mitigates: ['costly-unfunded', 'long-horizon'],
  },
  continuity: {
    label: '延續既有施政',
    description: '說明這是延續市府已在推動的工作，而不是選前新開的支票',
    mitigates: ['government-plan'],
  },
};


export interface PolicyAssessment {
  policyId: string;
  strengths: StrengthId[];
  risks: RiskId[];
  /** 對手在同議題的政見 */
  opponentPolicyIds: string[];
  /** 依資料可用的包裝角度 */
  angles: FramingAngle[];
  suggestion: Strategy;
  /** 建議包裝時的最佳角度 */
  suggestedAngle: FramingAngle | null;
}

const LONG_HORIZON = /203\d|8\s*年|八年|長期|5[–-]8\s*年/;
/** 政見文字中涉及支出的線索 */
const SPENDING = /補助|免費|基金|加碼|津貼|獎勵|加菜金|預算|經費|\d[\d,.]*\s*(?:萬|億)?元/;

export function assessPolicy(
  bundle: ContentBundle,
  policy: Policy,
  opponentCandidacyIds: readonly string[],
): PolicyAssessment {
  const opponentPolicyIds = bundle.policies
    .filter((p) => p.topic === policy.topic && p.timeframe === 'current' && opponentCandidacyIds.includes(p.candidacyId))
    .map((p) => p.id);
  const natures = policy.citations.map((c) => bundle.sources.find((s) => s.id === c.sourceId)?.nature);
  const { scale, deadline, funding } = policy.fields;

  const ourOnTopic = bundle.policies.filter(
    (p) => p.topic === policy.topic && p.timeframe === 'current' && p.candidacyId === policy.candidacyId,
  ).length;
  const opponentDominant = opponentPolicyIds.length >= 2 && opponentPolicyIds.length > ourOnTopic;
  const concrete = scale.stated !== null || deadline.stated !== null || funding.stated !== null;
  const text = [policy.summary, ...policy.citations.map((c) => c.quote)].join('\n');

  const strengths: StrengthId[] = [];
  if (concrete) strengths.push('concrete');
  if (opponentPolicyIds.length === 0) strengths.push('unique-issue');
  else if (!opponentDominant) strengths.push('head-to-head');
  if (natures.some((n) => n === 'candidate-official' || n === 'government-record' || n === 'election-authority')) strengths.push('official-source');
  if (policy.origin === 'government-plan') strengths.push('incumbent-resources');

  const risks: RiskId[] = [];
  if (funding.stated === null && SPENDING.test(text)) risks.push('costly-unfunded');
  if (!concrete) risks.push('vague');
  if (deadline.stated !== null && LONG_HORIZON.test(deadline.stated)) risks.push('long-horizon');
  if (policy.origin === 'government-plan') risks.push('government-plan');
  if (natures.every((n) => n === 'media')) risks.push('thin-source');
  if (opponentDominant) risks.push('opponent-dominant');

  const angles: FramingAngle[] = [];
  if (scale.stated !== null) angles.push('beneficiaries');
  if (concrete) angles.push('numbers');
  if (opponentPolicyIds.length > 0 && !opponentDominant) angles.push('contrast');
  angles.push('vision', 'step-by-step');
  if (policy.origin === 'government-plan') angles.push('continuity');

  // 優先挑能化解最多風險的角度；都化解不了時挑能發揮優勢的角度
  const ranked = [...angles].sort(
    (a, b) =>
      FRAMING_ANGLES[b].mitigates.filter((r) => risks.includes(r)).length -
      FRAMING_ANGLES[a].mitigates.filter((r) => risks.includes(r)).length,
  );
  const best = ranked[0] ?? null;
  const mitigatable = best ? FRAMING_ANGLES[best].mitigates.filter((r) => risks.includes(r)).length : 0;

  // 建議：優勢明顯且風險少就主打；包裝後仍弊多於利就低調；其餘包裝
  const net = strengths.length - risks.length;
  const netAfterFraming = strengths.length - (risks.length - mitigatable);
  let suggestion: Strategy;
  if (risks.length === 0 || (net >= 2 && risks.length <= 1)) suggestion = 'featured';
  else if (netAfterFraming <= 0 || risks.includes('opponent-dominant')) suggestion = 'low-profile';
  else suggestion = 'reframed';

  return {
    policyId: policy.id,
    strengths,
    risks,
    opponentPolicyIds,
    angles,
    suggestion,
    suggestedAngle: suggestion === 'reframed' ? best : null,
  };
}

/** 套用某角度後仍未化解的風險 */
export function remainingRisks(assessment: PolicyAssessment, angle: FramingAngle | null): RiskId[] {
  if (!angle) return assessment.risks;
  return assessment.risks.filter((r) => !FRAMING_ANGLES[angle].mitigates.includes(r));
}
