const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const context = { window: { crypto: require("node:crypto").webcrypto }, console };
vm.createContext(context);
["constants.js", "seat-engine.js", "group-planner.js"].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context));
const { engine, groupPlanner } = context.window.SeatMaster;
const config = engine.normalizeConfig({ maxNumber: 23, emptyNumbers: "", femaleStart: 12, seatExcludedNumbers: "2, 9" });
const roster = engine.buildStudents(config);

for (const strategy of ["random", "balanced", "same"]) {
  const groups = groupPlanner.draw(roster, 4, strategy, {});
  const numbers = groups.flatMap((group) => group.members);
  assert.equal(numbers.length, roster.length);
  assert.equal(new Set(numbers).size, roster.length);
  assert.deepEqual([...numbers].sort((a, b) => a - b), [...roster].map((student) => student.number));
  assert.ok([...groups].every((group) => group.members.length >= 2 && group.members.length <= 6));
  if (strategy === "same") {
    const byNumber = new Map(roster.map((student) => [student.number, student]));
    assert.ok(groups.every((group) => new Set(group.members.map((number) => byNumber.get(number).gender)).size === 1));
  }
}

const withPreassignment = groupPlanner.draw(roster, 4, "random", { 1: 0, 3: 0, 4: 2 });
assert.ok(withPreassignment[0].members.includes(1) && withPreassignment[0].members.includes(3));
assert.ok(withPreassignment[2].members.includes(4));
const report = groupPlanner.validate(withPreassignment, roster.map((student) => student.number));
assert.equal(report.valid, true);
assert.equal(groupPlanner.numberOfGroups(1, 4), 1);
assert.equal(groupPlanner.numberOfGroups(7, 6), 2);
assert.throws(() => groupPlanner.draw(roster, 1, "random", {}), /2–6/);
assert.throws(() => groupPlanner.draw(roster, 4, "same", { 1: 0, 12: 0 }), /性別不同/);
console.log("group planner tests passed");
