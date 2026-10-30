# 選戰辦公室：選前之夜

單人、繁體中文、文字決策網頁遊戲，沿用原專案 React／TypeScript／Vite 架構。V1 收錄六都目前主要藍綠 **12 位已登記參選人**，資料基準為 **2026-10-30**。法定候選名單尚未公告，來源仍待人工審閱，因此目前是有明示範圍的可玩預覽。

| 縣市 | 國民黨 | 民進黨 |
| --- | --- | --- |
| 臺北 | 蔣萬安 | 沈伯洋 |
| 新北 | 李四川 | 蘇巧慧 |
| 桃園 | 張善政 | 黃世杰 |
| 臺中 | 江啟臣 | 何欣純 |
| 臺南 | 謝龍介 | 陳亭妃 |
| 高雄 | 柯志恩 | 賴瑞隆 |

不加入民眾黨假設參選人物；其他縣市與人物留待下一版。舊目錄與原資料保留，但不開放選取。

新局採臺灣當日日期，安排到 2026-11-27 選前之夜，最多 12 份主要事件簡報，壓縮平靜日，目標 15 分鐘內完成。每份簡報處理一個主要事件，可選擇安排行動與有來源的政見曝光。每次提交自動保存。終局只有故事、團隊與選擇回顧，**不產生開票、票數、勝負或當選人**。模擬民調觀測只提供到選前第十天，之後完全隱藏數字。選舉當日以後不能冒充今天開局，提供明示日期的歷史重玩。

人物及政見有來源；辦公室情境、內部資源與民調觀測是遊戲虛構，不代表真人性格、實際民調或選舉預測。新聞只以中性查核議程影響遊戲，不將報導指控變成既定事實。

## 本地Docker試玩

使用者已選擇本地Docker方式，預設入口`http://127.0.0.1:8787`，只綁本機，先使用新聞快照。主機為DESKTOP-JDGUJKR，但程式目前仍在雲端工作分支，需完成經授權的版本交付才能在桌機執行。

```sh
docker compose up --build -d
docker compose ps
```

完整取得版本、空閒埠、健康檢查與新聞模式操作見 [本地Docker](docs/LOCAL_DOCKER.md)。

## 安裝與執行

Node.js 22.12+、Python 3（新聞擷取）、pnpm 10.28.0（以 `packageManager` 固定）。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm test:news
pnpm build
pnpm test:e2e
pnpm test:e2e:production
```

Playwright 首次使用可執行 `pnpm exec playwright install chromium`，或用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium` 指定已安裝的瀏覽器。`test:e2e` 使用隔離的測試資料；`test:e2e:production` 使用正式內容 JSON，逐一測 12 人的手機與桌面完整流程。

## 新聞更新

```sh
pnpm news:update
pnpm build
pnpm start
```

本地／自架預覽伺服器預設僅監聽 `127.0.0.1:4173`，不會自行啟用背景擷取。明確加上 `NEWS_UPDATES=1 pnpm start` 才會啟用每 60 分鐘擷取；服務停止就不再執行。外部排程、公開部署與持續維運 **尚未啟用**。靜態主機需由排程更新 `news.json` 或重新部署，不能僅上傳建置就宣稱持續更新。

細節與限制見 [新聞管線](docs/NEWS_PIPELINE.md)、[V1 驗收](docs/V1_ACCEPTANCE.md)。舊版長期規劃保留在 [原開發計畫](docs/DEVELOPMENT_PLAN.md)，目前需求以 V1 驗收文件為準。

## 存檔與資料版本

每局保存種子、臺灣起始日期、完整狀態與內容快照。新局採新新聞，舊局繼續使用保存的內容，即使伺服器資料更新也不會中途改寫；同日期、種子、內容與選擇可以重現。損壞或不相容舊存檔會明確提示，不靜默清除。無法使用 localStorage 時仍可在當前畫面遊玩並顯示尚未保存。

MIT
