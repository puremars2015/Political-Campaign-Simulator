import { useEffect, useMemo, useRef, useState } from 'react';
import { withNews } from '../content/news.ts';
import type { ContentBundle } from '../content/schema.ts';
import { loadContent } from '../content/index.ts';
import {
  createNewGame,
  endRound,
  resolveEvent,
  setPolicyExposure,
  submitAction,
  type EngineResult,
} from '../engine/engine.ts';
import type { GameState } from '../engine/types.ts';
import { createLocalSaveStore, type LoadResult } from '../storage/saveStore.ts';
import { BriefingScreen } from './BriefingScreen.tsx';
import { CandidateSelectScreen } from './CandidateSelectScreen.tsx';
import { ConfirmScreen } from './ConfirmScreen.tsx';
import { DistrictSelectScreen } from './DistrictSelectScreen.tsx';
import { IntroScreen } from './IntroScreen.tsx';

function randomSeed(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => n.toString(36)).join('');
}

/** 開局流程：選縣市 → 選該縣市候選人 → 查閱資料並確認（計畫 3.1） */
type SetupStep =
  | { kind: 'intro' }
  | { kind: 'districts' }
  | { kind: 'candidates'; districtId: string }
  | { kind: 'confirm'; districtId: string; candidacyId: string };

export function App() {
  const base = useMemo(() => loadContent(), []);
  const [latestContent, setLatestContent] = useState(base);
  const [gameContent, setGameContent] = useState<ContentBundle | null>(null);
  const content = gameContent ?? latestContent;
  useEffect(() => {
    const packaged = document.getElementById('campaign-news-snapshot')?.textContent;
    if (packaged) {
      try { setLatestContent(withNews(base, JSON.parse(packaged))); } catch { /* 離線包資料損壞時使用內建資料。 */ }
      return;
    }
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}news.json`, { cache: 'no-cache', signal: controller.signal });
        if (!response.ok) return;
        const raw: unknown = await response.json();
        if (!controller.signal.aborted) setLatestContent(withNews(base, raw));
      } catch { /* 來源失效或離線時，保留內建資料，不阻止遊玩。 */ }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60 * 60 * 1000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [base]);
  const store = useMemo(() => createLocalSaveStore({
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }, content.contentVersion, () => new Date(), content), [content]);
  const [initialLoad] = useState<LoadResult>(() => store.load());
  const [step, setStep] = useState<SetupStep>({ kind: 'intro' });
  const [game, setGame] = useState<GameState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const screenKey = game ? `${game.round}/${game.phase}` : JSON.stringify(step);
  useEffect(() => {
    const heading = document.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
    window.scrollTo({ top: 0 });
  }, [screenKey]);
  // 以 ref 保存最新狀態，避免連點時兩次提交都基於同一份舊狀態
  const gameRef = useRef<GameState | null>(null);

  function commit(next: GameState, snapshot = content) {
    setGameContent(snapshot);
    gameRef.current = next;
    setGame(next);
    const snapshotStore = createLocalSaveStore({
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
    }, snapshot.contentVersion, () => new Date(), snapshot);
    const saved = snapshotStore.save(next);
    setNotice(saved.ok ? null : `${saved.message}。目前進度仍保留在畫面上，但尚未保存。`);
  }

  function apply(run: (current: GameState) => EngineResult) {
    const current = gameRef.current;
    if (!current) return;
    const result = run(current);
    if (result.ok) commit(result.state);
    else setNotice(result.reason);
  }

  function returnToSetup() {
    gameRef.current = null;
    setGame(null);
    setGameContent(null);
    setNotice(null);
    setStep({ kind: 'districts' });
  }

  if (game) {
    return (
      <BriefingScreen
        content={content}
        game={game}
        notice={notice}
        onAction={(actionId, revision) => apply((s) => submitAction(s, actionId, revision))}
        onExposure={(policyId, status, angle, revision) =>
          apply((s) => setPolicyExposure(s, content, policyId, status, revision, angle))
        }
        onEventChoice={(choiceId, revision) => apply((s) => resolveEvent(s, content, choiceId, revision))}
        onEndRound={(revision) => apply((s) => endRound(s, content, revision))}
        onRestart={returnToSetup}
        onReplay={() => {
          try {
            commit(createNewGame(content, { seed: game.seed, districtId: game.districtId, candidacyId: game.candidacyId, startDate: game.calendar[0]?.startDate }));
          } catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
        }}
      />
    );
  }

  const district =
    step.kind === 'candidates' || step.kind === 'confirm'
      ? content.districts.find((d) => d.id === step.districtId)
      : undefined;

  if (step.kind === 'districts') {
    return (
      <DistrictSelectScreen
        content={content}
        onSelect={(districtId) => setStep({ kind: 'candidates', districtId })}
        onBack={() => setStep({ kind: 'intro' })}
      />
    );
  }

  if (step.kind === 'candidates' && district) {
    return (
      <CandidateSelectScreen
        content={content}
        district={district}
        onSelect={(candidacyId) => setStep({ kind: 'confirm', districtId: district.id, candidacyId })}
        // 返回更換縣市時清除尚未確認的候選人選擇
        onBack={() => setStep({ kind: 'districts' })}
      />
    );
  }

  if (step.kind === 'confirm' && district) {
    const candidacy = content.candidacies.find((c) => c.id === step.candidacyId);
    if (candidacy) {
      return (
        <ConfirmScreen
          content={content}
          district={district}
          candidacy={candidacy}
          notice={notice}
          onHistorical={(startDate) => {
            try { commit(createNewGame(content, { seed: randomSeed(), districtId: district.id, candidacyId: candidacy.id, startDate })); }
            catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
          }}
          onConfirm={() => {
            try {
              commit(createNewGame(content, { seed: randomSeed(), districtId: district.id, candidacyId: candidacy.id }));
            } catch (error) {
              setNotice(error instanceof Error ? error.message : String(error));
            }
          }}
          onBack={() => setStep({ kind: 'candidates', districtId: district.id })}
        />
      );
    }
  }

  return (
    <IntroScreen
      content={content}
      loadResult={initialLoad}
      notice={notice}
      onContinue={initialLoad.status === 'ok' ? () => commit(initialLoad.state, initialLoad.contentSnapshot ?? base) : undefined}
      onStart={() => setStep({ kind: 'districts' })}
    />
  );
}
