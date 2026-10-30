const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const context = { window: { crypto: require("node:crypto").webcrypto }, console };
vm.createContext(context);
["constants.js", "seat-engine.js", "room-layout.js"].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context));
const SM = context.window.SeatMaster;
const state = SM.createDefaultState();
state.config = SM.engine.normalizeConfig({ rows: 2, cols: 3, maxNumber: 12, emptyNumbers: "", femaleStart: 7 });
state.seats = SM.engine.buildSeatGrid(state.config, []);
for (const template of ["islands", "round", "u"]) {
  const made = SM.roomLayout.createTemplate(state, template);
  assert.equal(made.roomLayout.template, template);
  assert.equal(made.roomLayout.tables.flatMap((table) => table.seatIds).length, made.seats.length);
  assert.equal(new Set(made.roomLayout.tables.flatMap((table) => table.seatIds)).size, made.seats.length);
  if (template === "islands") assert.ok(made.roomLayout.paths.length > 0);
  const normalized = SM.roomLayout.normalize(made.roomLayout, made.seats);
  assert.deepEqual(Array.from(normalized.tables.flatMap((table) => table.seatIds)).sort(), Array.from(made.seats.map((seat) => seat.id)).sort());
}
const round = { id: "round-test", type: "round", x: 50, y: 50, width: 30, height: 30, rotation: 0 };
const points = SM.roomLayout.seatPoints(round, 6);
assert.equal(points.length, 6);
assert.ok(points.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100));
const u = SM.roomLayout.seatPoints({ ...round, type: "u" }, 10);
assert.equal(u.length, 10);
console.log("room layout tests passed");
