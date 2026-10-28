import { activeCandidacies, assessDistrict, policiesFor } from '../content/query.ts';
import type { Candidacy, ContentBundle, District } from '../content/schema.ts';
import { CitationList, PolicyCard } from './PolicyCard.tsx';
import { CANDIDACY_STATUS_LABELS } from './labels.ts';

interface Props {
  content: ContentBundle;
  district: District;
  candidacy: Candidacy;
  notice: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

function CandidacyPolicies({ content, candidacy }: { content: ContentBundle; candidacy: Candidacy }) {
  const current = policiesFor(content, candidacy.id).filter((p) => p.timeframe === 'current');
  const historical = policiesFor(content, candidacy.id).filter((p) => p.timeframe === 'historical');
  return (
    <>
      {current.length === 0 ? (
        <p>尚未取得可核對的公開主張。</p>
      ) : (
        current.map((policy) => <PolicyCard key={policy.id} content={content} policy={policy} />)
      )}
      {historical.length > 0 && (
        <details>
          <summary>歷史立場（非本次政見）</summary>
          {historical.map((policy) => (
            <PolicyCard key={policy.id} content={content} policy={policy} />
          ))}
        </details>
      )}
    </>
  );
}

export function ConfirmScreen({ content, district, candidacy, notice, onConfirm, onBack }: Props) {
  const person = content.people.find((p) => p.id === candidacy.personId);
  const opponents = activeCandidacies(content, district.id).filter((c) => c.id !== candidacy.id);
  const playability = assessDistrict(content, district);
  const playable = district.status === 'playable' && playability.playable;

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">第三步・{district.name}</p>
        <h1>{person?.name ?? candidacy.personId}</h1>
        <p className="dates">
          {candidacy.party}・{CANDIDACY_STATUS_LABELS[candidacy.status]}
        </p>
      </header>

      <section className="card" aria-labelledby="nature-title">
        <h2 id="nature-title">資料性質</h2>
        <p>
          候選人與政見為真實公開資料，每項都附出處。競選辦公室的內部對話、資源、民調變化與選舉結果為遊戲模擬，
          不代表真人的實際決策，也不是選舉預測。你在遊戲中的宣傳安排不會改變任何候選人的真實政見。
        </p>
        <p className="cost">資料截至 {district.dataAsOf ?? '未標示'}</p>
      </section>

      <section className="card" aria-labelledby="status-title">
        <h2 id="status-title">參選資格來源</h2>
        <CitationList content={content} citations={candidacy.statusCitations} />
      </section>

      {person && person.background.length > 0 && (
        <section className="card" aria-labelledby="bg-title">
          <h2 id="bg-title">公開履歷</h2>
          {person.background.map((item, i) => (
            <details key={i}>
              <summary>{item.text}</summary>
              <CitationList content={content} citations={[item.citation]} />
            </details>
          ))}
        </section>
      )}

      <section className="card" aria-labelledby="ours-title">
        <h2 id="ours-title">本次政見</h2>
        <CandidacyPolicies content={content} candidacy={candidacy} />
      </section>

      {opponents.map((opponent) => {
        const name = content.people.find((p) => p.id === opponent.personId)?.name ?? opponent.personId;
        return (
          <section key={opponent.id} className="card" aria-labelledby={`opp-${opponent.id}`}>
            <h2 id={`opp-${opponent.id}`}>
              同選區對手：{name}（{opponent.party}）
            </h2>
            <CandidacyPolicies content={content} candidacy={opponent} />
          </section>
        );
      })}

      <div className="button-row">
        <button type="button" className="primary" disabled={!playable} onClick={onConfirm}>
          確認輔佐並開始
        </button>
        <button type="button" onClick={onBack}>
          返回候選人名單
        </button>
      </div>
      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}
      {!playable && <p className="cost">此縣市資料尚未達到可玩門檻，目前僅供查閱。</p>}
    </main>
  );
}
