(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const LANGUAGE_KEY = "classroom-seat-master:language";
  const dictionaries = {
    "zh-Hant": {
      "home.back": "回首頁", "home.current": "首頁", "home.navigation": "首頁導覽",
      "mode.manual": "全手動排位",
      "mode.manualHelp": "選學生，再點座位；排好自動接續下一位。",
      "manual.eyebrow": "逐一安排",
      "manual.rulesTitle": "手動排位說明",
      "manual.progressLabel": "排位進度",
      "manual.progress": "已排 {placed}／{total} 人 · 待排 {remaining} 人",
      "manual.instructions": "選學生 → 點座位。也可拖曳；點已排學生可移動或交換。",
      "manual.rulesNote": "沿用目前結果或預排位置起步。手動排位由老師決定，不套用抽籤的性別與固定限制；走道不能坐人。",
      "manual.search": "搜尋座號或姓名",
      "manual.searchPlaceholder": "例如：21 或 小明",
      "manual.filterLabel": "名單篩選",
      "manual.pending": "待排學生",
      "manual.all": "全班名單",
      "manual.autoNext": "排好後自動選下一位",
      "manual.unseat": "移回待排",
      "manual.cancelSelection": "取消選取",
      "manual.undo": "復原",
      "manual.redo": "重做",
      "manual.saved": "草稿自動儲存，可隨時回來繼續。",
      "manual.finish": "完成並展示",
      "manual.clear": "全部移回待排",
      "manual.selected": "待放置：{student}",
      "manual.chooseFirst": "請先選一位學生，再點座位。",
      "manual.allPlaced": "全班排好了！可繼續換位，或完成並展示。",
      "manual.noMatches": "找不到符合的學生，請清除搜尋或切換全班名單。",
      "manual.nonePending": "沒有待排學生，可切換全班名單調整。",
      "manual.emptySeat": "空位",
      "manual.capacity": "還少 {count} 個座位，請切回座位屬性增加桌位。",
      "manual.swapped": "已將 {student} 與 {seat} 的學生交換。",
      "manual.placed": "已將 {student} 安排到 {seat}。",
      "manual.displaced": "原位的 {student} 已移回待排，現在可安排他的位置。",
      "manual.returned": "{student} 已移回待排。",
      "manual.undone": "已復原上一步。",
      "manual.redone": "已重做。",
      "manual.clearConfirm": "將手動草稿的所有學生移回待排？可按「復原」還原；教室格局與抽籤預排設定會保留。",
      "manual.cleared": "已全部移回待排，可從空白座位表開始。",
      "manual.swapTarget": "點擊交換兩位學生",
      "manual.replaceTarget": "點擊安排；原位學生會移回待排",
      "manual.placeTarget": "點擊放置選取的學生",
      "manual.incomplete": "還有 {count} 位學生未排位，請完成後再展示。",
      "manual.done": "手動排位完成；點學生卡牌可查看資料",
      "manual.resultTitle": "班級座位表",
      "groups.open": "任務分組", "groups.eyebrow": "臨時活動安排", "groups.title": "任務分組", "groups.name": "任務名稱", "groups.size": "每組人數", "groups.strategy": "分組方式", "groups.random": "隨機混合", "groups.balanced": "盡量男女均衡", "groups.same": "依性別分組", "groups.roster": "本次參與名單", "groups.selectAll": "全選", "groups.preassignHelp": "勾選學生；抽組前可指定組別，其餘由系統抽入剩餘組別。無實體座位學生仍可參加。", "groups.draw": "立即抽全班", "groups.redrawUnlocked": "重抽未鎖定組別", "groups.print": "列印分組", "groups.randomGroup": "隨機安排", "groups.groupNumber": "第 {number} 組", "groups.preassign": "預先安排 {student}", "groups.singlePersonNote": "目前只有 1 位參與者，無法滿足每組至少 2 人。", "groups.genderConflict": "性別不同", "groups.needsAdjustment": "分組需要調整：", "groups.ready": "已將 {count} 位學生分成 {groups} 組。", "groups.selectAtLeastOne": "至少選一位參與學生。", "groups.defaultName": "臨時任務", "groups.defaultGroup": "第 {number} 組", "groups.rename": "編輯組名", "groups.lock": "鎖定", "groups.unlock": "解除鎖定", "groups.empty": "目前沒有組員", "groups.moveStudent": "調整 {student} 所屬組別", "groups.groupFull": "該組已達 6 人上限。", "groups.popupBlocked": "瀏覽器阻擋了列印視窗，請允許此網站開啟視窗。",
      "room.templates": "教室版型", "room.templateGrid": "矩形網格", "room.templateIslands": "島型小組桌", "room.templateRound": "圓桌", "room.templateU": "U 型教室", "room.editLayout": "編輯桌組與動線", "room.editorHelp": "開啟後，點選畫布中的桌組、座位或通道，再用下方數值微調位置與大小；也可直接拖曳。", "room.noSelection": "請先點選一張桌組", "room.tableSettings": "桌組設定", "room.seatSettings": "選取座位", "room.pathSettings": "主要通道", "room.pathSettingsHint": "保留不放桌組的空間", "room.pathName": "名稱", "room.pathX": "通道 X", "room.pathY": "通道 Y", "room.pathHeight": "通道高度", "room.deletePath": "刪除這條通道", "room.tableShape": "桌型", "room.shapeRect": "矩形桌", "room.shapeRound": "圓桌", "room.shapeU": "U 型桌", "room.rotateLeft": "左轉 15°", "room.rotateRight": "右轉 15°", "room.duplicate": "複製桌組", "room.addTable": "新增 4 人桌", "room.addSeat": "加一個座位", "room.removeSeat": "移除最後座位", "room.delete": "刪除選取桌", "room.addPath": "新增輪椅／主要通道", "room.pathWidth": "通道寬度", "room.templateHelp": "先選擇常用版型；要細調時開啟編輯，點選物件再修改。", "room.table": "桌組 {number}", "room.seat": "教室座位", "room.moveTable": "移動桌組 {number}；使用方向鍵微調，Shift 加方向鍵旋轉", "room.movePath": "移動通道；使用方向鍵微調",
      "manual.nonSeatHeading": "不需實體座位（仍保留在班級名單）", "manual.noPhysicalSeat": "不需實體座位", "manual.requireSeat": "改為需要實體座位", "manual.noNonSeatStudents": "目前沒有標記為不需實體座位的學生。",
      "groups.newTask": "新增任務", "groups.preassignTables": "任務座位預排（選填）", "groups.noSeatPlan": "尚未指定桌組", "groups.noSeatAreas": "目前沒有可安排的桌組／座位區。", "groups.seatArea": "任務桌組", "groups.seatZone": "座位區 {number}", "groups.assignSeat": "安排 {student} 的任務座位", "groups.seatNumber": "座位 {number}", "groups.noTaskSeat": "尚未安排任務座位", "groups.seatAreaMissing": "指定桌組已不存在", "groups.seatCapacity": "指定桌組容量為 {count} 席", "groups.seatOutsideArea": "座位不屬於指定桌組", "groups.duplicateTaskSeat": "同一座位被重複指派。", "room.keepOneTable": "教室至少要保留一個桌組。", "room.wheelchairPath": "輪椅／主要通道",
      "room.seatCount": "每桌座位數", "room.seatX": "選取座位 X", "room.seatY": "Y", "room.seatWidth": "椅子寬", "room.seatHeight": "椅子高", "room.autoArrangeSeats": "自動排列此桌座位", "room.opening": "U 型開口", "room.openBottom": "朝下", "room.openTop": "朝上", "room.openLeft": "朝左", "room.openRight": "朝右", "room.roundRadius": "圓桌座位半徑", "room.edgeTop": "上邊", "room.edgeRight": "右邊", "room.edgeBottom": "下邊", "room.edgeLeft": "左邊",
      "room.tableX": "桌組 X", "room.tableY": "桌組 Y", "room.tableWidth": "桌寬 %", "room.tableHeight": "桌高 %", "room.zoom": "畫布縮放", "room.zoomReset": "重設視圖",
      "room.seatOverlap": "有 {count} 個座位過於靠近，請調整桌組或單席位置。", "room.pathOverlap": "有 {count} 張桌組壓到保留動線，請移開桌組。", "room.geometryOk": "目前座位間距清楚。",
      "room.undo": "復原桌位編輯", "room.redo": "重做桌位編輯",
      "room.geometryHelp": "調整桌型、開口、各邊座位數或自動排列，會重排該桌座位；手動位置可用復原還原。",

      "app.title": "Classroom Seat Master｜班級座位編排",
      "validation.collapse": "收合", "validation.expand": "查看問題",
      "draw.skip": "直接揭曉", "draw.getReady": "全班注意，座位即將揭曉", "draw.rolling": "命運轉動中…", "draw.revealing": "新座位登場！",
      "picker.title": "抽學生", "picker.close": "關閉", "picker.count": "一次抽幾位", "picker.noRepeat": "本輪不重複", "picker.pool": "可抽 {available} 人／全班 {total} 人", "picker.ready": "下一位，會是誰？", "picker.start": "開始抽學生", "picker.next": "再抽一次", "picker.reset": "重開一輪", "picker.history": "本輪抽選紀錄", "picker.emptyHistory": "還沒有人被抽中", "picker.exhausted": "本輪全班都抽過了！重開一輪即可繼續。", "picker.noStudents": "目前沒有有效學生，請先設定班級名單。", "picker.countdown": "準備揭曉", "picker.rolling": "聚光燈會停在誰身上？", "picker.winners": "就是你！", "picker.announced": "本次抽中：{names}", "picker.resetConfirm": "清除本輪抽選紀錄，讓全班重新參加？", "picker.saved": "抽選紀錄自動儲存在此瀏覽器。", "picker.storageFailed": "本次紀錄暫存於頁面，瀏覽器無法儲存。", "picker.invalidCount": "請輸入 1 到 {max} 之間的整數。",
      "common.saved": "已儲存於本機", "common.saving": "儲存中…", "common.fullscreen": "全螢幕", "common.presentation": "進入展示模式", "common.startPresentation": "點此開始展示", "common.returnResult": "返回展示結果", "common.exitPresentation": "結束展示", "common.returnAdmin": "返回維護後台", "common.cancel": "取消", "common.apply": "套用",
      "common.soundOn": "音效開啟", "common.soundOff": "音效關閉", "common.untitled": "未命名班級",
      "classes.eyebrow": "班級管理", "classes.title": "目前班級", "classes.choose": "切換目前呈現的班級", "classes.count": "{count} 個班級", "classes.add": "新增班級", "classes.duplicate": "複製目前班級", "classes.delete": "刪除目前班級", "classes.help": "每個班級各自保留名單、版型與抽籤結果；匯出會包含全部班級。", "classes.newName": "新班級 {number}", "classes.copySuffix": "副本",
      "admin.basic": "基本資料", "admin.classAndStudents": "班級與人數", "admin.className": "班級名稱", "admin.classNameHelp": "可輸入任意班級名稱，標題與匯出檔名會自動同步。", "admin.maxNumber": "最大座號", "admin.femaleStart": "女生起始座號", "admin.emptyNumbers": "缺號／空號", "admin.emptyPlaceholder": "例：16-20, 25", "admin.emptyHelp": "支援逗號、空白與區間，例如 16-20, 25", "admin.displayContent": "展示內容", "admin.numberOnly": "只顯示座號", "admin.nameOnly": "只顯示姓名", "admin.numberAndName": "座號＋姓名",
      "admin.noPhysicalSeat": "不需實體座位（座號）", "admin.noPhysicalSeatPlaceholder": "例：3, 8-10", "admin.noPhysicalSeatHelp": "這些學生仍保留在名單並可參加抽學生／任務分組，但不占用教室座位。",
      "admin.studentData": "學生資料（選填）", "admin.dataPlaceholder": "座號\t姓名\t外號\t帳號\t密碼\t居住地點\n1\t王小明\t小明\tstudent01\t••••••\t臺北市", "admin.dataHelp": "第一列填欄名，可直接貼上 Excel；系統會依座號同步最大座號與缺號，姓名後方可增加任意資料欄位。", "admin.dataPrivacy": "資料會在展示模式點擊學生卡牌後顯示；密碼類欄位預設遮罩，請仍避免輸入不應公開的敏感資訊。",
      "admin.space": "空間配置", "admin.grid": "教室網格", "admin.columns": "直行數", "admin.rows": "橫排數", "admin.gridHelp": "行數、排數可隨時增減，變更後會自動重建網格並保留仍存在的座位設定。點座位切換四種狀態；點右上角可固定座號，點外圍標籤可整批切換。", "admin.rotateLayout": "旋轉整間教室", "admin.rotateHelp": "每次旋轉 90°；學生座位、黑板、門與老師座位會一起轉，座位屬性、預排與抽籤結果都會保留。展示模式也能使用旋轉按鈕。", "admin.rotateCounterclockwise": "逆時針 90°", "admin.rotateClockwise": "順時針 90°", "admin.genderPatterns": "男女交錯快速配置", "admin.genderPatternsHelp": "一鍵套用男女座位限制；走道會保留，人數不平均時會自動留下必要的不限座位。", "admin.genderRows": "橫排交錯", "admin.genderColumns": "直行交錯", "admin.genderCheckerboard": "棋盤交錯", "admin.genderTableSequence": "各桌依座位順序交錯", "admin.roomMarkers": "教室標記位置", "admin.roomMarkersHelp": "黑板、門與老師座位都可選擇邊緣位置、微調位置與大小。", "admin.boardPosition": "黑板", "admin.boardLength": "黑板長度", "admin.positionFineTune": "位置微調", "admin.markerSize": "標記大小", "admin.doorPosition": "門", "admin.teacherPosition": "老師座位", "admin.dataTools": "資料工具", "admin.backupReset": "備份與重設", "admin.export": "匯出設定", "admin.import": "匯入設定", "admin.clearPins": "清除固定", "admin.reset": "恢復預設",
      "mode.layout": "首頁／座位設定", "mode.prearrange": "事先安排", "mode.adjust": "調整結果", "mode.layoutHelp": "點擊座位可切換不限、男生、女生與走道。", "mode.prearrangeHelp": "暗樁模式：點擊座位指定學生；抽籤會保留預排位置，展示時完全看不出來。", "mode.adjustHelp": "依序點擊兩個座位即可交換抽籤結果，空桌也能交換。", "mode.adjustUnavailable": "完成一次抽籤後，即可在此手動調整結果。", "mode.prearrangeCount": "已預排 {count} 人", "mode.clickToAssign": "點擊預排", "mode.swapSelected": "已選 {seat}，請點第二個座位", "mode.swapDone": "已交換 {first} 與 {second} 的結果。",
      "seat.general": "不限性別", "seat.male": "限男生", "seat.female": "限女生", "seat.aisle": "走道／無桌", "seat.generalShort": "不限", "seat.maleShort": "男生", "seat.femaleShort": "女生", "seat.aisleShort": "走道", "seat.fixed": "已固定", "seat.number": "{number} 號", "seat.col": "第 {label} 行", "seat.row": "第 {number} 排",
      "room.board": "黑板", "room.door": "門", "room.teacher": "老師座位", "room.position.topStart": "上方左側", "room.position.topCenter": "上方中央", "room.position.topEnd": "上方右側", "room.position.rightStart": "右側上方", "room.position.rightCenter": "右側中央", "room.position.rightEnd": "右側下方", "room.position.bottomStart": "下方左側", "room.position.bottomCenter": "下方中央", "room.position.bottomEnd": "下方右側", "room.position.leftStart": "左側上方", "room.position.leftCenter": "左側中央", "room.position.leftEnd": "左側下方", "room.position.hidden": "隱藏",
      "summary.male": "男生", "summary.female": "女生", "summary.total": "全班",
      "stage.preview": "即時預覽", "stage.draw": "座位抽籤", "stage.board": "講臺・黑板", "stage.title": "{className}座位表", "stage.pageTitle": "{className}班級座位編排", "stage.subtitle": "{seats} 席 · {students} 位學生 · {empty} 張空桌", "stage.valid": "配置可用", "stage.errors": "{count} 項待調整",
      "validation.aislePin": "走道位置不能固定 {number} 號。", "validation.notInRoster": "{number} 號不在目前有效名單中。", "validation.genderMismatch": "{number} 號與固定座位的性別條件不符。", "validation.duplicatePin": "{number} 號被固定在兩個以上的位置。", "validation.capacity": "可用座位只有 {seats} 席，少於 {students} 位學生。", "validation.generalCapacity": "不限性別座位不足，無法容納限制座位分配後的學生。",
      "draw.ready": "按下按鈕，開始公平隨機排位", "draw.drawing": "正在公平隨機配置…", "draw.start": "開始抽籤", "draw.redraw": "重新抽籤", "draw.done": "抽籤完成；點學生卡牌可查看資料", "draw.go": "開始！",
      "studentData.number": "座號", "studentData.name": "姓名", "studentData.gender": "性別", "studentData.male": "男", "studentData.female": "女", "studentData.field": "欄位 {number}",
      "profile.openCard": "開啟學生資料卡", "profile.flipping": "正在翻開學生資料卡…", "profile.badge": "學生資料卡", "profile.closeHint": "點卡片外側或按 Esc 關閉", "profile.noData": "尚未填寫其他學生資料", "profile.reveal": "顯示", "profile.hide": "隱藏",
      "pin.heading": "固定座位", "pin.number": "座號", "pin.help": "固定設定只會在管理模式顯示。", "pin.title": "指定 {seat} 座位", "pin.random": "不固定（交由隨機配置）", "pin.option": "{number} 號",
      "toast.fixFirst": "請先修正座位配置，再進入展示模式。", "toast.pinned": "{number} 號已固定；展示模式不會顯示標記。", "toast.unpinned": "已取消固定座位。", "toast.rotatedClockwise": "座位表已順時針旋轉 90°。", "toast.rotatedCounterclockwise": "座位表已逆時針旋轉 90°。", "toast.genderPatternApplied": "已套用「{pattern}」。", "toast.genderPatternRelaxed": "因男女比例，有 {count} 席保留為不限。", "toast.genderPatternPinsCleared": "另清除 {count} 個衝突的固定座位。", "toast.fullscreen": "瀏覽器未允許全螢幕。", "toast.exported": "設定檔已匯出。", "toast.imported": "設定已成功匯入。", "toast.importFailed": "匯入失敗。", "toast.clearedPins": "所有固定座位已清除。", "toast.reset": "已恢復 4 行 × 8 排預設配置。", "toast.rosterParsed": "已辨識並轉換 {count} 筆學生資料。", "toast.rosterParsedPartial": "已轉換 {count} 筆學生資料；目前有 {total} 個有效座號，另有 {missing} 人未填資料。", "toast.rosterEmpty": "沒有辨識到有效的學生資料。", "confirm.reset": "確定要恢復預設值？目前座位設定會被清除。", "confirm.deleteClass": "確定刪除「{className}」嗎？這個班級的資料會從本機清除。", "storage.suffix": "座位設定", "storage.invalid": "這不是有效的 Classroom Seat Master 設定檔。"
    },
    en: {
      "home.back": "Back to home", "home.current": "Home", "home.navigation": "Home navigation",
      "mode.manual": "Manual seating",
      "mode.manualHelp": "Choose a student, then a desk. Continue with the next student.",
      "manual.eyebrow": "ONE STUDENT AT A TIME",
      "manual.rulesTitle": "About manual seating",
      "manual.progressLabel": "Seating progress",
      "manual.progress": "{placed}/{total} seated · {remaining} remaining",
      "manual.instructions": "Choose a student → click a desk. Dragging also works. Select a seated student to move or swap.",
      "manual.rulesNote": "Start with the current result or pre-arranged seats. You decide all placements; draw-only gender rules and pins do not restrict manual seating. Aisles stay unavailable.",
      "manual.search": "Search number or name",
      "manual.searchPlaceholder": "e.g. 21 or Alex",
      "manual.filterLabel": "Filter students",
      "manual.pending": "Unseated",
      "manual.all": "All students",
      "manual.autoNext": "Select the next student automatically",
      "manual.unseat": "Unseat student",
      "manual.cancelSelection": "Deselect",
      "manual.undo": "Undo",
      "manual.redo": "Redo",
      "manual.saved": "Draft saved automatically. Return any time to continue.",
      "manual.finish": "Finish & present",
      "manual.clear": "Unseat everyone",
      "manual.selected": "Place: {student}",
      "manual.chooseFirst": "Choose a student, then click a desk.",
      "manual.allPlaced": "Everyone is seated! Adjust seats or finish and present.",
      "manual.noMatches": "No matching students. Clear the search or show all students.",
      "manual.nonePending": "Everyone is seated. Show all students to adjust.",
      "manual.emptySeat": "Empty desk",
      "manual.capacity": "Add {count} more desks in Seat rules to seat everyone.",
      "manual.swapped": "Swapped {student} with the student at {seat}.",
      "manual.placed": "Placed {student} at {seat}.",
      "manual.displaced": "The previous occupant, {student}, is now unseated and selected.",
      "manual.returned": "{student} is now unseated.",
      "manual.undone": "Undid the last change.",
      "manual.redone": "Redid the change.",
      "manual.clearConfirm": "Unseat everyone in the manual draft? Undo can restore it. Room layout and draw pins will be kept.",
      "manual.cleared": "Everyone is unseated. Start with the empty seating chart.",
      "manual.swapTarget": "Click to swap students",
      "manual.replaceTarget": "Click to place; the occupant returns to the unseated list",
      "manual.placeTarget": "Click to place the selected student",
      "manual.incomplete": "Seat the remaining {count} students before presenting.",
      "manual.done": "Manual seating complete. Click a student card to view details.",
      "manual.resultTitle": "SEATING CHART",
      "groups.open": "Task groups", "groups.eyebrow": "TEMPORARY ACTIVITY", "groups.title": "Task groups", "groups.name": "Task name", "groups.size": "Target group size", "groups.strategy": "Grouping", "groups.random": "Random mix", "groups.balanced": "Balance genders", "groups.same": "Separate by gender", "groups.roster": "Participants", "groups.selectAll": "Select all", "groups.preassignHelp": "Select students and optionally assign a group before drawing. Other students are drawn into the remaining groups. Students without a physical seat can still participate.", "groups.draw": "Draw groups now", "groups.redrawUnlocked": "Redraw unlocked groups", "groups.print": "Print groups", "groups.randomGroup": "Draw automatically", "groups.groupNumber": "Group {number}", "groups.preassign": "Preassign {student}", "groups.singlePersonNote": "Only one participant is selected, so the minimum group size cannot be met.", "groups.genderConflict": "has mixed genders", "groups.needsAdjustment": "Groups need adjustment:", "groups.ready": "Arranged {count} students into {groups} groups.", "groups.selectAtLeastOne": "Select at least one participant.", "groups.defaultName": "Temporary task", "groups.defaultGroup": "Group {number}", "groups.rename": "Rename group", "groups.lock": "Lock", "groups.unlock": "Unlock", "groups.empty": "No members yet", "groups.moveStudent": "Change group for {student}", "groups.groupFull": "That group already has 6 members.", "groups.popupBlocked": "The browser blocked the print window. Allow pop-ups for this site.",
      "room.templates": "Room layout", "room.templateGrid": "Grid", "room.templateIslands": "Islands", "room.templateRound": "Round tables", "room.templateU": "U shape", "room.editLayout": "Edit tables and paths", "room.editorHelp": "Turn editing on, select a table, seat, or path, then fine-tune its position and size below. You can also drag it directly.", "room.noSelection": "Select a table to edit it", "room.tableSettings": "Table settings", "room.seatSettings": "Selected seat", "room.pathSettings": "Main path", "room.pathSettingsHint": "Keep this area clear of tables", "room.pathName": "Name", "room.pathX": "Path X", "room.pathY": "Path Y", "room.pathHeight": "Path height", "room.deletePath": "Delete this path", "room.tableShape": "Table shape", "room.shapeRect": "Rectangle", "room.shapeRound": "Round", "room.shapeU": "U shape", "room.rotateLeft": "Rotate left 15°", "room.rotateRight": "Rotate right 15°", "room.duplicate": "Duplicate table", "room.addTable": "Add 4-seat table", "room.addSeat": "Add a seat", "room.removeSeat": "Remove last seat", "room.delete": "Delete selected table", "room.addPath": "Add wheelchair / main path", "room.pathWidth": "Path width", "room.templateHelp": "Choose a common layout first. For fine adjustments, turn on editing, select an item, then change it.", "room.table": "Table {number}", "room.seat": "Classroom seat", "room.moveTable": "Move table {number}; use arrow keys to nudge and Shift+arrow keys to rotate", "room.movePath": "Move path with arrow keys",
      "manual.nonSeatHeading": "No physical seat (kept on roster)", "manual.noPhysicalSeat": "No physical seat", "manual.requireSeat": "Mark as needing a physical seat", "manual.noNonSeatStudents": "No students are marked as not needing a physical seat.",
      "groups.newTask": "New task", "groups.preassignTables": "Preassign task tables (optional)", "groups.noSeatPlan": "No table selected", "groups.noSeatAreas": "There are no tables or seat areas to assign.", "groups.seatArea": "Task table", "groups.seatZone": "Seat area {number}", "groups.assignSeat": "Assign a task seat to {student}", "groups.seatNumber": "Seat {number}", "groups.noTaskSeat": "No task seat assigned", "groups.seatAreaMissing": "The selected table no longer exists", "groups.seatCapacity": "The selected table has {count} seats", "groups.seatOutsideArea": "The seat is outside the selected table", "groups.duplicateTaskSeat": "A seat has been assigned more than once.", "room.keepOneTable": "Keep at least one table in the room.", "room.wheelchairPath": "Wheelchair / main path",
      "room.seatCount": "Seats per table", "room.seatX": "Selected seat X", "room.seatY": "Y", "room.seatWidth": "Chair width", "room.seatHeight": "Chair height", "room.autoArrangeSeats": "Auto arrange this table", "room.opening": "U opening", "room.openBottom": "Bottom", "room.openTop": "Top", "room.openLeft": "Left", "room.openRight": "Right", "room.roundRadius": "Round table seat radius", "room.edgeTop": "Top", "room.edgeRight": "Right", "room.edgeBottom": "Bottom", "room.edgeLeft": "Left",
      "room.tableX": "Table X", "room.tableY": "Table Y", "room.tableWidth": "Table width %", "room.tableHeight": "Table height %", "room.zoom": "Canvas zoom", "room.zoomReset": "Reset view",
      "room.seatOverlap": "{count} seats are too close together. Adjust the table or individual seats.", "room.pathOverlap": "{count} table(s) overlap a reserved path. Move the table away.", "room.geometryOk": "Seat spacing looks clear.",
      "room.undo": "Undo room edit", "room.redo": "Redo room edit",
      "room.geometryHelp": "Changing the shape, opening, edge counts, or automatic layout repositions the table seats. Use Undo to restore manual positions.",

      "app.title": "Classroom Seat Master",
      "validation.collapse": "Collapse", "validation.expand": "View issues",
      "draw.skip": "Reveal now", "draw.getReady": "Eyes up — your new seats are coming", "draw.rolling": "Shuffling the possibilities…", "draw.revealing": "Your new seats are here!",
      "picker.title": "Pick students", "picker.close": "Close", "picker.count": "Students per draw", "picker.noRepeat": "No repeats this round", "picker.pool": "{available} available / {total} students", "picker.ready": "Who will be next?", "picker.start": "Pick students", "picker.next": "Draw again", "picker.reset": "New round", "picker.history": "This round’s picks", "picker.emptyHistory": "No students picked yet", "picker.exhausted": "Everyone has been picked! Start a new round to continue.", "picker.noStudents": "There are no active students. Set up the class roster first.", "picker.countdown": "Get ready", "picker.rolling": "Who will the spotlight find?", "picker.winners": "It’s you!", "picker.announced": "Selected: {names}", "picker.resetConfirm": "Clear this round’s picks and let everyone participate again?", "picker.saved": "Draw history is saved in this browser.", "picker.storageFailed": "History is available on this page, but could not be saved in the browser.", "picker.invalidCount": "Enter a whole number from 1 to {max}.",
      "common.saved": "Saved locally", "common.saving": "Saving…", "common.fullscreen": "Fullscreen", "common.presentation": "Present", "common.startPresentation": "Start presentation", "common.returnResult": "Return to result", "common.exitPresentation": "Exit presentation", "common.returnAdmin": "Back to admin", "common.cancel": "Cancel", "common.apply": "Apply",
      "common.soundOn": "Sound on", "common.soundOff": "Sound off", "common.untitled": "Untitled class",
      "classes.eyebrow": "CLASS MANAGEMENT", "classes.title": "Current class", "classes.choose": "Choose the class to show", "classes.count": "{count} classes", "classes.add": "Add class", "classes.duplicate": "Duplicate class", "classes.delete": "Delete class", "classes.help": "Each class keeps its own roster, layout, and draw result. Export includes every class.", "classes.newName": "New class {number}", "classes.copySuffix": "copy",
      "admin.basic": "BASIC INFO", "admin.classAndStudents": "Class & Students", "admin.className": "Class name", "admin.classNameHelp": "Enter any class name. Titles and export filenames update automatically.", "admin.maxNumber": "Highest student number", "admin.femaleStart": "First female student number", "admin.emptyNumbers": "Unused numbers", "admin.emptyPlaceholder": "e.g. 16-20, 25", "admin.emptyHelp": "Supports commas, spaces, and ranges such as 16-20, 25", "admin.displayContent": "Display format", "admin.numberOnly": "Student number only", "admin.nameOnly": "Name only", "admin.numberAndName": "Number + name",
      "admin.noPhysicalSeat": "No physical seat (student numbers)", "admin.noPhysicalSeatPlaceholder": "e.g. 3, 8-10", "admin.noPhysicalSeatHelp": "These students remain on the roster and can join student picks or task groups, without occupying a classroom seat.",
      "admin.studentData": "Student data (optional)", "admin.dataPlaceholder": "Number\tName\tNickname\tAccount\tPassword\tLocation\n1\tAlex Chen\tAlex\tstudent01\t••••••\tTaipei", "admin.dataHelp": "Use the first row for field names, then paste from Excel. Student numbers automatically update the highest and unused numbers; add any columns after the name.", "admin.dataPrivacy": "These fields appear when a student card is opened in presentation mode. Password fields are masked by default; avoid entering information that should not be shown publicly.",
      "admin.space": "ROOM LAYOUT", "admin.grid": "Seat Grid", "admin.columns": "Columns", "admin.rows": "Rows", "admin.gridHelp": "Change rows or columns at any time. Existing positions keep their settings. Click a seat to cycle its state, use the top-right button to pin a student, or click an axis label for batch changes.", "admin.rotateLayout": "Rotate entire classroom", "admin.rotateHelp": "Rotate everything 90° at a time. Student seats, the board, door, and teacher seat move together while seat rules, pins, and draw results stay intact. Rotation controls also remain available while presenting.", "admin.rotateCounterclockwise": "90° counterclockwise", "admin.rotateClockwise": "90° clockwise", "admin.genderPatterns": "Quick gender patterns", "admin.genderPatternsHelp": "Apply alternating seat rules in one click. Aisles stay in place, and uneven class ratios automatically keep the required seats unrestricted.", "admin.genderRows": "Alternate rows", "admin.genderColumns": "Alternate columns", "admin.genderCheckerboard": "Checkerboard", "admin.genderTableSequence": "Alternate seats within each table", "admin.roomMarkers": "Room marker positions", "admin.roomMarkersHelp": "Choose an edge position, then fine-tune the position and size of the board, door, and teacher seat.", "admin.boardPosition": "Board", "admin.boardLength": "Board length", "admin.positionFineTune": "Fine position", "admin.markerSize": "Marker size", "admin.doorPosition": "Door", "admin.teacherPosition": "Teacher seat", "admin.dataTools": "DATA TOOLS", "admin.backupReset": "Backup & Reset", "admin.export": "Export settings", "admin.import": "Import settings", "admin.clearPins": "Clear pins", "admin.reset": "Reset defaults",
      "mode.layout": "Home / Seat setup", "mode.prearrange": "Pre-arrange", "mode.adjust": "Adjust result", "mode.layoutHelp": "Click a seat to cycle through unrestricted, male, female, and aisle states.", "mode.prearrangeHelp": "Private pre-arrangement: click a seat to assign a student. The draw preserves it, while presentation reveals no marker.", "mode.adjustHelp": "Click two seats in sequence to swap their draw results. Empty desks can be swapped too.", "mode.adjustUnavailable": "Complete a draw to manually adjust its result here.", "mode.prearrangeCount": "{count} pre-arranged", "mode.clickToAssign": "Click to assign", "mode.swapSelected": "Selected {seat}; now choose the second seat", "mode.swapDone": "Swapped the results of {first} and {second}.",
      "seat.general": "Any student", "seat.male": "Male only", "seat.female": "Female only", "seat.aisle": "Aisle / no desk", "seat.generalShort": "Any", "seat.maleShort": "Male", "seat.femaleShort": "Female", "seat.aisleShort": "Aisle", "seat.fixed": "Pinned", "seat.number": "No. {number}", "seat.col": "Column {label}", "seat.row": "Row {number}",
      "room.board": "Board", "room.door": "Door", "room.teacher": "Teacher seat", "room.position.topStart": "Top left", "room.position.topCenter": "Top center", "room.position.topEnd": "Top right", "room.position.rightStart": "Right top", "room.position.rightCenter": "Right center", "room.position.rightEnd": "Right bottom", "room.position.bottomStart": "Bottom left", "room.position.bottomCenter": "Bottom center", "room.position.bottomEnd": "Bottom right", "room.position.leftStart": "Left top", "room.position.leftCenter": "Left center", "room.position.leftEnd": "Left bottom", "room.position.hidden": "Hidden",
      "summary.male": "Male", "summary.female": "Female", "summary.total": "Total",
      "stage.preview": "LIVE PREVIEW", "stage.draw": "SEAT DRAW", "stage.board": "FRONT OF CLASS", "stage.title": "{className} Seating Chart", "stage.pageTitle": "{className} Seat Planner", "stage.subtitle": "{seats} seats · {students} students · {empty} empty desks", "stage.valid": "Ready", "stage.errors": "{count} issues",
      "validation.aislePin": "Student {number} cannot be pinned to an aisle.", "validation.notInRoster": "Student {number} is not in the active roster.", "validation.genderMismatch": "Student {number} does not match this seat restriction.", "validation.duplicatePin": "Student {number} is pinned to more than one seat.", "validation.capacity": "Only {seats} seats are available for {students} students.", "validation.generalCapacity": "There are not enough unrestricted seats for the remaining students.",
      "draw.ready": "Press the button to start a fair random draw", "draw.drawing": "Creating a fair random arrangement…", "draw.start": "Start draw", "draw.redraw": "Draw again", "draw.done": "Draw complete. Click a student card to view details.", "draw.go": "GO!",
      "studentData.number": "Number", "studentData.name": "Name", "studentData.gender": "Gender", "studentData.male": "Male", "studentData.female": "Female", "studentData.field": "Field {number}",
      "profile.openCard": "Open student profile card", "profile.flipping": "Opening student profile card…", "profile.badge": "STUDENT CARD", "profile.closeHint": "Click outside the card or press Esc to close", "profile.noData": "No additional student data has been entered", "profile.reveal": "Reveal", "profile.hide": "Hide",
      "pin.heading": "PIN A SEAT", "pin.number": "Student number", "pin.help": "Pin markers are visible only in admin mode.", "pin.title": "Assign seat {seat}", "pin.random": "Not pinned (random placement)", "pin.option": "Student {number}",
      "toast.fixFirst": "Fix the seating configuration before presenting.", "toast.pinned": "Student {number} is pinned. The marker stays hidden in presentation mode.", "toast.unpinned": "Seat pin removed.", "toast.rotatedClockwise": "Seating chart rotated 90° clockwise.", "toast.rotatedCounterclockwise": "Seating chart rotated 90° counterclockwise.", "toast.genderPatternApplied": "Applied “{pattern}”.", "toast.genderPatternRelaxed": "Because of the class ratio, {count} seats remain unrestricted.", "toast.genderPatternPinsCleared": "Also cleared {count} conflicting pinned seats.", "toast.fullscreen": "Fullscreen was blocked by the browser.", "toast.exported": "Settings exported.", "toast.imported": "Settings imported successfully.", "toast.importFailed": "Import failed.", "toast.clearedPins": "All seat pins cleared.", "toast.reset": "Restored the default 4 × 8 layout.", "toast.rosterParsed": "Recognized and normalized {count} student records.", "toast.rosterParsedPartial": "Normalized {count} student records for {total} active numbers; {missing} records are still blank.", "toast.rosterEmpty": "No valid student records were recognized.", "confirm.reset": "Reset to defaults? Current seat settings will be cleared.", "confirm.deleteClass": "Delete “{className}”? This class will be removed from this browser.", "storage.suffix": "seating-settings", "storage.invalid": "This is not a valid Classroom Seat Master settings file."
    }
  };

  let language = "zh-Hant";
  try { language = localStorage.getItem(LANGUAGE_KEY) === "en" ? "en" : "zh-Hant"; } catch (_) {  }

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
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => { element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel)); });
    document.querySelectorAll("[data-language-label]").forEach((element) => { element.textContent = language === "en" ? "中文" : "EN"; });
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage === "en" ? "en" : "zh-Hant";
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch (_) {  }
    apply();
    window.dispatchEvent(new CustomEvent("seatmaster:languagechange", { detail: { language } }));
    return language;
  }

  SeatMaster.i18n = { t, apply, getLanguage: () => language, setLanguage, addMessages: (messages) => Object.entries(messages).forEach(([locale, entries]) => Object.assign(dictionaries[locale], entries)), toggle: () => setLanguage(language === "en" ? "zh-Hant" : "en") };
})();
