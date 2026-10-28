import type { LoadResult } from '../storage/saveStore.ts';

interface Props {
  loadResult: LoadResult;
  onContinue?: () => void;
  onStart: () => void;
}

export function IntroScreen({ loadResult, onContinue, onStart }: Props) {
  const hasProblem = loadResult.status === 'corrupt' || loadResult.status === 'incompatible';

  return (
    <main className="screen">
      <h1>選戰辦公室：距離投票還有90天</h1>
      <section className="card" aria-labelledby="disclaimer-title">
        <h2 id="disclaimer-title">開始之前</h2>
        <p>
          你將隨機成為一名候選人的競選辦公室主任。本原型的縣市、候選人與事件皆為虛構，
          選情與開票結果來自遊戲模型，不代表任何真實選舉的預測。
        </p>
      </section>

      {hasProblem && (
        <p className="notice" role="alert">
          {loadResult.message} 開始新的一局會覆蓋這份存檔。
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
