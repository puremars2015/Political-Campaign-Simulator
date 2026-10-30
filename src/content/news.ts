import { newsSnapshotSchema, type ContentBundle, type NewsSnapshot, eventSchema } from './schema.ts';

/** 新聞只改變本局查核議程；不從標題推論候選人行為、立場或真實支持率。 */
export function withNews(base: ContentBundle, raw: unknown): ContentBundle {
  const news = newsSnapshotSchema.parse(raw);
  const unique = [...new Map(news.items.map((item) => [item.id, item])).values()];
  const snapshot: NewsSnapshot = { ...news, items: unique };
  const events = base.events.filter((e) => !e.id.startsWith('news-'));
  for (const district of base.districts.filter((d) => d.kind === 'municipality')) {
    const items = unique.filter((n) => n.districtIds.includes(district.id));
    if (!items.length) continue;
    events.push(eventSchema.parse({
      id: `news-${district.id}-${news.version}`,
      districtIds: [district.id], title: `${district.name}新聞查核簡報`,
      body: `本局新聞快照有 ${items.length} 則與本市或收錄人物關鍵字相關的報導。請先查閱來源；標題中的說法與指控不代表已核實事實。以下是虛構的辦公室工作安排，不是報導內容的事實結論。`,
      priority: 100, window: { fromRound: 1, toRound: 12 }, once: true, binding: 'none',
      choices: [
        { id: 'verify', label: '安排來源查核', knownCost: '1 行動點；遊戲中的政策一致性提升 2，不改動真實資料。',
          cost: { actionPoints: 1, funds: 0 }, effects: [{ kind: 'resource', key: 'policyConsistency', delta: 2 }] },
        { id: 'read', label: '閱讀並保留未知', knownCost: '零成本；不替未知消息下結論。',
          cost: { actionPoints: 0, funds: 0 }, effects: [] },
      ],
    }));
  }
  const baseVersion = base.contentVersion.split('+news-')[0];
  return { ...base, contentVersion: `${baseVersion}+news-${news.version}`, news: snapshot, events };
}
