import type { CampaignStage } from '../engine/calendar.ts';
import type { ResourceKey } from '../engine/types.ts';

export const STAGE_LABELS: Record<CampaignStage, string> = {
  takeover: '接手與盤點',
  platform: '政見成形',
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

export function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}
