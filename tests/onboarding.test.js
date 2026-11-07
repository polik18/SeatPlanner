const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const store = new Map();
const c = { window: {}, localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } };
vm.createContext(c);
for (const name of ['constants', 'seat-engine', 'onboarding-storage']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), c);
const api = c.window.SeatMaster.onboardingStorage;
const fixture = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name + '.json'), 'utf8'));
const blank = api.defaults(), demo = fixture('default-v4');
assert.equal(api.shouldShow(blank, null), true);
assert.equal(api.shouldShow(blank, demo), true);
for (const flag of ['completed', 'dismissed', 'hasUserActivity']) assert.equal(api.shouldShow({ ...blank, [flag]: true }, demo), false);
for (const name of ['existing-v4', 'multi-v4']) assert.equal(api.shouldShow(blank, fixture(name)), false);
for (const modify of [s => s.config.className = 'My class', s => s.seats[0].pin = 1, s => s.manualDraft = { 'seat-0-0': 1 }, s => s.activities = [{}], s => s.config.studentData = '1 Alex']) {
  const data = structuredClone(demo); modify(data.classes[0].state); assert.equal(api.shouldShow(blank, data), false);
}
assert.equal(api.shouldShow(blank, demo), true, 'next-step navigation does not set flags');
api.write({ ...blank, dismissed: true }); assert.equal(api.read().value.dismissed, true);
api.reset(); assert.equal(api.read().value.dismissed, false);
store.set(api.KEY, 'corrupted'); assert.equal(api.read().ok, false); assert.equal(api.write(blank).ok, false); assert.equal(store.get(api.KEY), 'corrupted');
console.log('onboarding decision matrix passed');
