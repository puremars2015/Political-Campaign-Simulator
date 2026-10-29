# 選戰辦公室：距離投票還有90天

單人、文字敘事、回合決策的政治模擬網頁遊戲。玩家先選縣市，再從該縣市2026年縣市長選舉的真實候選人中選一位，扮演其競選辦公室主任，在時間、預算、候選人立場與團隊壓力之間做選擇。候選人與政見為附出處的真實公開資料；辦公室內部對話、民調與開票為模擬。

完整設計見 [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)。

> 目前為 M0／M1 開發階段：引擎、內容驗證、開局流程、政見來源查閱與存檔可運作。正式內容只有22縣市目錄，尚無已查證的候選人與政見，所以目前沒有可玩的縣市（臺北市資料蒐集中）。

## 環境需求

- Node.js 22.12 以上
- pnpm 10（版本固定於 `package.json` 的 `packageManager`；可用 `corepack enable` 啟用）

## 指令

| 用途 | 指令 |
| --- | --- |
| 安裝依賴 | `pnpm install` |
| 開發伺服器 | `pnpm dev` |
| 型別檢查 | `pnpm typecheck` |
| 單元／內容／存檔測試 | `pnpm test` |
| 只跑內容驗證 | `pnpm validate:content` |
| 正式建置 | `pnpm build` |
| 端到端測試（手機＋桌面） | `pnpm test:e2e` |

端到端測試使用 `@playwright/test`，首次執行前若本機沒有瀏覽器，請先執行 `pnpm exec playwright install chromium`。e2e 以 `vite --mode e2e` 建置到 `dist-e2e/`，改用 `tests/fixtures/content-data.ts` 的測試專用資料；正式建置不會打包這份資料。

## 專案結構

```
src/
  engine/    純 TypeScript 規則引擎，不依賴介面
    rng.ts       可序列化狀態的亂數產生器（確定性重現）
    calendar.ts  依投票日產生12回合日期表
    config.ts    集中管理的平衡參數與行動清單
    engine.ts    開局、提交行動、回合結算、延遲效果
    types.ts     GameState 等核心資料型別
  content/   結構化內容與 zod schema 驗證
    schema.ts    選舉、縣市、人物、參選紀錄、唯讀政見、來源、事件模板
    validate.ts  引用、跨屆／跨選區誤用與可玩門檻檢查
    query.ts     可玩門檻評估、可用政見篩選
    data/        正式內容 JSON（22縣市目錄與真實資料）
  storage/   可替換的存檔介面（首版為 localStorage）
  ui/        React 畫面
tests/
  engine/ content/ storage/   Vitest
  fixtures/                   測試專用資料（標示為測試資料，不進正式內容）
  e2e/                        Playwright
```

## 內容資料規則

- 每個縣市的 `status` 只有在通過可玩門檻時才能標為 `playable`：選舉日期、行政區、參選資格與政見來源皆已審閱，所有參選紀錄為選務機關公告之正式候選人，且模擬參數已設定。
- 政見為唯讀資料，每筆至少引用一個來源；來源未交代的欄位以 `{ "stated": null }` 表示「來源未說明」，不得補值。
- 政見的屆次與選區必須與參選紀錄一致，驗證器會擋下跨屆或跨選區誤用。
- 來源的 `verification` 為 `pending-review` 時，該政見可在資料頁查閱，但不會進入遊戲。

## 政見盲測

參考 [blindvote.app](https://blindvote.app/) 的方法，在選候選人頁提供「政見盲測」：

- 每一輪一個議題（`topics.json` 的分類），列出比較對象在該議題的政見，遮住身分、打亂順序；只有一位提出的議題集中在最後一輪「特色政見」。
- 姓名與黨名在所有段落中遮蔽；陣營專屬用詞（例如現任者的「市府」）只遮在該陣營的段落；「臺」統一寫成「台」。
- 段落取自非媒體來源中最長的一則引文，開票時顯示完整原文、出處與審閱狀態。
- 現任者以市府名義宣布、尚未完成的計畫標為 `government-plan`，開票時標示「市府計畫」。
- 比較對象由 `comparisons.json` 設定；目前臺北市只比較沈伯洋與蔣萬安，其他參選人顯示為「尚未收錄，不代表沒有主張」。

邏輯在 `src/content/compare.ts`（純函式），畫面在 `src/ui/BlindCompareScreen.tsx`。

## 引擎契約

- 開局必須指定縣市與參選紀錄，不隨機分配候選人。
- GameState 只保存政見 ID 與本局宣傳安排（待宣傳、主打、延後、降低曝光），無法改寫政見內容。
- 相同種子、內容版本與選擇序列必定得到相同結果；所有隨機抽樣都走 `engine/rng.ts`。
- 每次提交都帶 `expectedRevision`，重複或過期的提交會被拒絕，不會重複扣款。
- 被拒絕的行動不扣資源、不推進時間。
- 存檔版本或內容版本不相容時明確回報，不會靜默重置。

## 授權

MIT
