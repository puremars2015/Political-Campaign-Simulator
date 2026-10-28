import type { LoadResult } from '../storage/saveStore.ts';

interface Props {
  loadResult: LoadResult;
  notice: string | null;
  onContinue?: () => void;
  onStart: () => void;
}

export function IntroScreen({ loadResult, notice, onContinue, onStart }: Props) {
  const hasProblem = loadResult.status === 'corrupt' || loadResult.status === 'incompatible';

  return (
    <main className="screen">
      <h1>選戰辦公室：距離投票還有90天</h1>
      <section className="card" aria-labelledby="disclaimer-title">
        <h2 id="disclaimer-title">開始之前</h2>
        <p>
          先選擇縣市，再從該縣市2026年縣市長選舉的真實候選人中選一位，成為其競選辦公室主任。
          候選人與政見為附出處的真實公開資料；辦公室內部對話、民調變化與開票結果為遊戲模擬，
          不代表真人的實際決策，也不是選舉預測。
        </p>
      </section>

      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}

      {hasProblem && (
        <p className="notice" role="alert">
          {loadResult.message} 確認新的候選人並開局後，會覆蓋這份存檔。
        </p>
      )}

      <div className="button-row">
        {onContinue && (
          <button type="button" className="primary" onClick={onContinue}>
            繼續遊戲
          </button>
        )}
        <button type="button" className={onContinue ? undefined : 'primary'} onClick={onStart}>
          開始新的一局
        </button>
      </div>
    </main>
  );
}
