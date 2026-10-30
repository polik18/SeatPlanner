(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const i18n = SeatMaster.i18n;
  let toastTimer = null;
  let validationAnchor = null;
  let validationExpanded = true;
  let validationMessage = "";

  function setValidationAnchor(selector) {
    validationAnchor = selector;
    validationExpanded = true;
  }

  function renderValidation(report, panel) {
    const message = report.valid ? "" : `<ul>${report.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    panel.hidden = report.valid;
    if (panel.innerHTML !== message) panel.innerHTML = message;
  }

  function updateValidationNotice() {
    const notice = document.getElementById("validationNotice");
    notice.classList.toggle("is-collapsed", !validationExpanded);
    document.getElementById("validationPanel").hidden = notice.hidden || !validationExpanded;
    document.getElementById("validationToggle").setAttribute("aria-expanded", String(validationExpanded));
    document.getElementById("validationToggleLabel").textContent = i18n.t(validationExpanded ? "validation.collapse" : "validation.expand");
    positionValidationNotice();
  }

  function toggleValidationNotice() {
    validationExpanded = !validationExpanded;
    updateValidationNotice();
  }

  function positionValidationNotice() {
    const notice = document.getElementById("validationNotice");
    if (notice.hidden || document.body.classList.contains("presentation-mode")) return;
    const viewport = window.visualViewport;
    const left = (viewport ? viewport.offsetLeft : 0) + 12;
    const right = left + (viewport ? viewport.width : window.innerWidth) - 24;
    const bottom = (viewport ? viewport.offsetTop + viewport.height : window.innerHeight) - 12;
    const top = Math.max(viewport ? viewport.offsetTop : 0, document.querySelector(".app-header").getBoundingClientRect().bottom) + 12;
    notice.style.maxWidth = `${Math.max(0, right - left)}px`;
    const panel = document.getElementById("validationPanel");
    panel.style.maxHeight = `${Math.max(40, Math.min(window.innerHeight * 0.3, bottom - top - 60))}px`;
    const { width, height } = notice.getBoundingClientRect();
    const anchor = validationAnchor && document.querySelector(validationAnchor);
    const rect = anchor && anchor.getBoundingClientRect();
    let point = { x: right - width, y: Math.max(top, bottom - height - 56) };
    if (validationExpanded && rect && rect.bottom > top && rect.top < bottom && rect.right > left && rect.left < right) {
      const x = Math.max(left, Math.min(rect.left + (rect.width - width) / 2, right - width));
      const y = Math.max(top, Math.min(rect.top + (rect.height - height) / 2, bottom - height));
      const candidates = [
        { x: rect.right + 12, y },
        { x: rect.left - width - 12, y },
        { x, y: rect.top - height - 12 },
        { x, y: rect.bottom + 12 }
      ];
      point = candidates.find((item) => item.x >= left && item.x + width <= right && item.y >= top && item.y + height <= bottom) || point;
    }
    notice.style.left = `${point.x}px`;
    notice.style.top = `${point.y}px`;
    notice.style.right = "auto";
    notice.style.bottom = "auto";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function columnLabel(index) {
    let value = index;
    let result = "";
    do {
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);
    return result;
  }

  function typeLabel(type) {
    return i18n.t(`seat.${type}`);
  }

  const roomPositionOptions = [
    ["top-start", "room.position.topStart"], ["top-center", "room.position.topCenter"], ["top-end", "room.position.topEnd"],
    ["right-start", "room.position.rightStart"], ["right-center", "room.position.rightCenter"], ["right-end", "room.position.rightEnd"],
    ["bottom-start", "room.position.bottomStart"], ["bottom-center", "room.position.bottomCenter"], ["bottom-end", "room.position.bottomEnd"],
    ["left-start", "room.position.leftStart"], ["left-center", "room.position.leftCenter"], ["left-end", "room.position.leftEnd"],
    ["hidden", "room.position.hidden"]
  ];

  function populateRoomPositionOptions() {
    document.querySelectorAll("[data-room-position-select]").forEach((select) => {
      const selected = select.value;
      select.innerHTML = roomPositionOptions.map(([value, key]) => `<option value="${value}">${escapeHtml(i18n.t(key))}</option>`).join("");
      if (roomPositionOptions.some(([value]) => value === selected)) select.value = selected;
    });
  }

  function renderRoomMarkers(state) {
    document.querySelectorAll("[data-room-slot]").forEach((slot) => { slot.innerHTML = ""; });
    [
      { key: "boardPosition", type: "board", icon: "▰", label: "room.board", lengthKey: "boardLength" },
      { key: "doorPosition", type: "door", icon: "▯", label: "room.door", offsetKey: "doorOffset" },
      { key: "teacherPosition", type: "teacher", icon: "◆", label: "room.teacher", offsetKey: "teacherOffset" }
    ].forEach((marker) => {
      const position = state.config[marker.key];
      if (position === "hidden") return;
      const slot = document.querySelector(`[data-room-slot="${position}"]`);
      if (!slot) return;
      const offset = marker.offsetKey ? Number(state.config[marker.offsetKey]) || 0 : 0;
      const length = marker.lengthKey ? Number(state.config[marker.lengthKey]) || 3 : 3;
      const boardLength = 70 + length * 34;
      const boardSideLength = 58 + length * 27;
      const boardMobileLength = 52 + length * 7;
      slot.insertAdjacentHTML("beforeend", `<span class="room-marker room-marker-${marker.type}" data-room-marker="${marker.type}" style="--marker-offset:${offset}px;--board-length:${boardLength}px;--board-side-length:${boardSideLength}px;--board-mobile-length:${boardMobileLength}px"><span class="room-marker-icon" aria-hidden="true">${marker.icon}</span><span>${escapeHtml(i18n.t(marker.label))}</span></span>`);
    });
  }

  function fillRoomControlOutputs(config) {
    document.getElementById("boardLengthOutput").textContent = `${config.boardLength} / 5`;
    document.getElementById("doorOffsetOutput").textContent = `${config.doorOffset > 0 ? "+" : ""}${config.doorOffset} px`;
    document.getElementById("teacherOffsetOutput").textContent = `${config.teacherOffset > 0 ? "+" : ""}${config.teacherOffset} px`;
  }

  function presentationStudentContent(state, number, directory) {
    if (number === null || number === undefined) return "<strong>—</strong>";
    const mode = state.config.displayMode || "number";
    const name = directory.get(Number(number));
    if (mode === "name" && name) return `<strong class="student-name-only">${escapeHtml(name)}</strong>`;
    if (mode === "both" && name) return `<span class="student-number">${escapeHtml(i18n.t("seat.number", { number }))}</span><strong class="student-name">${escapeHtml(name)}</strong>`;
    if (mode === "name" && !name) return `<strong class="student-name-fallback">${escapeHtml(i18n.t("seat.number", { number }))}</strong>`;
    return `<strong>${escapeHtml(number)}</strong>`;
  }

  function seatContent(seat, state, presentation, directory, adminMode) {
    if (presentation) {
      const value = state.hasDrawn ? state.assignment[seat.id] : null;
      return `<div class="seat-main student-result">${presentationStudentContent(state, value, directory)}</div>`;
    }
    const coordinate = `${columnLabel(seat.col)}${seat.row + 1}`;
    if (adminMode === "prearrange") {
      if (seat.type === "aisle") return `<div class="seat-main"><strong>×</strong><small>${escapeHtml(typeLabel(seat.type))}</small></div>`;
      const name = seat.pin ? directory.get(seat.pin) : "";
      const detail = seat.pin ? `${name ? `${escapeHtml(name)} · ` : ""}${escapeHtml(i18n.t("seat.fixed"))}` : escapeHtml(i18n.t("mode.clickToAssign"));
      return `<div class="seat-main"><strong>${seat.pin ? escapeHtml(i18n.t("seat.number", { number: seat.pin })) : coordinate}</strong><small>${detail}</small></div>`;
    }
    if (adminMode === "adjust" || adminMode === "manual") {
      if (seat.type === "aisle") return `<div class="seat-main admin-result"><strong>×</strong><small class="admin-seat-meta">${escapeHtml(typeLabel(seat.type))}</small></div>`;
      const value = adminMode === "manual" ? state.manualDraft[seat.id] : state.assignment[seat.id];
      return `<div class="seat-main admin-result">${presentationStudentContent(adminMode === "manual" ? { ...state, config: { ...state.config, displayMode: "both" } } : state, value, directory)}<small class="admin-seat-meta">${coordinate}</small></div>`;
    }
    const pinned = seat.pin ? `<strong>${escapeHtml(i18n.t("seat.number", { number: seat.pin }))}</strong><small>${escapeHtml(i18n.t("seat.fixed"))} · ${escapeHtml(typeLabel(seat.type))}</small>` : `<strong>${seat.type === "aisle" ? "×" : columnLabel(seat.col) + (seat.row + 1)}</strong><small>${escapeHtml(typeLabel(seat.type))}</small>`;
    const pinTitle = i18n.t("pin.title", { seat: `${columnLabel(seat.col)}${seat.row + 1}` });
    const pinButton = seat.type === "aisle" ? "" : `<button class="pin-button ${seat.pin ? "is-pinned" : ""}" type="button" data-action="pin" data-seat-id="${seat.id}" title="${escapeHtml(pinTitle)}" aria-label="${escapeHtml(pinTitle)}">${seat.pin ? "●" : "○"}</button>`;
    return `<div class="seat-main">${pinned}</div>${pinButton}`;
  }

  function renderSeatGrid(state, presentation, adminMode, selectedSeatId) {
    const grid = document.getElementById("seatGrid");
    const dimensionControls = document.getElementById("gridDimensions");
    if (state.roomLayout && Array.isArray(state.roomLayout.tables)) {
      grid.className = `room-canvas${state.roomLayout.editing && !presentation ? " is-editing" : ""}`;
      grid.removeAttribute("style");
      grid.style.zoom = String(state.roomLayout.zoom || 1);
      if (dimensionControls) dimensionControls.hidden = true;
      const students = SeatMaster.engine.buildStudents(state.config);
      const records = SeatMaster.engine.parseStudentRecords(state.config.studentData, students);
      const directory = SeatMaster.engine.parseStudentNames(state.config.studentData, students);
      const html = [];
      let collisionCount = 0;
      (state.roomLayout.paths || []).forEach((path) => {
        html.push(`<div class="room-path${path.id === state.roomLayout.selectedPathId ? " is-selected" : ""}" data-path-id="${escapeHtml(path.id)}" style="left:${path.x}%;top:${path.y}%;width:${path.width}%;height:${path.height}%">${escapeHtml(path.label)}${state.roomLayout.editing && !presentation ? `<button class="room-path-handle" data-path-handle="true" type="button" aria-label="${escapeHtml(i18n.t("room.movePath"))}"></button>` : ""}</div>`);
      });
      state.roomLayout.tables.forEach((table, index) => {
        const points = SeatMaster.roomLayout.seatPoints(table, table.seatIds.length);
        const widthPx = Math.max(1, grid.clientWidth * table.width / 100);
        const heightPx = Math.max(1, grid.clientHeight * table.height / 100);
        let minimumDistance = 60;
        for (let left = 0; left < points.length; left += 1) for (let right = left + 1; right < points.length; right += 1) {
          const dx = (points[left].x - points[right].x) * widthPx / 100;
          const dy = (points[left].y - points[right].y) * heightPx / 100;
          minimumDistance = Math.min(minimumDistance, Math.hypot(dx, dy));
        }
        const seatSize = Math.max(26, Math.min(48, minimumDistance * 0.82));
        const overlapping = new Set();
        for (let left = 0; left < points.length; left += 1) for (let right = left + 1; right < points.length; right += 1) {
          const dx = Math.abs(points[left].x - points[right].x) * widthPx / 100;
          const dy = Math.abs(points[left].y - points[right].y) * heightPx / 100;
          if (dx < seatSize && dy < seatSize * 0.8) { overlapping.add(table.seatIds[left]); overlapping.add(table.seatIds[right]); }
        }
        collisionCount += overlapping.size;
        const tableStyle = `left:${table.x}%;top:${table.y}%;width:${table.width}%;height:${table.height}%;--room-seat-size:${seatSize}px;--room-seat-height:${seatSize * 0.8}px;transform:translate(-50%,-50%) rotate(${table.rotation}deg)`;
        html.push(`<div class="room-table room-table-${table.type}${table.type === "u" ? ` room-table-u-open-${table.geometry?.opening || "bottom"}` : ""}${table.id === state.roomLayout.selectedTableId ? " is-selected" : ""}" data-table-id="${escapeHtml(table.id)}" style="${tableStyle}"><div class="room-table-surface">${escapeHtml(i18n.t("room.table", { number: index + 1 }))}</div>${state.roomLayout.editing && !presentation ? `<button class="room-table-drag-handle" type="button" data-table-handle="true" aria-label="${escapeHtml(i18n.t("room.moveTable", { number: index + 1 }))}">${escapeHtml(i18n.t("room.table", { number: index + 1 }))}</button>` : ""}`);
        table.seatIds.forEach((seatId, seatIndex) => {
          const seat = state.seats.find((item) => item.id === seatId);
          if (!seat) return;
          const point = points[seatIndex] || { x: 50, y: 50 };
          const classes = ["seat"];
          if (state.roomLayout.editing && !presentation) classes.push("room-seat-editable");
          if (state.roomLayout.selectedSeatId === seat.id) classes.push("is-room-seat-selected");
          if (overlapping.has(seat.id)) classes.push("is-room-seat-collision");
          const assignedNumber = presentation && state.hasDrawn ? state.assignment[seat.id] : null;
          const hasProfile = Number.isInteger(assignedNumber) && records.has(assignedNumber);
          if (presentation && hasProfile) classes.push("has-profile");
          if (!presentation && adminMode === "prearrange") classes.push("prearrange-seat", seat.pin ? "is-pinned-seat" : "");
          if (!presentation && (adminMode === "adjust" || adminMode === "manual")) classes.push("admin-adjust-seat", selectedSeatId === seat.id ? "is-swap-selected" : "");
          html.push(`<div class="${classes.filter(Boolean).join(" ")}" data-seat-id="${escapeHtml(seat.id)}" ${state.roomLayout.editing && !presentation ? 'data-room-seat-handle="true"' : ""} data-type="${presentation ? "general" : seat.type}" role="button" tabindex="${presentation && !hasProfile ? "-1" : "0"}" aria-label="${presentation ? escapeHtml(hasProfile ? i18n.t("profile.openCard") : i18n.t("room.seat")) : escapeHtml(typeLabel(seat.type))}" style="left:${point.x}%;top:${point.y}%">${seatContent(seat, state, presentation, directory, adminMode)}${presentation && hasProfile ? '<span class="profile-indicator" aria-hidden="true">＋</span>' : ""}</div>`);
        });
        html.push("</div>");
      });
      grid.innerHTML = html.join("");
      const geometryStatus = document.getElementById("roomGeometryStatus");
      if (geometryStatus) {
        geometryStatus.hidden = false;
        geometryStatus.textContent = collisionCount ? i18n.t("room.seatOverlap", { count: collisionCount }) : i18n.t("room.geometryOk");
        geometryStatus.classList.toggle("is-warning", collisionCount > 0);
      }
      const toolbar = document.getElementById("roomLayoutToolbar");
      if (toolbar) toolbar.hidden = presentation;
      document.querySelectorAll("[data-gender-pattern]").forEach((button) => {
        button.hidden = state.roomLayout.tables.length > 0
          ? button.dataset.genderPattern !== "tableSequence"
          : button.dataset.genderPattern === "tableSequence";
      });
      const editToggle = document.getElementById("roomEditToggle");
      if (editToggle) editToggle.checked = Boolean(state.roomLayout.editing);
      const pathWidth = document.getElementById("roomPathWidthInput");
      const selectedPath = state.roomLayout.paths.find((path) => path.id === state.roomLayout.selectedPathId);
      if (pathWidth) pathWidth.value = selectedPath ? String(selectedPath.width) : "8";
      const selectedTable = state.roomLayout.tables.find((table) => table.id === state.roomLayout.selectedTableId);
      const selectedSeat = (selectedTable?.seatPositions || []).find((position) => position.id === state.roomLayout.selectedSeatId);
      const seatCount = document.getElementById("roomSeatCountInput");
      if (seatCount) { seatCount.value = selectedTable ? String(selectedTable.seatIds.length) : "1"; seatCount.disabled = !selectedTable; }
      ["roomSeatXInput", "roomSeatYInput"].forEach((id) => { const input = document.getElementById(id); if (input) { input.disabled = !selectedSeat; input.value = selectedSeat ? String(Math.round(selectedSeat[id === "roomSeatXInput" ? "x" : "y"] * 10) / 10) : ""; } });
      const shape = document.getElementById("roomTableTypeSelect");
      if (shape) { shape.value = selectedTable?.type || "rect"; shape.disabled = !selectedTable; }
      const tableWidth = document.getElementById("roomTableWidthInput");
      const tableHeight = document.getElementById("roomTableHeightInput");
      if (tableWidth) { tableWidth.value = String(selectedTable?.width || 30); tableWidth.disabled = !selectedTable; }
      if (tableHeight) { tableHeight.value = String(selectedTable?.height || 30); tableHeight.disabled = !selectedTable; }
      const zoom = document.getElementById("roomZoomInput");
      const zoomOutput = document.getElementById("roomZoomOutput");
      if (zoom) zoom.value = String(Math.round((state.roomLayout.zoom || 1) * 100));
      if (zoomOutput) zoomOutput.value = `${Math.round((state.roomLayout.zoom || 1) * 100)}%`;
      const openingControl = document.getElementById("roomUOpeningControl");
      const opening = document.getElementById("roomUOpeningSelect");
      if (openingControl) openingControl.hidden = selectedTable?.type !== "u";
      if (opening) opening.value = selectedTable?.geometry?.opening || "bottom";
      const roundControl = document.getElementById("roomRoundRadiusControl");
      const radius = document.getElementById("roomRoundRadiusInput");
      if (roundControl) roundControl.hidden = selectedTable?.type !== "round";
      if (radius) radius.value = String(selectedTable?.geometry?.seatRadius || 44);
      const edgeControls = document.getElementById("roomEdgeControls");
      if (edgeControls) edgeControls.hidden = !selectedTable || selectedTable.type === "round";
      const edgeCounts = selectedTable?.edgeCounts || SeatMaster.roomLayout.defaultEdgeCounts(selectedTable || { type: "rect" }, selectedTable?.seatIds.length || 0);
      document.querySelectorAll("[data-room-edge]").forEach((input) => { input.value = String(edgeCounts[input.dataset.roomEdge] || 0); input.disabled = !selectedTable; input.parentElement.hidden = selectedTable?.type === "u" && input.dataset.roomEdge === (selectedTable.geometry?.opening || "bottom"); });
      ["roomRotateLeft", "roomRotateRight", "roomDuplicateTable", "roomDeleteTable", "roomAddSeat", "roomAutoArrangeSeats"].forEach((id) => { const button = document.getElementById(id); if (button) button.disabled = !selectedTable; });
      const removeSeat = document.getElementById("roomRemoveSeat");
      if (removeSeat) removeSeat.disabled = !selectedTable || selectedTable.seatIds.length <= 1;
      return;
    }
    grid.className = "seat-grid";
    grid.removeAttribute("style");
    if (dimensionControls) dimensionControls.hidden = false;
    const toolbar = document.getElementById("roomLayoutToolbar");
    if (toolbar) toolbar.hidden = true;
    document.querySelectorAll("[data-gender-pattern]").forEach((button) => { button.hidden = button.dataset.genderPattern === "tableSequence"; });
      const geometryStatus = document.getElementById("roomGeometryStatus");
      if (geometryStatus) geometryStatus.hidden = true;
    grid.style.setProperty("--cols", state.config.cols);
    const html = [];
    const students = SeatMaster.engine.buildStudents(state.config);
    const records = SeatMaster.engine.parseStudentRecords(state.config.studentData, students);
    const directory = SeatMaster.engine.parseStudentNames(state.config.studentData, students);
    if (!presentation) {
      html.push('<span class="grid-corner"></span>');
      for (let col = 0; col < state.config.cols; col += 1) {
        html.push(`<button class="axis-button" type="button" data-axis="col" data-index="${col}" ${adminMode !== "layout" ? "disabled" : ""}>${escapeHtml(i18n.t("seat.col", { label: columnLabel(col) }))}</button>`);
      }
    }

    for (let row = 0; row < state.config.rows; row += 1) {
      if (!presentation) html.push(`<button class="axis-button" type="button" data-axis="row" data-index="${row}" ${adminMode !== "layout" ? "disabled" : ""}>${escapeHtml(i18n.t("seat.row", { number: row + 1 }))}</button>`);
      for (let col = 0; col < state.config.cols; col += 1) {
        const seat = state.seats.find((item) => item.row === row && item.col === col);
        const classes = ["seat"];
        if (presentation && seat.type === "aisle") classes.push("is-aisle");
        const assignedNumber = presentation && state.hasDrawn ? state.assignment[seat.id] : null;
        const hasProfile = Number.isInteger(assignedNumber) && records.has(assignedNumber);
        if (presentation && hasProfile) classes.push("has-profile");
        if (!presentation && adminMode === "prearrange") classes.push("prearrange-seat", seat.pin ? "is-pinned-seat" : "");
        if (!presentation && (adminMode === "adjust" || adminMode === "manual")) classes.push("admin-adjust-seat", selectedSeatId === seat.id ? "is-swap-selected" : "");
        html.push(`<div class="${classes.filter(Boolean).join(" ")}" data-seat-id="${seat.id}" data-type="${presentation ? "general" : seat.type}" role="button" tabindex="${presentation && !hasProfile ? "-1" : "0"}" aria-label="${presentation ? escapeHtml(hasProfile ? i18n.t("profile.openCard") : "Seat") : escapeHtml(typeLabel(seat.type))}">${seatContent(seat, state, presentation, directory, adminMode)}${presentation && hasProfile ? '<span class="profile-indicator" aria-hidden="true">＋</span>' : ""}</div>`);
      }
    }
    grid.innerHTML = html.join("");
  }

  function renderSummary(state) {
    const students = SeatMaster.engine.buildStudents(state.config);
    const male = students.filter((student) => student.gender === "male").length;
    const female = students.filter((student) => student.gender === "female").length;
    const required = SeatMaster.engine.studentsRequiringSeats(state.config);
    const usable = state.seats.filter((seat) => seat.type !== "aisle").length;
    const emptyDesks = Math.max(0, usable - required.length);

    document.getElementById("studentSummary").innerHTML = `
      <div class="summary-chip"><strong>${male}</strong><span>${escapeHtml(i18n.t("summary.male"))}</span></div>
      <div class="summary-chip"><strong>${female}</strong><span>${escapeHtml(i18n.t("summary.female"))}</span></div>
      <div class="summary-chip"><strong>${students.length}</strong><span>${escapeHtml(i18n.t("summary.total"))}</span></div>
      <div class="summary-chip"><strong>${students.length - required.length}</strong><span>${escapeHtml(i18n.t("summary.noSeat"))}</span></div>`;
    document.getElementById("stageTitle").textContent = i18n.t("stage.title", { className: state.config.className });
    document.getElementById("pageTitle").textContent = i18n.t("stage.pageTitle", { className: state.config.className });
    document.querySelector(".stage-heading .presentation-only").textContent = i18n.t(state.resultSource === "manual" ? "manual.resultTitle" : "stage.draw");
    document.getElementById("stageSubtitle").textContent = i18n.t("stage.subtitle", { seats: usable, students: required.length, empty: emptyDesks });

    const report = SeatMaster.engine.validate(state);
    const badge = document.getElementById("capacityBadge");
    badge.textContent = report.valid ? i18n.t("stage.valid") : i18n.t("stage.errors", { count: report.errors.length });
    badge.classList.toggle("is-error", !report.valid);
    const panel = document.getElementById("validationPanel");
    const message = report.errors.join("\n");
    if (message !== validationMessage) validationExpanded = true;
    validationMessage = message;
    document.getElementById("validationNotice").hidden = report.valid;
    document.getElementById("validationNoticeTitle").textContent = i18n.t("stage.errors", { count: report.errors.length });
    renderValidation(report, panel);
    updateValidationNotice();
  }

  function fillInputs(state) {
    const mapping = {
      classNameInput: "className",
      rowsInput: "rows",
      colsInput: "cols",
      maxNumberInput: "maxNumber",
      emptyNumbersInput: "emptyNumbers",
      seatExcludedNumbersInput: "seatExcludedNumbers",
      femaleStartInput: "femaleStart",
      displayModeInput: "displayMode",
      studentDataInput: "studentData",
      boardPositionInput: "boardPosition",
      boardLengthInput: "boardLength",
      doorPositionInput: "doorPosition",
      doorOffsetInput: "doorOffset",
      teacherPositionInput: "teacherPosition",
      teacherOffsetInput: "teacherOffset"
    };
    Object.entries(mapping).forEach(([id, key]) => { document.getElementById(id).value = state.config[key]; });
    fillRoomControlOutputs(state.config);
  }

  function showToast(message, type) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2700);
  }

  function setSaveStatus(message) {
    document.getElementById("saveStatus").textContent = message;
  }

  function renderRollingValue(element, state, number, directory) {
    if (!directory) directory = SeatMaster.engine.parseStudentNames(state.config.studentData, SeatMaster.engine.buildStudents(state.config));
    const main = element.querySelector(".seat-main");
    if (main) main.innerHTML = presentationStudentContent(state, number, directory);
  }

  SeatMaster.ui = { escapeHtml, columnLabel, populateRoomPositionOptions, renderRoomMarkers, renderSeatGrid, renderSummary, fillInputs, fillRoomControlOutputs, showToast, setSaveStatus, renderRollingValue, renderValidation, setValidationAnchor, positionValidationNotice, toggleValidationNotice };
})();
