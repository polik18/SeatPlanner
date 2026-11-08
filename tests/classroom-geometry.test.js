const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const values = new Map();
const context = { window: { crypto: require('node:crypto').webcrypto }, localStorage: {
  getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)
} };
vm.createContext(context);
for (const file of ['constants', 'seat-engine', 'class-data', 'classroom-geometry', 'storage']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file + '.js'), 'utf8'), context);
const SM = context.window.SeatMaster, G = SM.classroomGeometry;
for (const roomAspect of ['landscape', 'portrait']) for (const side of ['top', 'right', 'bottom', 'left']) for (const align of ['start', 'center', 'end']) {
  const g = G.legacy({ ...SM.constants.DEFAULT_CONFIG, roomAspect, boardPosition: `${side}-${align}` });
  assert.equal(G.valid(g), true);
  const before = G.clone(g);
  for (let i = 0; i < 4; i++) G.rotate(g, 'clockwise');
  const near = (a, b) => Math.abs(a - b) < 1e-8;
  assert.deepEqual(g.bounds, before.bounds);
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(near(g.content[key], before.content[key]));
  for (let i = 0; i < 3; i++) for (const key of ['x', 'y', 'width', 'height', 'rotation', 'wallT']) assert.ok(near(g.markers[i][key], before.markers[i][key]), key);
  G.rotate(g, 'clockwise'); G.rotate(g, 'counterclockwise');
  assert.deepEqual(g.bounds, before.bounds);
}
const g = G.legacy(SM.constants.DEFAULT_CONFIG), before = G.clone(g);
G.resize(g, 1800, 900);
assert.equal(g.content.width, before.content.width);
assert.equal(g.content.x - before.content.x, 300);
assert.equal(g.markers[0].width, before.markers[0].width);
G.resize(g, 500, 500);
assert.ok(G.overflow(g).includes('content'));
G.fit(g); assert.deepEqual(Array.from(G.overflow(g)), []);
assert.equal(G.valid(g), true);
const far = G.legacy(SM.constants.DEFAULT_CONFIG);
far.markers[2].wall = null; far.markers[2].x = 7999;
G.resize(far, 300, 300); G.fit(far);
assert.equal(G.valid(far), true); assert.deepEqual(Array.from(G.overflow(far)), []);
for (const edit of [g => g.bounds.width = Infinity, g => g.markers[0].rotation = NaN, g => g.markers.pop(), g => g.content.width = 0, g => g.schemaVersion = 9]) {
  const invalid = G.clone(g); edit(invalid); assert.equal(G.valid(invalid), false);
}
const state = SM.createDefaultState(); state.seats = SM.engine.buildSeatGrid(state.config, []); G.ensure(state);
state.classroomGeometry.markers[1].visible = false;
const workspace = { version: 5, activeClassId: 'geometry', classes: [{ id: 'geometry', state }] };
assert.equal(SM.storage.save(workspace).ok, true);
const disk = JSON.parse(values.get(SM.constants.STORAGE_KEY));
assert.equal(disk.version, 6, 'older applications reject the new geometry format');
assert.equal(disk.classes[0].state.version, 6);
const restored = SM.storage.load();
assert.equal(restored.classes[0].id, 'geometry');
assert.deepEqual(restored.classes[0].state.classroomGeometry, state.classroomGeometry);
const corrupt = JSON.parse(JSON.stringify(disk)); corrupt.classes[0].state.classroomGeometry.markers[0].width = -10;
assert.equal(SM.storage.migrate(corrupt), null);
console.log('Classroom geometry: legacy positions, resize/fit, rotation invariants, validation and v6 persistence passed');
