import { describe, expect, it } from 'vitest';
import { buildCurrentCalendar, pollVisible, taipeiToday } from '../../src/engine/calendar.ts';
import { loadContent } from '../../src/content/index.ts';
import { createNewGame, endRound, resolveEvent, choiceBlocker } from '../../src/engine/engine.ts';
import { gameCandidacies } from '../../src/content/query.ts';

describe('依當日日期到選前之夜', () => {
  it('臺灣跨日、選前11/10/9天、前一夜與選後邊界', () => {
    expect(taipeiToday(() => new Date('2026-11-17T16:00:00Z'))).toBe('2026-11-18');
    for (const [date, count, visible] of [['2026-11-17',11,true],['2026-11-18',10,true],['2026-11-19',9,false],['2026-11-27',1,false]] as const) {
      const calendar = buildCurrentCalendar('2026-11-28',date);
      expect(calendar).toHaveLength(count);
      expect(calendar[0]?.startDate).toBe(date);
      expect(calendar.at(-1)?.endDate).toBe('2026-11-27');
      expect(pollVisible(date,'2026-11-28')).toBe(visible);
    }
    for (const date of ['2026-11-28','2026-11-29']) expect(() => buildCurrentCalendar('2026-11-28',date)).toThrow('本屆劇本已結束');
    expect(buildCurrentCalendar('2026-11-28','2026-10-30')).toHaveLength(12);
  });
  it('六都12人、零資源路徑均可收尾，每份主要事件唯一，不產生開票或勝負', () => {
    const content = loadContent();
    let count = 0;
    for (const district of content.districts.filter((d) => d.kind === 'municipality')) {
      for (const candidate of gameCandidacies(content,district,'preview')) {
        count++;
        for (const date of ['2026-10-30','2026-11-19','2026-11-27']) {
          let state = createNewGame(content,{districtId:district.id,candidacyId:candidate.id,seed:`full-${count}`,startDate:date});
          state.resources = {funds:0,morale:0,candidateTrust:0,publicTrust:0,policyConsistency:0};
          const fired = new Set<string>();
          let rounds = 0;
          while (state.phase === 'campaign') {
            rounds++;
            expect(rounds).toBeLessThanOrEqual(12);
            expect(state.activeEvent).not.toBeNull();
            const event = content.events.find((e) => e.id === state.activeEvent?.eventId)!;
            expect(fired.has(event.id)).toBe(false);
            fired.add(event.id);
            const choice = event.choices.find((c) => !choiceBlocker(state,content,c));
            expect(choice).toBeDefined();
            const result = resolveEvent(state,content,choice!.id,state.revision);
            if (!result.ok) throw new Error(result.reason);
            state=result.state;
            const next = endRound(state,content,state.revision);
            if (!next.ok) throw new Error(next.reason);
            state=next.state;
          }
          expect(state.phase).toBe('ended');
          expect(state.calendar.at(-1)?.endDate).toBe('2026-11-27');
          expect(state).not.toHaveProperty('electionResult');
          expect(state).not.toHaveProperty('winner');
        }
      }
    }
    expect(count).toBe(12);
  });
});

import { simulatedPoll } from '../../src/engine/poll.ts';
it('選前11/10天有明示模擬觀測，9天以後與終局無數字', () => {
  const content = loadContent();
  for (const [date, visible] of [['2026-11-17',true],['2026-11-18',true],['2026-11-19',false],['2026-11-27',false]] as const) {
    const state = createNewGame(content,{districtId:'taipei',candidacyId:'2026-taipei-shen-po-yang',seed:'poll',startDate:date});
    const poll = simulatedPoll(state,content);
    expect(poll !== null).toBe(visible);
    expect(simulatedPoll(state,content)).toEqual(poll);
    if (poll) expect(poll.rows.reduce((sum,r) => sum+r.percent, poll.undecided)).toBeCloseTo(100);
    expect(simulatedPoll({...state,phase:'ended'},content)).toBeNull();
  }
});
