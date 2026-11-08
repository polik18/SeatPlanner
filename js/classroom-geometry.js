(function () {
  'use strict';
  const SM = window.SeatMaster;
  const clone = value => JSON.parse(JSON.stringify(value));
  const types = ['board', 'door', 'teacher'];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const angle = n => (n % 360 + 360) % 360;
  function legacy(config) {
    const portrait = config.roomAspect === 'portrait';
    const width = portrait ? 900 : 1200, height = portrait ? 1200 : 900;
    return { schemaVersion: 1, bounds: { width, height },
      content: { x: 100, y: 90, width: width - 200, height: height - 180 },
      markers: types.map(type => {
        const position = config[type + 'Position'] || (type === 'board' ? 'top-center' : 'right-end');
        const [side, align] = position.split('-');
        const fraction = align === 'start' ? 0.2 : align === 'end' ? 0.8 : 0.5;
        const vertical = ['left', 'right'].includes(side);
        const offset = Number(config[type + 'Offset']) || 0;
        const size = 0.7 + (Number(config[type + 'Size']) || 3) * 0.1;
        return { id: type, type, visible: position !== 'hidden',
          x: vertical ? (side === 'left' ? 38 : width - 38) : clamp(width * fraction + offset, 30, width - 30),
          y: vertical ? clamp(height * fraction + offset, 30, height - 30) : (side === 'bottom' ? height - 38 : 38),
          width: (type === 'board' ? 70 + (Number(config.boardLength) || 3) * 34 : type === 'teacher' ? 100 : 70) * size,
          height: (type === 'teacher' ? 55 : 30) * size, rotation: vertical ? 90 : 0,
          wall: type === 'teacher' ? null : (position === 'hidden' ? 'top' : side), wallT: clamp(fraction + offset / (vertical ? height : width), 0, 1) };
      }) };
  }
  function valid(g) {
    const finite = (...values) => values.every(Number.isFinite);
    return !!g && g.schemaVersion === 1 && !!g.bounds && finite(g.bounds.width, g.bounds.height) &&
      g.bounds.width >= 300 && g.bounds.width <= 4000 && g.bounds.height >= 300 && g.bounds.height <= 4000 &&
      !!g.content && finite(g.content.x, g.content.y, g.content.width, g.content.height) &&
      g.content.width > 0 && g.content.height > 0 && Math.abs(g.content.x) < 10000 && Math.abs(g.content.y) < 10000 && g.content.width <= 10000 && g.content.height <= 10000 &&
      Array.isArray(g.markers) && g.markers.length >= 3 && g.markers.length <= 100 && types.every(type => g.markers.filter(m => m?.id === type && m.type === type).length === 1) && new Set(g.markers.map(m=>m?.id)).size === g.markers.length &&
      g.markers.every(m => typeof m.id==='string' && m.id.length<=100 && /^[a-zA-Z0-9-]+$/.test(m.id) && types.includes(m.type) && typeof m.visible === 'boolean' && finite(m.x, m.y, m.width, m.height, m.rotation, m.wallT) &&
        Math.abs(m.x) < 10000 && Math.abs(m.y) < 10000 && m.width >= 20 && m.width <= 4000 && m.height >= 20 && m.height <= 4000 && m.rotation >= 0 && m.rotation < 360 &&
        [null, 'top', 'right', 'bottom', 'left'].includes(m.wall) && m.wallT >= 0 && m.wallT <= 1);
  }
  function ensure(state) {
    if (!state.classroomGeometry) state.classroomGeometry = legacy(state.config);
    return state.classroomGeometry;
  }
  function extents(m) {
    const a = m.rotation * Math.PI / 180;
    return { x: (Math.abs(Math.cos(a)) * m.width + Math.abs(Math.sin(a)) * m.height) / 2,
      y: (Math.abs(Math.sin(a)) * m.width + Math.abs(Math.cos(a)) * m.height) / 2 };
  }
  function pinWall(m, bounds) {
    if (!m.wall) return;
    const e = extents(m);
    if (m.wall === 'left' || m.wall === 'right') {
      m.x = m.wall === 'left' ? e.x + 8 : bounds.width - e.x - 8;
      m.y = clamp(m.wallT * bounds.height, e.y + 8, Math.max(e.y + 8, bounds.height - e.y - 8));
    } else {
      m.y = m.wall === 'top' ? e.y + 8 : bounds.height - e.y - 8;
      m.x = clamp(m.wallT * bounds.width, e.x + 8, Math.max(e.x + 8, bounds.width - e.x - 8));
    }
  }
  function resize(g, width, height) {
    width = clamp(width, 300, 4000); height = clamp(height, 300, 4000);
    const dx = (width - g.bounds.width) / 2, dy = (height - g.bounds.height) / 2;
    g.content.x += dx; g.content.y += dy;
    g.markers.forEach(m => { m.x += dx; m.y += dy; });
    g.bounds = { width, height };
    g.markers.forEach(m => pinWall(m, g.bounds));
  }
  function overflow(g) {
    const b = g.bounds, c = g.content;
    const result = [];
    if (c.x < -0.1 || c.y < -0.1 || c.x + c.width > b.width + 0.1 || c.y + c.height > b.height + 0.1) result.push('content');
    g.markers.filter(m => m.visible).forEach(m => {
      const e = extents(m);
      if (m.x - e.x < -0.1 || m.y - e.y < -0.1 || m.x + e.x > b.width + 0.1 || m.y + e.y > b.height + 0.1) result.push(m.id);
    });
    return result;
  }
  function fit(g) {
    const c = g.content;
    let left = Math.min(0, c.x), top = Math.min(0, c.y), right = Math.max(g.bounds.width, c.x + c.width), bottom = Math.max(g.bounds.height, c.y + c.height);
    g.markers.filter(m => m.visible && !m.wall).forEach(m => { const e = extents(m); left = Math.min(left, m.x - e.x); right = Math.max(right, m.x + e.x); top = Math.min(top, m.y - e.y); bottom = Math.max(bottom, m.y + e.y); });
    let scale = Math.min((g.bounds.width - 40) / (right - left), (g.bounds.height - 40) / (bottom - top), 1);
    g.markers.filter(m => m.visible).forEach(m => { const e = extents(m); scale = Math.min(scale, (g.bounds.width - 40) / (e.x * 2), (g.bounds.height - 40) / (e.y * 2)); });
    const tx = (g.bounds.width - (right - left) * scale) / 2 - left * scale;
    const ty = (g.bounds.height - (bottom - top) * scale) / 2 - top * scale;
    c.x = c.x * scale + tx; c.y = c.y * scale + ty; c.width *= scale; c.height *= scale;
    g.markers.forEach(m => { m.x = m.x * scale + tx; m.y = m.y * scale + ty; m.width = Math.max(20, m.width * scale); m.height = Math.max(20, m.height * scale); pinWall(m, g.bounds); });
  }
  function rotate(g, direction) {
    const cw = direction === 'clockwise', { width: w, height: h } = g.bounds;
    const c = g.content;
    const x = c.x, y = c.y;
    c.x = cw ? h - y - c.height : y; c.y = cw ? x : w - x - c.width;
    [c.width, c.height] = [c.height, c.width];
    const sides = ['top', 'right', 'bottom', 'left'];
    g.markers.forEach(m => {
      const oldX = m.x;
      m.x = cw ? h - m.y : m.y; m.y = cw ? oldX : w - oldX;
      m.rotation = angle(m.rotation + (cw ? 90 : -90));
      if (m.wall) {
        const old = m.wall;
        m.wall = sides[(sides.indexOf(old) + (cw ? 1 : 3)) % 4];
        if (cw ? ['left', 'right'].includes(old) : ['top', 'bottom'].includes(old)) m.wallT = 1 - m.wallT;
      }
    });
    g.bounds = { width: h, height: w };
  }
  SM.classroomGeometry = { clone, types, clamp, angle, legacy, valid, ensure, extents, pinWall, resize, overflow, fit, rotate };
})();
