import type { CampaignStage } from '../engine/calendar.ts';
import type { ResourceKey } from '../engine/types.ts';
export { EXPOSURE_LABELS } from '../engine/engine.ts';
import type { CandidacyStatus, DistrictStatus, Source } from '../content/schema.ts';

export const STAGE_LABELS: Record<CampaignStage, string> = {
  takeover: '接手與盤點',
  platform: '政見取捨',
  pressure: '壓力累積',
  countdown: '投票倒數',
};

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  funds: '經費（萬元）',
  morale: '團隊士氣',
  candidateTrust: '候選人信任',
  publicTrust: '公共信任（內部評估）',
  policyConsistency: '政策一致性',
};

export const DISTRICT_STATUS_LABELS: Record<DistrictStatus, string> = {
  'not-started': '尚未開始蒐集資料',
  collecting: '資料蒐集中',
  preview: '預覽資料（名單未公告、來源待審閱）',
  playable: '可遊玩',
};

export const CANDIDACY_STATUS_LABELS: Record<CandidacyStatus, string> = {
  announced: '宣布參選',
  nominated: '獲政黨提名',
  registered: '完成登記',
  certified: '選務機關公告之正式候選人',
  withdrawn: '退選或未獲登記',
};

export const VERIFICATION_LABELS: Record<Source['verification'], string> = {
  'pending-review': '待人工審閱',
  reviewed: '已審閱',
  disputed: '審閱有疑義',
  unavailable: '來源失效',
};

export const LOCATOR_LABELS = {
  page: '頁碼',
  timestamp: '時間碼',
  paragraph: '段落',
  quote: '引文定位',
} as const;

export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
