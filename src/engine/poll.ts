import type { ContentBundle } from '../content/schema.ts';
import type { GameState } from './types.ts';
import { pollVisible } from './calendar.ts';
import { nextFloat, seedRng } from './rng.ts';

/** 玩具觀測模型，非抽樣調查、非真實支持率；不產生或推導投票結果。 */
export function simulatedPoll(state: GameState, content: ContentBundle) {
  const date = state.calendar[state.round - 1]?.endDate;
  const election = content.elections.find((e) => e.id === content.districts.find((d) => d.id === state.districtId)?.electionId);
  if (state.phase !== 'campaign' || !date || !election || !pollVisible(date, election.electionDate)) return null;
  let rng = seedRng(`${state.seed}/poll/${date}`);
  const ids = [state.candidacyId, ...state.opponentCandidacyIds];
  const weights = ids.map((id) => {
    const [noise, next] = nextFloat(rng); rng = next;
    return { id, value: Math.max(0.01, (state.hidden.support[id] ?? 0) + (noise - .5) * .06) };
  });
  const total = weights.reduce((sum, row) => sum + row.value, state.hidden.undecided);
  return { date, rows: weights.map((row) => ({ candidacyId: row.id, percent: row.value / total * 100 })), undecided: state.hidden.undecided / total * 100 };
}
