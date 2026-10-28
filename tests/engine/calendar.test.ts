import { describe, expect, it } from 'vitest';
import { addDays, buildCalendar } from '../../src/engine/calendar.ts';

describe('buildCalendar', () => {
  const calendar = buildCalendar('2026-11-28');

  it('產生12回合，從投票前90天開始、到投票前一天結束', () => {
    expect(calendar).toHaveLength(12);
    expect(calendar[0]?.startDate).toBe('2026-08-30');
    expect(calendar[11]?.endDate).toBe('2026-11-27');
  });

  it('回合日期連續不重疊', () => {
    for (let i = 1; i < calendar.length; i++) {
      expect(calendar[i]?.startDate).toBe(addDays(calendar[i - 1]!.endDate, 1));
    }
  });

  it('最後三回合逐日倒數', () => {
    for (const span of calendar.slice(9)) {
      expect(span.startDate).toBe(span.endDate);
      expect(span.stage).toBe('countdown');
    }
  });
});
