(function () {
  "use strict";
  const sm = window.SeatMaster;
  const { engine, ui, i18n, sound, effects } = sm;
  const STORAGE_KEY = "classroom-seat-master:student-draw";

  function init(getState, onSoundChange) {
    const el = (id) => document.getElementById(id);
    const dialog = el("studentDrawDialog");
    let round = { key: "", history: [] };
    let students = [];
    let names = new Map();
    let timeline = null;
    let busy = false;
    let storageFailed = false;

    function syncRoster() {
      const { config } = getState();
      students = engine.buildStudents(config);
      names = engine.parseStudentNames(config.studentData, students);
      const key = JSON.stringify([config.className, students.map((student) => [student.number, names.get(student.number) || ""])]);
      if (round.key !== key) {
        round = { key, history: [] };
        try {
          const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
          const valid = new Set(students.map((student) => student.number));
          if (saved && saved.key === key && Array.isArray(saved.history) && saved.history.length <= 999 &&
              saved.history.every((batch) => Array.isArray(batch) && batch.length > 0 && batch.length <= students.length &&
                new Set(batch).size === batch.length && batch.every((number) => valid.has(number)))) round = saved;
        } catch (_) { /* A missing or outdated round starts empty. */ }
      }
      el("studentDrawClass").textContent = config.className;
    }

    function excluded() { return el("studentDrawNoRepeat").checked ? [...new Set(round.history.flat())] : []; }
    function availableCount() { return students.length - excluded().length; }
    function label(number) { return `${i18n.t("seat.number", { number })}${names.get(number) ? ` ${names.get(number)}` : ""}`; }

    function saveRound() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(round)); storageFailed = false; }
      catch (_) { storageFailed = true; }
    }

    function cards(numbers, final) {
      el("studentDrawCards").innerHTML = numbers.map((number, index) => `<div class="picker-card ${final ? "is-winner" : ""}" style="--reveal-delay:${Math.min(index * 80, 640)}ms"><span>${ui.escapeHtml(i18n.t("seat.number", { number }))}</span><strong>${ui.escapeHtml(names.get(number) || String(number))}</strong></div>`).join("");
      el("studentDrawCards").classList.toggle("is-single", numbers.length === 1);
    }

    function updateControls() {
      const available = availableCount();
      const count = el("studentDrawCount");
      count.max = Math.max(1, available);
      count.disabled = busy || !available;
      el("studentDrawNoRepeat").disabled = busy;
      el("studentDrawStart").disabled = busy || !available;
      el("studentDrawReset").disabled = busy || !round.history.length;
      el("studentDrawSkip").hidden = !busy;
      el("studentDrawStart").textContent = i18n.t(round.history.length ? "picker.next" : "picker.start");
      el("studentDrawPool").textContent = i18n.t("picker.pool", { available, total: students.length });
      el("studentDrawSound").textContent = i18n.t(sound.isEnabled() ? "common.soundOn" : "common.soundOff");
      el("studentDrawSound").setAttribute("aria-pressed", String(sound.isEnabled()));
      el("studentDrawStage").setAttribute("aria-busy", String(busy));
    }

    function render() {
      updateControls();
      const available = availableCount();
      const last = round.history[round.history.length - 1];
      el("studentDrawPhase").textContent = i18n.t(!students.length ? "picker.noStudents" : !available ? "picker.exhausted" : last ? "picker.winners" : "picker.ready");
      if (last) cards(last, false);
      else {
        el("studentDrawCards").innerHTML = '<div class="picker-mystery" aria-hidden="true">?</div>';
        el("studentDrawCards").classList.add("is-single");
      }
      el("studentDrawHistory").innerHTML = round.history.length ? round.history.map((batch) => `<li>${ui.escapeHtml(batch.map(label).join("、"))}</li>`).join("") : `<li>${ui.escapeHtml(i18n.t("picker.emptyHistory"))}</li>`;
    }

    function stop() {
      if (timeline) timeline.cancel();
      timeline = null;
      busy = false;
      el("studentDrawStage").classList.remove("is-counting", "is-rolling", "is-revealed");
      el("studentDrawConfetti").classList.remove("is-active");
      el("studentDrawConfetti").innerHTML = "";
      updateControls();
    }

    function start() {
      if (busy) return;
      syncRoster();
      const count = Number(el("studentDrawCount").value);
      const available = availableCount();
      if (!Number.isInteger(count) || count < 1 || count > available) {
        el("studentDrawAnnouncement").textContent = i18n.t("picker.invalidCount", { max: available });
        el("studentDrawCount").reportValidity();
        return;
      }
      // Select once, using cryptographic randomness. Animation never affects the result.
      const winners = engine.pickStudents(getState().config, count, excluded());
      const pool = students.filter((student) => !excluded().includes(student.number)).map((student) => student.number);
      stop();
      busy = true;
      updateControls();
      el("studentDrawAnnouncement").textContent = "";
      const stage = el("studentDrawStage");
      stage.scrollIntoView({ block: "center", behavior: "instant" });
      timeline = effects.run({
        onStage(phase, number) {
          stage.classList.toggle("is-counting", phase === "countdown");
          stage.classList.toggle("is-rolling", phase === "rolling");
          stage.classList.toggle("is-revealed", phase === "reveal");
          el("studentDrawPhase").textContent = i18n.t(phase === "countdown" ? "picker.countdown" : phase === "rolling" ? "picker.rolling" : "picker.winners");
          if (phase === "countdown") {
            el("studentDrawCards").classList.add("is-single");
            el("studentDrawCards").innerHTML = `<div class="picker-countdown" aria-hidden="true">${number}</div>`;
          }
        },
        onTick() { cards(engine.secureShuffle(pool).slice(0, count), false); },
        onReveal() {
          round.history.push(winners);
          // Keep the full round in no-repeat mode; bound unlimited repeat-mode history.
          if (round.history.length > 999) round.history.shift();
          saveRound();
          cards(winners, true);
          el("studentDrawAnnouncement").textContent = i18n.t("picker.announced", { names: winners.map(label).join("、") }) + " " + i18n.t(storageFailed ? "picker.storageFailed" : "picker.saved");
          effects.celebrate(el("studentDrawConfetti"));
          el("studentDrawSkip").hidden = true;
        },
        onFinish() {
          busy = false;
          updateControls();
          el("studentDrawHistory").innerHTML = round.history.map((batch) => `<li>${ui.escapeHtml(batch.map(label).join("、"))}</li>`).join("");
          if (!availableCount()) el("studentDrawPhase").textContent = i18n.t("picker.exhausted");
          el("studentDrawCount").value = Math.max(1, Math.min(count, availableCount()));
          el(availableCount() ? "studentDrawStart" : "studentDrawReset").focus({ preventScroll: true });
        }
      });
    }

    document.querySelectorAll(".student-draw-open").forEach((button) => button.addEventListener("click", () => {
      if (document.body.classList.contains("drawing-mode")) return;
      syncRoster();
      render();
      dialog.showModal();
    }));
    el("studentDrawStart").addEventListener("click", start);
    el("studentDrawSkip").addEventListener("click", () => { if (timeline) timeline.reveal(); });
    el("studentDrawClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", stop);
    dialog.addEventListener("cancel", stop);
    el("studentDrawNoRepeat").addEventListener("change", render);
    el("studentDrawSound").addEventListener("click", () => { sound.toggle(); updateControls(); onSoundChange(); });
    el("studentDrawReset").addEventListener("click", () => {
      if (busy || !window.confirm(i18n.t("picker.resetConfirm"))) return;
      stop(); round.history = []; saveRound(); render();
      el("studentDrawAnnouncement").textContent = i18n.t(storageFailed ? "picker.storageFailed" : "picker.ready");
    });
    window.addEventListener("seatmaster:languagechange", () => { if (!busy) render(); });
    return { close() { if (dialog.open) dialog.close(); else stop(); } };
  }

  sm.studentDraw = { init };
})();
