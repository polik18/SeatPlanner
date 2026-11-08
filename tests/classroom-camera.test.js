const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const c = { window: { SeatMaster: {} } }; vm.createContext(c);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../js/classroom-camera.js'), 'utf8'), c);
const C = c.window.SeatMaster.classroomCamera;
for (const scale of [0.1, 0.5, 1, 2, 4]) {
  const camera = { scale, x: -230, y: 71 }, point = { x: 387, y: 943 };
  const result = C.toWorld(camera, C.toScreen(camera, point));
  assert.ok(Math.abs(result.x - point.x) < 1e-9 && Math.abs(result.y - point.y) < 1e-9);
  const anchor = { x: 127, y: 251 }, world = C.toWorld(camera, anchor);
  C.zoomAt(camera, anchor, scale * 2);
  const after = C.toScreen(camera, world);
  assert.ok(Math.abs(after.x - anchor.x) < 1e-9 && Math.abs(after.y - anchor.y) < 1e-9);
}
const camera = { x: 0, y: 0, scale: 1 }, viewport = { width: 1000, height: 700 };
C.fit(camera, viewport, { x: 0, y: 0, width: 1200, height: 900 });
assert.ok(1200 * camera.scale <= viewport.width && 900 * camera.scale <= viewport.height);
assert.deepEqual(JSON.parse(JSON.stringify(C.toScreen(camera, { x: 600, y: 450 }))), { x: 500, y: 350 });
console.log('Camera: coordinate round trips, zoom anchors, scale limits and whole-room fit passed');
