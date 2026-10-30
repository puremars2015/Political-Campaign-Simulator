import { NewsPanel } from './NewsPanel.tsx';
import type { ContentBundle } from '../content/schema.ts';
import { EXPOSURE_LABELS } from '../engine/strategy.ts';
import type { GameState } from '../engine/types.ts';
import { PolicyCard } from './PolicyCard.tsx';

interface Props {
  content: ContentBundle; game: GameState; notice: string | null;
  onRestart: () => void; onReplay: () => void;
}

export function ResultsScreen({ content, game, notice, onRestart, onReplay }: Props) {
  return <main className="screen">
    <header><p className="eyebrow">{content.districts.find((d) => d.id === game.districtId)?.name}・{game.calendar.at(-1)?.endDate}</p>
      <h1>選前之夜</h1>
      <p>最後一份簡報已收進資料夾。辦公室的燈還亮著，明天人們會做出自己的選擇。至於結果——留待開票的那一刻。</p>
    </header>
    <p className="notice">故事在選前之夜結束。本版不產生票數、當選人或勝負。內部資源與對話都是遊戲敘事，不代表真實民調與真人決策。</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="card"><h2>團隊回顧（模擬）</h2>
      <p>團隊士氣 {game.resources.morale}／100・候選人信任 {game.resources.candidateTrust}／100・剩餘經費 {game.resources.funds} 萬元。</p>
      <p>{game.resources.morale >= 60 ? '團隊保有繼續合作的餘力。' : '密集的選戰讓團隊需要休息與重整。'}{game.resources.candidateTrust >= 60 ? '辦公室累積了協商空間。' : '後續合作仍需要建立信任。'}</p>
    </section>
    <section className="card"><h2>宣傳安排與選擇回顧</h2>
      <p>這些是本局的宣傳安排，並不代表真人增加、撤回或改變任何主張。未解決的工作與選擇都留在紀錄中。</p>
      {game.campaign.map((entry) => { const policy = content.policies.find((p) => p.id === entry.policyId); return policy && <details key={entry.policyId}><summary>{policy.issue}：{EXPOSURE_LABELS[entry.status]}</summary>
        <ol>{entry.history.map((h, i) => <li key={i}>第 {h.round} 份簡報：{EXPOSURE_LABELS[h.status]}{h.decisionId && `（決策 ${h.decisionId}）`}</li>)}</ol><PolicyCard content={content} policy={policy}/></details>; })}
      <p>{game.pendingEffects.length} 項後續工作尚未到期；故事在此收尾，不推算它們的選票影響。</p>
    </section>
    <NewsPanel content={content} districtId={game.districtId} game={game} />
    <details className="card"><summary>完整決策紀錄與重現資訊</summary><p>種子：{game.seed}・內容版本：{game.contentVersion}・本局起始：{game.calendar[0]?.startDate}（臺灣日期）。資料截至 {game.dataAsOf}。</p><ol>{game.decisions.map((d) => <li key={d.id}>{d.id}・第 {d.round} 份簡報：{d.summary}</li>)}</ol></details>
    <div className="button-row"><button type="button" onClick={onReplay}>相同日期與種子重新挑戰</button><button type="button" className="primary" onClick={onRestart}>重新選擇縣市與候選人</button></div>
  </main>;
}
