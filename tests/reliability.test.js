const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const values = new Map();
let deny = false;
const context = { window: { crypto: require('node:crypto').webcrypto }, localStorage: {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => { if (deny) throw new Error('QuotaExceededError'); values.set(key, value); },
  removeItem: key => values.delete(key)
} };
vm.createContext(context);
for (const file of ['constants', 'seat-engine', 'storage', 'group-planner', 'room-layout']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context);
const SM = context.window.SeatMaster;
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name + '.json'), 'utf8'));
for (const version of [1, 2, 3]) assert.equal(SM.storage.migrate(fixture('legacy-v' + version)).classes[0].state.version, 4);
for (const name of ['existing-v4', 'multi-v4']) {
  const source = fixture(name);
  assert.equal(SM.storage.save(source).ok, true);
  const restored = SM.storage.load();
  for (const field of ['assignment', 'manualDraft', 'activities', 'roomLayout']) assert.equal(JSON.stringify(restored.classes.map(c => c.state[field] ?? null)), JSON.stringify(source.classes.map(c => c.state[field] ?? null)));
}
deny = true;
assert.equal(SM.storage.save(fixture('default-v4')).ok, false);
deny = false;
const damaged = fixture('multi-v4'); damaged.classes.push({ id: 'broken', state: {} });
assert.equal(SM.storage.migrate(damaged), null);
values.set(SM.constants.STORAGE_KEY, '{broken original');
assert.equal(SM.storage.load(), null);
assert.equal(SM.storage.getLoadStatus().status, 'error');
assert.equal(SM.storage.save(fixture('default-v4')).ok, false);
assert.equal(values.get(SM.constants.STORAGE_KEY), '{broken original');

for (let size = 2; size <= 6; size++) for (let male = 0; male <= 34; male++) for (let female = 0; female <= 34 - male; female++) {
  const total = male + female;
  if (!total) continue;
  const students = Array.from({ length: total }, (_, i) => ({ number: i + 1, gender: i < male ? 'male' : 'female' }));
  if (male === 1 || female === 1) assert.throws(() => SM.groupPlanner.draw(students, size, 'same', {}));
  else {
    const groups = SM.groupPlanner.draw(students, size, 'same', {});
    assert.equal(SM.groupPlanner.validate(groups, students.map(s => s.number)).valid, true);
    for (const group of groups) assert.equal(new Set(group.members.map(n => students[n - 1].gender)).size, 1);
  }
}
const students = Array.from({ length: 8 }, (_, i) => ({ number: i + 1, gender: i < 6 ? 'male' : 'female' }));
assert.deepEqual(Array.from(SM.groupPlanner.draw(students, 4, 'same', { 7: 0 }), g => g.members.length).sort((a,b) => a-b), [2, 6]);
assert.throws(() => SM.groupPlanner.draw(students, 4, 'same', { 1: 0, 7: 0 }));

const table = { x: 50, y: 50, width: 40, height: 10, rotation: 90, type: 'round', geometry: {}, seatIds: ['a', 'b'], seatPositions: [] };
assert.equal(SM.roomLayout.tableIntersectsPath(table, { x: 47, y: 65, width: 6, height: 6 }), true);
assert.equal(SM.roomLayout.tableIntersectsPath(table, { x: 65, y: 47, width: 6, height: 6 }), false);
table.seatPositions = SM.roomLayout.autoSeatPositions(table, table.seatIds);
const added = SM.roomLayout.setSeatCount(table, table.seatIds, 3, () => 1);
assert.equal(new Set(added.seatPositions.map(p => `${p.x},${p.y}`)).size, 3);
assert.deepEqual(Array.from(added.seatIds).slice(0,2), ['a', 'b']);
assert.equal(SM.roomLayout.tablesIntersect(table, { ...table, x: 54 }), true);
console.log('reliability tests passed (gender feasibility exhaustive through 34 students)');
