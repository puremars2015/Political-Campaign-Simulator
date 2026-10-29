import { useMemo, useRef, useState } from 'react';
import { loadContent } from '../content/index.ts';
import {
  createNewGame,
  endRound,
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
  const content = useMemo(() => loadContent(), []);
  const store = useMemo(() => createLocalSaveStore(window.localStorage, content.contentVersion), [content]);
  const [initialLoad] = useState<LoadResult>(() => store.load());
  const [step, setStep] = useState<SetupStep>({ kind: 'intro' });
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

  function returnToSetup() {
    gameRef.current = null;
    setGame(null);
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
        onEndRound={(revision) => apply((s) => endRound(s, revision))}
        onRestart={returnToSetup}
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
      loadResult={initialLoad}
      notice={notice}
      onContinue={initialLoad.status === 'ok' ? () => commit(initialLoad.state) : undefined}
      onStart={() => setStep({ kind: 'districts' })}
    />
  );
}
