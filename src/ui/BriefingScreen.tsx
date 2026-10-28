import { ACTIONS } from '../engine/config.ts';
import type { GameState, ResourceKey } from '../engine/types.ts';
import { RESOURCE_LABELS, STAGE_LABELS, formatDelta } from './labels.ts';

interface Props {
  game: GameState;
  candidateName: string;
  districtName: string;
  notice: string | null;
  onAction: (actionId: string, revision: number) => void;
  onEndRound: (revision: number) => void;
  onRestart: () => void;
}

function unaffordableReason(game: GameState, cost: { actionPoints: number; funds: number }): string | null {
  if (game.actionPoints < cost.actionPoints) return '行動點不足';
  if (game.resources.funds < cost.funds) return '經費不足';
  return null;
}

export function BriefingScreen({ game, candidateName, districtName, notice, onAction, onEndRound, onRestart }: Props) {
  const span = game.calendar[game.round - 1];
  const recent = game.decisions.slice(-5).reverse();

  if (game.phase !== 'campaign') {
    return (
      <main className="screen">
        <h1>投票日</h1>
        <p className="card">十二個回合結束了。投票模型、開票與結局回顧將在 M2 實作。</p>
        <button type="button" className="primary" onClick={onRestart}>
          開始新的一局
        </button>
      </main>
    );
  }

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">
          {districtName}・{candidateName}
        </p>
        <h1>
          第 {game.round} 回合：{span ? STAGE_LABELS[span.stage] : ''}
        </h1>
        {span && (
          <p className="dates">
            {span.startDate === span.endDate ? span.startDate : `${span.startDate} 至 ${span.endDate}`}
          </p>
        )}
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}

      <section className="card" aria-labelledby="resources-title">
        <h2 id="resources-title">辦公室狀態</h2>
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
