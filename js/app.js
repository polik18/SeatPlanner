(function () {
  "use strict";

  const SeatMaster = window.SeatMaster;
  const { engine, storage, ui, sound, i18n } = SeatMaster;
  let state = SeatMaster.createDefaultState();
  let activePinSeatId = null;
  let saveTimer = null;
  let drawingTimer = null;
  let drawTimeouts = [];
  let adminMode = "layout";
  let selectedAdjustmentSeatId = null;
  let profileFlipTimer = null;

  function hydrate(rawState) {
    const config = engine.normalizeConfig(rawState && rawState.config ? rawState.config : state.config);
    const seats = engine.buildSeatGrid(config, rawState && rawState.seats ? rawState.seats : []);
    const students = engine.buildStudents(config);
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
    return { version: SeatMaster.constants.VERSION, config, seats, assignment: resultValid ? assignment : {}, hasDrawn: resultValid };
  }

  function saveSoon() {
    ui.setSaveStatus(i18n.t("common.saving"));
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      storage.save(state);
      ui.setSaveStatus(i18n.t("common.saved"));
    }, 180);
  }

  function render(options) {
    const presentation = document.body.classList.contains("presentation-mode");
    if (!options || !options.keepInputs) ui.fillInputs(state);
    ui.renderSummary(state);
    ui.renderRoomMarkers(state);
    ui.renderSeatGrid(state, presentation, adminMode, selectedAdjustmentSeatId);
    updateAdminModeUI();
  }

  function updateAdminModeUI() {
    if (adminMode === "adjust" && !state.hasDrawn) adminMode = "layout";
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
    state.config = config;
    state.seats = engine.buildSeatGrid(config, state.seats);
    const validNumbers = new Set(engine.buildStudents(config).map((student) => student.number));
    state.seats.forEach((seat) => { if (seat.pin && !validNumbers.has(seat.pin)) seat.pin = null; });
    state.assignment = {};
    state.hasDrawn = false;
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
    const rotated = engine.rotateSeatLayout(state.config, state.seats, state.assignment, direction);
    state.config = engine.normalizeConfig(rotated.config);
    state.seats = rotated.seats;
    state.assignment = rotated.assignment;
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

  function cycleSeat(seatId) {
    const seat = state.seats.find((item) => item.id === seatId);
    if (!seat) return;
    seat.type = engine.nextSeatType(seat.type);
    if (seat.type === "aisle") seat.pin = null;
    state.assignment = {};
    state.hasDrawn = false;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
  }

  function cycleAxis(axis, index) {
    const seats = state.seats.filter((seat) => seat[axis] === index);
    if (!seats.length) return;
    const nextType = engine.nextSeatType(seats[0].type);
    seats.forEach((seat) => {
      seat.type = nextType;
      if (nextType === "aisle") seat.pin = null;
    });
    state.assignment = {};
    state.hasDrawn = false;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
  }

  function applyGenderPattern(pattern) {
    closeStudentProfile();
    const result = engine.applyGenderPattern(state.config, state.seats, pattern);
    state.seats = result.seats;
    state.assignment = {};
    state.hasDrawn = false;
    selectedAdjustmentSeatId = null;
    adminMode = "layout";
    render({ keepInputs: true });
    saveSoon();
    const patternKeys = { rows: "admin.genderRows", columns: "admin.genderColumns", checkerboard: "admin.genderCheckerboard" };
    const messages = [i18n.t("toast.genderPatternApplied", { pattern: i18n.t(patternKeys[pattern]) })];
    if (result.relaxedSeats) messages.push(i18n.t("toast.genderPatternRelaxed", { count: result.relaxedSeats }));
    if (result.clearedPins.length) messages.push(i18n.t("toast.genderPatternPinsCleared", { count: result.clearedPins.length }));
    ui.showToast(messages.join(" "));
  }

  function openPinDialog(seatId) {
    const seat = state.seats.find((item) => item.id === seatId);
    if (!seat || seat.type === "aisle") return;
    activePinSeatId = seatId;
    const students = engine.buildStudents(state.config);
    const usedNumbers = new Set(state.seats.filter((item) => item.id !== seatId && item.pin).map((item) => item.pin));
    const available = students.filter((student) => !usedNumbers.has(student.number) && engine.isCompatible(seat, student));
    const select = document.getElementById("pinStudentSelect");
    select.innerHTML = `<option value="">${ui.escapeHtml(i18n.t("pin.random"))}</option>${available.map((student) => `<option value="${student.number}">${ui.escapeHtml(i18n.t("pin.option", { number: student.number }))}</option>`).join("")}`;
    select.value = seat.pin || "";
    document.getElementById("pinDialogTitle").textContent = i18n.t("pin.title", { seat: `${ui.columnLabel(seat.col)}${seat.row + 1}` });
    document.getElementById("pinDialog").showModal();
  }

  function applyPin() {
    const seat = state.seats.find((item) => item.id === activePinSeatId);
    if (!seat) return;
    const value = Number.parseInt(document.getElementById("pinStudentSelect").value, 10);
    seat.pin = Number.isInteger(value) ? value : null;
    state.assignment = {};
    state.hasDrawn = false;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
    saveSoon();
    ui.showToast(seat.pin ? i18n.t("toast.pinned", { number: seat.pin }) : i18n.t("toast.unpinned"));
  }

  function enterPresentation() {
    const report = engine.validate(state);
    if (!report.valid) {
      ui.showToast(i18n.t("toast.fixFirst"), "error");
      document.getElementById("validationPanel").scrollIntoView({ behavior: "smooth", block: "center" });
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
    document.getElementById("drawMessage").textContent = i18n.t(state.hasDrawn ? "draw.done" : "draw.ready");
    updateSoundButton();
    render({ keepInputs: true });
  }

  function exitPresentation() {
    closeStudentProfile();
    window.clearInterval(drawingTimer);
    drawTimeouts.forEach(window.clearTimeout);
    drawTimeouts = [];
    document.body.classList.remove("drawing-mode");
    document.body.classList.remove("presentation-mode");
    setPresentationRotationDisabled(false);
    adminMode = state.hasDrawn ? "adjust" : adminMode;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
  }

  function isSensitiveField(label) {
    return /(?:密碼|密码|口令|password|passwd|passcode|pwd|pin)/i.test(String(label || ""));
  }

  function openStudentProfile(seatId) {
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
    if (!['layout', 'prearrange', 'adjust'].includes(mode)) return;
    if (mode === "adjust" && !state.hasDrawn) return;
    adminMode = mode;
    selectedAdjustmentSeatId = null;
    render({ keepInputs: true });
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
    document.querySelectorAll(".presentation-rotate-button").forEach((button) => { button.disabled = disabled; });
  }

  function showCountdown(reducedMotion) {
    const overlay = document.getElementById("drawCountdown");
    const text = document.getElementById("drawCountdownText");
    if (reducedMotion) return;
    overlay.classList.add("is-active");
    [["3", 0], ["2", 400], ["1", 800], ["GO", 1200]].forEach(([value, delay]) => {
      drawTimeouts.push(window.setTimeout(() => {
        text.textContent = value === "GO" ? i18n.t("draw.go") : value;
        text.classList.remove("is-pop");
        void text.offsetWidth;
        text.classList.add("is-pop");
        sound.playCount(value);
      }, delay));
    });
    drawTimeouts.push(window.setTimeout(() => overlay.classList.remove("is-active"), 1580));
  }

  function celebrate() {
    const layer = document.getElementById("celebrationLayer");
    const colors = ["#e77732", "#1f6b51", "#f1bd50", "#72a896", "#d86179"];
    layer.innerHTML = Array.from({ length: 42 }, (_, index) => {
      const left = 5 + Math.random() * 90;
      const drift = -70 + Math.random() * 140;
      const delay = Math.random() * 0.28;
      const duration = 1.1 + Math.random() * 0.75;
      const color = colors[index % colors.length];
      return `<i style="--left:${left}%;--drift:${drift}px;--delay:${delay}s;--duration:${duration}s;--color:${color}"></i>`;
    }).join("");
    layer.classList.remove("is-active");
    void layer.offsetWidth;
    layer.classList.add("is-active");
    drawTimeouts.push(window.setTimeout(() => {
      layer.classList.remove("is-active");
      layer.innerHTML = "";
    }, 2200));
  }

  function startDraw() {
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
    const students = engine.buildStudents(state.config).map((student) => student.number);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drawDuration = reducedMotion ? 120 : 2050;
    drawTimeouts.forEach(window.clearTimeout);
    drawTimeouts = [];
    sound.unlock();
    sound.playLaunch();
    showCountdown(reducedMotion);
    document.body.classList.add("drawing-mode");
    setPresentationRotationDisabled(true);
    button.disabled = true;
    button.classList.add("is-drawing");
    message.textContent = i18n.t("draw.drawing");

    state.hasDrawn = false;
    render({ keepInputs: true });
    const seatElements = Array.from(document.querySelectorAll(".seat:not(.is-aisle)"));
    seatElements.forEach((element) => element.classList.add("is-rolling"));

    window.clearInterval(drawingTimer);
    let tick = 0;
    drawingTimer = window.setInterval(() => {
      seatElements.forEach((element) => {
        const value = engine.secureShuffle(students)[0];
        ui.renderRollingValue(element, state, value || null);
      });
      if (tick % 3 === 0) sound.playTick(tick / 3);
      tick += 1;
    }, 75);

    drawTimeouts.push(window.setTimeout(() => {
      window.clearInterval(drawingTimer);
      state.assignment = assignment;
      state.hasDrawn = true;
      render({ keepInputs: true });
      document.querySelectorAll(".seat:not(.is-aisle)").forEach((element, index) => {
        element.style.setProperty("--reveal-delay", `${index * 18}ms`);
        element.classList.add("is-final");
      });
      document.body.classList.remove("drawing-mode");
      sound.playReveal();
      if (!reducedMotion) celebrate();
      button.disabled = false;
      button.classList.remove("is-drawing");
      setPresentationRotationDisabled(false);
      document.getElementById("drawButtonText").textContent = i18n.t("draw.redraw");
      message.textContent = i18n.t("draw.done");
      saveSoon();
    }, drawDuration));
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
      document.getElementById("drawMessage").textContent = i18n.t("draw.done");
    } else {
      render({ keepInputs: true });
      document.getElementById("drawButtonText").textContent = i18n.t("draw.start");
      document.getElementById("drawMessage").textContent = i18n.t("draw.ready");
    }
  }

  function bindEvents() {
    ["classNameInput", "rowsInput", "colsInput", "maxNumberInput", "emptyNumbersInput", "femaleStartInput", "displayModeInput"].forEach((id) => {
      document.getElementById(id).addEventListener("change", updateFromInputs);
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
      const pinButton = event.target.closest("[data-action='pin']");
      if (pinButton) { event.stopPropagation(); openPinDialog(pinButton.dataset.seatId); return; }
      const axis = event.target.closest("[data-axis]");
      if (axis) { cycleAxis(axis.dataset.axis, Number(axis.dataset.index)); return; }
      const seat = event.target.closest(".seat");
      if (seat && document.body.classList.contains("presentation-mode")) {
        openStudentProfile(seat.dataset.seatId);
      } else if (seat) {
        if (adminMode === "prearrange") openPinDialog(seat.dataset.seatId);
        else if (adminMode === "adjust") selectAdjustmentSeat(seat.dataset.seatId);
        else cycleSeat(seat.dataset.seatId);
      }
    });

    document.getElementById("seatGrid").addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("seat")) {
        event.preventDefault();
        if (document.body.classList.contains("presentation-mode")) openStudentProfile(event.target.dataset.seatId);
        else if (adminMode === "prearrange") openPinDialog(event.target.dataset.seatId);
        else if (adminMode === "adjust") selectAdjustmentSeat(event.target.dataset.seatId);
        else cycleSeat(event.target.dataset.seatId);
      }
    });

    document.getElementById("pinForm").addEventListener("submit", (event) => {
      if (event.submitter && event.submitter.value === "default") applyPin();
    });
    document.getElementById("presentationButton").addEventListener("click", enterPresentation);
    document.getElementById("adminButton").addEventListener("click", exitPresentation);
    document.getElementById("drawButton").addEventListener("click", startDraw);
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
        storage.save(state);
        render();
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
      adminMode = "layout";
      selectedAdjustmentSeatId = null;
      storage.save(state);
      render();
      ui.showToast(i18n.t("toast.reset"));
    });
  }

  function init() {
    state = hydrate(storage.load() || SeatMaster.createDefaultState());
    i18n.apply();
    ui.populateRoomPositionOptions();
    bindEvents();
    render();
    storage.save(state);
  }

  init();
})();
