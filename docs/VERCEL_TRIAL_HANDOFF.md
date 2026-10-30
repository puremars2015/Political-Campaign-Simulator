> 已停用：使用者於本輪改用DESKTOP-JDGUJKR本地Docker部署。本文只保留先前唯讀研究，不是Vercel部署授權；請改看LOCAL_DOCKER.md。

# Vercel試玩站待執行交接

2026-10-30唯讀準備；沒有建立專案、上傳、部署、推送或變更憑證。父對話已向使用者詢問建立URL可存取試玩站，尚待明確答覆。

## 已確認與尚未知

- 連接帳號可見team：`puremars2015s-projects`／`team_RexKTlv2ZPFHvC9nzRIVz3fQ`。以儲存庫網址與political/campaign名稱查詢，無相關專案。GitHub repo沒有homepage且has_pages=false，因此沒有已核實的現成試玩URL。
- API可讀到team身分，但這次回傳未提供billing plan或剩餘額度；不得猜測目前帳號一定是Hobby或有未使用免費額度。
- Vercel公開文件表示Hobby免費，但限個人、非商業使用且有用量上限。此靜態試玩不需要資料庫、Functions、付費外掛、正式網域或額外憑證；不因此保證任意帳號／任意流量都不會有成本。[官方Hobby說明](https://vercel.com/docs/plans/hobby)

## 使用者同意後的最小操作

1. 確認授權範圍包含讓持有URL者存取這個獨立試玩站、使用上述team，並維持不購買方案、不開付費資源。
2. 建立獨立專案`political-campaign-simulator-trial`；不連接Git自動部署、不git push、不綁正式網域、不動既有專案。透過已授權的Vercel工具部署本地驗收後的靜態`dist/`檔案，保留新聞JSON快照。只需HTML、JS、CSS與news.json，沒有伺服器環境變數或密鑰依賴。
3. 等待實際READY結果，記錄部署ID、URL、實際target與來源commit，重新驗證首頁、六都12人、手機完整局、11/27收尾、民調界線與讀檔。若受Vercel Authentication保護，使用既有已授權方式測試，不默默關閉保護或建立新bypass憑證。
4. 將實際URL、可見性與試玩限制交給使用者。這個版本僅含打包新聞快照，沒有持續RSS更新。

注意：Vercel現行文件指出，新專案**首次部署會被平台標為production**，即使要求preview。它仍可是一個獨立的試玩專案、沒有正式自訂網域，但不能向使用者保證平台target一定是Preview。不要為了繞過此行為故意建立失敗部署；授權需按實際新試玩站範圍判斷。[官方環境與首次部署說明](https://vercel.com/docs/deployments/environments)

## RSS後續依賴

目前`NEWS_UPDATES=1 pnpm start`是自架Node服務的每60分鐘迴圈，不能直接搬成Vercel靜態站上的持續進程。若未來要Vercel持續更新，需另設有持久儲存／發布機制的排程或重新部署管線，並另行授權啟用。Hobby的Vercel Cron最低間隔為每日一次，不能宣稱免費支援每小時Cron；本次不升級方案、不建立排程。[官方Cron限制](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Library

官方附件流程先前在hosted apps工具清單階段HTTP401，無任何upload session或Library ID。依父對話指示不重試、不更換流程、不改憑證。這個阻擋仍在；本文件與試玩包的workspace路徑不是已交付附件或公開入口。
