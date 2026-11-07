(function () {
  'use strict';
  const SM = window.SeatMaster, C = SM.seatingConstraints;
  const oldArrange = SM.engine.arrange;
  // Synchronous callers must never receive an unconstrained result by accident.
  SM.engine.arrange = state => {
    if (C.activeRules(state).length) throw new Error(C.say('請使用符合分開安排規則的抽位流程。','Use the constrained seating draw.'));
    return oldArrange(state);
  };
  async function solve(state, options = {}) {
    if(options.signal?.aborted)return {status:'cancelled',nodes:0};
    const base = SM.engine.validate(state);
    if (!base.valid) return { status: 'unsatisfiable', errors: base.errors, nodes: 0 };
    const rules = C.activeRules(state);
    if (!rules.length) return { status: 'solved', assignment: oldArrange(state), nodes: 0 };
    const fixed = Object.fromEntries(state.seats.filter(s => s.pin).map(s => [s.id,s.pin]));
    const preflight = C.validateAssignment(state, fixed, { partial: true });
    if (!preflight.valid) return { status: preflight.errors.length>preflight.violations.length ? 'invalid' : 'unsatisfiable', errors: preflight.errors, nodes: 0 };
    const seats = base.usableSeats, byId = new Map(seats.map(s => [s.id,s]));
    const located = new Map(Object.entries(fixed).map(([id,number]) => [number,id]));
    const occupied = new Set(Object.keys(fixed)), assignment = { ...fixed };
    const graph = preflight.graph, tables = preflight.tables, shuffle = options.shuffle || SM.engine.secureShuffle;
    const relevant = new Map(base.students.map(s => [s.number,rules.filter(r => r.a === s.number || r.b === s.number)]));
    const allowed = (student, id) => !occupied.has(id) && SM.engine.isCompatible(byId.get(id), student) && relevant.get(student.number).every(rule => {
      const other = rule.a === student.number ? rule.b : rule.a;
      return !located.has(other) || !C.relationConflict(rule,id,located.get(other),graph,tables);
    });
    const pending = shuffle(base.students.filter(s => !located.has(s.number)));
    let nodes = 0, solution = null;
    function* search(remaining) {
      nodes++; yield;
      if (!remaining.length) { solution = Object.fromEntries(seats.map(s => [s.id,assignment[s.id] ?? null])); return true; }
      let chosen, candidates;
      for (const student of remaining) {
        const choices = seats.filter(seat => allowed(student,seat.id)).map(s => s.id);
        if (!choices.length) return false;
        if (!chosen || choices.length < candidates.length || choices.length === candidates.length && relevant.get(student.number).length > relevant.get(chosen.number).length) { chosen=student; candidates=choices; }
      }
      for (const id of shuffle(candidates)) {
        assignment[id]=chosen.number; occupied.add(id); located.set(chosen.number,id);
        if (yield* search(remaining.filter(s => s.number !== chosen.number))) return true;
        delete assignment[id]; occupied.delete(id); located.delete(chosen.number);
      }
      return false;
    }
    const clock = options.clock || (() => Date.now()), start = clock();
    const iterator = search(pending), maxNodes = options.maxNodes ?? 150000, timeoutMs = options.timeoutMs ?? 3000;
    let sliceStart = start;
    while (true) {
      if (options.signal?.aborted) return { status: 'cancelled', nodes };
      if (nodes >= maxNodes || clock()-start >= timeoutMs) return { status: 'timeout', nodes };
      const step = iterator.next();
      if (step.done) break;
      if (clock()-sliceStart > 8) {
        await (options.yieldControl ? options.yieldControl() : new Promise(resolve => window.setTimeout(resolve,0)));
        sliceStart=clock();
      }
    }
    if (!solution) return { status: 'unsatisfiable', nodes, errors: [C.say('目前條件沒有符合的排位，請檢查保留位置與分開安排規則。','No seating satisfies the current conditions. Check priority seats and separation rules.')] };
    const report = C.validateAssignment(state,solution);
    return report.valid ? { status:'solved',assignment:solution,nodes } : { status:'invalid',errors:report.errors,nodes };
  }
  SM.constrainedArranger = { solve };
})();
