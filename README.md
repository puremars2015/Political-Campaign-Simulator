# 選戰辦公室：距離投票還有90天

單人、文字敘事、回合決策的政治模擬網頁遊戲。玩家扮演候選人的競選辦公室主任，在時間、預算、候選人立場與團隊壓力之間做選擇。

完整設計見 [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)。

> 目前為專案骨架階段：引擎、內容驗證、存檔與基本介面可運作，候選人與事件仍為占位資料（M0 進行中）。

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

端到端測試使用 `@playwright/test`，首次執行前若本機沒有瀏覽器，請先執行 `pnpm exec playwright install chromium`。

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
    data/        districts / candidates / events JSON
  storage/   可替換的存檔介面（首版為 localStorage）
  ui/        React 畫面
tests/
  engine/ content/ storage/   Vitest
  e2e/                        Playwright
```

## 引擎契約

- 相同種子、內容版本與選擇序列必定得到相同結果；所有隨機抽樣都走 `engine/rng.ts`。
- 每次提交都帶 `expectedRevision`，重複或過期的提交會被拒絕，不會重複扣款。
- 被拒絕的行動不扣資源、不推進時間。
- 存檔版本或內容版本不相容時明確回報，不會靜默重置。

## 授權

MIT
