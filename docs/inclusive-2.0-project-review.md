# SeatPlanner Inclusive 2.0 專案研究

研究日期：2026-11-07。範圍：現有原始碼、改善計畫、使用者提供的歡迎畫面素材；本次未修改應用程式，未宣告任何開發 Phase 完成。

## 架構與現況

原生 HTML／CSS／JavaScript 單頁工具，採 window.SeatMaster 命名空間與依序載入的腳本，沒有套件建置流程或後端。保留直接開啟 index.html 的能力，是後續改版的基本限制。

- index.html：頁面結構、管理／展示與模態視窗。
- assets/styles.css：全站樣式與響應式布局。
- js/app.js：工作區、事件協調、班級操作、學生資料卡及自由教室操作。
- js/storage.js：多班級工作區、v1–v4 遷移、JSON 匯入匯出。
- js/seat-engine.js、manual-seating.js：抽籤、規則驗證及手排草稿。
- js/group-planner.js、group-ui.js：任務分組及介面。
- js/room-layout.js、ui.js：自由桌組模型與畫面呈現。
- js/student-draw.js、draw-effects.js、sound.js：抽學生、動畫及音效。

現有功能已涵蓋多班級、優先安排、手排、無實體座位學生、自由桌型及活動分組，應沿用與改善，避免重建。

## 已核對的風險

1. app.js:init() 在載入、hydrate 與 render 後立即存檔。首訪不可只判斷 localStorage 或班級是否存在；應保留初始化前快照，搭配獨立 onboarding metadata。
2. storage.save() 的 setItem 沒有例外處理。load() 將無資料、讀取失敗及 JSON 損壞都回傳 null；配合 init 自動存檔，存在覆寫損壞原資料的風險。應分開載入狀態，失敗時保留原內容。
3. import 遷移僅做有限結構檢查，多班級中無效 entry 會被 filter 掉。需定義整批拒絕或明示部分匯入，避免靜默遺失班級。
4. openStudentProfile() 將自訂欄位放入資料卡。密碼只遮罩，原值仍存於 DOM data-actual 並可揭露。公開展示宜採座號與姓名白名單，而非只擴充敏感詞過濾。
5. index.html 載入 polik18.github.io 的 site-stats.js，離線版須移除外部請求並以網路紀錄驗證。
6. 同性別分組仍採貪婪分配組別。本次另外以 8 人、6 男 2 女、目標每組 4 人、same 策略、無預排實測，確實拋出「依性別分組後，組別人數無法符合 2–6 人限制」；合法解為 6 人與 2 人各一組。原因是開放組別以平均容量分配性別，未先求出各性別可行組數。7 男 1 女也回報失敗，但該案例在每組至少 2 人的規則下本來就不可行。既有測試通過不代表此問題已修復。
7. 桌組旋轉碰撞、圓桌增席後重新分布、密集 U 型及調整布局後保留結果，需進一步瀏覽器重現；本次未將它們判定為全部已證實的缺陷。

## 主視覺整合決策建議

使用 SeatPlanner-main.png 作為使用者指定的歡迎主視覺，優先於計畫原先建議的 SVG／CSS 插圖形式，無須重新生成素材。

圖片已包含「SeatPlanner Inclusive」「每個位置，都是學習的起點」與副標；與計畫建議文案不同。歡迎頁應沿用圖片語氣，避免疊加另一組主標。開始使用、匯入既有班級、跳過介紹及語言切換必須使用真實 HTML 控制項。

- 桌機：完整呈現橫幅，下方配置操作區，避免按鈕蓋住圖片文字。
- 手機：不宜直接 cover 裁切整張圖，會切掉主標或教室。可完整等比顯示圖片，另以 HTML 呈現可讀文案和操作。
- 英文：圖中文字已烘焙在像素內，無法隨語系切換；可提供英文 HTML 說明，若要整張無中文，須另備無字或英文素材。
- 無障礙：主要資訊應有 HTML 文字等價內容，圖片若重複則用空 alt；不可依賴圖片文字作唯一操作說明。
- 原圖約 2 MB，整合時保留原檔；是否提供壓縮衍生版本應依載入實測決定。

## 實測與環境

以下五項於本次研究全部通過：

- node tests/engine.test.js
- node tests/effects.test.js
- node tests/manual.test.js
- node tests/group-planner.test.js
- node tests/room-layout.test.js

Python import playwright 失敗：ModuleNotFoundError。目前未執行 manual-browser.py 與 features-browser.py，亦未驗證 Chromium、file://、裝置尺寸、網路請求或無障礙流程。

專案目錄目前不是 Git repository；E:\Git\SeatPlanner-main.zip 存在。尚未建立分支、提交或基線 fixture。實作前應以原始 ZIP 與目前含主視覺的目錄分別保全，再初始化版本管理。

## 建議實作順序

1. Phase 0：保全原版、建立 Git 基線、v4／舊版 fixture 及瀏覽器測試環境。
2. Phase 1：存讀失敗與匯入完整性、公開展示白名單、移除外部統計、分組求解與布局回歸。
3. Phase 2–3：任務導向首頁、指定主視覺歡迎頁、獨立首訪 metadata、可重看的逐步導覽。
4. Phase 4–5：教師環境提示、同儕輪替與空白觀察表、展示改善、完整回歸與文件。

維持 classroom-seat-master:v4 與 JSON v4，不因品牌或新手導覽改名而變更既有資料鍵。真實教師試用仍需實際參與者，不能以自動化測試代替。

## 後續實作接點與研究界線

- app.js:init()：在 storage.load() 後、hydrate() 前保留原始工作區快照；導覽在 render() 後啟動。不得以最後的 saveWorkspace() 作為已使用訊號。
- app.js:addClass()、importClasses()、updateFromInputs() 及排位完成事件：確認操作成功後才通知 meaningful activity；取消匯入、驗證失敗、語言切換不應記錄。
- app.js:hasUntouchedDemoClass() 已有預設資料比較邏輯，可參考並抽成可測試判定；不可把目前記憶體 state 當作原始載入快照。
- storage.js:load() 應區分空資料、合法資料、損壞及存取失敗；save() 回傳明確結果，讀取失敗時避免啟動流程覆寫原值。
- storage.js:migrate() 的 filter(Boolean) 會捨棄無效班級；匯入應先驗證整份檔案，完成預覽與選擇後才更新工作區。
- index.html 目前腳本依序載入，onboarding 模組需放在 app.js 前；沿用原生腳本模式即可，無需引入建置工具。

本次重新執行五份 Node 測試均通過；分組缺陷以額外 Node VM 探針重現，尚未加入正式回歸測試。未安裝套件、未建立 Git、未修改應用程式或工作資料。本文件是研究交付，不代表 Phase 0–5 已完成；後續執行須依計畫建立備份、分支、fixture 與逐階段驗收報告。
