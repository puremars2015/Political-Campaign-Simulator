# 本地Docker試玩部署

指定主機為DESKTOP-JDGUJKR；本文件與程式在雲端checkout準備，尚未透過此任務接觸或部署到該桌機。Vercel部署方案已停用。Library附件401保持阻擋，不改用其他傳輸繞過。

## 預設行為

- 主機入口：`http://127.0.0.1:8787`，只綁本機loopback；不向LAN或公網開放。
- 容器內部的0.0.0.0:8080只供Docker埠映射使用，主機映射仍限定127.0.0.1。沒有修改防火牆。
- 預設`NEWS_UPDATES=0`，只使用內附新聞快照；健康檢查與開始頁明示快照模式，不宣稱持續抓取。
- `news-data`具名volume保存新聞資料；遊戲存檔仍在使用者瀏覽器localStorage，不存在容器內。
- Dockerfile使用Node 24／Debian Bookworm及Python 3。第一次build需連線下載官方基底映像、npm依賴及Debian套件，後續使用本地快取。Windows Docker Desktop需切換Linux containers。

## 取得指定版本

雲端工作分支為`codex/six-cities-v1`，原repo：
`https://github.com/puremars2015/Political-Campaign-Simulator.git`

截至本輪唯讀檢查，該分支尚未存在遠端。**以下clone流程須先取得該次push許可，並由雲端把完成的commit推上原repo分支後才可執行。**沒有擅自push或用桌機上的舊版代替新版。

```powershell
git clone --branch codex/six-cities-v1 https://github.com/puremars2015/Political-Campaign-Simulator.git Political-Campaign-Simulator-Trial
cd Political-Campaign-Simulator-Trial
git log -1 --oneline
```

若目標資料夾已存在，先確認原內容與未提交修改，改選新的試玩資料夾，不直接覆蓋。父任務須將`git log`結果與交付commit核對，才進行build。

受支援的主要交付方式是：經明確許可把這次commit推至使用者原GitHub repo的工作分支，再於已授權桌機clone。無須推main、無須公開網站、無須新增憑證。官方附件流程若恢復授權，也可以交付指定版本的原始碼包；目前沒有成功附件ID，因此不把workspace連結當已完成交付。

## 啟動與檢查（PowerShell）

在原始碼根目錄：

```powershell
Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue
docker compose config --quiet
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://127.0.0.1:8787/healthz
Start-Process http://127.0.0.1:8787
```

若8787被占用，不停止其他服務，改用已確認空閒的埠：

```powershell
$env:GAME_PORT='8788'
docker compose up --build -d
Invoke-RestMethod http://127.0.0.1:8788/healthz
```

健康回應須為`status=ok`；`news.updateMode=snapshot`代表未啟用自動擷取，並顯示最後成功時間與資料版本。新聞故障時遊戲仍可使用內建資料；健康回應會將新聞標成unavailable或stale，不把它說成新資料。

只停止本專案：`docker compose down`。不要使用`docker system prune`或停止不屬於本專案的容器。預設down不刪除新聞volume。遊戲存檔取決於瀏覽器與網址，換埠會形成另一個儲存來源。

## 手動或每小時更新新聞

只更新一次，仍維持快照模式：

```powershell
docker compose exec game python3 scripts/update_news.py --output /app/data/news.json
Invoke-RestMethod http://127.0.0.1:8787/healthz
```

要讓本地容器持續每60分鐘嘗試擷取：

```powershell
$env:NEWS_UPDATES='1'
docker compose up -d
```

這只重建本專案game服務的設定。服務啟動先抓一次，之後每60分鐘重試；停止容器即停止，不建立外部排程。UI與`/healthz`會顯示hourly模式。失敗會保留最後成功快照與時間，且有stale標示。新局採新版本，既有局維持開局快照；進行中畫面顯示的是開局時模式，不冒充目前服務即時狀態。

關閉每小時更新：`$env:NEWS_UPDATES='0'`後`docker compose up -d`。若使用者沒有授權新聞網路連線，保持預設快照即可。

## 代理雲端驗證

- Docker Engine 28.4.0、Compose 2.40.3，實際build成功；runtime使用node帳號。初次啟動因雲端原檔0600權限失敗，已改COPY --chown並重新build／run通過。
- 預設快照容器僅綁127.0.0.1:8787，健康狀態healthy，healthz回HTTP200且updateMode=snapshot。
- 另一個隔離的每小時模式測試容器僅綁127.0.0.1:8788；2026-10-30T04:10:26.262892Z成功實際擷取RSS，回報hourly及60分鐘設定。未等候下一個完整60分鐘自然觸發。
- 真正容器服務上的手機／桌面完整局、存讀及民調新聞標題截止測試共4項通過；另有一般正式內容30項、測試資料14項E2E通過。
- [健康回應](evidence/docker-health.json)、[驗證紀錄](evidence/docker-verification.txt)。測試只操作本任務新建的兩個測試容器／volume，不停止任何其他容器。

雲端結果不等於已在DESKTOP-JDGUJKR部署。測試結束已停止並移除本任務的兩個測試容器及其測試volume，沒有留下每小時背景擷取。

## 雲端特殊建置環境

一般桌機不需要自訂CA。此雲端環境的網路透過受管proxy，build使用BuildKit的`proxy_ca` secret mount，未將session CA複製進映像；npm與apt保留TLS驗證。此雲端Docker buildx快取目錄另放於/tmp，沒有修改registry憑證或DOCKER_CONFIG。這些是雲端測試設定，不要求桌機建立或複製雲端憑證。
