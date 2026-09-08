const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

function harness(reduced = false) {
  let clock = 0;
  let next = 0;
  const timers = new Map();
  const calls = [];
  const sound = Object.fromEntries(["unlock", "stop", "playLaunch", "playCount", "playTick", "playDrumRoll", "playReveal"].map((name) => [name, () => calls.push(name)]));
  const context = { window: { SeatMaster: { sound }, matchMedia: () => ({ matches: reduced }),
    setTimeout(fn, delay) { const id = ++next; timers.set(id, { fn, time: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/draw-effects.js"), "utf8"), context);
  const controller = context.window.SeatMaster.effects.run({
    onStage: (phase) => calls.push(phase), onTick: () => calls.push("tick"),
    onReveal: () => calls.push("result"), onFinish: () => calls.push("done")
  });
  function advance(target) {
    while (timers.size) {
      const [id, task] = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
      if (task.time > target) break;
      timers.delete(id); clock = task.time; task.fn();
    }
    clock = target;
  }
  return { controller, calls, advance, timers };
}
const normal = harness();
normal.advance(4250);
assert.equal(normal.calls.filter((call) => call === "countdown").length, 3);
assert.ok(normal.calls.includes("tick"));
assert.equal(normal.calls.filter((call) => call === "result").length, 1);
normal.controller.reveal(); normal.advance(6000);
assert.equal(normal.calls.filter((call) => call === "result").length, 1);
assert.equal(normal.calls.filter((call) => call === "done").length, 1);
assert.equal(normal.timers.size, 0);
const cancelled = harness();
cancelled.advance(2300); cancelled.controller.cancel(); cancelled.advance(10000);
assert.ok(!cancelled.calls.includes("result"));
assert.equal(cancelled.timers.size, 0);
const skipped = harness();
skipped.controller.reveal(); skipped.controller.reveal(); skipped.advance(6000);
assert.equal(skipped.calls.filter((call) => call === "result").length, 1);
assert.ok(!skipped.calls.includes("tick"));
const reduced = harness(true);
reduced.advance(120);
assert.ok(reduced.calls.includes("done"));
assert.ok(!reduced.calls.includes("countdown") && !reduced.calls.includes("playDrumRoll"));
console.log("effects tests passed");
