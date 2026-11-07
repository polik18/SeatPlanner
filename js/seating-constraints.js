(function () {
  'use strict';
  const SM = window.SeatMaster;
  const say = (zh, en) => SM.i18n?.getLanguage?.() === 'en' ? en : zh;
  const edgeKey = (a, b) => JSON.stringify([a, b].sort());
  function signature(state) {
    return JSON.stringify(state.roomLayout ? { tables: state.roomLayout.tables.map(t => [t.id, t.type, t.x, t.y, t.width, t.height, t.rotation, t.seatIds, t.seatPositions]), paths: state.roomLayout.paths } : state.seats.map(s => [s.id, s.row, s.col, s.type === 'aisle']));
  }
  function activeRules(state) {
    const active = new Set(SM.engine.studentsRequiringSeats(state.config).map(s => s.number));
    const identities = new Map((state.rosterIdentity || []).filter(row => active.has(row.number)).map(row => [row.studentId, row.number]));
    return (state.seatingConstraints?.pairs || []).filter(rule => rule.enabled !== false && identities.has(rule.studentAId) && identities.has(rule.studentBId)).map(rule => ({ ...rule, a: identities.get(rule.studentAId), b: identities.get(rule.studentBId) }));
  }
  function topology(state) {
    const seats = state.seats.filter(s => s.type !== 'aisle');
    if (state.roomLayout) return { confirmed: Boolean(state.seatTopology?.confirmed && state.seatTopology.signature === signature(state)), edges: new Set((state.seatTopology?.edges || []).map(([a,b]) => edgeKey(a,b))) };
    const edges = new Set();
    for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) if (Math.max(Math.abs(seats[i].row - seats[j].row), Math.abs(seats[i].col - seats[j].col)) === 1) edges.add(edgeKey(seats[i].id, seats[j].id));
    return { confirmed: true, edges };
  }
  function points(state) {
    if (!state.roomLayout) return state.seats.filter(s => s.type !== 'aisle').map(s => ({ id: s.id, x: 8 + 84 * (s.col + .5) / state.config.cols, y: 8 + 84 * (s.row + .5) / state.config.rows }));
    return state.roomLayout.tables.flatMap(table => SM.roomLayout.seatPoints(table, table.seatIds.length).map((point, index) => {
      const angle = table.rotation * Math.PI / 180, dx = (point.x - 50) * table.width * 1.45 / 100, dy = (point.y - 50) * table.height / 100;
      return { id: table.seatIds[index], x: table.x + (dx * Math.cos(angle) - dy * Math.sin(angle)) / 1.45, y: table.y + dx * Math.sin(angle) + dy * Math.cos(angle) };
    }));
  }
  function suggest(state) {
    if (!state.roomLayout) return [...topology(state).edges].map(JSON.parse);
    const nodes = points(state), edges = new Map();
    for (const node of nodes) {
      const nearest = nodes.filter(other => other.id !== node.id).map(other => ({ other, distance: Math.hypot((node.x-other.x)*1.45, node.y-other.y) })).sort((a,b) => a.distance-b.distance);
      for (const item of nearest.slice(0, 2)) edges.set(edgeKey(node.id,item.other.id), [node.id,item.other.id]);
    }
    return [...edges.values()];
  }
  function tableMap(state) { return new Map((state.roomLayout?.tables || []).flatMap(table => table.seatIds.map(id => [id, table.id]))); }
  function relationConflict(rule, a, b, graph, tables) {
    return rule.relations.includes('notAdjacent') && graph.edges.has(edgeKey(a,b)) || rule.relations.includes('notSameTable') && tables.get(a) && tables.get(a) === tables.get(b);
  }
  function validateAssignment(state, assignment, options = {}) {
    const errors = [], violations = [], seats = new Set(state.seats.filter(s => s.type !== 'aisle').map(s => s.id));
    const students = new Set(SM.engine.studentsRequiringSeats(state.config).map(s => s.number)), placed = new Map();
    for (const [id, number] of Object.entries(assignment || {})) {
      if (!seats.has(id)) { errors.push(say('排位包含不存在或不可坐的座位。','An assigned seat is unavailable.')); continue; }
      if (number == null) continue;
      if (!students.has(number) || placed.has(number)) errors.push(say('排位含無效或重複學生。','Invalid or duplicate student in seating.'));
      placed.set(number, id);
    }
    if (!options.partial && placed.size !== students.size) errors.push(say('尚有學生未排位。','Some students are still unseated.'));
    const rules = activeRules(state), graph = topology(state), tables = tableMap(state);
    if (rules.some(rule => rule.relations.includes('notAdjacent')) && !graph.confirmed) errors.push(say('請先確認自由教室的座位鄰接圖。','Confirm the free-layout adjacency map first.'));
    if (rules.some(rule => rule.relations.includes('notSameTable')) && !state.roomLayout) errors.push(say('不同桌組規則需要自由教室桌組。','Different-table rules require a table layout.'));
    if (rules.some(rule => rule.relations.includes('notSameTable')) && state.roomLayout && [...seats].some(id=>!tables.has(id))) errors.push(say('有座位未歸屬桌組，請先確認教室。','Some seats have no table. Review the classroom first.'));
    for (const rule of rules) if (placed.has(rule.a) && placed.has(rule.b) && relationConflict(rule, placed.get(rule.a), placed.get(rule.b), graph, tables)) {
      violations.push({ ruleId: rule.id, a: rule.a, b: rule.b });
      errors.push(say(`${rule.a}、${rule.b} 號違反分開安排規則。`,`Students ${rule.a} and ${rule.b} violate a separation rule.`));
    }
    return { valid: errors.length === 0, errors, violations, rules, graph, tables };
  }
  SM.seatingConstraints = { say, edgeKey, signature, activeRules, topology, points, suggest, tableMap, relationConflict, validateAssignment };
})();
