import type { ContentBundle, NewsSnapshot } from './schema.ts';
import type { GameState } from '../engine/types.ts';
import { pollVisible, taipeiToday } from '../engine/calendar.ts';

/** 標題只是資料；此分類不判斷報導真假，也不推論候選人選情。 */
export const isPollingHeadline = (title: string): boolean => /民調|支持率|支持度|看好度|勝率|誤差範圍|領先|落後/.test(title);

export function newsVisibleInGame(content: ContentBundle, game?: GameState): NewsSnapshot['items'] {
  const items = content.news?.items ?? [];
  const electionId = game ? content.districts.find((d) => d.id === game.districtId)?.electionId : content.elections[0]?.id;
  const election = content.elections.find((e) => e.id === electionId);
  const date = game?.calendar[game.round - 1]?.endDate ?? taipeiToday();
  const allowed = game?.phase !== 'ended' && !!election && pollVisible(date, election.electionDate);
  return allowed ? items : items.filter((item) => !isPollingHeadline(item.title));
}
