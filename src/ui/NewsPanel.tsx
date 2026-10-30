import { newsVisibleInGame } from '../content/newsVisibility.ts';
import type { GameState } from '../engine/types.ts';
import type { ContentBundle } from '../content/schema.ts';

export function NewsPanel({ content, districtId, game }: { content: ContentBundle; districtId?: string; game?: GameState }) {
  const news = content.news;
  if (!news) return <p className="cost">新聞更新尚未載入，仍可使用內建資料遊玩。</p>;
  const visible = newsVisibleInGame(content, game);
  const items = districtId ? visible.filter((n) => n.districtIds.includes(districtId)) : visible;
  return <details className="card"><summary>新聞{game ? '本局快照' : news.updateMode === 'hourly' ? '每小時更新' : '快照'}與資料狀態（{items.length} 則）</summary>
    <p>來源：<a href={news.sourceUrl} target="_blank" rel="noreferrer">中央社政治 RSS</a>。{game ? `本局建立時為${news.updateMode === 'hourly' ? '每小時擷取' : '僅快照'}模式，這份來源已固定；新局資料與服務更新狀態以開始頁為準。` : news.updateMode === 'hourly' ? '本地服務每60分鐘嘗試擷取；失敗時保留上次成功資料。' : '目前是快照模式，不會自動擷取新消息。需由維運端另行開啟更新服務。'}</p>
    <p>最後成功：{news.lastSuccessAt ?? '尚未成功'}（UTC）・最後嘗試：{news.lastAttemptAt ?? '無'}。</p>
    <p>狀態：{news.status === 'stale' ? '更新失敗，沿用最後成功快照' : news.status === 'empty' ? '本次無相關消息' : '快照可用'}・版本：{news.version}。</p>
    <p>本局固定快照；開始新局才使用新資料。只保存新聞標題與連結，關鍵字映射可能有誤；報導中的指控與推論不可當成既定事實。</p>
    {visible.length < news.items.length && <p>已到民調顯示截止後，含民調或選情比較的新聞標題不在遊戲內顯示；不把標題當成真實支持率。</p>}
    <ul>{items.map((n) => <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a><p className="cost">{n.publisher}・發布 {n.publishedAt}・關聯人物：{n.personNames.join('、') || '依城市關鍵字'}</p></li>)}</ul>
  </details>;
}
