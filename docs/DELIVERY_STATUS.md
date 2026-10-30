# 試玩交付狀態（2026-10-30）

使用者要求先立即試玩，因此先交付沿用現有應用程式的單檔版本與備用本機啟動包。未推送、未部署、未啟用外部排程。

## 可玩產物

- `deliverables/Political-Campaign-Simulator-Trial.html`：所有JS與CSS內嵌，包含新聞快照`0411ae9beda36bf5`。
- `deliverables/Political-Campaign-Simulator-Trial.zip`：單檔HTML、Python標準函式庫localhost啟動器、繁體中文說明。
- `deliverables/Trial-Mobile-Election-Eve.png`及桌面對應檔：實際試玩包畫面。
- 可用`pnpm package:trial`從既有Vite產物重製HTML。產物不放入git；本機腳本與應用程式改動納入版本控制。

## 已驗證

手機Pixel 7與桌面Chrome均從localhost載入單一HTML後切為離線，完成12個事件至選前之夜；只有主文件一個網路請求，無外部資源、無瀏覽器程式錯誤、無水平溢出。所選臺南陳亭妃路徑的主要事件與全部選項共2156字元。此為代理自動操作／文字量檢查，不是人類15分鐘試玩或實際閱讀測時證據。

雲端瀏覽器的file://導航被管理政策擋下（ERR_BLOCKED_BY_ADMINISTRATOR）。沒有繞過此政策，因此沒有宣稱在此環境已驗證直接雙擊；備用方案`python3 START.py`僅監聽127.0.0.1:8765，不是對外預覽。

## 可分享網址與主機唯讀檢查

- 工具未提供這個執行環境的port分享／preview URL功能。
- GitHub repository API：homepage=null、has_pages=false，目前無可核實的Pages入口。
- 已授權Vercel帳號與所屬team以儲存庫網址、political/campaign名稱查詢均無專案。這僅表示這次可見範圍無結果，不證明其他未連接主機不存在。
- 因此沒有虛構公開URL。若要手機直接點網址，可於另行明確授權後建立分享用preview部署；不需要先做正式production或付費操作。

## Library交付阻擋

已使用當前官方Library skill的prepared-upload helper，一次準備6個附件（HTML、ZIP、說明、手機與桌面截圖、V1驗收文件）。helper在取得hosted apps工具清單時回傳HTTP 401，輸出`library upload failed: hosted apps tools/list request failed with HTTP status 401`，exit=1。

錯誤發生於準備／上傳前；沒有返回任何upload session、library_file_id或成功寫入。未重試或切換較寬鬆路徑，沒有憑證修改。需要具備可用Library工具授權的交付執行端／連線，才能回傳正式附件ID。這是尚未完成的附件交付，不可將workspace路徑或localhost網址冒稱為使用者可開啟入口。

## 來源review進度

已抓取38個來源：37個成功，1個東森來源403未繞過。逐引用文字比對發現非官方ENCORE.TAIPEI頁面為JS空殼；ENCORE及AI2033原標為candidate-official不符站方自述，已改為secondary-summary，取消其官方來源遊戲優勢，保留原歷程。其他完整的摘要／欄位語境審閱與節奏review尚在進行，不把文字匹配當成人工查證完成。

HTML SHA256：`1549f2a22ad7e51a45ef7aedaacbbe0b4690a99368ce5fca69b4cb5726196354`

ZIP SHA256：`fe23b5fbbc965624d6f9d0d4154b576235e0ed66de2dd15521790baf9ec30590`
