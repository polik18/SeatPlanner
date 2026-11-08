(function () {
  'use strict';
  const SM = window.SeatMaster;
  const KEY = 'seatplanner:ui-onboarding:v1';
  const defaults = () => ({ schemaVersion: 1, completed: false, dismissed: false, hasUserActivity: false, tourVersionSeen: 0 });
  function meaningful(workspace) {
    if (!workspace?.classes?.length) return false;
    if (workspace.classes.length > 1) return true;
    const state = workspace.classes[0].state;
    if (!state?.config || !Array.isArray(state.seats)) return false;
    const baseline = SM.engine.normalizeConfig(SM.constants.DEFAULT_CONFIG);
    const config = SM.engine.normalizeConfig(state.config);
    if (Object.keys(baseline).some(key => baseline[key] !== config[key] && !(key === 'studentData' && config[key] === ''))) return true;
    if (state.hasDrawn || state.roomLayout || state.classroomGeometry || state.activities?.length) return true;
    if (Object.values(state.manualDraft || {}).some(Number.isInteger)) return true;
    if (Object.values(state.assignment || {}).some(Number.isInteger)) return true;
    const expected = SM.engine.buildSeatGrid(baseline, []);
    if (!state.seats.length) return false; // pre-hydration default
    return state.seats.length !== expected.length || expected.some((seat, index) => {
      const actual = state.seats[index];
      return ['id', 'row', 'col', 'type'].some(key => seat[key] !== actual[key]) || Boolean(actual.pin);
    });
  }
  function shouldShow(metadata, workspace) {
    return !metadata.completed && !metadata.dismissed && !metadata.hasUserActivity && !meaningful(workspace);
  }
  let blocked = false;
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ok: true, value: defaults() };
      const value = JSON.parse(raw);
      if (value?.schemaVersion !== 1 || ['completed', 'dismissed', 'hasUserActivity'].some(key => typeof value[key] !== 'boolean')) throw new Error('Invalid tutorial metadata');
      return { ok: true, value: { ...defaults(), ...value } };
    } catch (error) { blocked = true; return { ok: false, value: defaults(), error }; }
  }
  function write(value) {
    if (blocked) return { ok: false };
    try { localStorage.setItem(KEY, JSON.stringify(value)); return { ok: true }; }
    catch (error) { return { ok: false, error }; }
  }
  function reset() {
    try { localStorage.removeItem(KEY); blocked = false; return { ok: true }; }
    catch (error) { return { ok: false, error }; }
  }
  SM.onboardingStorage = { KEY, defaults, meaningful, shouldShow, read, write, reset };
})();
