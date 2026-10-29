/** 預覽資料的固定說明（計畫 8.4：名單尚未定案時只能標示為預覽資料） */
export function PreviewNotice() {
  return (
    <section className="notice" role="note" aria-labelledby="preview-title">
      <h2 id="preview-title">預覽資料</h2>
      <p>
        候選人名單尚未經選務機關公告，政見來源仍在人工審閱，且目前只收錄部分參選人。
        模擬參數為中性預設值，不代表任何真實民調或選情。
      </p>
    </section>
  );
}
