(function () {
  "use strict";

  const SM = window.SeatMaster;
  const { engine, i18n, ui } = SM;

  // Drafts are independent of the last published result. Never keep duplicates,
  // missing student numbers, removed desks, or aisle assignments after an edit.
  function normalize(state, source) {
    const valid = new Set(engine.buildStudents(state.config).map((s) => s.number));
    const used = new Set();
    const assignment = {};
    state.seats.filter((s) => s.type !== "aisle").forEach((seat) => {
      const value = source && source[seat.id];
      assignment[seat.id] = Number.isInteger(value) && valid.has(value) && !used.has(value) ? value : null;
      if (assignment[seat.id] !== null) used.add(value);
    });
    return assignment;
  }

  function remaining(state, assignment) {
    const used = new Set(Object.values(assignment));
    return engine.buildStudents(state.config).filter((s) => !used.has(s.number));
  }

  function place(state, source, number, targetId) {
    const assignment = normalize(state, source);
    if (!Object.hasOwn(assignment, targetId) || !engine.buildStudents(state.config).some((s) => s.number === number)) return assignment;
    const from = Object.keys(assignment).find((id) => assignment[id] === number);
    if (from === targetId) return assignment;
    // A seated student swaps; an unseated student sends the occupant to the tray.
    if (from) assignment[from] = assignment[targetId];
    assignment[targetId] = number;
    return assignment;
  }

  function createController(getState, changed, finish) {
    let selected = null;
    let undo = [];
    let redo = [];
    let query = "";
    let filter = "pending";
    let automatic = true;
    let active = false;
    const $ = (id) => document.getElementById(id);
    const t = i18n.t;
    const label = (number) => {
      const state = getState();
      const name = engine.parseStudentNames(state.config.studentData, engine.buildStudents(state.config)).get(number);
      return `${t("seat.number", { number })}${name ? ` ${name}` : ""}`;
    };
    const seatLabel = (id) => {
      const seat = getState().seats.find((s) => s.id === id);
      return seat ? `${ui.columnLabel(seat.col)}${seat.row + 1}` : "";
    };
    const matches = (number) => label(number).toLocaleLowerCase().includes(query.toLocaleLowerCase());
    const next = () => remaining(getState(), getState().manualDraft).find((s) => matches(s.number))?.number || null;
    const focusSeat = (id) => document.querySelector(`.seat[data-seat-id="${id}"]`)?.focus({ preventScroll: true });

    function reset() { undo = []; redo = []; selected = null; }
    function start() {
      const state = getState();
      if (state.manualDraft === null || state.manualDraft === undefined) {
        const source = state.hasDrawn ? state.assignment : Object.fromEntries(state.seats.map((s) => [s.id, s.pin]));
        state.manualDraft = normalize(state, source);
        reset();
      }
      if (automatic && selected === null) selected = next();
    }
    function commit(assignment, nextSelected, message) {
      const state = getState();
      if (JSON.stringify(assignment) === JSON.stringify(state.manualDraft)) return;
      undo.push({ assignment: { ...state.manualDraft }, selected });
      if (undo.length > 100) undo.shift();
      redo = [];
      state.manualDraft = assignment;
      selected = nextSelected;
      changed();
      $("manualFeedback").textContent = message;
    }
    function move(number, id) {
      const state = getState();
      const source = state.manualDraft;
      if (!source || !Object.hasOwn(source, id)) return;
      const occupant = source[id];
      const from = Object.keys(source).find((key) => source[key] === number);
      if (from === id) { selected = null; changed(false); return; }
      const assignment = place(state, source, number, id);
      const pending = remaining(state, assignment).filter((s) => matches(s.number));
      const nextSelected = !from && occupant ? occupant : automatic ? pending[0]?.number || null : null;
      let message = t(from && occupant ? "manual.swapped" : "manual.placed", { student: label(number), seat: seatLabel(id) });
      if (!from && occupant) message += ` ${t("manual.displaced", { student: label(occupant) })}`;
      commit(assignment, nextSelected, message);
      if (!from && occupant) ui.showToast(message);
      focusSeat(id);
    }
    function selectSeat(id) {
      const source = getState().manualDraft;
      if (!source || !Object.hasOwn(source, id)) return;
      if (selected !== null) move(selected, id);
      else if (source[id]) { selected = source[id]; changed(false); focusSeat(id); }
      else { $("manualFeedback").textContent = t("manual.chooseFirst"); }
    }
    function restore(backward) {
      const from = backward ? undo : redo;
      const to = backward ? redo : undo;
      const snapshot = from.pop();
      if (!snapshot) return;
      const state = getState();
      to.push({ assignment: { ...state.manualDraft }, selected });
      state.manualDraft = normalize(state, snapshot.assignment);
      selected = snapshot.selected;
      changed();
      $("manualFeedback").textContent = t(backward ? "manual.undone" : "manual.redone");
    }
    function unseat() {
      const source = getState().manualDraft;
      const id = Object.keys(source || {}).find((key) => source[key] === selected);
      if (!id) return;
      commit({ ...source, [id]: null }, selected, t("manual.returned", { student: label(selected) }));
    }
    function render(isActive) {
      active = isActive;
      $("manualPanel").hidden = !active;
      document.body.classList.toggle("manual-mode", active);
      if (!active) return;
      const state = getState();
      const source = state.manualDraft || {};
      const students = engine.buildStudents(state.config);
      const names = engine.parseStudentNames(state.config.studentData, students);
      const pending = remaining(state, source);
      const seatsByNumber = new Map(Object.entries(source).filter(([, n]) => n).map(([id, n]) => [n, id]));
      if (selected !== null && !students.some((s) => s.number === selected)) selected = null;
      $("manualProgress").textContent = t("manual.progress", { placed: students.length - pending.length, total: students.length, remaining: pending.length });
      $("manualProgressBar").max = students.length || 1;
      $("manualProgressBar").value = students.length - pending.length;
      $("manualCurrent").textContent = selected !== null ? t("manual.selected", { student: label(selected) }) : pending.length ? t("manual.chooseFirst") : t("manual.allPlaced");
      $("manualFinishButton").disabled = pending.length > 0 || !students.length;
      $("manualUndoButton").disabled = !undo.length;
      $("manualRedoButton").disabled = !redo.length;
      $("manualUnseatButton").disabled = !seatsByNumber.has(selected);
      $("manualCancelSelection").disabled = selected === null;
      $("manualClearButton").disabled = !seatsByNumber.size;
      $("manualCapacity").hidden = Object.keys(source).length >= students.length;
      $("manualCapacity").textContent = t("manual.capacity", { count: students.length - Object.keys(source).length });
      document.querySelectorAll("[data-manual-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.manualFilter === filter)));
      const visible = students.filter((s) => matches(s.number) && (filter === "all" || !seatsByNumber.has(s.number)));
      const tray = $("manualStudents");
      tray.classList.toggle("numbers-only", !visible.some((s) => names.get(s.number)));
      const scroll = tray.scrollTop;
      tray.innerHTML = visible.length ? visible.map((s) => {
        const id = seatsByNumber.get(s.number);
        const name = names.get(s.number);
        const description = `${label(s.number)}${id ? ` · ${seatLabel(id)}` : ""}`;
        return `<button type="button" class="manual-student ${selected === s.number ? "is-selected" : ""}" data-student-number="${s.number}" draggable="true" aria-pressed="${selected === s.number}" aria-label="${ui.escapeHtml(description)}" title="${ui.escapeHtml(description)}"><span class="manual-student-number">${s.number}</span>${name ? `<span class="manual-student-name">${ui.escapeHtml(name)}</span>` : ""}${id ? `<small>${ui.escapeHtml(seatLabel(id))}</small>` : ""}</button>`;
      }).join("") : `<p class="manual-empty">${ui.escapeHtml(query ? t("manual.noMatches") : t("manual.nonePending"))}</p>`;
      tray.scrollTop = scroll;
      document.querySelectorAll(".seat").forEach((element) => {
        const id = element.dataset.seatId;
        const usable = Object.hasOwn(source, id);
        const number = source[id];
        element.classList.toggle("manual-seat-selected", !!number && number === selected);
        element.classList.toggle("manual-seat-target", usable && selected !== null && number !== selected);
        element.setAttribute("aria-pressed", String(!!number && number === selected));
        element.setAttribute("aria-disabled", String(!usable));
        element.tabIndex = usable ? 0 : -1;
        element.draggable = usable && !!number;
        element.setAttribute("aria-label", `${seatLabel(id)} · ${usable ? number ? label(number) : t("manual.emptySeat") : t("seat.aisle")}`);
        element.title = usable && selected !== null && number !== selected ? t(number ? seatsByNumber.has(selected) ? "manual.swapTarget" : "manual.replaceTarget" : "manual.placeTarget") : "";
      });
    }

    $("manualStudents").addEventListener("click", (event) => {
      const button = event.target.closest("[data-student-number]");
      if (!button) return;
      const number = Number(button.dataset.studentNumber);
      selected = selected === number ? null : number;
      changed(false);
      document.querySelector(`[data-student-number="${number}"]`)?.focus({ preventScroll: true });
    });
    $("manualSearch").addEventListener("input", (event) => { query = event.target.value.trim(); render(active); });
    document.querySelectorAll("[data-manual-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.manualFilter; render(active); }));
    $("manualAutoNext").addEventListener("change", (event) => { automatic = event.target.checked; });
    $("manualCancelSelection").addEventListener("click", () => { selected = null; changed(false); });
    $("manualUnseatButton").addEventListener("click", unseat);
    $("manualUndoButton").addEventListener("click", () => restore(true));
    $("manualRedoButton").addEventListener("click", () => restore(false));
    $("manualClearButton").addEventListener("click", () => {
      if (!window.confirm(t("manual.clearConfirm"))) return;
      commit(normalize(getState(), {}), automatic ? engine.buildStudents(getState().config)[0]?.number || null : null, t("manual.cleared"));
    });
    $("manualFinishButton").addEventListener("click", finish);
    document.addEventListener("keydown", (event) => {
      if (!active || document.querySelector("dialog[open]") || event.target.closest("input, textarea, select, [contenteditable], dialog")) return;
      if (event.key === "Escape") { selected = null; changed(false); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); restore(!event.shiftKey); }
    });
    let dragging = null;
    document.addEventListener("dragstart", (event) => {
      if (!active) return;
      const student = event.target.closest("[data-student-number]");
      const seat = event.target.closest(".seat");
      dragging = student ? Number(student.dataset.studentNumber) : seat ? getState().manualDraft[seat.dataset.seatId] : null;
      if (!dragging) return;
      event.dataTransfer.setData("text/plain", String(dragging));
      event.dataTransfer.effectAllowed = "move";
    });
    $("seatGrid").addEventListener("dragover", (event) => {
      const seat = event.target.closest(".seat");
      if (active && dragging && seat && Object.hasOwn(getState().manualDraft, seat.dataset.seatId)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
    });
    $("seatGrid").addEventListener("drop", (event) => {
      const seat = event.target.closest(".seat");
      if (!active || !dragging || !seat) return;
      event.preventDefault();
      move(dragging, seat.dataset.seatId);
      dragging = null;
    });
    document.addEventListener("dragend", () => { dragging = null; });
    return { start, render, selectSeat, reset };
  }

  SM.manualSeating = { normalize, remaining, place, createController };
})();
