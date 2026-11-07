(function () {
  'use strict';
  const SM = window.SeatMaster;
  const clone = value => JSON.parse(JSON.stringify(value));
  function id() { return window.crypto?.randomUUID?.() || `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  function ensure(state) {
    const roster = SM.engine.buildStudents(state.config);
    const names = SM.engine.parseStudentNames(state.config.studentData, roster);
    if (!Array.isArray(state.rosterIdentity)) state.rosterIdentity = [];
    const known = new Set(state.rosterIdentity.map(row => row.number));
    for (const student of roster) if (!known.has(student.number)) state.rosterIdentity.push({ studentId: id(), number: student.number, nameAtMatch: names.get(student.number) || '' });
    state.seatingConstraints ||= { version: 1, pairs: [] };
    state.seatTopology ||= null;
    state.studentDrawRound ||= null;
    return state;
  }
  function initializeEntry(entry) {
    entry.meta = { academicYear: '', term: '', createdAt: null, updatedAt: null, archivedAt: null, ...(entry.meta || {}) };
    entry.records ||= [];
    ensure(entry.state);
    return entry;
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  function content(state) {
    const value = clone(state);
    delete value.adminMode;
    if (value.roomLayout) for (const key of ['editing', 'zoom', 'selectedTableId', 'selectedPathId', 'selectedSeatId']) delete value.roomLayout[key];
    return JSON.stringify(canonical(value));
  }
  function addRecord(entry, label, options = {}) {
    initializeEntry(entry);
    const state = SM.storage ? SM.storage.serializableState(entry.state) : clone(entry.state);
    const key = content(state);
    if (entry.records.some(record => content(record.state) === key && sameMeta(entry.meta,record.meta)) && !options.force) return false;
    const now = new Date().toISOString();
    entry.records.unshift({ id: id(), label: String(label || now).trim().slice(0, 80), savedAt: options.legacy ? null : now, meta:{academicYear:entry.meta.academicYear,term:entry.meta.term}, state });
    if (options.legacy) entry.meta.migratedAt = now;
    else { entry.meta.updatedAt = now; entry.meta.createdAt ||= now; }
    return true;
  }
  function sameMeta(a,b){return (a?.academicYear||'')===(b?.academicYear||'')&&(a?.term||'')===(b?.term||'');}
  function matches(entry,record){return sameMeta(entry.meta,record.meta)&&content(SM.storage.serializableState(entry.state))===content(record.state);}
  function rosterChanged(state, config) {
    const before = SM.engine.buildStudents(state.config), after = SM.engine.buildStudents(config);
    const oldNames = SM.engine.parseStudentNames(state.config.studentData, before), newNames = SM.engine.parseStudentNames(config.studentData, after);
    return JSON.stringify(before.map(s => [s.number, oldNames.get(s.number) || ''])) !== JSON.stringify(after.map(s => [s.number, newNames.get(s.number) || '']));
  }
  function identityChoices(state, config) {
    ensure(state);
    const roster = SM.engine.buildStudents(config), names = SM.engine.parseStudentNames(config.studentData, roster);
    return roster.map(student => {
      const name = names.get(student.number) || '';
      const prior = state.rosterIdentity.find(row => row.number === student.number && row.nameAtMatch === name);
      return { number: student.number, name, studentId: prior?.studentId || '' };
    });
  }
  function applyIdentity(state, config, choices = identityChoices(state, config)) {
    const old = state.rosterIdentity || [], byId = new Map(old.map(row => [row.studentId, row.number]));
    const used = new Set(), remap = new Map();
    const next = choices.map(row => {
      const studentId = row.studentId || id();
      if (used.has(studentId)) throw new Error('Duplicate student identity');
      used.add(studentId);
      if (byId.has(studentId)) remap.set(byId.get(studentId), row.number);
      return { studentId, number: row.number, nameAtMatch: row.name || '' };
    });
    const mapAssignments = source => source && Object.fromEntries(Object.entries(source).map(([seat, number]) => [seat, remap.get(number) ?? null]));
    state.assignment = mapAssignments(state.assignment) || {};
    state.manualDraft = mapAssignments(state.manualDraft);
    state.seats.forEach(seat => { seat.pin = remap.get(seat.pin) ?? null; });
    // Keep retired identities, but never re-use their numbers for a new person.
    state.rosterIdentity = [...next, ...old.filter(row => !used.has(row.studentId)).map(row => ({ ...row, number: null }))];
    if(state.studentDrawRound){state.studentDrawRound={key:JSON.stringify(next.map(row=>[row.studentId,row.number])),history:state.studentDrawRound.history.map(batch=>batch.map(number=>remap.get(number)).filter(Number.isInteger)).filter(batch=>batch.length)};}
    state.config = config;
  }
  SM.classData = { id, clone, ensure, initializeEntry, content, matches, addRecord, rosterChanged, identityChoices, applyIdentity };
})();
