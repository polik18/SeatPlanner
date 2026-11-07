# Inclusive 2.0 開發基線

日期：2026-11-07。原生 HTML/CSS/JavaScript，無建置步驟；入口 `index.html`。

- 原始 ZIP 保留在 `E:\Git\SeatPlanner-main.zip`。
- 含主視覺與研究文件的可執行快照：`E:\Git\SeatPlanner-baseline-20261107-084802.zip`。
- Git 原版提交 `1a25611`，標籤 `baseline-before-inclusive-v2`；開發分支 `feature/inclusive-ux-v2`。
- 資料鍵 `classroom-seat-master:v4` 與 JSON v4 持續使用。模組透過 `window.SeatMaster` 依序載入。
- `tests/fixtures/` 提供預設、既有結果、多班級手排草稿與 v1–v3 遷移樣本。全為合成資料。
- 五份原有 Node 測試通過。瀏覽器基線及後續結果記於 `docs/inclusive-2.0-delivery.md`。

復原方式：從快照解壓至另一個資料夾，或以 Git 標籤建立另一份 checkout。請勿對正在使用的瀏覽器資料執行清除操作。

指定 PNG 作為歡迎主視覺，優先於原計畫的 SVG 插圖建議。英文使用 HTML 等價文字；圖片內的中文仍保留。
