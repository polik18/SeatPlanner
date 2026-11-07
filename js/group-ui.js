(function () {
  "use strict";

  const SM = window.SeatMaster;
  const { engine, groupPlanner, i18n, ui } = SM;

  function create(getState, save) {
    const $ = (id) => document.getElementById(id);
    const dialog = $("groupPlannerDialog");
    let currentId = null;
    let activeNumbers = new Set();
    let preassignments = {};
    let tablePreferences = {};
    let redo = [];
    const t = i18n.t;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const active = () => getState().activities.find((item) => item.id === currentId) || null;
    const studentLabel = (student) => {
      const name = student.name || engine.parseStudentNames(getState().config.studentData, engine.buildStudents(getState().config)).get(student.number);
      return `${t("seat.number", { number: student.number })}${name ? ` ${name}` : ""}`;
    };

    function seatingAreas(activity) {
      if (activity && Array.isArray(activity.seatAreasSnapshot)) return activity.seatAreasSnapshot;
      const state = getState();
      if (state.roomLayout) return state.roomLayout.tables.map((table, index) => ({ id: table.id, name: t("room.table", { number: index + 1 }), seatIds: table.seatIds }));
      const seats = state.seats.filter((seat) => seat.type !== "aisle");
      const areas = [];
      for (let i = 0; i < seats.length; i += 6) areas.push({ id: `zone-${areas.length + 1}`, name: t("groups.seatZone", { number: areas.length + 1 }), seatIds: seats.slice(i, i + 6).map((seat) => seat.id) });
      return areas;
    }

    function groupCountFor(students, groupSize, strategy) {
      let count = groupPlanner.numberOfGroups(students.length, groupSize);
      if (strategy === "same" && students.length > 1) count = Math.min(Math.floor(students.length / 2), Math.max(count, Math.ceil(students.filter((student) => student.gender === "male").length / 6) + Math.ceil(students.filter((student) => student.gender === "female").length / 6)));
      return count;
    }

    function renderTablePreassign() {
      const students = engine.buildStudents(getState().config).filter((student) => activeNumbers.has(student.number));
      const count = groupCountFor(students, Number($("groupSize").value), $("groupStrategy").value);
      const areas = seatingAreas();
      $("groupTablePreassign").innerHTML = count ? Array.from({ length: count }, (_, index) => `<label class="group-table-preassign-row"><span>${ui.escapeHtml(t("groups.groupNumber", { number: index + 1 }))}</span><select data-preassign-table="${index}"><option value="">${ui.escapeHtml(t("groups.noSeatPlan"))}</option>${areas.map((area) => `<option value="${ui.escapeHtml(area.id)}">${ui.escapeHtml(area.name)} · ${area.seatIds.length}</option>`).join("")}</select></label>`).join("") : `<p class="group-empty">${ui.escapeHtml(t("groups.noSeatAreas"))}</p>`;
      Object.entries(tablePreferences).forEach(([index, areaId]) => { const select = document.querySelector(`[data-preassign-table="${index}"]`); if (select) select.value = areaId; });
    }

    function roster() {
      const students = engine.buildStudents(getState().config);
      const participants = students.filter((student) => activeNumbers.has(student.number));
      const count = groupCountFor(participants, Number($("groupSize").value), $("groupStrategy").value);
      const names = engine.parseStudentNames(getState().config.studentData, students);
      $("groupRoster").innerHTML = students.map((student) => {
        const checked = activeNumbers.has(student.number);
        const seatTag = student.requiresSeat ? "" : `<small class="roster-no-seat">${ui.escapeHtml(t("manual.noPhysicalSeat"))}</small>`;
        const options = [`<option value="">${ui.escapeHtml(t("groups.randomGroup"))}</option>`, ...Array.from({ length: count }, (_, index) => `<option value="${index}">${ui.escapeHtml(t("groups.groupNumber", { number: index + 1 }))}</option>`)].join("");
        return `<label class="group-roster-row"><input type="checkbox" data-group-participant="${student.number}" ${checked ? "checked" : ""}><span class="group-roster-name"><b>${student.number}</b>${ui.escapeHtml(names.get(student.number) || "")}${seatTag}</span><select data-preassign-number="${student.number}" aria-label="${ui.escapeHtml(t("groups.preassign", { student: studentLabel(student) }))}" ${checked ? "" : "disabled"}>${options}</select></label>`;
      }).join("");
      Object.entries(preassignments).forEach(([number, index]) => {
        const select = document.querySelector(`[data-preassign-number="${number}"]`);
        if (select) select.value = String(index);
      });
      renderTablePreassign();
    }

    function taskSnapshot(activity) {
      return { groups: clone(activity.groups), groupTables: clone(activity.groupTables || {}), seatAssignments: clone(activity.seatAssignments || {}) };
    }

    function restoreSnapshot(activity, value) {
      if (Array.isArray(value)) { activity.groups = value; activity.groupTables ||= {}; activity.seatAssignments ||= {}; return; }
      activity.groups = value.groups; activity.groupTables = value.groupTables || {}; activity.seatAssignments = value.seatAssignments || {};
    }

    function snapshot(activity) {
      activity.history = Array.isArray(activity.history) ? activity.history : [];
      activity.history.push(taskSnapshot(activity));
      if (activity.history.length > 50) activity.history.shift();
      redo = [];
    }

    function assignGroupSeats(activity, group) {
      activity.groupTables ||= {};
      activity.seatAssignments ||= {};
      const areaId = activity.groupTables[group.id];
      if (!areaId) { group.members.forEach((number) => { delete activity.seatAssignments[number]; }); return; }
      const area = seatingAreas(activity).find((item) => item.id === areaId);
      if (!area) { group.members.forEach((number) => { delete activity.seatAssignments[number]; }); return; }
      const members = new Set(group.members);
      const used = new Set(Object.entries(activity.seatAssignments).filter(([number]) => !members.has(Number(number))).map(([, seatId]) => seatId));
      group.members.forEach((number) => { delete activity.seatAssignments[number]; });
      const open = area.seatIds.filter((seatId) => !used.has(seatId));
      group.members.forEach((number, index) => { if (open[index]) activity.seatAssignments[number] = open[index]; });
    }

    function showStatus(activity) {
      const report = groupPlanner.validate(activity.groups, activity.participants);
      const count = activity.participants.length;
      const onePerson = count === 1 ? ` ${t("groups.singlePersonNote")}` : "";
      const historicalRoster = activity.rosterSnapshot || engine.buildStudents(getState().config);
      const historicalByNumber = new Map(historicalRoster.map((student) => [student.number, student]));
      const genderByNumber = new Map(historicalRoster.map((student) => [student.number, student.gender]));
      const genderIssues = activity.strategy === "same" ? activity.groups.filter((group) => new Set(group.members.map((number) => genderByNumber.get(number)).filter(Boolean)).size > 1).map((group) => `${group.name} ${t("groups.genderConflict")}`) : [];
      const areas = seatingAreas(activity);
      const seatIssues = [];
      const usedSeats = new Set();
      activity.groups.forEach((group) => {
        const areaId = activity.groupTables && activity.groupTables[group.id];
        if (!areaId) return;
        const area = areas.find((item) => item.id === areaId);
        if (!area) { seatIssues.push(`${group.name} ${t("groups.seatAreaMissing")}`); return; }
        if (group.members.length > area.seatIds.length) seatIssues.push(`${group.name} ${t("groups.seatCapacity", { count: area.seatIds.length })}`);
        group.members.forEach((number) => {
          const seatId = activity.seatAssignments && activity.seatAssignments[number];
          if (!seatId) { seatIssues.push(`${studentLabel(historicalByNumber.get(number) || { number })} ${t("groups.noTaskSeat")}`); return; }
          if (!area.seatIds.includes(seatId)) seatIssues.push(`${studentLabel(historicalByNumber.get(number) || { number })} ${t("groups.seatOutsideArea")}`);
          if (usedSeats.has(seatId)) seatIssues.push(t("groups.duplicateTaskSeat"));
          usedSeats.add(seatId);
        });
      });
      const issues = [...report.errors, ...genderIssues, ...seatIssues];
      $("groupStatus").textContent = issues.length ? `${t("groups.needsAdjustment")} ${issues.join(" ")}` : `${t("groups.ready", { count, groups: activity.groups.length })}${onePerson}`;
      $("groupStatus").classList.toggle("is-error", issues.length > 0);
      $("groupUndoButton").disabled = !activity.history.length;
      $("groupRedoButton").disabled = !redo.length;
      $("groupRedrawButton").disabled = !activity.groups.some((group) => !group.locked);
      $("groupPrintButton").disabled = !activity.groups.length;
    }

    function renderGroup(group, index, activity, byNumber, areas) {
      const area = areas.find((item) => item.id === activity.groupTables?.[group.id]);
      const memberRows = group.members.map((number) => {
        const student = byNumber.get(number) || { number };
        const currentSeat = activity.seatAssignments?.[number] || "";
        const used = new Set(Object.entries(activity.seatAssignments || {}).filter(([studentNumber]) => Number(studentNumber) !== number).map(([, seatId]) => seatId));
        const seatSelect = area ? `<select data-task-seat-number="${number}" aria-label="${ui.escapeHtml(t("groups.assignSeat", { student: studentLabel(student) }))}"><option value="">${ui.escapeHtml(t("groups.noTaskSeat"))}</option>${area.seatIds.map((seatId, seatIndex) => `<option value="${ui.escapeHtml(seatId)}" ${seatId === currentSeat ? "selected" : ""} ${used.has(seatId) ? "disabled" : ""}>${ui.escapeHtml(t("groups.seatNumber", { number: seatIndex + 1 }))}</option>`).join("")}</select>` : "";
        return `<li><span>${ui.escapeHtml(studentLabel(student))}</span><div><select data-move-number="${number}" aria-label="${ui.escapeHtml(t("groups.moveStudent", { student: studentLabel(student) }))}">${activity.groups.map((target, targetIndex) => `<option value="${targetIndex}" ${targetIndex === index ? "selected" : ""}>${ui.escapeHtml(target.name)}</option>`).join("")}</select>${seatSelect}</div></li>`;
      }).join("");
      return `<article class="task-group ${group.locked ? "is-locked" : ""}">
        <header><input class="task-group-name" type="text" maxlength="40" value="${ui.escapeHtml(group.name)}" data-group-name="${index}" aria-label="${ui.escapeHtml(t("groups.rename"))}"><span class="task-group-size">${group.members.length} / 6</span><button class="button button-secondary group-lock" type="button" data-group-lock="${index}" aria-pressed="${group.locked}">${ui.escapeHtml(t(group.locked ? "groups.unlock" : "groups.lock"))}</button></header>
        <label class="group-seat-area"><span>${ui.escapeHtml(t("groups.seatArea"))}</span><select data-group-table="${index}"><option value="">${ui.escapeHtml(t("groups.noSeatPlan"))}</option>${areas.map((item) => `<option value="${ui.escapeHtml(item.id)}" ${activity.groupTables?.[group.id] === item.id ? "selected" : ""}>${ui.escapeHtml(item.name)} · ${item.seatIds.length}</option>`).join("")}</select></label>
        <ul>${memberRows || `<li class="group-empty">${ui.escapeHtml(t("groups.empty"))}</li>`}</ul>
      </article>`;
    }

    function renderResults() {
      const activity = active();
      if (!activity) { $("groupResults").innerHTML = ""; return; }
      const students = activity.rosterSnapshot || engine.buildStudents(getState().config);
      const byNumber = new Map(students.map((student) => [student.number, student]));
      const areas = seatingAreas(activity);
      $("groupResults").innerHTML = activity.groups.map((group, index) => renderGroup(group, index, activity, byNumber, areas)).join("");
      showStatus(activity);
    }

    function render() {
      const state = getState();
      const savedSelect = $("groupSavedTasks");
      savedSelect.innerHTML = `<option value="">${ui.escapeHtml(t("groups.newTask"))}</option>${state.activities.map((activity) => `<option value="${ui.escapeHtml(activity.id)}">${ui.escapeHtml(activity.title)}</option>`).join("")}`;
      savedSelect.value = currentId && state.activities.some((item) => item.id === currentId) ? currentId : "";
      const activity = active();
      if (activity) {
        $("groupTaskName").value = activity.title;
        $("groupSize").value = String(activity.groupSize);
        $("groupStrategy").value = activity.strategy;
      } else if (!currentId) {
        $("groupTaskName").value = "";
      }
      roster();
      renderResults();
    }

    function open() {
      const state = getState();
      const activity = state.activities[0];
      if (activity) {
        currentId = activity.id;
        activeNumbers = new Set(activity.participants);
        preassignments = { ...(activity.preassignments || {}) };
        tablePreferences = { ...(activity.tablePreferences || {}) };
      } else {
        currentId = null;
        activeNumbers = new Set(engine.buildStudents(state.config).map((student) => student.number));
        preassignments = {};
        tablePreferences = {};
      }
      redo = [];
      render();
      if (!dialog.open) dialog.showModal();
    }

    function drawNew() {
      const state = getState();
      const students = engine.buildStudents(state.config).filter((student) => activeNumbers.has(student.number));
      if (!students.length) { $("groupStatus").textContent = t("groups.selectAtLeastOne"); return; }
      const groupSize = Number($("groupSize").value);
      const strategy = $("groupStrategy").value;
      let groups;
      try { groups = groupPlanner.draw(students, groupSize, strategy, preassignments); }
      catch (error) { $("groupStatus").textContent = error.message; $("groupStatus").classList.add("is-error"); return; }
      const groupTables = {};
      const areas = seatingAreas();
      groups.forEach((group, index) => {
        const areaId = tablePreferences[index] || (groups.length <= areas.length ? areas[index]?.id : "");
        if (areaId) groupTables[group.id] = areaId;
      });
      const names = engine.parseStudentNames(state.config.studentData, engine.buildStudents(state.config));
      const activity = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: $("groupTaskName").value.trim() || t("groups.defaultName"),
        createdAt: new Date().toISOString(),
        participants: students.map((student) => student.number),
        rosterSnapshot: students.map((student) => ({ ...student, name: names.get(student.number) || "" })),
        groupSize,
        strategy,
        preassignments: { ...preassignments },
        groups,
        seatAreasSnapshot: clone(areas),
        tablePreferences: { ...tablePreferences },
        groupTables,
        seatAssignments: {},
        history: []
      };
      groups.forEach((group) => assignGroupSeats(activity, group));
      state.activities.unshift(activity);
      currentId = activity.id;
      save();
      roster();
      renderResults();
    }

    function redrawUnlocked() {
      const activity = active();
      if (!activity) return;
      const lockedNumbers = new Set(activity.groups.filter((group) => group.locked).flatMap((group) => group.members));
      const pending = (activity.rosterSnapshot || engine.buildStudents(getState().config)).filter((student) => activity.participants.includes(student.number) && !lockedNumbers.has(student.number));
      if (!pending.length) return;
      let fresh;
      try { fresh = groupPlanner.draw(pending, activity.groupSize, activity.strategy, {}); }
      catch (error) { $("groupStatus").textContent = error.message; $("groupStatus").classList.add("is-error"); return; }
      snapshot(activity);
      const locked = activity.groups.filter((group) => group.locked);
      const replaceable = activity.groups.filter((group) => !group.locked);
      fresh.forEach((group, index) => {
        const old = replaceable[index];
        if (old) { group.id = old.id; group.name = old.name; }
        else group.name = t("groups.groupNumber", { number: activity.groups.length + index + 1 });
      });
      activity.groups = [...locked, ...fresh].sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
      activity.groupTables ||= {}; activity.seatAssignments ||= {};
      activity.groups.filter((group) => !group.locked).forEach((group) => assignGroupSeats(activity, group));
      save(); renderResults();
    }

    function undo() {
      const activity = active();
      if (!activity || !activity.history.length) return;
      redo.push(taskSnapshot(activity));
      restoreSnapshot(activity, activity.history.pop());
      save(); renderResults();
    }

    function redoChange() {
      const activity = active();
      if (!activity || !redo.length) return;
      activity.history.push(taskSnapshot(activity));
      if (activity.history.length > 50) activity.history.shift();
      restoreSnapshot(activity, redo.pop());
      save(); renderResults();
    }

    function print() {
      const activity = active();
      if (!activity) return;
      const students = activity.rosterSnapshot || engine.buildStudents(getState().config);
      const names = new Map(students.map((student) => [student.number, student.name || ""]));
      const escape = ui.escapeHtml;
      const areas = seatingAreas(activity);
      const content = activity.groups.map((group) => {
        const area = areas.find((item) => item.id === activity.groupTables?.[group.id]);
        return `<section><h2>${escape(group.name)} (${group.members.length})</h2>${area ? `<p>${escape(area.name)}</p>` : ""}<ol>${group.members.map((number) => { const seatIndex = area?.seatIds.indexOf(activity.seatAssignments?.[number]) ?? -1; return `<li>${escape(t("seat.number", { number }))} ${escape(names.get(number) || "")}${seatIndex >= 0 ? ` · ${escape(t("groups.seatNumber", { number: seatIndex + 1 }))}` : ""}</li>`; }).join("")}</ol></section>`;
      }).join("");
      const page = window.open("", "_blank");
      if (!page) { $("groupStatus").textContent = t("groups.popupBlocked"); return; }
      page.document.write(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>${escape(activity.title)}</title><style>body{font:16px system-ui,sans-serif;margin:32px;color:#18382b}h1{margin-bottom:4px}.groups{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}section{border:1px solid #ccd8d1;border-radius:12px;padding:12px 20px;break-inside:avoid}li{padding:3px}@media print{body{margin:12mm}.groups{gap:10mm}}</style><h1>${escape(activity.title)}</h1><p>${escape(new Date(activity.createdAt).toLocaleString())}</p><main class="groups">${content}</main><script>window.print()<\/script></html>`);
      page.document.close();
    }

    $("groupPlannerOpen").addEventListener("click", open);
    $("groupPlannerClose").addEventListener("click", () => dialog.close());
    $("groupSize").addEventListener("change", roster);
    $("groupStrategy").addEventListener("change", roster);
    $("groupSelectAll").addEventListener("click", () => { activeNumbers = new Set(engine.buildStudents(getState().config).map((student) => student.number)); roster(); });
    $("groupSavedTasks").addEventListener("change", (event) => {
      currentId = event.target.value || null;
      const activity = active();
      activeNumbers = new Set(activity ? activity.participants : engine.buildStudents(getState().config).map((student) => student.number));
      preassignments = { ...(activity?.preassignments || {}) };
      tablePreferences = { ...(activity?.tablePreferences || {}) };
      redo = []; render();
    });
    $("groupNewTask").addEventListener("click", () => {
      currentId = null;
      activeNumbers = new Set(engine.buildStudents(getState().config).map((student) => student.number));
      preassignments = {}; tablePreferences = {}; redo = [];
      render(); $("groupTaskName").focus();
    });
    $("groupRoster").addEventListener("change", (event) => {
      const check = event.target.closest("[data-group-participant]");
      if (check) { const number = Number(check.dataset.groupParticipant); if (check.checked) activeNumbers.add(number); else { activeNumbers.delete(number); delete preassignments[number]; } roster(); return; }
      const select = event.target.closest("[data-preassign-number]");
      if (select) { if (select.value === "") delete preassignments[select.dataset.preassignNumber]; else preassignments[select.dataset.preassignNumber] = Number(select.value); }
      const tableSelect = event.target.closest("[data-preassign-table]");
      if (tableSelect) { if (!tableSelect.value) delete tablePreferences[tableSelect.dataset.preassignTable]; else tablePreferences[tableSelect.dataset.preassignTable] = tableSelect.value; }
    });
    $("groupTablePreassign").addEventListener("change", (event) => {
      const tableSelect = event.target.closest("[data-preassign-table]");
      if (!tableSelect) return;
      if (!tableSelect.value) delete tablePreferences[tableSelect.dataset.preassignTable];
      else tablePreferences[tableSelect.dataset.preassignTable] = tableSelect.value;
    });
    $("groupDrawButton").addEventListener("click", drawNew);
    $("groupRedrawButton").addEventListener("click", redrawUnlocked);
    $("groupUndoButton").addEventListener("click", undo);
    $("groupRedoButton").addEventListener("click", redoChange);
    $("groupPrintButton").addEventListener("click", print);
    $("groupResults").addEventListener("change", (event) => {
      const activity = active();
      if (!activity) return;
      const name = event.target.closest("[data-group-name]");
      const move = event.target.closest("[data-move-number]");
      const groupTable = event.target.closest("[data-group-table]");
      const taskSeat = event.target.closest("[data-task-seat-number]");
      if (name) { snapshot(activity); activity.groups[Number(name.dataset.groupName)].name = name.value.trim() || t("groups.defaultGroup", { number: Number(name.dataset.groupName) + 1 }); save(); renderResults(); return; }
      if (move) {
        const number = Number(move.dataset.moveNumber); const destination = Number(move.value);
        const source = activity.groups.find((group) => group.members.includes(number));
        if (!source || source === activity.groups[destination]) return;
        const target = activity.groups[destination];
        if (target.members.length >= 6) { $("groupStatus").textContent = t("groups.groupFull"); renderResults(); return; }
        snapshot(activity); source.members = source.members.filter((member) => member !== number); target.members.push(number); assignGroupSeats(activity, source); assignGroupSeats(activity, target); save(); renderResults();
      }
      if (groupTable) {
        const group = activity.groups[Number(groupTable.dataset.groupTable)];
        snapshot(activity);
        activity.groupTables ||= {}; activity.seatAssignments ||= {};
        if (groupTable.value) activity.groupTables[group.id] = groupTable.value; else delete activity.groupTables[group.id];
        assignGroupSeats(activity, group); save(); renderResults();
      }
      if (taskSeat) {
        const number = Number(taskSeat.dataset.taskSeatNumber);
        if (taskSeat.value && Object.entries(activity.seatAssignments || {}).some(([other, id]) => Number(other) !== number && id === taskSeat.value)) { renderResults(); return; }
        snapshot(activity);
        if (taskSeat.value) activity.seatAssignments[number] = taskSeat.value; else delete activity.seatAssignments[number];
        save(); renderResults();
      }
    });
    $("groupResults").addEventListener("click", (event) => {
      const button = event.target.closest("[data-group-lock]");
      const activity = active();
      if (!button || !activity) return;
      snapshot(activity); const group = activity.groups[Number(button.dataset.groupLock)]; group.locked = !group.locked; save(); renderResults();
    });
    return { open };
  }

  SM.groupUI = { create };
})();
