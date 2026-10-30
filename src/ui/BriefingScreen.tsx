import { PollPanel } from './PollPanel.tsx';
import { NewsPanel } from './NewsPanel.tsx';
import type { ContentBundle } from '../content/schema.ts';
import { assessPolicy, type FramingAngle } from '../content/assess.ts';
import { ACTIONS, EXPOSURE_COSTS } from '../engine/config.ts';
import type { ExposureStatus, GameState, ResourceKey } from '../engine/types.ts';
import { ResultsScreen } from './ResultsScreen.tsx';
import { PolicyCard } from './PolicyCard.tsx';
import { EventCard } from './EventCard.tsx';
import { StrategyCard } from './StrategyCard.tsx';
import { RESOURCE_LABELS, STAGE_LABELS, formatDelta } from './labels.ts';

type ExposureChoice = Exclude<ExposureStatus, 'pending' | 'internal'>;

interface Props {
  content: ContentBundle;
  game: GameState;
  notice: string | null;
  onAction: (actionId: string, revision: number) => void;
  onExposure: (policyId: string, status: ExposureChoice, angle: FramingAngle | null, revision: number) => void;
  onEventChoice: (choiceId: string, revision: number) => void;
  onEndRound: (revision: number) => void;
  onRestart: () => void;
  onReplay: () => void;
}

function unaffordableReason(game: GameState, cost: { actionPoints: number; funds: number }): string | null {
  if (game.actionPoints < cost.actionPoints) return '行動點不足';
  if (game.resources.funds < cost.funds) return '經費不足';
  return null;
}

function candidacyName(content: ContentBundle, candidacyId: string): string {
  const candidacy = content.candidacies.find((c) => c.id === candidacyId);
  const person = content.people.find((p) => p.id === candidacy?.personId);
  return person?.name ?? candidacyId;
}

export function BriefingScreen({ content, game, notice, onAction, onExposure, onEventChoice, onEndRound, onRestart, onReplay }: Props) {
  const span = game.calendar[game.round - 1];
  const recent = game.decisions.slice(-5).reverse();
  const district = content.districts.find((d) => d.id === game.districtId);

  if (game.phase !== 'campaign') {
    return <ResultsScreen content={content} game={game} notice={notice} onRestart={onRestart} onReplay={onReplay} />;
  }

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">
          {district?.name ?? game.districtId}・{candidacyName(content, game.candidacyId)} 競選辦公室
        </p>
        <h1>
          第 {game.round} 回合：{span ? STAGE_LABELS[span.stage] : ''}
        </h1>
        {span && (
          <p className="dates">
            {span.startDate === span.endDate ? span.startDate : `${span.startDate} 至 ${span.endDate}`}
            ・本局日期基準 {game.calendar[0]?.startDate}（臺灣）・資料截至 {game.dataAsOf}
            {game.dataMode === 'preview' && '・預覽資料（名單未公告、來源待審閱）'}
          </p>
        )}
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <PollPanel content={content} game={game} />
      <NewsPanel content={content} districtId={game.districtId} />
      <EventCard content={content} game={game} onChoose={onEventChoice} />

      <p className="cost">最多12份簡報，目標15分鐘內；每日一個主要事件，日期區間中的平靜日已壓縮。結尾停在選前之夜，民調觀測到選前第十天為止，不提供開票預測。</p>
      <section className="card" aria-labelledby="resources-title">
        <h2 id="resources-title">辦公室狀態（模擬）</h2>
        <dl className="resources">
          {(Object.keys(RESOURCE_LABELS) as ResourceKey[]).filter((key) => key !== 'publicTrust').map((key) => (
            <div key={key}>
              <dt>{RESOURCE_LABELS[key]}</dt>
              <dd>{game.resources[key]}</dd>
            </div>
          ))}
          <div>
            <dt>剩餘行動點</dt>
            <dd data-testid="action-points">{game.actionPoints}</dd>
          </div>
        </dl>
      </section>

      <details className="card" open={!content.releaseScope}><summary>選用：安排行動</summary>
      <section aria-labelledby="actions-title">
        <h2 id="actions-title">安排行動</h2>
        <ul className="actions">
          {ACTIONS.map((action) => {
            const reason = unaffordableReason(game, action.cost);
            return (
              <li key={action.id} className="card">
                <h3>{action.label}</h3>
                <p>{action.description}</p>
                <p className="cost">
                  成本：{action.cost.actionPoints} 行動點、{action.cost.funds} 萬元
                </p>
                <button
                  type="button"
                  disabled={reason !== null}
                  aria-describedby={reason ? `${action.id}-reason` : undefined}
                  onClick={() => onAction(action.id, game.revision)}
                >
                  執行{action.label}
                </button>
                {reason && (
                  <p id={`${action.id}-reason`} className="cost">
                    無法執行：{reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      </details>
      <details className="card" open={!content.releaseScope}><summary>選用：政見策略室與對手資料</summary>
      <section aria-labelledby="folder-title">
        <h2 id="folder-title">政見策略室</h2>
        <p className="cost">
          評估每項政見該大張旗鼓、圓滑包裝、吞下去還是先擱著。包裝只改變強調重點，引用的仍是來源原文；
          政見內容、對象、金額與期限不會因此改變。
        </p>
        {game.campaign.length === 0 ? (
          <p className="card">目前沒有可安排的已審閱政見。</p>
        ) : (
          <ul className="actions">
            {game.campaign.map((entry) => {
              const policy = content.policies.find((p) => p.id === entry.policyId);
              if (!policy) return null;
              return (
                <li key={entry.policyId}>
                  <StrategyCard
                    content={content}
                    policy={policy}
                    assessment={assessPolicy(content, policy, game.opponentCandidacyIds)}
                    entry={entry}
                    canAfford={(status) => unaffordableReason(game, EXPOSURE_COSTS[status]) === null}
                    onChoose={(status, angle) => onExposure(entry.policyId, status, angle, game.revision)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {game.opponentCandidacyIds.map((opponentId) => {
          const policies = content.policies.filter((p) => p.candidacyId === opponentId && p.timeframe === 'current');
          return (
            <details key={opponentId} className="card">
              <summary>對手政見：{candidacyName(content, opponentId)}</summary>
              {policies.length === 0 ? (
                <p>尚未取得可核對的公開主張。</p>
              ) : (
                policies.map((policy) => <PolicyCard key={policy.id} content={content} policy={policy} />)
              )}
            </details>
          );
        })}
      </section>

      </details>
      <button
        type="button"
        className="primary"
        disabled={game.activeEvent !== null}
        aria-describedby={game.activeEvent ? 'end-round-reason' : undefined}
        onClick={() => onEndRound(game.revision)}
      >
        結束本回合
      </button>
      {game.activeEvent && (
        <p id="end-round-reason" className="cost">
          本回合還有待處理的事件，請先在上方做出決定。
        </p>
      )}

      <section className="card" aria-labelledby="log-title">
        <h2 id="log-title">選戰紀錄</h2>
        {recent.length === 0 ? (
          <p>尚無紀錄。</p>
        ) : (
          <ol className="log">
            {recent.map((d) => (
              <li key={d.id}>
                第 {d.round} 回合・{d.summary}
                {Object.entries(d.resourceDelta)
                  .filter(([k, v]) => k !== 'publicTrust' && v !== 0)
                  .map(([k, v]) => `｜${RESOURCE_LABELS[k as ResourceKey]} ${formatDelta(v)}`)
                  .join('')}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
