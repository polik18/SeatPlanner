(function () {
  "use strict";
  const SM = window.SeatMaster;

  function createTemplate(state, template) {
    const activeSeats = state.seats.filter((seat) => seat.type !== "aisle");
    const requiredCount = SM.engine.studentsRequiringSeats(state.config).length;
    const seats = activeSeats.map((seat) => ({ ...seat }));
    const usedSeatIds = new Set(seats.map((seat) => seat.id));
    let next = seats.reduce((max, seat) => Math.max(max, Number(String(seat.id).match(/^free-(\d+)$/)?.[1]) || 0), 0) + 1;
    while (seats.length < requiredCount) {
      const index = seats.length;
      while (usedSeatIds.has(`free-${next}`)) next += 1;
      const id = `free-${next++}`;
      usedSeatIds.add(id);
      seats.push({ id, row: Math.floor(index / 6), col: index % 6, type: "general", pin: null });
    }
    const total = seats.length;
    const tables = [];
    if (template === "u") {
      tables.push({ id: "table-1", type: "u", x: 50, y: 52, width: 70, height: 64, rotation: 0, seatIds: seats.map((seat) => seat.id), seatPositions: [], geometry: { opening: "bottom", armThickness: 12 }, edgeCounts: null });
    } else {
      const tableType = template === "round" ? "round" : "rect";
      const capacity = Math.min(6, Math.max(4, Math.ceil(total / 4)));
      const count = Math.max(1, Math.ceil(total / capacity));
      seats.forEach((seat, index) => {
        const tableIndex = Math.floor(index / capacity);
        if (!tables[tableIndex]) {
          const columns = count <= 2 ? count : Math.ceil(Math.sqrt(count));
          const rows = Math.ceil(count / columns);
          const x = ((tableIndex % columns) + 0.5) * (100 / columns);
          const y = (Math.floor(tableIndex / columns) + 0.5) * (100 / rows);
          tables[tableIndex] = { id: `table-${tableIndex + 1}`, type: tableType, x, y, width: Math.min(34, 82 / columns), height: Math.min(36, 82 / rows), rotation: 0, seatIds: [], seatPositions: [], geometry: { opening: "bottom", seatRadius: 44, startAngle: -90, armThickness: 12 }, edgeCounts: null };
        }
        tables[tableIndex].seatIds.push(seat.id);
      });
    }
    tables.forEach((table) => { table.seatPositions = autoSeatPositions(table, table.seatIds); });
    return {
      seats,
      roomLayout: {
        version: 2,
        template,
        editing: false,
        nextTableId: tables.length + 1,
        nextSeatId: next,
        tables,
        paths: template === "islands" ? [{ id: "path-1", x: 47, y: 8, width: 6, height: 84, label: "輪椅／主要通道" }] : []
      }
    };
  }

  function normalize(layout, seats) {
    if (!layout || !Array.isArray(layout.tables)) return null;
    const validSeats = new Set((seats || []).filter((seat) => seat.type !== "aisle").map((seat) => seat.id));
    const used = new Set();
    const tables = layout.tables.filter((table) => table && typeof table.id === "string" && Array.isArray(table.seatIds)).map((table) => ({
      id: table.id,
      type: ["rect", "round", "u"].includes(table.type) ? table.type : "rect",
      x: Math.max(5, Math.min(95, Number(table.x) || 50)),
      y: Math.max(8, Math.min(92, Number(table.y) || 50)),
      width: Math.max(18, Math.min(80, Number(table.width) || 30)),
      height: Math.max(18, Math.min(80, Number(table.height) || 30)),
      rotation: ((Number(table.rotation) || 0) % 360 + 360) % 360,
      seatIds: table.seatIds.filter((id) => validSeats.has(id) && !used.has(id) && used.add(id)),
      seatPositions: Array.isArray(table.seatPositions) ? table.seatPositions.filter((position) => position && typeof position.id === "string" && Number.isFinite(Number(position.x)) && Number.isFinite(Number(position.y))).map((position) => ({ id: position.id, x: clamp(Number(position.x), 2, 98), y: clamp(Number(position.y), 2, 98), angle: normalizeAngle(position.angle) })) : [],
      edgeCounts: normalizeEdgeCounts(table.edgeCounts),
      geometry: { opening: ["top", "right", "bottom", "left"].includes(table.geometry?.opening) ? table.geometry.opening : "bottom", seatRadius: clamp(Number(table.geometry?.seatRadius) || 44, 28, 49), startAngle: Number.isFinite(Number(table.geometry?.startAngle)) ? Number(table.geometry.startAngle) : -90, armThickness: clamp(Number(table.geometry?.armThickness) || 12, 6, 28) }
    })).filter((table) => table.seatIds.length);
    const unassigned = [...validSeats].filter((id) => !used.has(id));
    if (unassigned.length) {
      const first = tables[0];
      if (first) first.seatIds.push(...unassigned);
      else tables.push({ id: "table-1", type: "rect", x: 50, y: 50, width: 34, height: 30, rotation: 0, seatIds: unassigned, seatPositions: [], edgeCounts: null, geometry: { opening: "bottom", seatRadius: 44, startAngle: -90, armThickness: 12 } });
    }
    tables.forEach((table) => {
      const positions = new Map(table.seatPositions.filter((position) => table.seatIds.includes(position.id)).map((position) => [position.id, position]));
      const missing = table.seatIds.filter((id) => !positions.has(id));
      autoSeatPositions(table, missing).forEach((position) => positions.set(position.id, position));
      table.seatPositions = table.seatIds.map((id) => positions.get(id));
    });
    const paths = Array.isArray(layout.paths) ? layout.paths.filter((path) => path && typeof path.id === "string").map((path) => ({
      id: path.id,
      x: Math.max(0, Math.min(95, Number(path.x) || 0)),
      y: Math.max(0, Math.min(95, Number(path.y) || 0)),
      width: Math.max(3, Math.min(40, Number(path.width) || 6)),
      height: Math.max(3, Math.min(40, Number(path.height) || 20)),
      label: String(path.label || "輪椅／主要通道").slice(0, 40)
    })) : [];
    const selectedTableId = tables.some((table) => table.id === layout.selectedTableId) ? layout.selectedTableId : tables[0]?.id || null;
    const selectedPathId = paths.some((path) => path.id === layout.selectedPathId) ? layout.selectedPathId : paths[0]?.id || null;
    const selectedSeatId = tables.some((table) => table.id === selectedTableId && table.seatIds.includes(layout.selectedSeatId)) ? layout.selectedSeatId : null;
    const maxSeatSuffix = [...validSeats].reduce((max, id) => Math.max(max, Number(String(id).match(/^free-(\d+)$/)?.[1]) || 0), 0);
    return { version: 2, template: String(layout.template || "custom"), editing: Boolean(layout.editing), zoom: clamp(Number(layout.zoom) || 1, 0.6, 1.5), selectedTableId, selectedPathId, selectedSeatId, nextTableId: Number(layout.nextTableId) || tables.length + 1, nextSeatId: Math.max(Number(layout.nextSeatId) || 1, maxSeatSuffix + 1), tables, paths };
  }

  function normalizeSeats(source) {
    const types = SM.constants.SEAT_TYPES;
    const seen = new Set();
    return (Array.isArray(source) ? source : []).filter((seat) => seat && typeof seat.id === "string" && !seen.has(seat.id) && seen.add(seat.id)).map((seat, index) => ({
      id: seat.id,
      row: Number.isInteger(seat.row) ? seat.row : Math.floor(index / 6),
      col: Number.isInteger(seat.col) ? seat.col : index % 6,
      type: types.includes(seat.type) && seat.type !== "aisle" ? seat.type : "general",
      pin: Number.isInteger(seat.pin) ? seat.pin : null
    }));
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function normalizeAngle(value) { return ((Number(value) || 0) % 360 + 360) % 360; }
  function normalizeEdgeCounts(value) {
    if (!value || typeof value !== "object") return null;
    const keys = ["top", "right", "bottom", "left"];
    return Object.fromEntries(keys.map((key) => [key, Math.max(0, Math.min(60, Math.round(Number(value[key]) || 0)))]));
  }

  function allocate(count, weights, keys, explicit) {
    if (explicit && keys.every((key) => Number.isInteger(explicit[key]))) return keys.map((key) => explicit[key]);
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    const quotas = weights.map((weight) => count * weight / total);
    const result = quotas.map(Math.floor);
    let left = count - result.reduce((sum, value) => sum + value, 0);
    const order = quotas.map((value, index) => ({ index, fraction: value - result[index] })).sort((a, b) => b.fraction - a.fraction);
    for (let i = 0; i < left; i += 1) result[order[i % order.length].index] += 1;
    return result;
  }

  function defaultEdgeCounts(table, count) {
    const keys = activeEdges(table);
    const weights = keys.map((edge) => edge === "top" || edge === "bottom" ? 100 : 72);
    const values = allocate(count, weights, keys, null);
    return { top: values[keys.indexOf("top")] || 0, right: values[keys.indexOf("right")] || 0, bottom: values[keys.indexOf("bottom")] || 0, left: values[keys.indexOf("left")] || 0 };
  }

  function activeEdges(table) {
    if (table.type !== "u") return ["top", "right", "bottom", "left"];
    return {
      top: ["bottom", "right", "left"],
      right: ["top", "left", "bottom"],
      left: ["top", "right", "bottom"],
      bottom: ["top", "right", "left"]
    }[table.geometry?.opening || "bottom"];
  }

  function autoSeatPositions(table, seatIds) {
    const count = seatIds.length;
    if (!count) return [];
    if (table.type === "round") {
      const start = Number(table.geometry?.startAngle ?? -90) * Math.PI / 180;
      const radius = clamp(Number(table.geometry?.seatRadius) || 44, 28, 49);
      return seatIds.map((id, index) => {
        const angle = start + 2 * Math.PI * index / count;
        return { id, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, angle: normalizeAngle(angle * 180 / Math.PI + 90) };
      });
    }
    const isU = table.type === "u";
    const keys = activeEdges(table);
    const weights = keys.map((edge) => edge === "top" || edge === "bottom" ? 100 : 72);
    const counts = allocate(count, weights, keys, table.edgeCounts && Object.fromEntries(keys.map((key) => [key, table.edgeCounts[key]])));
    const points = [];
    keys.forEach((edge, edgeIndex) => {
      const amount = counts[edgeIndex];
      for (let index = 0; index < amount; index += 1) {
        const fraction = (index + 1) / (amount + 1);
        if (edge === "top") points.push({ x: 5 + 90 * fraction, y: 8, angle: 0 });
        if (edge === "bottom") points.push({ x: 95 - 90 * fraction, y: 92, angle: 180 });
        if (edge === "right") points.push({ x: 94, y: 8 + 84 * fraction, angle: 90 });
        if (edge === "left") points.push({ x: 6, y: 92 - 84 * fraction, angle: 270 });
      }
    });
    return seatIds.map((id, index) => ({ id, ...(points[index] || { x: 50, y: 50, angle: 0 }) }));
  }

  function setSeatCount(table, seatIds, count, nextId, resetExisting = false) {
    const nextIds = seatIds.slice(0, count);
    while (nextIds.length < count) nextIds.push(`free-${nextId()}`);
    const known = new Map((table.seatPositions || []).map((position) => [position.id, position]));
    const positions = autoSeatPositions(table, nextIds);
    return { seatIds: nextIds, seatPositions: positions.map((position) => resetExisting ? position : known.get(position.id) || position) };
  }

  function seatPoints(table, count) {
    const ids = (table.seatIds || Array.from({ length: count }, (_, index) => String(index))).slice(0, count);
    const known = new Map((table.seatPositions || []).map((position) => [position.id, position]));
    const missingIds = ids.filter((id) => !known.has(id));
    autoSeatPositions(table, missingIds).forEach((position) => known.set(position.id, position));
    return ids.map((id) => known.get(id));
  }

  SM.roomLayout = { createTemplate, normalize, normalizeSeats, seatPoints, autoSeatPositions, setSeatCount, defaultEdgeCounts, activeEdges };
})();
