(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const { STORAGE_KEY, VERSION } = SeatMaster.constants;

  function serializableState(state) {
    return {
      version: VERSION,
      config: { ...state.config },
      seats: state.seats.map((seat) => ({ id: seat.id, row: seat.row, col: seat.col, type: seat.type, pin: seat.pin || null })),
      assignment: state.hasDrawn ? { ...state.assignment } : {},
      hasDrawn: Boolean(state.hasDrawn),
      resultSource: state.resultSource || "draw",
      adminMode: state.adminMode || "layout",
      manualDraft: state.manualDraft ? { ...state.manualDraft } : null,
      activities: Array.isArray(state.activities) ? state.activities : [],
      roomLayout: state.roomLayout || null
    };
  }

  function isClassState(value) {
    return Boolean(value && value.config && Array.isArray(value.seats));
  }

  function migrateClassState(parsed) {
    if (!isClassState(parsed) || ![1, 2, 3, VERSION].includes(parsed.version)) return null;
    return {
      ...parsed,
      version: VERSION,
      config: { ...SeatMaster.constants.DEFAULT_CONFIG, ...parsed.config, seatExcludedNumbers: parsed.version === 1 ? "" : parsed.config.seatExcludedNumbers || "" },
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      roomLayout: parsed.roomLayout || null
    };
  }

  function classId(index, existing = new Set()) {
    let id = `class-${index}`;
    while (existing.has(id)) { index += 1; id = `class-${index}`; }
    return id;
  }

  function migrate(parsed) {
    if (parsed && parsed.version === VERSION && Array.isArray(parsed.classes)) {
      const used = new Set();
      const classes = parsed.classes.map((entry, index) => {
        const state = migrateClassState(entry && entry.state);
        if (!state) return null;
        const id = typeof entry.id === "string" && entry.id && !used.has(entry.id) ? entry.id : classId(index + 1, used);
        used.add(id);
        return { id, state };
      }).filter(Boolean);
      if (!classes.length) return null;
      const activeClassId = classes.some((entry) => entry.id === parsed.activeClassId) ? parsed.activeClassId : classes[0].id;
      return { version: VERSION, activeClassId, classes };
    }
    const state = migrateClassState(parsed);
    return state ? { version: VERSION, activeClassId: "class-1", classes: [{ id: "class-1", state }] } : null;
  }

  SeatMaster.storage = {
    save(workspace) {
      const migrated = migrate(workspace);
      if (!migrated) return;
      const serializable = {
        version: VERSION,
        activeClassId: migrated.activeClassId,
        classes: migrated.classes.map((entry) => ({ id: entry.id, state: serializableState(entry.state) }))
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("classroom-seat-master:v3") || localStorage.getItem("classroom-seat-master:v2") || localStorage.getItem("classroom-seat-master:v1");
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return migrate(parsed);
      } catch (_error) {
        return null;
      }
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("classroom-seat-master:v3");
      localStorage.removeItem("classroom-seat-master:v2");
      localStorage.removeItem("classroom-seat-master:v1");
    },

    export(workspace) {
      const migrated = migrate(workspace);
      if (!migrated) return;
      const json = JSON.stringify({ version: VERSION, activeClassId: migrated.activeClassId, classes: migrated.classes.map((entry) => ({ id: entry.id, state: serializableState(entry.state) })) }, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      const safeName = migrated.classes.length === 1 ? (migrated.classes[0].state.config.className || "class") : "classes";
      link.href = URL.createObjectURL(blob);
      link.download = `${safeName}-${SeatMaster.i18n ? SeatMaster.i18n.t("storage.suffix") : "座位設定"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    },

    async readImport(file) {
      const parsed = JSON.parse(await file.text());
      const migrated = migrate(parsed);
      if (!migrated) throw new Error(SeatMaster.i18n ? SeatMaster.i18n.t("storage.invalid") : "這不是有效的 Classroom Seat Master 設定檔。");
      return migrated;
    }
  };
})();
