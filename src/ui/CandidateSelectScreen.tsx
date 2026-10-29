import { activeCandidacies, assessDistrict, isPolicyUsable, policiesFor } from '../content/query.ts';
import type { ContentBundle, District } from '../content/schema.ts';
import { CANDIDACY_STATUS_LABELS, DISTRICT_STATUS_LABELS } from './labels.ts';

interface Props {
  content: ContentBundle;
  district: District;
  onSelect: (candidacyId: string) => void;
  onBack: () => void;
}

export function CandidateSelectScreen({ content, district, onSelect, onBack }: Props) {
  const candidacies = activeCandidacies(content, district.id);
  const playability = assessDistrict(content, district);
  const playable = district.status === 'playable' && playability.playable;

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">第二步・{district.name}</p>
        <h1>選擇要輔佐的候選人</h1>
        <p className="dates">
          {district.office}・{playable ? '可遊玩' : DISTRICT_STATUS_LABELS[district.status]}
          {district.dataAsOf && `・資料截至 ${district.dataAsOf}`}
        </p>
      </header>

      {!playable && (
        <section className="notice" aria-labelledby="progress-title">
          <h2 id="progress-title">此縣市尚不可玩</h2>
          <ul>
            {(playability.reasons.length > 0 ? playability.reasons : ['資料尚未發布']).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      )}

      {candidacies.length === 0 ? (
        <p className="card">尚未建立候選人名單。名單以選務機關公告為準，不提供假名或補造資料。</p>
      ) : (
        <ul className="actions">
          {candidacies.map((candidacy) => {
            const person = content.people.find((p) => p.id === candidacy.personId);
            const policies = policiesFor(content, candidacy.id).filter((p) => p.timeframe === 'current');
            const usable = policies.filter((p) => isPolicyUsable(content, p)).length;
            return (
              <li key={candidacy.id} className="card">
                <h3>
                  {candidacy.ballotNumber && `${candidacy.ballotNumber} 號・`}
                  {person?.name ?? candidacy.personId}
                </h3>
                <p className="cost">
                  {candidacy.party}・{CANDIDACY_STATUS_LABELS[candidacy.status]}
                </p>
                <p className="cost">
                  當次政見：已審閱 {usable} 項／已蒐集 {policies.length} 項
                </p>
                <button type="button" onClick={() => onSelect(candidacy.id)}>
                  查看{person?.name ?? ''}的資料
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" onClick={onBack}>
        返回選擇縣市
      </button>
    </main>
  );
}
