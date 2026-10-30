import type { ContentBundle } from '../content/schema.ts';
import type { GameState } from '../engine/types.ts';
import { simulatedPoll } from '../engine/poll.ts';
export function PollPanel({ content, game }: { content: ContentBundle; game: GameState }) {
  const poll = simulatedPoll(game, content);
  if (!poll) return <p className="cost">已進入選前最後九天或故事收尾，不提供民調數字。</p>;
  return <details className="card"><summary>模擬民調觀測・{poll.date}</summary>
    <p>純遊戲資料，由中性起始參數加入最多正負三個百分點的權重擾動後正規化。未進行真實抽樣，不是實際民調、統計誤差或選舉預測；不估算投票結果。</p>
    <ul>{poll.rows.map((row) => <li key={row.candidacyId}>{content.people.find((p) => p.id === content.candidacies.find((c) => c.id === row.candidacyId)?.personId)?.name}：{row.percent.toFixed(1)}%</li>)}<li>未表態：{poll.undecided.toFixed(1)}%</li></ul>
    <p>本次數字固定，不因重開面板重新抽取；到選前第十天為止，之後整個面板停止顯示數字。</p>
  </details>;
}
