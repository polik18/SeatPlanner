const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const context = { window: { crypto: require("node:crypto").webcrypto }, console };
vm.createContext(context);
for (const file of ["constants", "seat-engine", "manual-seating"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", `${file}.js`), "utf8"), context);
}
const { engine, manualSeating: manual, createDefaultState } = context.window.SeatMaster;
const state = createDefaultState();
state.config = engine.normalizeConfig({ ...state.config, rows: 2, cols: 3, maxNumber: 5, emptyNumbers: "3", femaleStart: 4 });
state.seats = engine.buildSeatGrid(state.config, []);
state.seats[0].type = "female";
state.seats[0].pin = 4;
state.seats[5].type = "aisle";
const plain = (value) => JSON.parse(JSON.stringify(value));
const valid = (assignment) => {
  const values = Object.values(assignment).filter((n) => n !== null);
  assert.equal(new Set(values).size, values.length, "a student must never appear twice");
  assert.ok(values.every((n) => [1, 2, 4, 5].includes(n)), "missing numbers must never be seated");
  assert.ok(!Object.hasOwn(assignment, "1-2"), "aisles must never hold an assignment");
};
let draft = manual.normalize(state, { "0-0": 1, "0-1": 1, "0-2": 3, "1-0": 99, "1-1": "2", "1-2": 4, removed: 5 });
assert.deepEqual(plain(draft), { "0-0": 1, "0-1": null, "0-2": null, "1-0": null, "1-1": null });
assert.deepEqual(Array.from(manual.remaining(state, draft), (s) => s.number), [2, 4, 5]);
// The teacher has full control over draw-only gender and pin restrictions.
draft = manual.place(state, draft, 2, "0-0");
assert.equal(draft["0-0"], 2);
assert.ok(manual.remaining(state, draft).some((s) => s.number === 1));
draft = manual.place(state, draft, 1, "0-1");
draft = manual.place(state, draft, 1, "0-0");
assert.equal(draft["0-0"], 1);
assert.equal(draft["0-1"], 2);
const saved = JSON.stringify(draft);
for (const [number, id] of [[1, "0-0"], [1, "1-2"], [3, "0-1"], [99, "0-1"], [1, "removed"]]) {
  assert.equal(JSON.stringify(manual.place(state, draft, number, id)), saved);
}
assert.equal(JSON.stringify(draft), saved, "operations must not mutate their source");
// Exhaust all valid student/desk moves from each generated state.
for (let round = 0; round < 12; round++) {
  for (const number of [1, 2, 4, 5]) {
    for (const id of Object.keys(draft)) {
      draft = manual.place(state, draft, number, id);
      valid(draft);
    }
  }
}
assert.equal(manual.remaining(state, draft).length, 0);
const rotation = engine.rotateSeatLayout(state.config, state.seats, draft, "clockwise");
const rotatedState = { ...state, config: rotation.config, seats: rotation.seats };
const rotated = manual.normalize(rotatedState, rotation.assignment);
assert.deepEqual(Object.values(rotated).filter(Boolean).sort(), Object.values(draft).filter(Boolean).sort());
// Removing a desk or a student releases only the affected placement.
state.seats = state.seats.filter((s) => s.id !== "0-0");
state.config.emptyNumbers = "2-3";
const reconciled = manual.normalize(state, draft);
assert.ok(!Object.hasOwn(reconciled, "0-0"));
assert.ok(!Object.values(reconciled).includes(2));
// Partial drafts round-trip separately from a completed result, and old v1
// exports without a draft remain valid input.
let serialized;
context.localStorage = { setItem(_key, value) { serialized = value; } };
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/storage.js"), "utf8"), context);
context.window.SeatMaster.storage.save({ ...state, manualDraft: reconciled, hasDrawn: false });
assert.deepEqual(JSON.parse(serialized).manualDraft, plain(reconciled));
assert.deepEqual(JSON.parse(serialized).assignment, {});
context.window.SeatMaster.storage.save({ ...state, manualDraft: null, assignment: draft, hasDrawn: true, resultSource: "manual" });
assert.equal(JSON.parse(serialized).resultSource, "manual");
assert.deepEqual(JSON.parse(serialized).assignment, plain(draft));
console.log("manual seating tests passed");
