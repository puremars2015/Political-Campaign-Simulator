import { useMemo, useRef, useState } from 'react';
import { loadContent } from '../content/index.ts';
import { createNewGame, endRound, submitAction, type EngineResult } from '../engine/engine.ts';
import type { GameState } from '../engine/types.ts';
import { createLocalSaveStore, type LoadResult } from '../storage/saveStore.ts';
import { BriefingScreen } from './BriefingScreen.tsx';
import { IntroScreen } from './IntroScreen.tsx';

function randomSeed(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => n.toString(36)).join('');
}

export function App() {
  const content = useMemo(() => loadContent(), []);
  const store = useMemo(() => createLocalSaveStore(window.localStorage, content.contentVersion), [content]);
  const [initialLoad] = useState<LoadResult>(() => store.load());
  const [game, setGame] = useState<GameState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 以 ref 保存最新狀態，避免連點時兩次提交都基於同一份舊狀態
  const gameRef = useRef<GameState | null>(null);

  function commit(next: GameState) {
    gameRef.current = next;
    setGame(next);
    const saved = store.save(next);
    setNotice(saved.ok ? null : `${saved.message}。目前進度仍保留在畫面上，但尚未保存。`);
  }

  function apply(run: (current: GameState) => EngineResult) {
    const current = gameRef.current;
    if (!current) return;
    const result = run(current);
    if (result.ok) commit(result.state);
    else setNotice(result.reason);
  }

  function startNewGame() {
    commit(createNewGame(content, { seed: randomSeed() }));
  }

  if (!game) {
    return (
      <IntroScreen
        loadResult={initialLoad}
        onContinue={initialLoad.status === 'ok' ? () => commit(initialLoad.state) : undefined}
        onStart={startNewGame}
      />
    );
  }

  const candidate = content.candidates.find((c) => c.id === game.candidateId);
  const district = content.districts.find((d) => d.id === game.districtId);

  return (
    <BriefingScreen
      game={game}
      candidateName={candidate?.name ?? game.candidateId}
      districtName={district?.name ?? game.districtId}
      notice={notice}
      onAction={(actionId, revision) => apply((s) => submitAction(s, actionId, revision))}
      onEndRound={(revision) => apply((s) => endRound(s, revision))}
      onRestart={startNewGame}
    />
  );
}
