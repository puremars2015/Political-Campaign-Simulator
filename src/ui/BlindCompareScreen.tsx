import { useMemo, useState } from 'react';
import { buildRounds, excludedCandidacies, normalizeText, primaryQuote, tally } from '../content/compare.ts';
import type { Comparison, ContentBundle, District } from '../content/schema.ts';
import { seedRng } from '../engine/rng.ts';
import { CitationList } from './PolicyCard.tsx';

interface Props {
  content: ContentBundle;
  district: District;
  comparison: Comparison;
  onBack: () => void;
}

type Phase = 'intro' | 'rounds' | 'important' | 'reveal';

function randomSeed(): number {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] ?? 0;
}

export function BlindCompareScreen({ content, district, comparison, onBack }: Props) {
  const [seed, setSeed] = useState(randomSeed);
  const rounds = useMemo(() => buildRounds(content, comparison, seedRng(seed)).rounds, [content, comparison, seed]);
  const [phase, setPhase] = useState<Phase>('intro');
  const [current, setCurrent] = useState(0);
  const [picks, setPicks] = useState<(string | null)[]>([]);
  const [important, setImportant] = useState<Set<string>>(new Set());

  const nameOf = (candidacyId: string) => {
    const candidacy = content.candidacies.find((c) => c.id === candidacyId);
    const person = content.people.find((p) => p.id === candidacy?.personId);
    return { name: person?.name ?? candidacyId, party: candidacy?.party ?? '' };
  };
  const excluded = excludedCandidacies(content, comparison);

  function restart() {
    setSeed(randomSeed());
    setPicks([]);
    setImportant(new Set());
    setCurrent(0);
    setPhase('rounds');
  }

  function choose(policyId: string | null) {
    const next = [...picks];
    next[current] = policyId;
    setPicks(next);
    if (current + 1 < rounds.length) setCurrent(current + 1);
    else setPhase('important');
  }

  if (phase === 'intro') {
    return (
      <main className="screen">
        <header>
          <p className="eyebrow">{district.name}・政見盲測</p>
          <h1>遮住名字，只比政見</h1>
        </header>
        <section className="card" aria-labelledby="how-title">
          <h2 id="how-title">怎麼玩</h2>
          <ol>
            <li>每一輪一個議題，列出候選人在這個議題的政見，遮住身分、打亂順序。</li>
            <li>在你最認同的一段蓋章，也可以跳過；跳過的題不計分。</li>
            <li>全部選完後標出對你特別重要的議題，再開票看每一段是誰提出的。</li>
          </ol>
          <p className="cost">
            本局 {rounds.length} 輪。姓名、黨名與會洩漏身分的字以「■■」遮蔽，「臺」統一寫成「台」；開票時顯示完整原文與出處。
          </p>
        </section>
        <section className="card" aria-labelledby="scope-title">
          <h2 id="scope-title">收錄範圍</h2>
          <p>
            目前只比較 {comparison.candidacyIds.map((id) => nameOf(id).name).join('、')}
            {excluded.length > 0 && (
              <>
                ；{excluded.map((id) => nameOf(id).name).join('、')} 尚未列入，這只代表本遊戲還沒收錄，不代表候選人沒有主張
              </>
            )}
            。
          </p>
          <p className="cost">
            資料截至 {district.dataAsOf ?? '未標示'}。來源尚在人工審閱中，開票時每段都會標示審閱狀態。
          </p>
        </section>
        <div className="button-row">
          <button type="button" className="primary" disabled={rounds.length === 0} onClick={() => setPhase('rounds')}>
            開始比政見
          </button>
          <button type="button" onClick={onBack}>
            返回
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'rounds') {
    const round = rounds[current];
    if (!round) return null;
    return (
      <main className="screen">
        <header>
          <p className="eyebrow">
            第 {current + 1}／{rounds.length} 輪
          </p>
          <h1>{round.topicName}</h1>
          {round.kind === 'signature' && <p className="dates">每位候選人各一段只有自己提出的議題。</p>}
        </header>
        <ul className="actions">
          {round.segments.map((segment, i) => (
            <li key={segment.policyId} className="card">
              <p className="eyebrow">第 {i + 1} 段</p>
              <p className="segment">{segment.maskedText}</p>
              <button type="button" onClick={() => choose(segment.policyId)}>
                蓋章：第 {i + 1} 段
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => choose(null)}>
          跳過這一輪
        </button>
      </main>
    );
  }

  if (phase === 'important') {
    return (
      <main className="screen">
        <header>
          <p className="eyebrow">開票前</p>
          <h1>哪些議題對你特別重要？</h1>
          <p className="dates">勾選的議題計 2 分，其餘 1 分；可以不勾。</p>
        </header>
        <fieldset className="card">
          <legend>重要議題</legend>
          {rounds.map((round) => (
            <label key={round.topicId} className="check">
              <input
                type="checkbox"
                checked={important.has(round.topicId)}
                onChange={(e) => {
                  const next = new Set(important);
                  if (e.target.checked) next.add(round.topicId);
                  else next.delete(round.topicId);
                  setImportant(next);
                }}
              />
              {round.topicName}
            </label>
          ))}
        </fieldset>
        <button type="button" className="primary" onClick={() => setPhase('reveal')}>
          開票
        </button>
      </main>
    );
  }

  const scores = tally(rounds, picks, important);
  const ranking = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className="screen">
      <header>
        <p className="eyebrow">{district.name}・開票</p>
        <h1>你蓋章的政見是誰提出的</h1>
      </header>
      <section className="card" aria-labelledby="score-title">
        <h2 id="score-title">計分</h2>
        <ol className="log">
          {ranking.map(([candidacyId, score]) => {
            const { name, party } = nameOf(candidacyId);
            return (
              <li key={candidacyId}>
                {name}（{party}）：{score} 分
              </li>
            );
          })}
        </ol>
        <p className="cost">這只反映你在本局抽到的議題中的選擇，不是選舉預測，也不代表候選人整體政見。</p>
      </section>

      {rounds.map((round, i) => {
        const absent = comparison.candidacyIds.filter((id) => !round.segments.some((s) => s.candidacyId === id));
        return (
          <section key={round.topicId} className="card" aria-labelledby={`reveal-${round.topicId}`}>
            <h2 id={`reveal-${round.topicId}`}>
              第 {i + 1} 輪・{round.topicName}
              {picks[i] === null || picks[i] === undefined ? '（跳過）' : ''}
            </h2>
            {round.segments.map((segment, j) => {
              const policy = content.policies.find((p) => p.id === segment.policyId);
              if (!policy) return null;
              const { name, party } = nameOf(segment.candidacyId);
              const stamped = picks[i] === segment.policyId;
              return (
                <article key={segment.policyId} className="policy">
                  <p className="eyebrow">
                    第 {j + 1} 段・{name}（{party}）{stamped && '・你蓋章的段落'}
                    {policy.origin === 'government-plan' && '・市府計畫'}
                  </p>
                  <p>{normalizeText(primaryQuote(content, policy))}</p>
                  <details>
                    <summary>查看出處</summary>
                    <CitationList content={content} citations={policy.citations} />
                  </details>
                </article>
              );
            })}
            {round.kind === 'shared' &&
              absent.map((id) => (
                <p key={id} className="cost">
                  {nameOf(id).name}：此議題未收錄政見
                </p>
              ))}
          </section>
        );
      })}

      <div className="button-row">
        <button type="button" className="primary" onClick={restart}>
          再玩一次（換題）
        </button>
        <button type="button" onClick={onBack}>
          返回候選人名單
        </button>
      </div>
    </main>
  );
}
