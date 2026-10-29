import type { ContentBundle } from '../content/schema.ts';
import { assessPolicy, type FramingAngle } from '../content/assess.ts';
import { ACTIONS, EXPOSURE_COSTS } from '../engine/config.ts';
import type { ExposureStatus, GameState, ResourceKey } from '../engine/types.ts';
import { PolicyCard } from './PolicyCard.tsx';
import { StrategyCard } from './StrategyCard.tsx';
import { RESOURCE_LABELS, STAGE_LABELS, formatDelta } from './labels.ts';

type ExposureChoice = Exclude<ExposureStatus, 'pending' | 'internal'>;

interface Props {
  content: ContentBundle;
  game: GameState;
  notice: string | null;
  onAction: (actionId: string, revision: number) => void;
  onExposure: (policyId: string, status: ExposureChoice, angle: FramingAngle | null, revision: number) => void;
  onEndRound: (revision: number) => void;
  onRestart: () => void;
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

export function BriefingScreen({ content, game, notice, onAction, onExposure, onEndRound, onRestart }: Props) {
  const span = game.calendar[game.round - 1];
  const recent = game.decisions.slice(-5).reverse();
  const district = content.districts.find((d) => d.id === game.districtId);

  if (game.phase !== 'campaign') {
    return (
      <main className="screen">
        <h1>投票日</h1>
        <p className="card">十二個回合結束了。投票模型、開票與結局回顧將在 M2 實作。</p>
        <button type="button" className="primary" onClick={onRestart}>
          重新選擇縣市與候選人
        </button>
      </main>
    );
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
            ・資料截至 {game.dataAsOf}
            {game.dataMode === 'preview' && '・預覽資料（名單未公告、來源待審閱）'}
          </p>
        )}
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="card" aria-labelledby="resources-title">
        <h2 id="resources-title">辦公室狀態（模擬）</h2>
        <dl className="resources">
          {(Object.keys(RESOURCE_LABELS) as ResourceKey[]).map((key) => (
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

      <button type="button" className="primary" onClick={() => onEndRound(game.revision)}>
        結束本回合
      </button>

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
                  .filter(([, v]) => v !== 0)
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
