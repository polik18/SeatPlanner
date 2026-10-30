(function () {
  "use strict";

  const SeatMaster = window.SeatMaster;
  const { engine, storage, ui, sound, i18n } = SeatMaster;
  let state = SeatMaster.createDefaultState();
  let activePinSeatId = null;
  let saveTimer = null;
  let seatTimeline = null;
  let adminMode = "layout";
  let selectedAdjustmentSeatId = null;
  let profileFlipTimer = null;
  let manual;
  let studentPicker;
  let groupPlannerUi;
  let selectedTableId = null;
  let selectedPathId = null;
  let roomPointerDrag = null;
  let roomUndoStack = [];
  let roomRedoStack = [];
  const roomRangeEdits = new Set();

  function roomEditSnapshot() {
    return JSON.parse(JSON.stringify({ roomLayout: state.roomLayout, seats: state.seats, assignment: state.assignment, hasDrawn: state.hasDrawn, manualDraft: state.manualDraft || null }));
  }

  function recordRoomEdit() {
    roomUndoStack.push(roomEditSnapshot());
    if (roomUndoStack.length > 80) roomUndoStack.shift();
    roomRedoStack = [];
  }

  function restoreRoomEdit(snapshot) {
    state.roomLayout = snapshot.roomLayout;
    state.seats = snapshot.seats;
    state.assignment = snapshot.assignment;
    state.hasDrawn = snapshot.hasDrawn;
    state.manualDraft = snapshot.manualDraft;
    selectedTableId = state.roomLayout?.selectedTableId || null;
    selectedPathId = state.roomLayout?.selectedPathId || null;
    render({ keepInputs: true });
    saveSoon();
  }

  function undoRoomEdit() {
    if (!roomUndoStack.length) return;
    roomRedoStack.push(roomEditSnapshot());
    restoreRoomEdit(roomUndoStack.pop());
  }

  function redoRoomEdit() {
    if (!roomRedoStack.length) return;
    roomUndoStack.push(roomEditSnapshot());
    restoreRoomEdit(roomRedoStack.pop());
  }

  function startRoomRangeEdit(id) {
    if (roomRangeEdits.has(id)) return;
    roomRangeEdits.add(id);
    recordRoomEdit();
  }

  function hydrate(rawState) {
    const config = engine.normalizeConfig(rawState && rawState.config ? rawState.config : state.config);
    const hasRoomLayout = rawState && rawState.roomLayout && Array.isArray(rawState.roomLayout.tables);
    const seats = hasRoomLayout ? SeatMaster.roomLayout.normalizeSeats(rawState.seats) : engine.buildSeatGrid(config, rawState && rawState.seats ? rawState.seats : []);
    const roomLayout = hasRoomLayout ? SeatMaster.roomLayout.normalize(rawState.roomLayout, seats) : null;
    const students = engine.studentsRequiringSeats(config);
    const validNumbers = new Set(students.map((student) => student.number));
    const usableIds = new Set(seats.filter((seat) => seat.type !== "aisle").map((seat) => seat.id));
    const sourceAssignment = rawState && rawState.hasDrawn && rawState.assignment && typeof rawState.assignment === "object" ? rawState.assignment : {};
    const assignment = {};
    const assigned = new Set();
    let resultValid = Boolean(rawState && rawState.hasDrawn);
    usableIds.forEach((id) => {
      const value = sourceAssignment[id];
      if (value === null || value === undefined) assignment[id] = null;
      else if (Number.isInteger(value) && validNumbers.has(value) && !assigned.has(value)) { assignment[id] = value; assigned.add(value); }
      else resultValid = false;
    });
    if (assigned.size !== students.length) resultValid = false;
    const hydrated = { version: SeatMaster.constants.VERSION, config, seats, assignment: resultValid ? assignment : {}, hasDrawn: resultValid,
      resultSource: rawState && rawState.resultSource === "manual" ? "manual" : "draw", manualDraft: null,
      activities: Array.isArray(rawState && rawState.activities) ? rawState.activities : [], roomLayout };
    if (rawState && rawState.manualDraft && typeof rawState.manualDraft === "object") hydrated.manualDraft = SeatMaster.manualSeating.normalize(hydrated, rawState.manualDraft);
    hydrated.adminMode = ["layout", "prearrange", "manual", "adjust"].includes(rawState && rawState.adminMode) ? rawState.adminMode : hydrated.manualDraft ? "manual" : "layout";
    if (hydrated.adminMode === "adjust" && !resultValid) hydrated.adminMode = "layout";
    return hydrated;
  }

  function saveSoon() {
    ui.setSaveStatus(i18n.t("common.saving"));
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      storage.save(state);
      ui.setSaveStatus(i18n.t("common.saved"));
    }, 180);
  }

  function render(options) {
    const focusedSeat = document.activeElement.closest(".seat")?.dataset.seatId;
    const presentation = document.body.classList.contains("presentation-mode");
    if (!options || !options.keepInputs) ui.fillInputs(state);
    const manualActive = adminMode === "manual" && !presentation;
    if (manualActive && !state.manualDraft) manual.start();
    ui.renderSummary(manualActive ? { ...state, seats: state.seats.map((s) => ({ ...s, pin: null, type: s.type === "aisle" ? "aisle" : "general" })) } : state);
    ui.renderRoomMarkers(state);
    ui.renderSeatGrid(state, presentation, adminMode, selectedAdjustmentSeatId);
    document.getElementById("roomUndoButton").disabled = !roomUndoStack.length;
    document.getElementById("roomRedoButton").disabled = !roomRedoStack.length;
    updateAdminModeUI();
    if (manual) manual.render(manualActive);
    if (manualActive && focusedSeat) document.querySelector(`.seat[data-seat-id="${focusedSeat}"]`)?.focus({ preventScroll: true });
    ui.positionValidationNotice();
  }

  function updateAdminModeUI() {
    if (adminMode === "adjust" && !state.hasDrawn) adminMode = "layout";
    state.adminMode = adminMode;
    const atHome = adminMode === "layout" && !document.body.classList.contains("presentation-mode");
    document.getElementById("homeButtonText").textContent = i18n.t(atHome ? "home.current" : "home.back");
    document.getElementById("homeButton").setAttribute("aria-current", atHome ? "page" : "false");
    document.getElementById("otherToolsLink").hidden = !atHome;
    document.querySelectorAll("[data-admin-mode]").forEach((button) => {
      const active = button.dataset.adminMode === adminMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.getElementById("adjustModeButton").disabled = !state.hasDrawn;
    const help = document.getElementById("adminModeHelp");
    if (adminMode === "adjust" && selectedAdjustmentSeatId) {
      const seat = state.seats.find((item) => item.id === selectedAdjustmentSeatId);
      help.textContent = i18n.t("mode.swapSelected", { seat: `${ui.columnLabel(seat.col)}${seat.row + 1}` });
    } else {
      help.textContent = i18n.t(`mode.${adminMode}Help`);
    }
    const pinCount = state.seats.filter((seat) => seat.pin).length;
    document.getElementById("prearrangeCount").hidden = adminMode === "manual";
    document.getElementById("prearrangeCount").textContent = adminMode === "adjust" && !state.hasDrawn ? i18n.t("mode.adjustUnavailable") : i18n.t("mode.prearrangeCount", { count: pinCount });
    document.getElementById("presentationButton").textContent = i18n.t(state.hasDrawn ? "common.returnResult" : "common.presentation");
  }

  function readConfigFromInputs() {
    return engine.normalizeConfig({
      className: document.getElementById("classNameInput").value,
      rows: document.getElementById("rowsInput").value,
      cols: document.getElementById("colsInput").value,
      maxNumber: document.getElementById("maxNumberInput").value,
      emptyNumbers: document.getElementById("emptyNumbersInput").value,
      seatExcludedNumbers: document.getElementById("seatExcludedNumbersInput").value,
      femaleStart: document.getElementById("femaleStartInput").value,
      displayMode: document.getElementById("displayModeInput").value,
      studentData: document.getElementById("studentDataInput").value,
      boardPosition: document.getElementById("boardPositionInput").value,
      boardLength: document.getElementById("boardLengthInput").value,
      doorPosition: document.getElementById("doorPositionInput").value,
      doorOffset: document.getElementById("doorOffsetInput").value,
      teacherPosition: document.getElementById("teacherPositionInput").value,
      teacherOffset: document.getElementById("teacherOffsetInput").value
    });
  }

  function syncRosterConfigFromSpreadsheet(value) {
    const numbers = engine.inferStudentNumbers(value);
    if (!numbers.length) return;
    const maxNumber = numbers[numbers.length - 1];
    const present = new Set(numbers);
    const emptyNumbers = [];
    for (let number = 1; number <= maxNumber; number += 1) {
      if (!present.has(number)) emptyNumbers.push(number);
    }
    document.getElementById("maxNumberInput").value = maxNumber;
    document.getElementById("emptyNumbersInput").value = engine.formatNumberRanges(emptyNumbers);
  }

  function normalizeStudentDataInput(showFeedback, syncRoster) {
    const input = document.getElementById("studentDataInput");
    if (syncRoster) syncRosterConfigFromSpreadsheet(input.value);
    const config = readConfigFromInputs();
    const students = engine.buildStudents(config);
    const records = engine.parseStudentRecords(input.value, students);
    input.value = engine.normalizeStudentData(input.value, students);
    if (showFeedback) {
      const key = !records.size ? "toast.rosterEmpty" : records.size < students.length ? "toast.rosterParsedPartial" : "toast.rosterParsed";
      ui.showToast(i18n.t(key, { count: records.size, total: students.length, missing: students.length - records.size }), records.size ? undefined : "error");
    }
  }

  function updateFromInputs() {
    const config = readConfigFromInputs();
    const previous = state.config;
    const cosmeticOnly = ["rows", "cols", "maxNumber", "emptyNumbers", "femaleStart", "studentData", "seatExcludedNumbers"].every((key) => previous[key] === config[key]);
    state.config = config;
    if (cosmeticOnly) { render(); saveSoon(); return; }
    if (!state.roomLayout) state.seats = engine.buildSeatGrid(config, state.seats);
    const validNumbers = new Set(engine.studentsRequiringSeats(config).map((student) => student.number));
    state.seats.forEach((seat) => { if (seat.pin && !validNumbers.has(seat.pin)) seat.pin = null; });
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (manual) manual.reset();
    selectedAdjustmentSeatId = null;
    render();
    saveSoon();
  }

  function updateRoomMarkersFromInputs() {
    const config = readConfigFromInputs();
    state.config.boardPosition = config.boardPosition;
    state.config.boardLength = config.boardLength;
    state.config.doorPosition = config.doorPosition;
    state.config.doorOffset = config.doorOffset;
    state.config.teacherPosition = config.teacherPosition;
    state.config.teacherOffset = config.teacherOffset;
    ui.fillRoomControlOutputs(state.config);
    ui.renderRoomMarkers(state);
    saveSoon();
  }

  function rotateLayout(direction) {
    if (document.body.classList.contains("drawing-mode")) return;
    closeStudentProfile();
    if (state.roomLayout) {
      recordRoomEdit();
      state.roomLayout.tables.forEach((table) => {
        const oldX = table.x;
        table.x = direction === "clockwise" ? 100 - table.y : table.y;
        table.y = direction === "clockwise" ? oldX : 100 - oldX;
        [table.width, table.height] = [table.height, table.width];
        table.rotation = (table.rotation + (direction === "clockwise" ? 90 : 270)) % 360;
      });
      state.roomLayout.paths.forEach((path) => {
        const oldX = path.x;
        path.x = direction === "clockwise" ? 100 - path.y - path.height : path.y;
        path.y = direction === "clockwise" ? oldX : 100 - oldX - path.width;
        [path.width, path.height] = [path.height, path.width];
      });
      render({ keepInputs: true }); saveSoon();
      ui.showToast(i18n.t(direction === "clockwise" ? "toast.rotatedClockwise" : "toast.rotatedCounterclockwise"));
      return;
    }
    const rotated = engine.rotateSeatLayout(state.config, state.seats, state.assignment, direction);
    state.config = engine.normalizeConfig(rotated.config);
    state.seats = rotated.seats;
    state.assignment = rotated.assignment;
    if (state.manualDraft) state.manualDraft = Object.fromEntries(Object.entries(state.manualDraft).map(([id, number]) => [rotated.idMap.get(id), number]));
    manual.reset();
    selectedAdjustmentSeatId = selectedAdjustmentSeatId ? rotated.idMap.get(selectedAdjustmentSeatId) || null : null;
    activePinSeatId = null;
    const dialog = document.getElementById("pinDialog");
    if (dialog.open) dialog.close();
    render();
    const roomLayout = document.getElementById("roomLayout");
    roomLayout.classList.remove("is-rotating");
    void roomLayout.offsetWidth;
    roomLayout.classList.add("is-rotating");
    window.setTimeout(() => roomLayout.classList.remove("is-rotating"), 360);
    saveSoon();
    ui.showToast(i18n.t(direction === "clockwise" ? "toast.rotatedClockwise" : "toast.rotatedCounterclockwise"));
  }

  function applyRoomTemplate(template) {
    if (template === "grid" && !state.roomLayout) return;
    closeStudentProfile();
    recordRoomEdit();
    if (template === "grid") {
      if (!state.roomLayout) return;
      const oldSeats = new Map(state.seats.map((seat) => [seat.id, seat]));
      const oldOrder = state.roomLayout.tables.flatMap((table) => table.seatIds).map((id) => oldSeats.get(id)).filter(Boolean);
      const gridSeats = engine.buildSeatGrid(state.config, state.seats);
      const newUsable = gridSeats.filter((seat) => seat.type !== "aisle");
      const idMap = new Map();
      oldOrder.forEach((oldSeat, index) => {
        const nextSeat = newUsable[index];
        if (!nextSeat) return;
        idMap.set(oldSeat.id, nextSeat.id);
        nextSeat.type = oldSeat.type;
        nextSeat.pin = oldSeat.pin;
      });
      state.assignment = Object.fromEntries(Object.entries(state.assignment).filter(([id]) => idMap.has(id)).map(([id, number]) => [idMap.get(id), number]));
      if (state.manualDraft) state.manualDraft = Object.fromEntries(Object.entries(state.manualDraft).filter(([id]) => idMap.has(id)).map(([id, number]) => [idMap.get(id), number]));
      state.seats = gridSeats;
      state.roomLayout = null;
      selectedTableId = null; selectedPathId = null;
      if (state.hasDrawn && new Set(Object.values(state.assignment).filter(Number.isInteger)).size !== engine.studentsRequiringSeats(state.config).length) { state.hasDrawn = false; state.assignment = {}; }
      if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    } else {
      const created = SeatMaster.roomLayout.createTemplate(state, template);
      state.seats = created.seats;
      state.roomLayout = created.roomLayout;
      state.assignment = Object.fromEntries(state.seats.filter((seat) => seat.type !== "aisle").map((seat) => [seat.id, state.assignment[seat.id] ?? null]));
      if (state.hasDrawn && new Set(Object.values(state.assignment).filter(Number.isInteger)).size !== engine.studentsRequiringSeats(state.config).length) { state.hasDrawn = false; state.assignment = {}; }
      if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
      selectedTableId = state.roomLayout.tables[0]?.id || null;
      state.roomLayout.selectedTableId = selectedTableId;
      selectedPathId = state.roomLayout.paths[0]?.id || null;
      state.roomLayout.selectedSeatId = null;
    }
    manual.reset();
    render({ keepInputs: true }); saveSoon();
  }

  function rotateSelectedTable(delta) {
    const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
    if (!table) return;
    recordRoomEdit();
    table.rotation = (table.rotation + delta + 360) % 360;
    render({ keepInputs: true }); saveSoon();
  }

  function duplicateSelectedTable() {
    const layout = state.roomLayout;
    const source = layout?.tables.find((table) => table.id === selectedTableId);
    if (!source) return;
    recordRoomEdit();
    const idNumber = layout.nextTableId++;
    const copy = { ...source, id: `table-${idNumber}`, x: Math.min(90, source.x + 8), y: Math.min(90, source.y + 8), seatIds: [], seatPositions: [] };
    source.seatIds.forEach(() => {
      const index = layout.nextSeatId++;
      const id = `free-${index}`;
      state.seats.push({ id, row: Math.floor((state.seats.length) / 6), col: state.seats.length % 6, type: "general", pin: null });
      copy.seatIds.push(id);
      if (state.hasDrawn) state.assignment[id] = null;
    });
    copy.seatPositions = SeatMaster.roomLayout.autoSeatPositions(copy, copy.seatIds);
    layout.tables.push(copy); selectedTableId = copy.id;
    layout.selectedTableId = selectedTableId;
    render({ keepInputs: true }); saveSoon();
  }

  function addRoomTable() {
    const layout = state.roomLayout;
    if (!layout) return;
    recordRoomEdit();
    const idNumber = layout.nextTableId++;
    const table = { id: `table-${idNumber}`, type: "rect", x: 50, y: 50, width: 28, height: 28, rotation: 0, seatIds: [], seatPositions: [], edgeCounts: null, geometry: { opening: "bottom", seatRadius: 44, startAngle: -90, armThickness: 12 } };
    for (let index = 0; index < 4; index += 1) {
      const seatId = `free-${layout.nextSeatId++}`;
      state.seats.push({ id: seatId, row: Math.floor(state.seats.length / 6), col: state.seats.length % 6, type: "general", pin: null });
      table.seatIds.push(seatId);
      if (state.hasDrawn) state.assignment[seatId] = null;
    }
    table.seatPositions = SeatMaster.roomLayout.autoSeatPositions(table, table.seatIds);
    layout.tables.push(table); selectedTableId = table.id;
    layout.selectedTableId = selectedTableId;
    render({ keepInputs: true }); saveSoon();
  }

  function addSeatToSelectedTable() {
    const layout = state.roomLayout;
    const table = layout?.tables.find((item) => item.id === selectedTableId);
    if (!table) return;
    setSelectedTableSeatCount(table.seatIds.length + 1);
  }

  function removeSeatFromSelectedTable() {
    const layout = state.roomLayout;
    const table = layout?.tables.find((item) => item.id === selectedTableId);
    if (!table || table.seatIds.length <= 1) return;
    setSelectedTableSeatCount(table.seatIds.length - 1);
  }

  function setSelectedTableSeatCount(count, options = {}) {
    const layout = state.roomLayout;
    const table = layout?.tables.find((item) => item.id === selectedTableId);
    if (!layout || !table) return;
    if (!options.alreadyRecorded) recordRoomEdit();
    if (options.resetEdges) table.edgeCounts = null;
    const target = Math.max(1, Math.min(60, Math.round(Number(count) || 1)));
    const oldIds = new Set(table.seatIds);
    const next = SeatMaster.roomLayout.setSeatCount(table, table.seatIds, target, () => layout.nextSeatId++, Boolean(options.resetPositions));
    table.seatIds = next.seatIds;
    table.seatPositions = next.seatPositions;
    const nextIds = new Set(table.seatIds);
    state.seats = state.seats.filter((seat) => !oldIds.has(seat.id) || nextIds.has(seat.id));
    table.seatIds.filter((id) => !oldIds.has(id)).forEach((id) => {
      state.seats.push({ id, row: Math.floor(state.seats.length / 6), col: state.seats.length % 6, type: "general", pin: null });
    });
    const addedSeat = [...table.seatIds].reverse().find((id) => !oldIds.has(id));
    if (addedSeat) layout.selectedSeatId = addedSeat;
    if (state.hasDrawn) {
      state.assignment = Object.fromEntries(state.seats.filter((seat) => seat.type !== "aisle").map((seat) => [seat.id, state.assignment[seat.id] ?? null]));
      state.hasDrawn = Object.values(state.assignment).filter(Number.isInteger).length === engine.studentsRequiringSeats(state.config).length;
      if (!state.hasDrawn) state.assignment = {};
    }
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (!table.seatIds.includes(layout.selectedSeatId)) layout.selectedSeatId = null;
    render({ keepInputs: true }); saveSoon();
  }

  function autoArrangeSelectedSeats() {
    const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
    if (!table) return;
    recordRoomEdit();
    table.seatPositions = SeatMaster.roomLayout.autoSeatPositions(table, table.seatIds);
    render({ keepInputs: true }); saveSoon();
  }

  function setSelectedSeatCoordinate(axis, value) {
    const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
    const position = table?.seatPositions.find((item) => item.id === state.roomLayout.selectedSeatId);
    if (!position) return;
    recordRoomEdit();
    position[axis] = Math.max(2, Math.min(98, Number(value) || 2));
    render({ keepInputs: true }); saveSoon();
  }

  function deleteSelectedTable() {
    const layout = state.roomLayout;
    if (!layout || layout.tables.length < 2) { ui.showToast(i18n.t("room.keepOneTable"), "error"); return; }
    const table = layout.tables.find((item) => item.id === selectedTableId);
    if (!table) return;
    recordRoomEdit();
    const removed = new Set(table.seatIds);
    layout.tables = layout.tables.filter((item) => item.id !== selectedTableId);
    state.seats = state.seats.filter((seat) => !removed.has(seat.id));
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    selectedTableId = layout.tables[0]?.id || null;
    layout.selectedTableId = selectedTableId;
    render({ keepInputs: true }); saveSoon();
  }

  function addRoomPath() {
    const layout = state.roomLayout;
    if (!layout) return;
    recordRoomEdit();
    const path = { id: `path-${Date.now()}`, x: 8, y: 45, width: 8, height: 10, label: i18n.t("room.wheelchairPath") };
    layout.paths.push(path); selectedPathId = path.id; layout.selectedPathId = selectedPathId;
    render({ keepInputs: true }); saveSoon();
  }

  function cycleSeat(seatId) {
    const seat = state.seats.find((item) => item.id === seatId);
    if (!seat) return;
    ui.setValidationAnchor(`.seat[data-seat-id="${seatId}"]`);
    seat.type = engine.nextSeatType(seat.type);
    if (seat.type === "aisle") seat.pin = null;
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (manual) manual.reset();
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
  }

  function cycleAxis(axis, index) {
    ui.setValidationAnchor(`[data-axis="${axis}"][data-index="${index}"]`);
    const seats = state.seats.filter((seat) => seat[axis] === index);
    if (!seats.length) return;
    const nextType = engine.nextSeatType(seats[0].type);
    seats.forEach((seat) => {
      seat.type = nextType;
      if (nextType === "aisle") seat.pin = null;
    });
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (manual) manual.reset();
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
  }

  function applyGenderPattern(pattern) {
    closeStudentProfile();
    const roomOrder = pattern === "tableSequence" && state.roomLayout
      ? Object.fromEntries(state.roomLayout.tables.flatMap((table) => {
        const positions = new Map((table.seatPositions || []).map((position) => [position.id, position]));
        return table.seatIds
          .map((id) => ({ id, point: positions.get(id) }))
          .sort((left, right) => {
            const angle = (item) => Math.atan2((item.point?.y || 50) - 50, (item.point?.x || 50) - 50);
            return angle(left) - angle(right);
          })
          .map(({ id }, index) => [id, { index }]);
      }))
      : null;
    const result = engine.applyGenderPattern(state.config, state.seats, pattern, roomOrder);
    state.seats = result.seats;
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (manual) manual.reset();
    selectedAdjustmentSeatId = null;
    adminMode = "layout";
    render({ keepInputs: true });
    saveSoon();
    const patternKeys = { rows: "admin.genderRows", columns: "admin.genderColumns", checkerboard: "admin.genderCheckerboard", tableSequence: "admin.genderTableSequence" };
    const messages = [i18n.t("toast.genderPatternApplied", { pattern: i18n.t(patternKeys[pattern]) })];
    if (result.relaxedSeats) messages.push(i18n.t("toast.genderPatternRelaxed", { count: result.relaxedSeats }));
    if (result.clearedPins.length) messages.push(i18n.t("toast.genderPatternPinsCleared", { count: result.clearedPins.length }));
    ui.showToast(messages.join(" "));
  }

  function openPinDialog(seatId) {
    const seat = state.seats.find((item) => item.id === seatId);
    if (!seat || seat.type === "aisle") return;
    activePinSeatId = seatId;
    ui.setValidationAnchor(`.seat[data-seat-id="${seatId}"]`);
    const students = engine.studentsRequiringSeats(state.config);
    const usedNumbers = new Set(state.seats.filter((item) => item.id !== seatId && item.pin).map((item) => item.pin));
    const available = students.filter((student) => !usedNumbers.has(student.number) && engine.isCompatible(seat, student));
    const select = document.getElementById("pinStudentSelect");
    select.innerHTML = `<option value="">${ui.escapeHtml(i18n.t("pin.random"))}</option>${available.map((student) => `<option value="${student.number}">${ui.escapeHtml(i18n.t("pin.option", { number: student.number }))}</option>`).join("")}`;
    select.value = seat.pin || "";
    document.getElementById("pinDialogTitle").textContent = i18n.t("pin.title", { seat: `${ui.columnLabel(seat.col)}${seat.row + 1}` });
    previewPin();
    document.getElementById("pinDialog").showModal();
  }

  function previewPin() {
    const value = Number.parseInt(document.getElementById("pinStudentSelect").value, 10);
    const seats = state.seats.map((seat) => seat.id === activePinSeatId ? { ...seat, pin: Number.isInteger(value) ? value : null } : seat);
    ui.renderValidation(engine.validate({ ...state, seats }), document.getElementById("pinValidationPanel"));
  }

  function applyPin() {
    const seat = state.seats.find((item) => item.id === activePinSeatId);
    if (!seat) return;
    const value = Number.parseInt(document.getElementById("pinStudentSelect").value, 10);
    seat.pin = Number.isInteger(value) ? value : null;
    state.assignment = {};
    state.hasDrawn = false;
    if (state.manualDraft) state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    if (manual) manual.reset();
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
    if (engine.validate(state).valid) ui.showToast(seat.pin ? i18n.t("toast.pinned", { number: seat.pin }) : i18n.t("toast.unpinned"));
  }

  function finishManual() {
    state.manualDraft = SeatMaster.manualSeating.normalize(state, state.manualDraft);
    const pending = SeatMaster.manualSeating.remaining(state, state.manualDraft);
    if (pending.length) { ui.showToast(i18n.t("manual.incomplete", { count: pending.length }), "error"); return; }
    state.assignment = { ...state.manualDraft };
    state.hasDrawn = true;
    state.resultSource = "manual";
    state.manualDraft = null;
    manual.reset();
    adminMode = "adjust";
    saveSoon();
    enterPresentation();
  }

  function enterPresentation() {
    if (adminMode === "manual") { finishManual(); return; }
    const report = state.hasDrawn && state.resultSource === "manual" ? { valid: true } : engine.validate(state);
    if (!report.valid) {
      ui.showToast(i18n.t("toast.fixFirst"), "error");
      ui.setValidationAnchor("#presentationButton");
      ui.renderSummary(state);
      return;
    }
    if (!state.hasDrawn) {
      state.assignment = {};
      state.hasDrawn = false;
    }
    document.getElementById("toast").classList.remove("is-visible", "is-error");
    document.body.classList.add("presentation-mode");
    window.scrollTo(0, 0);
    document.getElementById("drawButtonText").textContent = i18n.t(state.hasDrawn ? "draw.redraw" : "draw.start");
    document.getElementById("drawMessage").textContent = i18n.t(state.hasDrawn ? state.resultSource === "manual" ? "manual.done" : "draw.done" : "draw.ready");
    updateSoundButton();
    render({ keepInputs: true });
  }

  function exitPresentation() {
    closeStudentProfile();
    if (seatTimeline) seatTimeline.cancel();
    seatTimeline = null;
    resetDrawEffects();
    document.body.classList.remove("drawing-mode");
    document.body.classList.remove("presentation-mode");
    setPresentationRotationDisabled(false);
    adminMode = state.hasDrawn ? "adjust" : adminMode;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
  }

  function goHome() {
    // Closing activities uses the same cancellation path as their own exit.
    // A draft is kept separately and must never be completed or cleared here.
    if (studentPicker) studentPicker.close();
    const dialog = document.getElementById("pinDialog");
    if (dialog.open) dialog.close();
    activePinSeatId = null;
    exitPresentation();
    setAdminMode("layout");
    ui.setValidationAnchor(null);
    document.querySelector(".control-panel").scrollTop = 0;
    document.querySelector(".classroom-stage").scrollTop = 0;
    window.scrollTo(0, 0);
    document.querySelector('[data-admin-mode="layout"]').focus({ preventScroll: true });
  }

  function isSensitiveField(label) {
    return /(?:密碼|密码|口令|password|passwd|passcode|pwd|pin)/i.test(String(label || ""));
  }

  function openStudentProfile(seatId) {
    if (document.body.classList.contains("drawing-mode")) return;
    if (!state.hasDrawn) return;
    const number = state.assignment[seatId];
    if (!Number.isInteger(number)) return;
    const students = engine.buildStudents(state.config);
    const record = engine.parseStudentRecords(state.config.studentData, students).get(number);
    if (!record) return;
    const overlay = document.getElementById("studentProfileOverlay");
    const card = document.getElementById("studentProfileCard");
    const numberLabel = i18n.t("seat.number", { number });
    const name = record.name || numberLabel;
    document.getElementById("studentProfileNumber").textContent = numberLabel;
    document.getElementById("studentProfileBackNumber").textContent = numberLabel;
    document.getElementById("studentProfileFrontName").textContent = name;
    document.getElementById("studentProfileName").textContent = name;
    const fields = document.getElementById("studentProfileFields");
    fields.innerHTML = record.fields.length ? record.fields.map((field, index) => {
      const sensitive = isSensitiveField(field.label);
      const value = sensitive ? "••••••••" : field.value;
      return `<div class="profile-field"><span>${ui.escapeHtml(field.label)}</span><div class="profile-value-row"><strong id="profileValue${index}" ${sensitive ? `data-actual="${ui.escapeHtml(field.value)}" data-sensitive="true"` : ""}>${ui.escapeHtml(value)}</strong>${sensitive ? `<button class="sensitive-toggle" type="button" data-target="profileValue${index}" aria-pressed="false">${ui.escapeHtml(i18n.t("profile.reveal"))}</button>` : ""}</div></div>`;
    }).join("") : `<p class="profile-empty">${ui.escapeHtml(i18n.t("profile.noData"))}</p>`;
    window.clearTimeout(profileFlipTimer);
    overlay.hidden = false;
    card.classList.remove("is-flipped");
    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      profileFlipTimer = window.setTimeout(() => card.classList.add("is-flipped"), 260);
    });
    document.getElementById("studentProfileClose").focus({ preventScroll: true });
  }

  function closeStudentProfile() {
    const overlay = document.getElementById("studentProfileOverlay");
    const card = document.getElementById("studentProfileCard");
    window.clearTimeout(profileFlipTimer);
    card.classList.remove("is-flipped");
    overlay.classList.remove("is-open");
    window.setTimeout(() => { if (!overlay.classList.contains("is-open")) overlay.hidden = true; }, 260);
  }

  function setAdminMode(mode) {
    if (!['layout', 'prearrange', 'manual', 'adjust'].includes(mode)) return;
    if (mode === "adjust" && !state.hasDrawn) return;
    adminMode = mode;
    selectedAdjustmentSeatId = null;
    if (mode === "manual") manual.start();
    render({ keepInputs: true });
    saveSoon();
  }

  function selectAdjustmentSeat(seatId) {
    const seat = state.seats.find((item) => item.id === seatId);
    if (!seat || seat.type === "aisle" || !state.hasDrawn) return;
    if (!selectedAdjustmentSeatId) {
      selectedAdjustmentSeatId = seatId;
      render({ keepInputs: true });
      return;
    }
    if (selectedAdjustmentSeatId === seatId) {
      selectedAdjustmentSeatId = null;
      render({ keepInputs: true });
      return;
    }
    const firstId = selectedAdjustmentSeatId;
    const firstSeat = state.seats.find((item) => item.id === firstId);
    [state.assignment[firstId], state.assignment[seatId]] = [state.assignment[seatId], state.assignment[firstId]];
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
    ui.showToast(i18n.t("mode.swapDone", { first: `${ui.columnLabel(firstSeat.col)}${firstSeat.row + 1}`, second: `${ui.columnLabel(seat.col)}${seat.row + 1}` }));
  }

  function updateSoundButton() {
    const button = document.getElementById("soundButton");
    const enabled = sound.isEnabled();
    button.setAttribute("aria-pressed", String(enabled));
    button.classList.toggle("is-muted", !enabled);
    document.getElementById("soundButtonText").textContent = i18n.t(enabled ? "common.soundOn" : "common.soundOff");
  }

  function setPresentationRotationDisabled(disabled) {
    document.querySelectorAll(".presentation-rotate-button, .student-draw-open, .presentation-only .language-button").forEach((button) => { button.disabled = disabled; });
  }

  function resetDrawEffects() {
    document.getElementById("drawCountdown").classList.remove("is-active");
    document.getElementById("drawSpotlight").classList.remove("is-active");
    document.getElementById("celebrationLayer").classList.remove("is-active");
    document.getElementById("celebrationLayer").innerHTML = "";
    document.getElementById("skipDrawButton").hidden = true;
    document.getElementById("drawButton").disabled = false;
    document.getElementById("drawButton").classList.remove("is-drawing");
  }

  function startDraw() {
    if (document.body.classList.contains("drawing-mode")) return;
    closeStudentProfile();
    let assignment;
    try {
      assignment = engine.arrange(state);
    } catch (error) {
      ui.showToast(error.message.split("\n")[0], "error");
      return;
    }

    const button = document.getElementById("drawButton");
    const message = document.getElementById("drawMessage");
    const students = engine.studentsRequiringSeats(state.config).map((student) => student.number);
    const directory = engine.parseStudentNames(state.config.studentData, engine.buildStudents(state.config));
    if (seatTimeline) seatTimeline.cancel();
    resetDrawEffects();
    document.body.classList.add("drawing-mode");
    setPresentationRotationDisabled(true);
    button.disabled = true;
    button.classList.add("is-drawing");
    message.textContent = i18n.t("draw.drawing");

    render({ keepInputs: true });
    ui.renderSeatGrid({ ...state, hasDrawn: false }, true, adminMode, null);
    document.getElementById("skipDrawButton").hidden = false;
    // Keep the previous assignment until the new result is actually revealed.
    const seatElements = Array.from(document.querySelectorAll(".seat:not(.is-aisle)"));
    seatTimeline = SeatMaster.effects.run({
      onStage(phase, number) {
        const overlay = document.getElementById("drawCountdown");
        overlay.classList.toggle("is-active", phase === "countdown");
        document.getElementById("drawSpotlight").classList.toggle("is-active", phase === "rolling");
        if (phase === "countdown") {
          const text = document.getElementById("drawCountdownText");
          text.textContent = number;
          text.classList.remove("is-pop"); void text.offsetWidth; text.classList.add("is-pop");
        }
        if (phase === "rolling") {
          message.textContent = i18n.t("draw.rolling");
          seatElements.forEach((element) => element.classList.add("is-rolling"));
        }
      },
      onTick() {
        const samples = engine.secureShuffle(students);
        seatElements.forEach((element, index) => ui.renderRollingValue(element, state, samples[index % samples.length] || null, directory));
      },
      onReveal() {
        state.assignment = assignment;
        state.hasDrawn = true;
        state.resultSource = "draw";
        state.manualDraft = null;
        manual.reset();
        render({ keepInputs: true });
        document.querySelectorAll(".seat:not(.is-aisle)").forEach((element, index) => {
          element.style.setProperty("--reveal-delay", `${Math.min(index * 18, 640)}ms`);
          element.classList.add("is-final");
        });
        document.getElementById("skipDrawButton").hidden = true;
        message.textContent = i18n.t("draw.revealing");
        SeatMaster.effects.celebrate(document.getElementById("celebrationLayer"));
        saveSoon();
      },
      onFinish() {
        document.body.classList.remove("drawing-mode");
        button.disabled = false;
        button.classList.remove("is-drawing");
        setPresentationRotationDisabled(false);
        document.getElementById("drawButtonText").textContent = i18n.t("draw.redraw");
        message.textContent = i18n.t("draw.done");
      }
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => ui.showToast(i18n.t("toast.fullscreen"), "error"));
    else document.exitFullscreen();
  }

  function refreshLanguage() {
    closeStudentProfile();
    i18n.apply();
    ui.populateRoomPositionOptions();
    ui.fillInputs(state);
    updateSoundButton();
    const button = document.getElementById("drawButton");
    if (button.disabled) {
      document.getElementById("drawMessage").textContent = i18n.t("draw.drawing");
    } else if (state.hasDrawn) {
      render({ keepInputs: true });
      document.getElementById("drawButtonText").textContent = i18n.t("draw.redraw");
      document.getElementById("drawMessage").textContent = i18n.t(state.resultSource === "manual" ? "manual.done" : "draw.done");
    } else {
      render({ keepInputs: true });
      document.getElementById("drawButtonText").textContent = i18n.t("draw.start");
      document.getElementById("drawMessage").textContent = i18n.t("draw.ready");
    }
  }

  function bindEvents() {
    let noticeFrame = null;
    const positionNotice = () => {
      if (noticeFrame !== null) return;
      noticeFrame = window.requestAnimationFrame(() => { noticeFrame = null; ui.positionValidationNotice(); });
    };
    document.addEventListener("scroll", positionNotice, { capture: true, passive: true });
    window.addEventListener("resize", positionNotice);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", positionNotice);
      window.visualViewport.addEventListener("scroll", positionNotice);
    }
    window.addEventListener("pagehide", () => {
      if (saveTimer !== null) { window.clearTimeout(saveTimer); saveTimer = null; storage.save(state); }
    });
    document.getElementById("validationToggle").addEventListener("click", ui.toggleValidationNotice);
    document.querySelector(".control-panel").addEventListener("input", () => ui.setValidationAnchor(null), true);
    document.getElementById("pinStudentSelect").addEventListener("change", previewPin);
    document.getElementById("pinDialog").addEventListener("close", positionNotice);
    ["classNameInput", "rowsInput", "colsInput", "maxNumberInput", "emptyNumbersInput", "seatExcludedNumbersInput", "femaleStartInput", "displayModeInput"].forEach((id) => {
      document.getElementById(id).addEventListener("change", updateFromInputs);
    });
    document.getElementById("manualNonSeatStudents").addEventListener("click", (event) => {
      const button = event.target.closest("[data-seat-requirement]");
      if (!button) return;
      const number = Number(button.dataset.seatRequirement);
      const excluded = engine.parseEmptyNumbers(state.config.seatExcludedNumbers, state.config.maxNumber);
      excluded.delete(number);
      document.getElementById("seatExcludedNumbersInput").value = engine.formatNumberRanges(excluded);
      updateFromInputs();
    });
    window.addEventListener("seatmaster:seatrequirement", (event) => {
      const number = Number(event.detail && event.detail.number);
      const excluded = engine.parseEmptyNumbers(state.config.seatExcludedNumbers, state.config.maxNumber);
      excluded.add(number);
      document.getElementById("seatExcludedNumbersInput").value = engine.formatNumberRanges(excluded);
      updateFromInputs();
    });
    ["boardPositionInput", "doorPositionInput", "teacherPositionInput"].forEach((id) => {
      document.getElementById(id).addEventListener("change", updateRoomMarkersFromInputs);
    });
    ["boardLengthInput", "doorOffsetInput", "teacherOffsetInput"].forEach((id) => {
      document.getElementById(id).addEventListener("input", updateRoomMarkersFromInputs);
    });
    const dataInput = document.getElementById("studentDataInput");
    dataInput.addEventListener("change", () => { normalizeStudentDataInput(false); updateFromInputs(); });
    dataInput.addEventListener("paste", () => {
      window.setTimeout(() => { normalizeStudentDataInput(true, true); updateFromInputs(); }, 0);
    });

    document.getElementById("seatGrid").addEventListener("click", (event) => {
      const tableHandle = event.target.closest("[data-table-handle]");
      if (tableHandle && state.roomLayout) { selectedTableId = tableHandle.closest("[data-table-id]").dataset.tableId; state.roomLayout.selectedTableId = selectedTableId; return; }
      const path = event.target.closest("[data-path-id]");
      if (path && state.roomLayout?.editing) { selectedPathId = path.dataset.pathId; state.roomLayout.selectedPathId = selectedPathId; render({ keepInputs: true }); return; }
      const pinButton = event.target.closest("[data-action='pin']");
      if (pinButton) { event.stopPropagation(); openPinDialog(pinButton.dataset.seatId); return; }
      const roomSeat = event.target.closest("[data-room-seat-handle]");
      if (roomSeat && state.roomLayout?.editing) {
        const table = roomSeat.closest("[data-table-id]");
        selectedTableId = table.dataset.tableId;
        state.roomLayout.selectedTableId = selectedTableId;
        state.roomLayout.selectedSeatId = roomSeat.dataset.seatId;
        render({ keepInputs: true });
        return;
      }
      const axis = event.target.closest("[data-axis]");
      if (axis) { cycleAxis(axis.dataset.axis, Number(axis.dataset.index)); return; }
      const seat = event.target.closest(".seat");
      if (seat && document.body.classList.contains("presentation-mode")) {
        openStudentProfile(seat.dataset.seatId);
      } else if (seat) {
        if (state.roomLayout?.editing) return;
        if (adminMode === "prearrange") openPinDialog(seat.dataset.seatId);
        else if (adminMode === "manual") manual.selectSeat(seat.dataset.seatId);
        else if (adminMode === "adjust") selectAdjustmentSeat(seat.dataset.seatId);
        else cycleSeat(seat.dataset.seatId);
      }
    });

    document.getElementById("seatGrid").addEventListener("keydown", (event) => {
      if (state.roomLayout?.editing && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        const seatHandle = event.target.closest("[data-room-seat-handle]");
        if (seatHandle) {
          const table = state.roomLayout.tables.find((item) => item.id === seatHandle.closest("[data-table-id]").dataset.tableId);
          const point = table?.seatPositions.find((item) => item.id === seatHandle.dataset.seatId);
          if (!point) return;
          recordRoomEdit();
          const delta = event.shiftKey ? 4 : 1;
          if (event.key === "ArrowLeft") point.x = Math.max(2, point.x - delta);
          if (event.key === "ArrowRight") point.x = Math.min(98, point.x + delta);
          if (event.key === "ArrowUp") point.y = Math.max(2, point.y - delta);
          if (event.key === "ArrowDown") point.y = Math.min(98, point.y + delta);
          state.roomLayout.selectedTableId = table.id;
          state.roomLayout.selectedSeatId = point.id;
          event.preventDefault(); render({ keepInputs: true }); saveSoon();
          document.querySelector(`[data-seat-id="${point.id}"]`)?.focus({ preventScroll: true });
          return;
        }
        const tableHandle = event.target.closest("[data-table-handle]");
        const pathHandle = event.target.closest("[data-path-handle]");
        const owner = event.target.closest(tableHandle ? "[data-table-id]" : "[data-path-id]");
        if (tableHandle && owner) {
          const table = state.roomLayout.tables.find((item) => item.id === owner.dataset.tableId);
          recordRoomEdit();
          if (event.shiftKey) table.rotation = (table.rotation + (event.key === "ArrowLeft" || event.key === "ArrowDown" ? -15 : 15) + 360) % 360;
          else { table.x = Math.max(5, Math.min(95, table.x + (event.key === "ArrowLeft" ? -2 : event.key === "ArrowRight" ? 2 : 0))); table.y = Math.max(8, Math.min(92, table.y + (event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0))); }
          event.preventDefault(); render({ keepInputs: true }); saveSoon(); document.querySelector(`[data-table-id="${table.id}"] [data-table-handle]`)?.focus({ preventScroll: true }); return;
        }
        if (pathHandle && owner) {
          const pathItem = state.roomLayout.paths.find((item) => item.id === owner.dataset.pathId);
          recordRoomEdit();
          pathItem.x = Math.max(0, Math.min(95, pathItem.x + (event.key === "ArrowLeft" ? -2 : event.key === "ArrowRight" ? 2 : 0)));
          pathItem.y = Math.max(0, Math.min(95, pathItem.y + (event.key === "ArrowUp" ? -2 : event.key === "ArrowDown" ? 2 : 0)));
          event.preventDefault(); render({ keepInputs: true }); saveSoon(); document.querySelector(`[data-path-id="${pathItem.id}"] [data-path-handle]`)?.focus({ preventScroll: true }); return;
        }
      }
      if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("seat")) {
        event.preventDefault();
        if (document.body.classList.contains("presentation-mode")) openStudentProfile(event.target.dataset.seatId);
        else if (state.roomLayout?.editing) {
          const owner = event.target.closest("[data-table-id]");
          if (owner) { state.roomLayout.selectedTableId = owner.dataset.tableId; selectedTableId = owner.dataset.tableId; state.roomLayout.selectedSeatId = event.target.dataset.seatId; render({ keepInputs: true }); }
        }
        else if (adminMode === "prearrange") openPinDialog(event.target.dataset.seatId);
        else if (adminMode === "manual") manual.selectSeat(event.target.dataset.seatId);
        else if (adminMode === "adjust") selectAdjustmentSeat(event.target.dataset.seatId);
        else cycleSeat(event.target.dataset.seatId);
      }
    });

    const roomCanvas = document.getElementById("seatGrid");
    roomCanvas.addEventListener("pointerdown", (event) => {
      if (!state.roomLayout?.editing || !event.isPrimary) return;
      if (event.target.closest("[data-action='pin']")) return;
      const seatHandle = event.target.closest("[data-room-seat-handle]");
      const tableHandle = event.target.closest("[data-table-handle]");
      const pathHandle = event.target.closest("[data-path-handle]");
      if (!seatHandle && !tableHandle && !pathHandle) return;
      const owner = event.target.closest(seatHandle || tableHandle ? "[data-table-id]" : "[data-path-id]");
      const rect = roomCanvas.getBoundingClientRect();
      const id = seatHandle ? seatHandle.dataset.seatId : tableHandle ? owner.dataset.tableId : owner.dataset.pathId;
      selectedTableId = seatHandle || tableHandle ? owner.dataset.tableId : selectedTableId;
      selectedPathId = pathHandle ? id : selectedPathId;
      if (state.roomLayout) { state.roomLayout.selectedTableId = selectedTableId; state.roomLayout.selectedPathId = selectedPathId; }
      const table = seatHandle ? state.roomLayout.tables.find((item) => item.id === owner.dataset.tableId) : null;
      if (seatHandle) state.roomLayout.selectedSeatId = id;
      const item = seatHandle ? table.seatPositions.find((position) => position.id === id) : tableHandle ? state.roomLayout.tables.find((item) => item.id === id) : state.roomLayout.paths.find((pathItem) => pathItem.id === id);
      recordRoomEdit();
      roomPointerDrag = { kind: seatHandle ? "seat" : tableHandle ? "table" : "path", id, tableId: table?.id, tableElement: table ? owner : null, rotation: table?.rotation || 0, rect, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, moved: false };
      roomCanvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    roomCanvas.addEventListener("pointermove", (event) => {
      if (!roomPointerDrag) return;
      const drag = roomPointerDrag;
      if (drag.kind === "seat") {
        const table = state.roomLayout?.tables.find((item) => item.id === drag.tableId);
        const point = table?.seatPositions.find((item) => item.id === drag.id);
        if (!point || !drag.tableElement) return;
        const bounds = drag.tableElement.getBoundingClientRect();
        const width = drag.tableElement.offsetWidth;
        const height = drag.tableElement.offsetHeight;
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        const angle = -drag.rotation * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
        point.x = Math.max(2, Math.min(98, (localX / width + 0.5) * 100));
        point.y = Math.max(2, Math.min(98, (localY / height + 0.5) * 100));
        drag.moved ||= Math.abs(point.x - drag.x) + Math.abs(point.y - drag.y) > 0.5;
        const element = roomCanvas.querySelector(`[data-seat-id="${drag.id}"]`);
        if (element) { element.style.left = `${point.x}%`; element.style.top = `${point.y}%`; }
        return;
      }
      const item = drag.kind === "table" ? state.roomLayout.tables.find((table) => table.id === drag.id) : state.roomLayout.paths.find((pathItem) => pathItem.id === drag.id);
      if (!item) return;
      const dx = ((event.clientX - drag.startX) / drag.rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / drag.rect.height) * 100;
      item.x = Math.max(drag.kind === "table" ? 5 : 0, Math.min(drag.kind === "table" ? 95 : 95, drag.x + dx));
      item.y = Math.max(drag.kind === "table" ? 8 : 0, Math.min(drag.kind === "table" ? 92 : 95, drag.y + dy));
      drag.moved ||= Math.abs(dx) + Math.abs(dy) > 0.5;
      const element = roomCanvas.querySelector(drag.kind === "table" ? `[data-table-id="${drag.id}"]` : `[data-path-id="${drag.id}"]`);
      if (element) { element.style.left = `${item.x}%`; element.style.top = `${item.y}%`; }
    });
    const finishRoomDrag = () => {
      if (!roomPointerDrag) return;
      roomPointerDrag = null;
      render({ keepInputs: true }); saveSoon();
    };
    roomCanvas.addEventListener("pointerup", finishRoomDrag);
    roomCanvas.addEventListener("pointercancel", finishRoomDrag);

    document.querySelectorAll("[data-room-template]").forEach((button) => button.addEventListener("click", () => applyRoomTemplate(button.dataset.roomTemplate)));
    document.getElementById("roomEditToggle").addEventListener("change", (event) => {
      if (!state.roomLayout) return;
      state.roomLayout.editing = event.target.checked;
      render({ keepInputs: true }); saveSoon();
    });
    document.getElementById("roomRotateLeft").addEventListener("click", () => rotateSelectedTable(-15));
    document.getElementById("roomRotateRight").addEventListener("click", () => rotateSelectedTable(15));
    document.getElementById("roomUndoButton").addEventListener("click", undoRoomEdit);
    document.getElementById("roomRedoButton").addEventListener("click", redoRoomEdit);
    document.getElementById("roomTableTypeSelect").addEventListener("change", (event) => {
      const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
      if (!table || !["rect", "round", "u"].includes(event.target.value)) return;
      recordRoomEdit();
      table.type = event.target.value;
      table.edgeCounts = null;
      table.seatPositions = SeatMaster.roomLayout.autoSeatPositions(table, table.seatIds);
      render({ keepInputs: true }); saveSoon();
    });
    ["roomTableWidthInput", "roomTableHeightInput"].forEach((id) => document.getElementById(id).addEventListener("change", (event) => {
      const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
      if (!table) return;
      recordRoomEdit();
      table[id === "roomTableWidthInput" ? "width" : "height"] = Math.max(18, Math.min(80, Number(event.target.value) || 18));
      render({ keepInputs: true }); saveSoon();
    }));
    document.getElementById("roomDuplicateTable").addEventListener("click", duplicateSelectedTable);
    document.getElementById("roomAddTable").addEventListener("click", addRoomTable);
    document.getElementById("roomAddSeat").addEventListener("click", addSeatToSelectedTable);
    document.getElementById("roomRemoveSeat").addEventListener("click", removeSeatFromSelectedTable);
    document.getElementById("roomSeatCountInput").addEventListener("change", (event) => {
      setSelectedTableSeatCount(event.target.value, { resetEdges: true });
    });
    document.getElementById("roomSeatXInput").addEventListener("change", (event) => setSelectedSeatCoordinate("x", event.target.value));
    document.getElementById("roomSeatYInput").addEventListener("change", (event) => setSelectedSeatCoordinate("y", event.target.value));
    document.getElementById("roomAutoArrangeSeats").addEventListener("click", autoArrangeSelectedSeats);
    document.getElementById("roomUOpeningSelect").addEventListener("change", (event) => {
      const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
      if (!table || table.type !== "u") return;
      recordRoomEdit();
      table.geometry ||= {};
      table.geometry.opening = event.target.value;
      table.edgeCounts = null;
      table.seatPositions = SeatMaster.roomLayout.autoSeatPositions(table, table.seatIds);
      render({ keepInputs: true }); saveSoon();
    });
    ["pointerdown", "focus"].forEach((eventName) => document.getElementById("roomRoundRadiusInput").addEventListener(eventName, () => startRoomRangeEdit("roundRadius")));
    document.getElementById("roomRoundRadiusInput").addEventListener("change", () => { roomRangeEdits.delete("roundRadius"); render({ keepInputs: true }); saveSoon(); });
    document.getElementById("roomRoundRadiusInput").addEventListener("input", (event) => {
      const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
      if (!table || table.type !== "round") return;
      table.geometry ||= {};
      table.geometry.seatRadius = Number(event.target.value);
      table.seatPositions = SeatMaster.roomLayout.autoSeatPositions(table, table.seatIds);
      const points = new Map(table.seatPositions.map((position) => [position.id, position]));
      table.seatIds.forEach((id) => { const seat = document.querySelector(`[data-seat-id="${id}"]`); const point = points.get(id); if (seat && point) { seat.style.left = `${point.x}%`; seat.style.top = `${point.y}%`; } });
      saveSoon();
    });
    document.querySelectorAll("[data-room-edge]").forEach((input) => input.addEventListener("change", () => {
      const table = state.roomLayout?.tables.find((item) => item.id === selectedTableId);
      if (!table || table.type === "round") return;
      recordRoomEdit();
      const counts = Object.fromEntries(["top", "right", "bottom", "left"].map((edge) => [edge, edge === table.geometry?.opening && table.type === "u" ? 0 : Math.max(0, Math.min(60, Math.round(Number(document.querySelector(`[data-room-edge="${edge}"]`).value) || 0)))]));
      let total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      if (total < 1) { counts[SeatMaster.roomLayout.activeEdges(table)[0]] = 1; total = 1; }
      if (total > 60) { table.edgeCounts = SeatMaster.roomLayout.defaultEdgeCounts(table, 60); }
      else table.edgeCounts = counts;
      setSelectedTableSeatCount(total, { alreadyRecorded: true, resetPositions: true });
    }));
    document.getElementById("roomDeleteTable").addEventListener("click", deleteSelectedTable);
    document.getElementById("roomAddPath").addEventListener("click", addRoomPath);
    document.getElementById("roomPathWidthInput").addEventListener("input", (event) => {
      const pathItem = state.roomLayout?.paths.find((item) => item.id === selectedPathId);
      if (!pathItem) return;
      startRoomRangeEdit("pathWidth");
      pathItem.width = Number(event.target.value);
      const element = document.querySelector(`[data-path-id="${selectedPathId}"]`);
      if (element) element.style.width = `${pathItem.width}%`;
      saveSoon();
    });
    document.getElementById("roomPathWidthInput").addEventListener("change", () => roomRangeEdits.delete("pathWidth"));
    document.getElementById("roomZoomInput").addEventListener("input", (event) => {
      if (!state.roomLayout) return;
      startRoomRangeEdit("zoom");
      state.roomLayout.zoom = Math.max(0.6, Math.min(1.5, Number(event.target.value) / 100));
      const canvas = document.getElementById("seatGrid");
      canvas.style.zoom = String(state.roomLayout.zoom);
      document.getElementById("roomZoomOutput").value = `${Math.round(state.roomLayout.zoom * 100)}%`;
      saveSoon();
    });
    document.getElementById("roomZoomInput").addEventListener("change", () => { roomRangeEdits.delete("zoom"); render({ keepInputs: true }); });
    document.getElementById("roomZoomReset").addEventListener("click", () => {
      if (!state.roomLayout) return;
      recordRoomEdit();
      state.roomLayout.zoom = 1;
      document.querySelector(".grid-scroll")?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      render({ keepInputs: true }); saveSoon();
    });

    document.getElementById("pinForm").addEventListener("submit", (event) => {
      if (event.submitter && event.submitter.value === "default") applyPin();
    });
    document.getElementById("manualStartButton").addEventListener("click", () => { setAdminMode("manual"); document.getElementById("manualPanel").scrollIntoView({ block: "start" }); });
    document.querySelectorAll("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));
    document.getElementById("presentationButton").addEventListener("click", enterPresentation);
    document.getElementById("adminButton").addEventListener("click", exitPresentation);
    document.getElementById("drawButton").addEventListener("click", startDraw);
    document.getElementById("skipDrawButton").addEventListener("click", () => { if (seatTimeline) seatTimeline.reveal(); });
    document.getElementById("rotateCounterclockwiseButton").addEventListener("click", () => rotateLayout("counterclockwise"));
    document.getElementById("rotateClockwiseButton").addEventListener("click", () => rotateLayout("clockwise"));
    document.getElementById("presentationRotateCounterclockwiseButton").addEventListener("click", () => rotateLayout("counterclockwise"));
    document.getElementById("presentationRotateClockwiseButton").addEventListener("click", () => rotateLayout("clockwise"));
    document.querySelectorAll("[data-gender-pattern]").forEach((button) => {
      button.addEventListener("click", () => applyGenderPattern(button.dataset.genderPattern));
    });
    document.getElementById("studentProfileClose").addEventListener("click", closeStudentProfile);
    document.getElementById("studentProfileOverlay").addEventListener("click", (event) => {
      if (event.target.id === "studentProfileOverlay") closeStudentProfile();
      const toggle = event.target.closest(".sensitive-toggle");
      if (toggle) {
        const value = document.getElementById(toggle.dataset.target);
        const revealed = toggle.getAttribute("aria-pressed") === "true";
        toggle.setAttribute("aria-pressed", String(!revealed));
        toggle.textContent = i18n.t(revealed ? "profile.reveal" : "profile.hide");
        value.textContent = revealed ? "••••••••" : value.dataset.actual;
      }
    });
    document.addEventListener("keydown", (event) => {
      if (state.roomLayout?.editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.target.matches("input, textarea, select")) {
        event.preventDefault();
        if (event.shiftKey) redoRoomEdit(); else undoRoomEdit();
        return;
      }
      if (event.key === "Escape" && !document.getElementById("studentProfileOverlay").hidden) closeStudentProfile();
    });
    document.querySelectorAll("[data-admin-mode]").forEach((button) => button.addEventListener("click", () => setAdminMode(button.dataset.adminMode)));
    document.querySelectorAll(".language-button").forEach((button) => {
      button.addEventListener("click", () => { i18n.toggle(); refreshLanguage(); });
    });
    document.getElementById("soundButton").addEventListener("click", () => { sound.toggle(); updateSoundButton(); });
    document.getElementById("fullscreenButton").addEventListener("click", toggleFullscreen);
    document.getElementById("presentationFullscreenButton").addEventListener("click", toggleFullscreen);
    document.getElementById("exportButton").addEventListener("click", () => { storage.export(state); ui.showToast(i18n.t("toast.exported")); });
    document.getElementById("importButton").addEventListener("click", () => document.getElementById("importFileInput").click());
    document.getElementById("importFileInput").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        state = hydrate(await storage.readImport(file));
        roomUndoStack = []; roomRedoStack = []; roomRangeEdits.clear();
        manual.reset();
        adminMode = state.manualDraft ? "manual" : state.adminMode;
        render();
        storage.save(state);
        ui.showToast(i18n.t("toast.imported"));
      } catch (error) {
        ui.showToast(error.message || i18n.t("toast.importFailed"), "error");
      } finally {
        event.target.value = "";
      }
    });
    document.getElementById("clearPinsButton").addEventListener("click", () => {
      state.seats.forEach((seat) => { seat.pin = null; });
      state.assignment = {};
      state.hasDrawn = false;
      selectedAdjustmentSeatId = null;
      render({ keepInputs: true });
      saveSoon();
      ui.showToast(i18n.t("toast.clearedPins"));
    });
    document.getElementById("resetButton").addEventListener("click", () => {
      if (!window.confirm(i18n.t("confirm.reset"))) return;
      storage.clear();
      state = hydrate(SeatMaster.createDefaultState());
      roomUndoStack = []; roomRedoStack = []; roomRangeEdits.clear();
      adminMode = "layout";
      manual.reset();
      selectedAdjustmentSeatId = null;
      storage.save(state);
      render();
      ui.showToast(i18n.t("toast.reset"));
    });
  }

  function init() {
    state = hydrate(storage.load() || SeatMaster.createDefaultState());
    manual = SeatMaster.manualSeating.createController(() => state, (persist = true) => { render({ keepInputs: true }); if (persist) saveSoon(); }, finishManual);
    adminMode = state.adminMode;
    i18n.apply();
    ui.populateRoomPositionOptions();
    bindEvents();
    studentPicker = SeatMaster.studentDraw.init(() => state, updateSoundButton);
    groupPlannerUi = SeatMaster.groupUI.create(() => state, saveSoon);
    render();
    storage.save(state);
  }

  init();
})();
