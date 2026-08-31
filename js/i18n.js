(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const LANGUAGE_KEY = "classroom-seat-master:language";
  const dictionaries = {
    "zh-Hant": {
      "app.title": "Classroom Seat Master｜班級座位編排",
      "common.saved": "已儲存於本機", "common.saving": "儲存中…", "common.fullscreen": "全螢幕", "common.presentation": "進入展示模式", "common.returnResult": "返回展示結果", "common.exitPresentation": "結束展示", "common.cancel": "取消", "common.apply": "套用",
      "common.soundOn": "音效開啟", "common.soundOff": "音效關閉", "common.untitled": "未命名班級",
      "admin.basic": "基本資料", "admin.classAndStudents": "班級與人數", "admin.className": "班級名稱", "admin.classNameHelp": "可輸入任意班級名稱，標題與匯出檔名會自動同步。", "admin.maxNumber": "最大座號", "admin.femaleStart": "女生起始座號", "admin.emptyNumbers": "缺號／空號", "admin.emptyPlaceholder": "例：16-20, 25", "admin.emptyHelp": "支援逗號、空白與區間，例如 16-20, 25", "admin.displayContent": "展示內容", "admin.numberOnly": "只顯示座號", "admin.nameOnly": "只顯示姓名", "admin.numberAndName": "座號＋姓名",
      "admin.studentData": "學生資料（選填）", "admin.dataPlaceholder": "座號\t姓名\t外號\t帳號\t密碼\t居住地點\n1\t王小明\t小明\tstudent01\t••••••\t臺北市", "admin.dataHelp": "第一列填欄名，可直接貼上 Excel；系統會依座號同步最大座號與缺號，姓名後方可增加任意資料欄位。", "admin.dataPrivacy": "資料會在展示模式點擊學生卡牌後顯示；密碼類欄位預設遮罩，請仍避免輸入不應公開的敏感資訊。",
      "admin.space": "空間配置", "admin.grid": "教室網格", "admin.columns": "直行數", "admin.rows": "橫排數", "admin.gridHelp": "行數、排數可隨時增減，變更後會自動重建網格並保留仍存在的座位設定。點座位切換四種狀態；點右上角可固定座號，點外圍標籤可整批切換。", "admin.rotateLayout": "旋轉整間教室", "admin.rotateHelp": "每次旋轉 90°；學生座位、黑板、門與老師座位會一起轉，座位屬性、預排與抽籤結果都會保留。", "admin.rotateCounterclockwise": "逆時針 90°", "admin.rotateClockwise": "順時針 90°", "admin.roomMarkers": "教室標記位置", "admin.roomMarkersHelp": "黑板、門與老師座位可各自放在教室四周，也可隱藏。", "admin.boardPosition": "黑板", "admin.doorPosition": "門", "admin.teacherPosition": "老師座位", "admin.dataTools": "資料工具", "admin.backupReset": "備份與重設", "admin.export": "匯出設定", "admin.import": "匯入設定", "admin.clearPins": "清除固定", "admin.reset": "恢復預設",
      "mode.layout": "座位屬性", "mode.prearrange": "事先安排", "mode.adjust": "調整結果", "mode.layoutHelp": "點擊座位可切換不限、男生、女生與走道。", "mode.prearrangeHelp": "暗樁模式：點擊座位指定學生；抽籤會保留預排位置，展示時完全看不出來。", "mode.adjustHelp": "依序點擊兩個座位即可交換抽籤結果，空桌也能交換。", "mode.adjustUnavailable": "完成一次抽籤後，即可在此手動調整結果。", "mode.prearrangeCount": "已預排 {count} 人", "mode.clickToAssign": "點擊預排", "mode.swapSelected": "已選 {seat}，請點第二個座位", "mode.swapDone": "已交換 {first} 與 {second} 的結果。",
      "seat.general": "不限性別", "seat.male": "限男生", "seat.female": "限女生", "seat.aisle": "走道／無桌", "seat.generalShort": "不限", "seat.maleShort": "男生", "seat.femaleShort": "女生", "seat.aisleShort": "走道", "seat.fixed": "已固定", "seat.number": "{number} 號", "seat.col": "第 {label} 行", "seat.row": "第 {number} 排",
      "room.board": "黑板", "room.door": "門", "room.teacher": "老師座位", "room.position.topStart": "上方左側", "room.position.topCenter": "上方中央", "room.position.topEnd": "上方右側", "room.position.rightStart": "右側上方", "room.position.rightCenter": "右側中央", "room.position.rightEnd": "右側下方", "room.position.bottomStart": "下方左側", "room.position.bottomCenter": "下方中央", "room.position.bottomEnd": "下方右側", "room.position.leftStart": "左側上方", "room.position.leftCenter": "左側中央", "room.position.leftEnd": "左側下方", "room.position.hidden": "隱藏",
      "summary.male": "男生", "summary.female": "女生", "summary.total": "全班",
      "stage.preview": "即時預覽", "stage.draw": "座位抽籤", "stage.board": "講臺・黑板", "stage.title": "{className}座位表", "stage.pageTitle": "{className}班級座位編排", "stage.subtitle": "{seats} 席 · {students} 位學生 · {empty} 張空桌", "stage.valid": "配置可用", "stage.errors": "{count} 項待調整",
      "validation.aislePin": "走道位置不能固定 {number} 號。", "validation.notInRoster": "{number} 號不在目前有效名單中。", "validation.genderMismatch": "{number} 號與固定座位的性別條件不符。", "validation.duplicatePin": "{number} 號被固定在兩個以上的位置。", "validation.capacity": "可用座位只有 {seats} 席，少於 {students} 位學生。", "validation.generalCapacity": "不限性別座位不足，無法容納限制座位分配後的學生。",
      "draw.ready": "按下按鈕，開始公平隨機排位", "draw.drawing": "正在公平隨機配置…", "draw.start": "開始抽籤", "draw.redraw": "重新抽籤", "draw.done": "抽籤完成；點學生卡牌可查看資料", "draw.go": "開始！",
      "studentData.number": "座號", "studentData.name": "姓名", "studentData.field": "欄位 {number}",
      "profile.openCard": "開啟學生資料卡", "profile.flipping": "正在翻開學生資料卡…", "profile.badge": "學生資料卡", "profile.closeHint": "點卡片外側或按 Esc 關閉", "profile.noData": "尚未填寫其他學生資料", "profile.reveal": "顯示", "profile.hide": "隱藏",
      "pin.heading": "固定座位", "pin.number": "座號", "pin.help": "固定設定只會在管理模式顯示。", "pin.title": "指定 {seat} 座位", "pin.random": "不固定（交由隨機配置）", "pin.option": "{number} 號",
      "toast.fixFirst": "請先修正座位配置，再進入展示模式。", "toast.pinned": "{number} 號已固定；展示模式不會顯示標記。", "toast.unpinned": "已取消固定座位。", "toast.rotatedClockwise": "座位表已順時針旋轉 90°。", "toast.rotatedCounterclockwise": "座位表已逆時針旋轉 90°。", "toast.fullscreen": "瀏覽器未允許全螢幕。", "toast.exported": "設定檔已匯出。", "toast.imported": "設定已成功匯入。", "toast.importFailed": "匯入失敗。", "toast.clearedPins": "所有固定座位已清除。", "toast.reset": "已恢復 4 行 × 8 排預設配置。", "toast.rosterParsed": "已辨識並轉換 {count} 筆學生資料。", "toast.rosterParsedPartial": "已轉換 {count} 筆學生資料；目前有 {total} 個有效座號，另有 {missing} 人未填資料。", "toast.rosterEmpty": "沒有辨識到有效的學生資料。", "confirm.reset": "確定要恢復預設值？目前座位設定會被清除。", "storage.suffix": "座位設定", "storage.invalid": "這不是有效的 Classroom Seat Master 設定檔。"
    },
    en: {
      "app.title": "Classroom Seat Master",
      "common.saved": "Saved locally", "common.saving": "Saving…", "common.fullscreen": "Fullscreen", "common.presentation": "Present", "common.returnResult": "Return to result", "common.exitPresentation": "Exit presentation", "common.cancel": "Cancel", "common.apply": "Apply",
      "common.soundOn": "Sound on", "common.soundOff": "Sound off", "common.untitled": "Untitled class",
      "admin.basic": "BASIC INFO", "admin.classAndStudents": "Class & Students", "admin.className": "Class name", "admin.classNameHelp": "Enter any class name. Titles and export filenames update automatically.", "admin.maxNumber": "Highest student number", "admin.femaleStart": "First female student number", "admin.emptyNumbers": "Unused numbers", "admin.emptyPlaceholder": "e.g. 16-20, 25", "admin.emptyHelp": "Supports commas, spaces, and ranges such as 16-20, 25", "admin.displayContent": "Display format", "admin.numberOnly": "Student number only", "admin.nameOnly": "Name only", "admin.numberAndName": "Number + name",
      "admin.studentData": "Student data (optional)", "admin.dataPlaceholder": "Number\tName\tNickname\tAccount\tPassword\tLocation\n1\tAlex Chen\tAlex\tstudent01\t••••••\tTaipei", "admin.dataHelp": "Use the first row for field names, then paste from Excel. Student numbers automatically update the highest and unused numbers; add any columns after the name.", "admin.dataPrivacy": "These fields appear when a student card is opened in presentation mode. Password fields are masked by default; avoid entering information that should not be shown publicly.",
      "admin.space": "ROOM LAYOUT", "admin.grid": "Seat Grid", "admin.columns": "Columns", "admin.rows": "Rows", "admin.gridHelp": "Change rows or columns at any time. Existing positions keep their settings. Click a seat to cycle its state, use the top-right button to pin a student, or click an axis label for batch changes.", "admin.rotateLayout": "Rotate entire classroom", "admin.rotateHelp": "Rotate everything 90° at a time. Student seats, the board, door, and teacher seat move together while seat rules, pins, and draw results stay intact.", "admin.rotateCounterclockwise": "90° counterclockwise", "admin.rotateClockwise": "90° clockwise", "admin.roomMarkers": "Room marker positions", "admin.roomMarkersHelp": "Place the board, door, and teacher seat anywhere around the room, or hide them.", "admin.boardPosition": "Board", "admin.doorPosition": "Door", "admin.teacherPosition": "Teacher seat", "admin.dataTools": "DATA TOOLS", "admin.backupReset": "Backup & Reset", "admin.export": "Export settings", "admin.import": "Import settings", "admin.clearPins": "Clear pins", "admin.reset": "Reset defaults",
      "mode.layout": "Seat rules", "mode.prearrange": "Pre-arrange", "mode.adjust": "Adjust result", "mode.layoutHelp": "Click a seat to cycle through unrestricted, male, female, and aisle states.", "mode.prearrangeHelp": "Private pre-arrangement: click a seat to assign a student. The draw preserves it, while presentation reveals no marker.", "mode.adjustHelp": "Click two seats in sequence to swap their draw results. Empty desks can be swapped too.", "mode.adjustUnavailable": "Complete a draw to manually adjust its result here.", "mode.prearrangeCount": "{count} pre-arranged", "mode.clickToAssign": "Click to assign", "mode.swapSelected": "Selected {seat}; now choose the second seat", "mode.swapDone": "Swapped the results of {first} and {second}.",
      "seat.general": "Any student", "seat.male": "Male only", "seat.female": "Female only", "seat.aisle": "Aisle / no desk", "seat.generalShort": "Any", "seat.maleShort": "Male", "seat.femaleShort": "Female", "seat.aisleShort": "Aisle", "seat.fixed": "Pinned", "seat.number": "No. {number}", "seat.col": "Column {label}", "seat.row": "Row {number}",
      "room.board": "Board", "room.door": "Door", "room.teacher": "Teacher seat", "room.position.topStart": "Top left", "room.position.topCenter": "Top center", "room.position.topEnd": "Top right", "room.position.rightStart": "Right top", "room.position.rightCenter": "Right center", "room.position.rightEnd": "Right bottom", "room.position.bottomStart": "Bottom left", "room.position.bottomCenter": "Bottom center", "room.position.bottomEnd": "Bottom right", "room.position.leftStart": "Left top", "room.position.leftCenter": "Left center", "room.position.leftEnd": "Left bottom", "room.position.hidden": "Hidden",
      "summary.male": "Male", "summary.female": "Female", "summary.total": "Total",
      "stage.preview": "LIVE PREVIEW", "stage.draw": "SEAT DRAW", "stage.board": "FRONT OF CLASS", "stage.title": "{className} Seating Chart", "stage.pageTitle": "{className} Seat Planner", "stage.subtitle": "{seats} seats · {students} students · {empty} empty desks", "stage.valid": "Ready", "stage.errors": "{count} issues",
      "validation.aislePin": "Student {number} cannot be pinned to an aisle.", "validation.notInRoster": "Student {number} is not in the active roster.", "validation.genderMismatch": "Student {number} does not match this seat restriction.", "validation.duplicatePin": "Student {number} is pinned to more than one seat.", "validation.capacity": "Only {seats} seats are available for {students} students.", "validation.generalCapacity": "There are not enough unrestricted seats for the remaining students.",
      "draw.ready": "Press the button to start a fair random draw", "draw.drawing": "Creating a fair random arrangement…", "draw.start": "Start draw", "draw.redraw": "Draw again", "draw.done": "Draw complete. Click a student card to view details.", "draw.go": "GO!",
      "studentData.number": "Number", "studentData.name": "Name", "studentData.field": "Field {number}",
      "profile.openCard": "Open student profile card", "profile.flipping": "Opening student profile card…", "profile.badge": "STUDENT CARD", "profile.closeHint": "Click outside the card or press Esc to close", "profile.noData": "No additional student data has been entered", "profile.reveal": "Reveal", "profile.hide": "Hide",
      "pin.heading": "PIN A SEAT", "pin.number": "Student number", "pin.help": "Pin markers are visible only in admin mode.", "pin.title": "Assign seat {seat}", "pin.random": "Not pinned (random placement)", "pin.option": "Student {number}",
      "toast.fixFirst": "Fix the seating configuration before presenting.", "toast.pinned": "Student {number} is pinned. The marker stays hidden in presentation mode.", "toast.unpinned": "Seat pin removed.", "toast.rotatedClockwise": "Seating chart rotated 90° clockwise.", "toast.rotatedCounterclockwise": "Seating chart rotated 90° counterclockwise.", "toast.fullscreen": "Fullscreen was blocked by the browser.", "toast.exported": "Settings exported.", "toast.imported": "Settings imported successfully.", "toast.importFailed": "Import failed.", "toast.clearedPins": "All seat pins cleared.", "toast.reset": "Restored the default 4 × 8 layout.", "toast.rosterParsed": "Recognized and normalized {count} student records.", "toast.rosterParsedPartial": "Normalized {count} student records for {total} active numbers; {missing} records are still blank.", "toast.rosterEmpty": "No valid student records were recognized.", "confirm.reset": "Reset to defaults? Current seat settings will be cleared.", "storage.suffix": "seating-settings", "storage.invalid": "This is not a valid Classroom Seat Master settings file."
    }
  };

  let language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh-Hant";

  function t(key, values) {
    let text = (dictionaries[language] && dictionaries[language][key]) || dictionaries["zh-Hant"][key] || key;
    Object.entries(values || {}).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  }

  function apply() {
    document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
    document.title = t("app.title");
    document.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-language-label]").forEach((element) => { element.textContent = language === "en" ? "中文" : "EN"; });
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === "en" ? "en" : "zh-Hant";
    localStorage.setItem(LANGUAGE_KEY, language);
    apply();
    window.dispatchEvent(new CustomEvent("seatmaster:languagechange", { detail: { language } }));
    return language;
  }

  SeatMaster.i18n = { t, apply, getLanguage: () => language, setLanguage, toggle: () => setLanguage(language === "en" ? "zh-Hant" : "en") };
})();
