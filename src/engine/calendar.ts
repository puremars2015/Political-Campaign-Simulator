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
  const parsed = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(parsed).toISOString().slice(0, 10) !== iso) throw new RangeError(`無效日期：${iso}`);
  return parsed;
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

/** 日期以臺灣日曆為準；clock 可注入，避免以執行機時區決定遊戲日期。 */
export function taipeiToday(clock: () => Date = () => new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(clock());
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** 最多12份每日主要簡報；平靜日壓縮，最後一份固定為選前之夜。 */
export function buildCurrentCalendar(electionDate: string, startDate = taipeiToday()): RoundSpan[] {
  const start = parseIsoDate(startDate), eve = parseIsoDate(addDays(electionDate, -1));
  if (start > eve) throw new Error('本屆劇本已結束。請明確選擇歷史重玩，不能以今天開局。');
  const days = Math.round((eve - start) / DAY_MS) + 1;
  const count = Math.min(BALANCE.totalRounds, days);
  return Array.from({ length: count }, (_, index) => {
    const offset = count === 1 ? 0 : Math.floor(index * (days - 1) / (count - 1));
    const previousOffset = count === 1 || index === 0 ? -1 : Math.floor((index - 1) * (days - 1) / (count - 1));
    const endDate = addDays(startDate, offset);
    return { round: index + 1, startDate: addDays(startDate, previousOffset + 1), endDate,
      stage: index === count - 1 ? 'countdown' : stageForRound(Math.ceil((index + 1) / count * 12)) };
  });
}

/** 依使用者的玩法界線：選前第10天之後不呈現民調；以遊戲目前事件日期判斷，終局另行停止呈現。 */
export function pollVisible(date: string, electionDate: string): boolean {
  return parseIsoDate(date) <= parseIsoDate(addDays(electionDate, -10));
}
