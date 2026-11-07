const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = { window: { crypto: require('node:crypto').webcrypto } };
vm.createContext(context);
for (const name of ['constants', 'seat-engine', 'room-layout']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', name + '.js'), 'utf8'), context);
}
const SM = context.window.SeatMaster;
const state = SM.createDefaultState();
// These fixtures intentionally preserve the pre-v5 schema for migration tests.
state.version = 4;
state.config = SM.engine.normalizeConfig(state.config);
state.seats = SM.engine.buildSeatGrid(state.config, []);
const workspace = { version: 4, activeClassId: 'class-1', classes: [{ id: 'class-1', state }] };
const write = (name, value) => fs.writeFileSync(path.join(__dirname, 'fixtures', name + '.json'), JSON.stringify(value, null, 2) + '\n');
write('default-v4', workspace);
const existing = JSON.parse(JSON.stringify(workspace));
existing.classes[0].state.config.className = '測試班級';
existing.classes[0].state.assignment = SM.engine.arrange(existing.classes[0].state);
existing.classes[0].state.hasDrawn = true;
write('existing-v4', existing);
for (const version of [1, 2, 3]) write('legacy-v' + version, { ...state, version });
const multi = JSON.parse(JSON.stringify(existing));
multi.classes.push({ id: 'class-2', state: { ...JSON.parse(JSON.stringify(state)), manualDraft: { [state.seats[0].id]: 1 }, activities: [] } });
write('multi-v4', multi);
