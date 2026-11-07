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
const templateStates = [];
for (const template of ["islands", "round", "u"]) {
  const made = SM.roomLayout.createTemplate(state, template);
  assert.equal(made.roomLayout.template, template);
  assert.equal(made.roomLayout.tables.flatMap((table) => table.seatIds).length, made.seats.length);
  assert.equal(new Set(made.roomLayout.tables.flatMap((table) => table.seatIds)).size, made.seats.length);
  if (template === "islands") {
    assert.equal(made.roomLayout.paths.length, 1);
    assert.equal(made.roomLayout.paths[0].locked, false);
    assert.ok(made.roomLayout.tables.every((table) => !SM.roomLayout.tableIntersectsPath(table, made.roomLayout.paths[0])));
  }
  if (template === "islands") {
    made.roomLayout.tables[0].seatPositions[0].width = 52;
    made.roomLayout.tables[0].seatPositions[0].height = 38;
  }
  const normalized = SM.roomLayout.normalize(made.roomLayout, made.seats);
  assert.deepEqual(Array.from(normalized.tables.flatMap((table) => table.seatIds)).sort(), Array.from(made.seats.map((seat) => seat.id)).sort());
  templateStates.push({ version: SM.constants.VERSION, config: state.config, seats: made.seats, assignment: {}, hasDrawn: false, activities: [], roomLayout: made.roomLayout });
}
const round = { id: "round-test", type: "round", x: 50, y: 50, width: 30, height: 30, rotation: 0 };
const points = SM.roomLayout.seatPoints(round, 6);
assert.equal(points.length, 6);
assert.ok(points.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100));
const u = SM.roomLayout.seatPoints({ ...round, type: "u" }, 10);
assert.equal(u.length, 10);

const storedValues = new Map();
context.localStorage = { setItem(key, value) { storedValues.set(key, value); }, getItem(key) { return storedValues.get(key) || null; }, removeItem(key) { storedValues.delete(key); } };
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/storage.js"), "utf8"), context);
const workspace = { version: SM.constants.VERSION, activeClassId: "round", classes: templateStates.map((templateState, index) => ({ id: ["islands", "round", "u"][index], state: templateState })) };
SM.storage.save(workspace);
const restored = SM.storage.load();
assert.equal(restored.classes.length, 3);
assert.equal(restored.activeClassId, "round");
restored.classes.forEach((entry, index) => {
  const expected = ["islands", "round", "u"][index];
  assert.equal(entry.state.roomLayout.template, expected);
  assert.deepEqual(Array.from(entry.state.roomLayout.tables.flatMap((table) => table.seatIds)).sort(), Array.from(entry.state.seats.map((seat) => seat.id)).sort());
});
const restoredIsland = restored.classes.find((entry) => entry.id === "islands").state.roomLayout;
assert.equal(restoredIsland.paths[0].locked, false);
assert.equal(restoredIsland.tables[0].seatPositions[0].width, 52);
assert.equal(restoredIsland.tables[0].seatPositions[0].height, 38);
console.log("room layout tests passed");
