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
      hasDrawn: Boolean(state.hasDrawn)
    };
  }

  SeatMaster.storage = {
    save(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState(state)));
    },

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || !parsed.config || !Array.isArray(parsed.seats)) return null;
        return parsed;
      } catch (_error) {
        return null;
      }
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },

    export(state) {
      const json = JSON.stringify(serializableState(state), null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const link = document.createElement("a");
      const safeName = (state.config.className || "class").replace(/[\\/:*?"<>|\s]+/g, "-");
      link.href = URL.createObjectURL(blob);
      link.download = `${safeName}-${SeatMaster.i18n ? SeatMaster.i18n.t("storage.suffix") : "座位設定"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    },

    async readImport(file) {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.version !== VERSION || !parsed.config || !Array.isArray(parsed.seats)) {
        throw new Error(SeatMaster.i18n ? SeatMaster.i18n.t("storage.invalid") : "這不是有效的 Classroom Seat Master 設定檔。");
      }
      return parsed;
    }
  };
})();
