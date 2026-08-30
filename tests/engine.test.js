const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const context = { window: { crypto: require("node:crypto").webcrypto }, console };
vm.createContext(context);
["js/constants.js", "js/seat-engine.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
});

const { engine, createDefaultState } = context.window.SeatMaster;

const empty = engine.parseEmptyNumbers("16-20, 25、27～28", 34);
assert.deepEqual(Array.from(empty), [16, 17, 18, 19, 20, 25, 27, 28]);

const state = createDefaultState();
state.config = engine.normalizeConfig(state.config);
state.seats = engine.buildSeatGrid(state.config, []);
const students = engine.buildStudents(state.config);
assert.equal(students.length, 29);
assert.equal(students.filter((student) => student.gender === "male").length, 15);
assert.equal(students.filter((student) => student.gender === "female").length, 14);

const names = engine.parseStudentNames("1, 王小明\n2：李小華\n陳小美", students);
assert.equal(names.get(1), "王小明");
assert.equal(names.get(2), "李小華");
assert.equal(names.get(3), "陳小美");

state.seats[0].type = "male";
state.seats[1].type = "female";
state.seats[2].pin = 1;
const assignment = engine.arrange(state);
assert.equal(assignment[state.seats[2].id], 1);
assert.equal(Object.values(assignment).filter(Number.isInteger).length, 29);
assert.equal(new Set(Object.values(assignment).filter(Number.isInteger)).size, 29);
state.seats.forEach((seat) => {
  const number = assignment[seat.id];
  if (!number) return;
  const student = students.find((item) => item.number === number);
  assert.equal(engine.isCompatible(seat, student), true);
});

state.seats.slice(0, 4).forEach((seat) => { seat.type = "aisle"; seat.pin = null; });
assert.equal(engine.validate(state).valid, false);

const dynamicConfig = engine.normalizeConfig({
  className: "302 自訂班",
  rows: 3,
  cols: 3,
  maxNumber: 7,
  emptyNumbers: "",
  femaleStart: 5,
  displayMode: "both",
  studentNames: "1, 學生一"
});
const dynamicSeats = engine.buildSeatGrid(dynamicConfig, []);
assert.equal(dynamicConfig.className, "302 自訂班");
assert.equal(dynamicSeats.length, 9);
assert.equal(engine.buildStudents(dynamicConfig).length, 7);
dynamicSeats[0].type = "male";
const expandedSeats = engine.buildSeatGrid({ ...dynamicConfig, rows: 5, cols: 6 }, dynamicSeats);
assert.equal(expandedSeats.length, 30);
assert.equal(expandedSeats.find((seat) => seat.id === "0-0").type, "male");

console.log("engine tests: 20 assertions passed");
