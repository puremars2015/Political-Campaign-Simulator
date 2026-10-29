import type { ContentBundle, EventDefinition } from '../content/schema.ts';
import { choiceBlocker } from '../engine/events.ts';
import type { GameState } from '../engine/types.ts';
import { PolicyCard } from './PolicyCard.tsx';

interface Props {
  content: ContentBundle;
  game: GameState;
  onChoose: (choiceId: string, revision: number) => void;
}

function candidacyName(content: ContentBundle, candidacyId: string): string {
  const candidacy = content.candidacies.find((c) => c.id === candidacyId);
  return content.people.find((p) => p.id === candidacy?.personId)?.name ?? candidacyId;
}

/** 把事件敘述中的佔位字換成議題與對手姓名；不寫入任何主張 */
function renderBody(content: ContentBundle, game: GameState, event: EventDefinition): string {
  const binding = game.activeEvent?.binding;
  const topic = content.topics.find((t) => t.id === binding?.topicId)?.name ?? '';
  const opponentPolicy = content.policies.find((p) => p.id === binding?.opponentPolicyId);
  const opponent = opponentPolicy
    ? candidacyName(content, opponentPolicy.candidacyId)
    : game.opponentCandidacyIds.map((id) => candidacyName(content, id)).join('、');
  return event.body.replaceAll('{topic}', topic).replaceAll('{opponent}', opponent);
}

/** 決策卡：情境、綁定的真實政見原文、選項與已知代價（計畫 6） */
export function EventCard({ content, game, onChoose }: Props) {
  const active = game.activeEvent;
  const event = active && content.events.find((e) => e.id === active.eventId);
  if (!active || !event) return null;
  const ours = content.policies.find((p) => p.id === active.binding?.ourPolicyId);
  const theirs = content.policies.find((p) => p.id === active.binding?.opponentPolicyId);

  return (
    <section className="card event" aria-labelledby="event-title">
      <p className="eyebrow">本回合事件・模擬情境</p>
      <h2 id="event-title">{event.title}</h2>
      <p>{renderBody(content, game, event)}</p>

      {ours && (
        <details open>
          <summary>我方相關政見</summary>
          <PolicyCard content={content} policy={ours} />
        </details>
      )}
      {theirs && (
        <details>
          <summary>對手相關政見：{candidacyName(content, theirs.candidacyId)}</summary>
          <PolicyCard content={content} policy={theirs} />
        </details>
      )}

      <ul className="choices">
        {event.choices.map((choice) => {
          const blocker = choiceBlocker(game, content, choice);
          return (
            <li key={choice.id}>
              <button
                type="button"
                disabled={blocker !== null}
                aria-describedby={`choice-${choice.id}-cost`}
                onClick={() => onChoose(choice.id, game.revision)}
              >
                {choice.label}
              </button>
              <p id={`choice-${choice.id}-cost`} className="cost">
                {blocker ? `無法選擇：${blocker}` : `已知代價：${choice.knownCost}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
