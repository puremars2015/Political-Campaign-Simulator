import type { ContentBundle } from '../content/schema.ts';
import { NewsPanel } from './NewsPanel.tsx';
import type { LoadResult } from '../storage/saveStore.ts';

interface Props {
  content: ContentBundle;
  loadResult: LoadResult;
  notice: string | null;
  onContinue?: () => void;
  onStart: () => void;
}

export function IntroScreen({ content, loadResult, notice, onContinue, onStart }: Props) {
  const hasProblem = loadResult.status === 'corrupt' || loadResult.status === 'incompatible';

  return (
    <main className="screen">
      <h1>選戰辦公室：選前之夜</h1>
      <section className="card" aria-labelledby="disclaimer-title">
        <h2 id="disclaimer-title">開始之前</h2>
        <p>
          先選擇縣市，再從該縣市2026年縣市長選舉的真實候選人中選一位，成為其競選辦公室主任。
          候選人與政見為附出處的真實公開資料；辦公室內部對話與資源為遊戲模擬，民調為純遊戲觀測，只呈現到選前第十天；本版不產生開票結果，
          不代表真人的實際決策，也不是選舉預測。
        </p>
      </section>

      <details className="card"><summary>玩法與操作說明</summary>
        <p>先選縣市與候選人，查閱來源後確認開局。每局最多 12 份每日主要簡報，目標 15 分鐘內完成；依臺灣當日日期安排到選前之夜，平靜日會壓縮。每份簡報有 3 個行動點；先處理事件，再分配行動與政見曝光，最後結束回合。可以保留行動點，事件永遠有零成本選項。</p>
        <p>團隊士氣與政策一致性用於辦公室敘事回顧；經費不足時仍可完成一局。閱讀政見與來源免費。每次決策自動儲存在本瀏覽器，重新整理後按「繼續遊戲」。確認開始新局或重新挑戰時會覆蓋舊存檔。</p>
        <p>按鈕可用 Tab 移動、Enter 或空白鍵執行。最後一份簡報結束後停在選前之夜，開票結果留作懸念，可用相同種子重玩比較選擇。</p>
      </details>
      <NewsPanel content={content} />
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
