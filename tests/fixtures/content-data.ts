/**
 * 測試專用資料：只用於單元測試與 e2e 建置（vite --mode e2e），不會進入正式內容。
 * 人物、縣市與來源皆為明確標示的測試資料，不代表任何真實候選人或政見。
 */
import type { ContentBundleInput } from '../../src/content/schema.ts';

const cite = (sourceId: string, quote: string) => ({
  sourceId,
  quote,
  locator: { kind: 'quote' as const, value: quote },
});

const unstated = { stated: null };
const noFields = { tool: unstated, scale: unstated, funding: unstated, deadline: unstated };

export const rawContent = {
  contentVersion: 'test-fixture',
  elections: [
    {
      id: 'test-election',
      name: '測試選舉（測試資料）',
      electionDate: '2026-11-28',
      citations: [cite('src-election', '測試投票日')],
    },
  ],
  districts: [
    {
      id: 'test-city',
      name: '測試市（測試資料）',
      kind: 'municipality',
      office: '測試市長',
      electionId: 'test-election',
      status: 'playable',
      dataAsOf: '2026-10-01',
      regions: [{ id: 'north', name: '北區', citations: [cite('src-election', '北區')] }],
      simulation: { undecided: 0.3 },
    },
    {
      id: 'draft-city',
      name: '未完成市（測試資料）',
      kind: 'county',
      office: '未完成市長',
      electionId: 'test-election',
      status: 'collecting',
    },
  ],
  people: [
    {
      id: 'tester-a',
      name: '測試候選人甲',
      background: [{ text: '測試用履歷', citation: cite('src-a', '測試用履歷') }],
      simulation: { personality: ['謹慎'], priorities: ['交通'], nonNegotiables: [], reviewed: true },
    },
    {
      id: 'tester-b',
      name: '測試候選人乙',
      simulation: { personality: ['積極'], priorities: ['住宅'], nonNegotiables: [], reviewed: true },
    },
  ],
  candidacies: [
    {
      id: 'cand-a',
      personId: 'tester-a',
      electionId: 'test-election',
      districtId: 'test-city',
      office: '測試市長',
      party: '測試黨',
      ballotNumber: 1,
      status: 'certified',
      statusCitations: [cite('src-election', '1號 測試候選人甲')],
      simulation: { baselineSupport: 0.4, startingFunds: 800 },
    },
    {
      id: 'cand-b',
      personId: 'tester-b',
      electionId: 'test-election',
      districtId: 'test-city',
      office: '測試市長',
      party: '無黨籍',
      ballotNumber: 2,
      status: 'certified',
      statusCitations: [cite('src-election', '2號 測試候選人乙')],
      simulation: { baselineSupport: 0.3, startingFunds: 600 },
    },
  ],
  policies: [
    {
      id: 'a-transit',
      candidacyId: 'cand-a',
      electionId: 'test-election',
      districtId: 'test-city',
      issue: '交通',
      summary: '測試政見：增加公車班次',
      citations: [cite('src-a', '增加公車班次')],
      fields: { ...noFields, tool: { stated: '公車路網調整', citation: cite('src-a', '公車路網調整') } },
      timeframe: 'current',
    },
    {
      id: 'a-housing',
      candidacyId: 'cand-a',
      electionId: 'test-election',
      districtId: 'test-city',
      issue: '住宅',
      summary: '測試政見：興建社會住宅',
      citations: [cite('src-a', '興建社會住宅')],
      fields: noFields,
      timeframe: 'current',
    },
    {
      id: 'a-parks',
      candidacyId: 'cand-a',
      electionId: 'test-election',
      districtId: 'test-city',
      issue: '公園',
      summary: '測試政見：增設公園（來源待審閱）',
      citations: [cite('src-pending', '增設公園')],
      fields: noFields,
      timeframe: 'current',
    },
    {
      id: 'a-old',
      candidacyId: 'cand-a',
      electionId: 'test-election',
      districtId: 'test-city',
      issue: '交通',
      summary: '測試歷史立場',
      citations: [cite('src-a', '過去立場')],
      fields: noFields,
      timeframe: 'historical',
    },
    {
      id: 'b-housing',
      candidacyId: 'cand-b',
      electionId: 'test-election',
      districtId: 'test-city',
      issue: '住宅',
      summary: '測試政見：租金補貼',
      citations: [cite('src-b', '租金補貼')],
      fields: noFields,
      timeframe: 'current',
    },
  ],
  sources: [
    {
      id: 'src-election',
      url: 'https://example.org/test/election',
      title: '測試公告',
      publisher: '測試機關',
      retrievedAt: '2026-10-01',
      nature: 'election-authority',
      verification: 'reviewed',
    },
    {
      id: 'src-a',
      url: 'https://example.org/test/a',
      title: '測試候選人甲政見',
      publisher: '測試候選人甲',
      retrievedAt: '2026-10-01',
      nature: 'candidate-official',
      verification: 'reviewed',
    },
    {
      id: 'src-b',
      url: 'https://example.org/test/b',
      title: '測試候選人乙政見',
      publisher: '測試候選人乙',
      retrievedAt: '2026-10-01',
      nature: 'candidate-official',
      verification: 'reviewed',
    },
    {
      id: 'src-pending',
      url: 'https://example.org/test/pending',
      title: '待審閱來源',
      publisher: '測試媒體',
      retrievedAt: '2026-10-01',
      nature: 'media',
      verification: 'pending-review',
    },
  ],
  events: [
    {
      id: 'test-event',
      title: '測試事件',
      body: '測試事件內容',
      window: { fromRound: 2, toRound: 4 },
      choices: [
        { id: 'free', label: '零成本選項', knownCost: '無', cost: { actionPoints: 0, funds: 0 }, effects: [] },
        {
          id: 'paid',
          label: '付費選項',
          knownCost: '經費',
          cost: { actionPoints: 1, funds: 10 },
          effects: [{ kind: 'resource', key: 'morale', delta: 2 }],
        },
      ],
    },
  ],
} satisfies ContentBundleInput;
