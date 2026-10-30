import type { ContentBundle } from '../content/schema.ts';

export function NewsPanel({ content, districtId }: { content: ContentBundle; districtId?: string }) {
  const news = content.news;
  if (!news) return <p className="cost">新聞更新尚未載入，仍可使用內建資料遊玩。</p>;
  const items = districtId ? news.items.filter((n) => n.districtIds.includes(districtId)) : news.items;
  return <details className="card"><summary>新聞資料與更新狀態（{items.length} 則）</summary>
    <p>來源：<a href={news.sourceUrl} target="_blank" rel="noreferrer">中央社政治 RSS</a>。每 60 分鐘檢查一次；需維運端啟用擷取排程，瀏覽器本身不會替伺服器更新資料。</p>
    <p>最後成功：{news.lastSuccessAt ?? '尚未成功'}（UTC）・最後嘗試：{news.lastAttemptAt ?? '無'}。</p>
    <p>狀態：{news.status === 'stale' ? '更新失敗，沿用最後成功快照' : news.status === 'empty' ? '本次無相關消息' : '快照可用'}・版本：{news.version}。</p>
    <p>本局固定快照；開始新局才使用新資料。只保存新聞標題與連結，關鍵字映射可能有誤；報導中的指控與推論不可當成既定事實。</p>
    <ul>{items.map((n) => <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a><p className="cost">{n.publisher}・發布 {n.publishedAt}・關聯人物：{n.personNames.join('、') || '依城市關鍵字'}</p></li>)}</ul>
  </details>;
}
