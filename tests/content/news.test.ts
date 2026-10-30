import { describe, expect, it } from 'vitest';
import { withNews } from '../../src/content/news.ts';
import { createNewGame, resolveEvent, endRound } from '../../src/engine/engine.ts';
import { createLocalSaveStore } from '../../src/storage/saveStore.ts';
import { loadContent } from '../../src/content/index.ts';
import { validateContent } from '../../src/content/validate.ts';
const base = loadContent();
function snapshot(version: string, day: string) {
  return { version, sourceUrl: 'https://feeds.feedburner.com/rsscna/politics', refreshMinutes: 60,
    lastAttemptAt: `${day}T03:00:00Z`, lastSuccessAt: `${day}T03:00:00Z`, status: 'ok',
    items: [{ id: `news-${version}`, title: '臺北市公開政策說明', url: 'https://www.cna.com.tw/news/aipl/202610300001.aspx', publisher: '中央社', publishedAt: `${day}T00:00:00Z`, districtIds: ['taipei'], personNames: [] }] };
}
describe('每日新聞快照', () => {
  it('兩日新局議程不同，同版本相同種子可重現；重複資料只產生一次事件', () => {
    const a = snapshot('day1', '2026-10-29');
    a.items.push(a.items[0]!);
    const first = withNews(base,a), second = withNews(base,snapshot('day2','2026-10-30'));
    expect(validateContent(first).ok).toBe(true);
    const options = { districtId:'taipei', candidacyId:'2026-taipei-shen-po-yang', seed:'daily' };
    const state = createNewGame(first, options);
    expect(createNewGame(first, options)).toEqual(state);
    expect(createNewGame(second, options).activeEvent).not.toEqual(state.activeEvent);
    expect(first.news?.items).toHaveLength(1);
    const resolved = resolveEvent(state,first,'read',state.revision);
    if (!resolved.ok) throw new Error(resolved.reason);
    expect(resolveEvent(resolved.state,first,'read',resolved.state.revision).ok).toBe(false);
    const advanced = endRound(resolved.state,first,resolved.state.revision);
    if (!advanced.ok) throw new Error(advanced.reason);
    expect(advanced.state.activeEvent?.eventId).not.toBe(state.activeEvent?.eventId);
  });
  it('更新後讀檔使用舊局內容快照，抓取失敗也可開局', () => {
    const a = withNews(base,snapshot('day1','2026-10-29'));
    const b = withNews(base,{...snapshot('day2','2026-10-30'),status:'stale'});
    const state = createNewGame(a,{ districtId:'taipei', candidacyId:'2026-taipei-shen-po-yang', seed:'save' });
    let value: string | null = null;
    const storage = { getItem:() => value, setItem:(_key: string, raw: string) => { value=raw; }, removeItem:() => { value=null; } };
    createLocalSaveStore(storage,a.contentVersion,() => new Date(),a).save(state);
    const restored = createLocalSaveStore(storage,b.contentVersion).load();
    expect(restored.status).toBe('ok');
    if (restored.status === 'ok') expect(restored.contentSnapshot).toEqual(a);
    expect(createNewGame(b,{ districtId:'taipei', candidacyId:'2026-taipei-shen-po-yang', seed:'stale' }).phase).toBe('campaign');
  });
});

import { newsVisibleInGame } from '../../src/content/newsVisibility.ts';
it('截止後與終局不經新聞標題繞道呈現民調；原快照保留供版本追溯', () => {
  const raw = snapshot('poll-test','2026-10-30');
  raw.items[0]!.title='臺北市長民調支持率55%';
  const content=withNews(base,raw);
  for (const [date, count] of [['2026-11-18',1],['2026-11-19',0],['2026-11-27',0]] as const) {
    const state=createNewGame(content,{districtId:'taipei',candidacyId:'2026-taipei-shen-po-yang',seed:'headline',startDate:date});
    expect(newsVisibleInGame(content,state)).toHaveLength(count);
    expect(newsVisibleInGame(content,{...state,phase:'ended'})).toHaveLength(0);
  }
  expect(content.news?.items).toHaveLength(1);
});
