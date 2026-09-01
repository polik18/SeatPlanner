(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const i18n = SeatMaster.i18n;
  let toastTimer = null;

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
    if (adminMode === "adjust") {
      if (seat.type === "aisle") return `<div class="seat-main admin-result"><strong>×</strong><small class="admin-seat-meta">${escapeHtml(typeLabel(seat.type))}</small></div>`;
      const value = state.assignment[seat.id];
      return `<div class="seat-main admin-result">${presentationStudentContent(state, value, directory)}<small class="admin-seat-meta">${coordinate}</small></div>`;
    }
    const pinned = seat.pin ? `<strong>${escapeHtml(i18n.t("seat.number", { number: seat.pin }))}</strong><small>${escapeHtml(i18n.t("seat.fixed"))} · ${escapeHtml(typeLabel(seat.type))}</small>` : `<strong>${seat.type === "aisle" ? "×" : columnLabel(seat.col) + (seat.row + 1)}</strong><small>${escapeHtml(typeLabel(seat.type))}</small>`;
    const pinTitle = i18n.t("pin.title", { seat: `${columnLabel(seat.col)}${seat.row + 1}` });
    const pinButton = seat.type === "aisle" ? "" : `<button class="pin-button ${seat.pin ? "is-pinned" : ""}" type="button" data-action="pin" data-seat-id="${seat.id}" title="${escapeHtml(pinTitle)}" aria-label="${escapeHtml(pinTitle)}">${seat.pin ? "●" : "○"}</button>`;
    return `<div class="seat-main">${pinned}</div>${pinButton}`;
  }

  function renderSeatGrid(state, presentation, adminMode, selectedSeatId) {
    const grid = document.getElementById("seatGrid");
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
        if (!presentation && adminMode === "adjust") classes.push("admin-adjust-seat", selectedSeatId === seat.id ? "is-swap-selected" : "");
        html.push(`<div class="${classes.filter(Boolean).join(" ")}" data-seat-id="${seat.id}" data-type="${presentation ? "general" : seat.type}" role="button" tabindex="${presentation && !hasProfile ? "-1" : "0"}" aria-label="${presentation ? escapeHtml(hasProfile ? i18n.t("profile.openCard") : "Seat") : escapeHtml(typeLabel(seat.type))}">${seatContent(seat, state, presentation, directory, adminMode)}${presentation && hasProfile ? '<span class="profile-indicator" aria-hidden="true">＋</span>' : ""}</div>`);
      }
    }
    grid.innerHTML = html.join("");
  }

  function renderSummary(state) {
    const students = SeatMaster.engine.buildStudents(state.config);
    const male = students.filter((student) => student.gender === "male").length;
    const female = students.length - male;
    const usable = state.seats.filter((seat) => seat.type !== "aisle").length;
    const emptyDesks = Math.max(0, usable - students.length);

    document.getElementById("studentSummary").innerHTML = `
      <div class="summary-chip"><strong>${male}</strong><span>${escapeHtml(i18n.t("summary.male"))}</span></div>
      <div class="summary-chip"><strong>${female}</strong><span>${escapeHtml(i18n.t("summary.female"))}</span></div>
      <div class="summary-chip"><strong>${students.length}</strong><span>${escapeHtml(i18n.t("summary.total"))}</span></div>`;
    document.getElementById("stageTitle").textContent = i18n.t("stage.title", { className: state.config.className });
    document.getElementById("pageTitle").textContent = i18n.t("stage.pageTitle", { className: state.config.className });
    document.getElementById("stageSubtitle").textContent = i18n.t("stage.subtitle", { seats: usable, students: students.length, empty: emptyDesks });

    const report = SeatMaster.engine.validate(state);
    const badge = document.getElementById("capacityBadge");
    badge.textContent = report.valid ? i18n.t("stage.valid") : i18n.t("stage.errors", { count: report.errors.length });
    badge.classList.toggle("is-error", !report.valid);
    const panel = document.getElementById("validationPanel");
    panel.hidden = report.valid;
    panel.innerHTML = report.errors.map((error) => `• ${escapeHtml(error)}`).join("<br>");
  }

  function fillInputs(state) {
    const mapping = {
      classNameInput: "className",
      rowsInput: "rows",
      colsInput: "cols",
      maxNumberInput: "maxNumber",
      emptyNumbersInput: "emptyNumbers",
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

  function renderRollingValue(element, state, number) {
    const students = SeatMaster.engine.buildStudents(state.config);
    const directory = SeatMaster.engine.parseStudentNames(state.config.studentData, students);
    const main = element.querySelector(".seat-main");
    if (main) main.innerHTML = presentationStudentContent(state, number, directory);
  }

  SeatMaster.ui = { escapeHtml, columnLabel, populateRoomPositionOptions, renderRoomMarkers, renderSeatGrid, renderSummary, fillInputs, fillRoomControlOutputs, showToast, setSaveStatus, renderRollingValue };
})();
