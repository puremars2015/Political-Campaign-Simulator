import { BALANCE } from './config.ts';

export interface RoundSpan {
  round: number;
  /** ISO 日期（YYYY-MM-DD），含首尾 */
  startDate: string;
  endDate: string;
  stage: CampaignStage;
}

/** 對應開發計畫 3.3 的四個敘事階段 */
export type CampaignStage = 'takeover' | 'platform' | 'pressure' | 'countdown';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new RangeError(`無效日期：${iso}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(parseIsoDate(iso) + days * DAY_MS);
}

function stageForRound(round: number): CampaignStage {
  if (round <= 3) return 'takeover';
  if (round <= 6) return 'platform';
  if (round <= 9) return 'pressure';
  return 'countdown';
}

/**
 * 依投票日建立12回合日期表：
 * 第1–9回合平均分配投票前90天至投票前4天，第10–12回合為投票前3、2、1天逐日倒數。
 */
export function buildCalendar(
  electionDate: string,
  totalDays: number = BALANCE.campaignDays,
  totalRounds: number = BALANCE.totalRounds,
  countdownRounds: number = BALANCE.countdownRounds,
): RoundSpan[] {
  const campaignStart = addDays(electionDate, -totalDays);
  const regularRounds = totalRounds - countdownRounds;
  const regularDays = totalDays - countdownRounds;
  const baseLength = Math.floor(regularDays / regularRounds);
  const longerRounds = regularDays % regularRounds;

  const spans: RoundSpan[] = [];
  let cursor = campaignStart;
  for (let i = 0; i < regularRounds; i++) {
    const length = baseLength + (i < longerRounds ? 1 : 0);
    const endDate = addDays(cursor, length - 1);
    spans.push({ round: i + 1, startDate: cursor, endDate, stage: stageForRound(i + 1) });
    cursor = addDays(endDate, 1);
  }
  for (let i = 0; i < countdownRounds; i++) {
    const round = regularRounds + i + 1;
    spans.push({ round, startDate: cursor, endDate: cursor, stage: stageForRound(round) });
    cursor = addDays(cursor, 1);
  }
  return spans;
}
