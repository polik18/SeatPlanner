(function () {
  'use strict';
  const SM = window.SeatMaster, G = SM.classroomGeometry, C = SM.classroomCamera;
  const $ = id => document.getElementById(id);
  const say = (zh, en) => SM.i18n.getLanguage() === 'en' ? en : zh;
  const names = () => ({ board: say('黑板', 'Board'), door: say('門', 'Door'), teacher: say('老師座位', 'Teacher desk'), bounds: say('教室形狀', 'Room shape') });
  let read, changed, history, root, layer, toolbar, panel, editing = false, selected = null, drag = null, owner = null, zoom = 1;
  let workspace, viewport, selectionLayer, footer, dock, home, tableHome, tableTools, previousFocus, previousScroll;
  let camera = { scale: 1, x: 0, y: 0 }, viewMode = 'work', pan = null, panTool = false, space = false, propertiesOpen = false, pinch = null;
  let lastViewSize = null;
  let objects=null,finishing=false,finishAbort=null;
  let feedbackTimer;
  function feedback(text){let node=$('drawingFeedback');if(!node){node=document.createElement('p');node.id='drawingFeedback';node.className='drawing-feedback';node.setAttribute('role','status');workspace.append(node);}node.textContent=text;node.hidden=false;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>{node.hidden=true;},2600);}
  const touches = new Map();
  const viewSize = () => ({ width: viewport.clientWidth, height: viewport.clientHeight });
  function fitView(initial = false) {
    const g = read().classroomGeometry;
    C.fit(camera, viewSize(), { x: 0, y: 0, ...g.bounds });
    if (initial && camera.scale < 0.65) { camera.scale = 0.65; C.center(camera, viewSize(), { x: g.bounds.width / 2, y: g.bounds.height / 2 }); }
    viewMode = initial ? 'work' : 'fit'; paint();
    lastViewSize = viewSize();
  }
  function revealSelection(focus = false) {
    const m = objects?.groupBox() || marker(), g = read().classroomGeometry;
    if (!m && selected !== 'bounds') return;
    const e = m ? G.extents(m) : { x: g.bounds.width / 2, y: g.bounds.height / 2 };
    const center = m || e;
    if (focus) {
      C.fit(camera, viewSize(), { x: center.x - e.x, y: center.y - e.y, width: Math.max(e.x * 2, 180), height: Math.max(e.y * 2, 140) }, 100);
      viewMode = 'work';
    } else {
      const p = C.toScreen(camera, center), v = viewSize();
      if (p.x < 60 || p.x > v.width - 60 || p.y < 60 || p.y > v.height - 60) C.center(camera, v, center);
    }
    paint();
  }
  function enterWorkspace() {
    previousFocus = document.activeElement; previousScroll = { x: window.scrollX, y: window.scrollY };
    workspace.hidden = false; workspace.querySelector('.workspace-top').append(toolbar);
    workspace.querySelector('.workspace-properties').append(panel, tableTools);
    viewport.prepend(root); document.body.classList.add('classroom-workspace-open');
    document.querySelector('.app-header').inert = true; document.querySelector('.app-shell').inert = true;
  }
  function leaveWorkspace() {
    if (!workspace || workspace.hidden) return;
    home.after(root); dock.append(toolbar, panel); tableHome.after(tableTools);
    workspace.hidden = true; document.body.classList.remove('classroom-workspace-open');
    document.querySelector('.app-header').inert = false; document.querySelector('.app-shell').inert = false;
    root.style.removeProperty('transform'); root.style.removeProperty('height');
    touches.clear(); pan = null; pinch = null; space = false; panTool = false;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else queueMicrotask(() => toolbar.querySelector('[data-canvas-action="edit"]')?.focus({ preventScroll: true }));
    if (previousScroll) window.scrollTo(previousScroll.x, previousScroll.y);
  }
  const snapshot = () => G.clone(read().classroomGeometry);
  function remember(before) {
    if (JSON.stringify(before) === JSON.stringify(read().classroomGeometry)) return;
    const after = read().classroomGeometry;
    read().classroomGeometry = before; history.record(); read().classroomGeometry = after;
    changed();
  }
  function mutate(fn) { const before = snapshot(); fn(read().classroomGeometry); remember(before); render(read()); }
  function marker() { return read().classroomGeometry?.markers.find(m => m.id === selected); }
  function cancelDrag() { if(objects?.dragging)objects.cancel(); if (!drag) return; read().classroomGeometry = drag.before; drag = null; paint(); }
  function stop() { finishAbort?.abort();cancelDrag(); if(editing)history.suspend();objects=null;finishing=false;if (editing && read?.().roomLayout) read().roomLayout.editing = false; editing = false; selected = null; root?.classList.remove('geometry-editing'); leaveWorkspace(); }
  const button = (action, text, extra = '') => `<button class="button button-secondary" type="button" data-canvas-action="${action}" ${extra}>${text}</button>`;
  function init(getState, commit, historyController) {
    read = getState; changed = commit; history = historyController; root = $('roomLayout');
    toolbar = document.createElement('section'); toolbar.className = 'classroom-editor-toolbar admin-only'; toolbar.id = 'classroomEditorToolbar';
    root.before(toolbar);
    panel = document.createElement('section'); panel.id = 'classroomObjectTools'; panel.className = 'classroom-object-tools admin-only'; toolbar.after(panel);
    dock = document.createElement('div'); dock.className = 'classroom-editor-dock admin-only'; toolbar.before(dock); dock.append(toolbar, panel);
    home = document.createComment('Classroom preview position'); root.before(home);
    tableTools = $('roomLayoutToolbar'); tableHome = document.createComment('Table tools position'); tableTools.before(tableHome);
    workspace = document.createElement('section'); workspace.id = 'classroomWorkspace'; workspace.className = 'classroom-workspace'; workspace.hidden = true;
    workspace.setAttribute('role', 'dialog'); workspace.setAttribute('aria-modal', 'true'); workspace.setAttribute('aria-label', '編輯教室 / Edit classroom');
    workspace.innerHTML = '<div class="workspace-top"></div><div class="workspace-body"><div id="classroomViewport" class="classroom-viewport" tabindex="0" aria-label="教室畫布 / Classroom canvas"><div id="classroomSelection" class="classroom-selection-layer"></div></div><aside class="workspace-properties" id="classroomProperties"></aside></div><div class="workspace-footer"></div>';
    document.body.append(workspace); viewport = $('classroomViewport'); selectionLayer = $('classroomSelection'); footer = workspace.querySelector('.workspace-footer'); footer.addEventListener('click', action);
    layer = document.createElement('div'); layer.className = 'classroom-marker-layer'; root.append(layer);
    toolbar.addEventListener('click', action); panel.addEventListener('click', action);selectionLayer.addEventListener('click',action);
    root.tabIndex=0;
    const objectAction=event=>{const b=event.target.closest('[data-drawing-action]');if(b&&objects&&!finishing){event.stopPropagation();objects.action(b.dataset.drawingAction,b.dataset.value);}};
    toolbar.addEventListener('click',objectAction);panel.addEventListener('click',objectAction);selectionLayer.addEventListener('click',objectAction);footer.addEventListener('click',objectAction);
    panel.addEventListener('change', event => {
      if(event.target.id==='drawingSeatTable'){objects?.action('seat-table',event.target.value);return;}
      if (event.target.id === 'canvasLock') return;
      if (event.target.id === 'canvasWall') { mutate(g => { const m = marker(); if (m) { m.wall = event.target.checked ? 'top' : null; G.pinWall(m, g.bounds); } }); return; }
      if (!event.target.matches('[data-geometry-value]')) return;
      const key = event.target.dataset.geometryValue, value = Number(event.target.value);
      if (!Number.isFinite(value)) return;
      mutate(g => {
        if (selected === 'bounds') {
          const lock = $('canvasLock')?.checked, ratio = g.bounds.width / g.bounds.height;
          G.resize(g, key === 'width' ? value : lock ? value * ratio : g.bounds.width, key === 'height' ? value : lock ? value / ratio : g.bounds.height);
        } else {
          const m = marker(); if (!m) return;
          const ratio = m.width / m.height;
          m[key] = key === 'rotation' ? G.angle(value) : key === 'width' || key === 'height' ? G.clamp(value, 20, 4000) : G.clamp(value, -3999, 7999);
          if ($('canvasLock')?.checked && (key === 'width' || key === 'height')) {
            if (key === 'width') m.height = G.clamp(m.width / ratio, 20, 4000);
            else m.width = G.clamp(m.height * ratio, 20, 4000);
          }
          if (key === 'x' || key === 'y') m.wall = null;
          G.pinWall(m, g.bounds);
        }
      });
    });
    viewport.addEventListener('pointerdown', pointerDown, true);
    root.addEventListener('keydown', event => {
      if(editing&&event.target===root&&['Enter',' '].includes(event.key)){event.preventDefault();objects?.select([{kind:'bounds',id:'bounds'}]);return;}
      const target = event.target.closest('[data-marker-id]');
      if (editing && target && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selected = target.dataset.markerId;if(objects)objects.select([{kind:'marker',id:selected}]); render(read()); }
    });
    viewport.addEventListener('pointermove', pointerMove);
    viewport.addEventListener('pointerup', pointerUp);
    viewport.addEventListener('pointercancel', event => { touches.delete(event.pointerId); pinch = null; pan = null; cancelDrag(); render(read()); });
    viewport.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) { cancelDrag(); render(read()); } });
    viewport.addEventListener('wheel', event => {
      if (!editing || drag || objects?.dragging || history.dragging() || finishing) return;
      event.preventDefault(); const r = viewport.getBoundingClientRect();
      C.zoomAt(camera, { x: event.clientX - r.left, y: event.clientY - r.top }, camera.scale * Math.exp(-event.deltaY * 0.0015)); viewMode = 'work'; paint();
    }, { passive: false });
    root.addEventListener('click', event => { if (editing && selected !== 'tables') { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
    document.addEventListener('keydown', keydown);
    window.addEventListener('seatmaster:languagechange', () => render(read()));
    window.addEventListener('resize', () => {
      if (editing && viewMode === 'fit') fitView();
      else {
        if (editing && lastViewSize) { const center = C.toWorld(camera, { x: lastViewSize.width / 2, y: lastViewSize.height / 2 }); C.center(camera, viewSize(), center); lastViewSize = viewSize(); }
        paint();
      }
    });
    document.addEventListener('keyup', event => { if (event.code === 'Space') { space = false; paint(); } });
    window.addEventListener('blur', () => { if (drag) { cancelDrag(); render(read()); } });
    document.querySelector('.room-marker-settings').hidden = true;
    const oldMarkerDetails = document.querySelector('.room-marker-settings').closest('.advanced-settings');
    if (oldMarkerDetails) oldMarkerDetails.hidden = true;
    const oldAspect = $('roomAspectInput');
    const shortcut = document.createElement('button'); shortcut.className = 'button button-secondary'; shortcut.type = 'button'; shortcut.dataset.canvasAction = 'edit';
    delete shortcut.dataset.canvasAction; shortcut.id = 'classroomEditorShortcut';
    shortcut.textContent = say('在教室圖上調整形狀與標記', 'Edit room shape and markers on canvas');
    oldAspect.closest('label').hidden = true; oldAspect.closest('label').after(shortcut);
    shortcut.addEventListener('click', () => { if (!editing) toolbar.querySelector('[data-canvas-action="edit"]').click(); });
  }
  async function action(event) {
    const b = event.target.closest('[data-canvas-action],[data-room-ratio]'); if (!b) return;
    const a = b.dataset.canvasAction || 'ratio-'+b.dataset.roomRatio;
    if(a==='cancel-finish'){finishAbort?.abort();return;}
    if(finishing)return;
    if (a === 'edit') {
      finishAbort=null;G.ensure(read());history.begin(); editing = true; selected = 'board';
      objects=SM.drawingObjects.create({read,history,feedback,changed:()=>{changed();},paint:()=>paint(),reveal:()=>revealSelection(),selected:refs=>{selected=refs.length===1?(refs[0].kind==='marker'?refs[0].id:refs[0].kind==='bounds'?'bounds':'objects'):refs.length?'objects':null;render(read());}});
      objects.select([{kind:'marker',id:'board'}],false);
      enterWorkspace(); changed(); render(read()); fitView(true); toolbar.querySelector('[data-canvas-action="done"]').focus(); return;
    }
    if (a === 'done') {
      cancelDrag();
      finishing=true;finishAbort=new AbortController();paint();
      try{
        const request=finishAbort,result=await history.finish(request.signal,text=>{if($('canvasStatus'))$('canvasStatus').textContent=text;});
        if(finishAbort!==request||!editing)return;
        finishing=false;
        if(result.status==='solved'){stop();changed();render(read());return;}
        render(read());$('canvasStatus').textContent=result.status==='cancelled'?say('已取消計算，草稿保留。','Calculation cancelled. Draft kept.'):result.status==='timeout'?say('尚未找到符合配置，可重試或調整。','No solution found within the time budget. Retry or adjust.'):(result.errors||['配置尚未完成。']).join(' ');$('canvasStatus').classList.add('is-error');
      }catch(error){finishing=false;render(read());$('canvasStatus').textContent=error.message;$('canvasStatus').classList.add('is-error');}return;
    }
    if(a==='close-editor'){stop();changed();render(read());return;}
    if (['board', 'door', 'teacher', 'bounds', 'tables'].includes(a)) {
      if(objects){
        if(['board','door','teacher'].includes(a)&&!read().classroomGeometry.markers.find(m=>m.id===a).visible)mutate(g=>{const m=g.markers.find(m=>m.id===a);m.visible=true;G.pinWall(m,g.bounds);});
        const ref=a==='bounds'?{kind:'bounds',id:'bounds'}:a==='tables'?read().roomLayout.tables[0]?{kind:'table',id:read().roomLayout.tables[0].id}:null:{kind:'marker',id:a};
        objects.select(ref?[ref]:[]);panTool=false;render(read());revealSelection();return;
      }
      selected = a;
      if (read().roomLayout) read().roomLayout.editing = a === 'tables';
      const m = marker(); if (m && !m.visible) mutate(g => { m.visible = true; m.x = g.bounds.width / 2; m.y = g.bounds.height / 2; G.pinWall(m, g.bounds); });
      if (read().roomLayout) changed();
      panTool = false; render(read()); revealSelection(); return;
    }
    if (a === 'undo' || a === 'redo') {
      history[a]();if(objects)objects.select(objects.refs); render(read()); return;
    }
    if (editing && ['pan', 'select', 'properties', 'zoom-selection', 'zoom-in', 'zoom-out', 'zoom-fit'].includes(a)) {
      if (a === 'pan' || a === 'select') panTool = a === 'pan';
      if (a === 'properties') propertiesOpen = !propertiesOpen;
      if (a === 'zoom-fit') { fitView(); return; }
      if (a === 'zoom-selection') { revealSelection(true); return; }
      if (a === 'zoom-in' || a === 'zoom-out') { const v = viewSize(); C.zoomAt(camera, { x: v.width / 2, y: v.height / 2 }, camera.scale * (a === 'zoom-in' ? 1.25 : 0.8)); viewMode = 'work'; }
      paint(); return;
    }
    if (a === 'zoom-in' || a === 'zoom-out' || a === 'zoom-fit') {
      zoom = a === 'zoom-fit' ? 1 : G.clamp(zoom + (a === 'zoom-in' ? 0.2 : -0.2), 0.5, 2);
      if (a === 'zoom-fit') root.parentElement.scrollTop = 0;
      paint(); return;
    }
    if (a === 'ratio-custom') {
      const w = Number($('canvasRatioWidth').value), h = Number($('canvasRatioHeight').value);
      if (!Number.isFinite(w / h) || w <= 0 || h <= 0 || w / h < 0.075 || w / h > 13.3333) {
        $('canvasStatus').textContent = say('請輸入正數長寬比，比例範圍為 3:40 至 40:3。', 'Enter a positive ratio between 3:40 and 40:3.');
        $('canvasStatus').classList.add('is-error'); return;
      }
    }
    if(objects&&objects.action(a))return;
    mutate(g => {
      const m = marker();
      if (a === 'fit') {const width=g.content.width;G.fit(g);if(read().roomLayout?.version===3){const ratio=g.content.width/width;for(const p of [...read().roomLayout.looseSeats,...read().roomLayout.tables.flatMap(t=>t.seatPositions)]){p.width=Math.max(12,p.width*ratio);p.height=Math.max(12,p.height*ratio);}}}
      if (a.startsWith('ratio-')) {
        const [w, h] = a === 'ratio-custom' ? [Number($('canvasRatioWidth').value), Number($('canvasRatioHeight').value)] : a.slice(6).split(':').map(Number);
        if (!Number.isFinite(w / h) || w <= 0 || h <= 0 || w / h < 0.075 || w / h > 13.3333) return;
        const height = G.clamp(g.bounds.height, Math.max(300, 300 * h / w), Math.min(4000, 4000 * h / w));
        G.resize(g, height * w / h, height);
      }
      if (!m) return;
      if (a === 'left' || a === 'right') { m.rotation = G.angle(m.rotation + (a === 'left' ? -90 : 90)); G.pinWall(m, g.bounds); }
      if (a === 'hide') { m.visible = false; selected = null; }
      if (a === 'reset') {
        const baseline = G.legacy(read().config), original = baseline.markers.find(item => item.id === selected);
        Object.assign(m, original); const e = G.extents(m);
        m.x = G.clamp(m.x * g.bounds.width / baseline.bounds.width, e.x + 8, g.bounds.width - e.x - 8);
        m.y = G.clamp(m.y * g.bounds.height / baseline.bounds.height, e.y + 8, g.bounds.height - e.y - 8);
        G.pinWall(m, g.bounds);
      }
    });
  }
  function point(event) {
    if (editing) {
      const r = viewport.getBoundingClientRect();
      return C.toWorld(drag?.camera || camera, { x: event.clientX - r.left, y: event.clientY - r.top });
    }
    const rect = drag?.frame || root.getBoundingClientRect(), g = drag?.before || read().classroomGeometry;
    return { x: (event.clientX - rect.left) * g.bounds.width / rect.width, y: (event.clientY - rect.top) * g.bounds.height / rect.height };
  }
  function pointerDown(event) {
    if (!editing || finishing) return;
    if(event.target.closest('[data-drawing-action],[data-canvas-action],[data-room-ratio]'))return;
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.size === 2) {
        cancelDrag(); history.cancelPointer(); pan = null; const [a, b] = [...touches.values()];
        const r = viewport.getBoundingClientRect(), mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
        pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: camera.scale, world: C.toWorld(camera, mid) };
        viewport.setPointerCapture(event.pointerId); event.preventDefault(); event.stopImmediatePropagation(); return;
      }
    }
    if (!event.isPrimary || ![0, 1].includes(event.button)) return;
    if (panTool || space || event.button === 1) {
      pan = { x: event.clientX, y: event.clientY, camera: { ...camera }, pointerId: event.pointerId };
      viewport.setPointerCapture(event.pointerId); event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if(objects){
      const p=point(event),b=read().classroomGeometry.bounds,tolerance=(event.pointerType==='touch'?24:12)/camera.scale;
      const nearBorder=p.x>=-tolerance&&p.x<=b.width+tolerance&&p.y>=-tolerance&&p.y<=b.height+tolerance&&Math.min(Math.abs(p.x),Math.abs(p.y),Math.abs(p.x-b.width),Math.abs(p.y-b.height))<=tolerance;
      if(!event.target.closest('[data-geometry-handle]')&&!objects.hit(event.target)&&nearBorder){event.preventDefault();event.stopImmediatePropagation();objects.select([{kind:'bounds',id:'bounds'}]);return;}
      event.preventDefault();event.stopImmediatePropagation();objects.down(event,p);viewport.setPointerCapture(event.pointerId);return;
    }
    if (selected === 'tables' && event.target.closest('#seatGrid')) return;
    const target = event.target.closest('[data-marker-id]'), handle = event.target.closest('[data-geometry-handle]');
    event.stopImmediatePropagation();
    if (!target && !handle) { selected = null; render(read()); return; }
    event.preventDefault();
    if (target) selected = target.dataset.markerId;
    const p = point(event), m = marker();
    const before = snapshot();
    drag = { before, selected, kind: handle?.dataset.geometryHandle || 'move', start: p, object: m ? G.clone(m) : null,
      lock: $('canvasLock')?.checked || event.shiftKey, pointerId: event.pointerId, frame: root.getBoundingClientRect(), camera: { ...camera } };
    viewport.setPointerCapture(event.pointerId);
    paint();
  }
  function pointerMove(event) {
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()], r = viewport.getBoundingClientRect();
      camera.scale = G.clamp(pinch.scale * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance), 0.1, 4);
      camera.x = (a.x + b.x) / 2 - r.left - pinch.world.x * camera.scale;
      camera.y = (a.y + b.y) / 2 - r.top - pinch.world.y * camera.scale; viewMode = 'work'; paint(); return;
    }
    if (pan && pan.pointerId === event.pointerId) {
      camera.x = pan.camera.x + event.clientX - pan.x; camera.y = pan.camera.y + event.clientY - pan.y;
      viewMode = 'work'; paint(); return;
    }
    if(objects){objects.move(point(event),event);return;}
    if (!drag || event.pointerId !== drag.pointerId) return;
    const p = point(event), d = drag, base = d.before, dx = p.x - d.start.x, dy = p.y - d.start.y;
    read().classroomGeometry = G.clone(base);
    const g = read().classroomGeometry, m = marker(), o = d.object;
    if (selected === 'bounds') {
      const horizontal = /[ew]/.test(d.kind), vertical = /[ns]/.test(d.kind);
      let w = base.bounds.width + (horizontal ? dx * (d.kind.includes('w') ? -1 : 1) : 0);
      let h = base.bounds.height + (vertical ? dy * (d.kind.includes('n') ? -1 : 1) : 0);
      if (d.lock) { if (horizontal) h = w * base.bounds.height / base.bounds.width; else w = h * base.bounds.width / base.bounds.height; }
      G.resize(g, w, h);
    } else if (m) {
      if (d.kind === 'move') {
        m.x = G.clamp(o.x + dx, -3999, 7999); m.y = G.clamp(o.y + dy, -3999, 7999);
        const walls = [{ side: 'left', distance: p.x }, { side: 'right', distance: g.bounds.width - p.x }, { side: 'top', distance: p.y }, { side: 'bottom', distance: g.bounds.height - p.y }].sort((a, b) => a.distance - b.distance);
        if (m.wall || m.type !== 'teacher' && walls[0].distance < 36 && !event.altKey) {
          m.wall = walls[0].side; const v = ['left', 'right'].includes(m.wall);
          m.wallT = G.clamp((v ? p.y / g.bounds.height : p.x / g.bounds.width), 0, 1);
          if (m.wall !== o.wall) m.rotation = ['left', 'right'].includes(m.wall) ? 90 : 0;
          G.pinWall(m, g.bounds);
        } else {
          m.wall = null;
          if (!event.altKey) { if (Math.abs(m.x - g.bounds.width / 2) < 10) m.x = g.bounds.width / 2; if (Math.abs(m.y - g.bounds.height / 2) < 10) m.y = g.bounds.height / 2; }
        }
      } else if (d.kind === 'rotate') {
        const startAngle = Math.atan2(d.start.y - o.y, d.start.x - o.x), nextAngle = Math.atan2(p.y - o.y, p.x - o.x);
        let rotation = G.angle(o.rotation + (nextAngle - startAngle) * 180 / Math.PI);
        if (!event.altKey && Math.abs(rotation - Math.round(rotation / 90) * 90) < 6) rotation = G.angle(Math.round(rotation / 90) * 90);
        m.rotation = rotation; G.pinWall(m, g.bounds);
      } else {
        const rad = -o.rotation * Math.PI / 180, lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad);
        let w = o.width + (d.kind.includes('e') ? lx : d.kind.includes('w') ? -lx : 0);
        let h = o.height + (d.kind.includes('s') ? ly : d.kind.includes('n') ? -ly : 0);
        if (d.lock) { if (/[ew]/.test(d.kind)) h = w * o.height / o.width; else w = h * o.width / o.height; }
        m.width = G.clamp(w, 20, 4000); m.height = G.clamp(h, 20, 4000);
        const localX = (m.width - o.width) / 2 * (d.kind.includes('w') ? -1 : d.kind.includes('e') ? 1 : 0);
        const localY = (m.height - o.height) / 2 * (d.kind.includes('n') ? -1 : d.kind.includes('s') ? 1 : 0);
        const a = o.rotation * Math.PI / 180;
        m.x += localX * Math.cos(a) - localY * Math.sin(a); m.y += localX * Math.sin(a) + localY * Math.cos(a);
        G.pinWall(m, g.bounds);
      }
    }
    paint();
    const status = $('canvasStatus'); if (status) status.textContent = statusText(g);
  }
  function pointerUp(event) {
    touches.delete(event.pointerId);
    if (pinch) { pinch = null; return; }
    if (pan?.pointerId === event.pointerId) { pan = null; return; }
    if(objects){objects.up(point(event));if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);return;}
    if (!drag || event.pointerId !== drag.pointerId) return;
    const before = drag.before; drag = null;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    remember(before); render(read());
  }
  function keydown(event) {
    if (event.defaultPrevented) return;
    if (!editing || event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    if(finishing){if(event.key==='Escape')finishAbort?.abort();return;}
    if (event.code === 'Space' && !event.target.closest('button, [data-marker-id]')) { event.preventDefault(); space = true; paint(); return; }
    if (event.key === 'Tab') {
      const controls = [...workspace.querySelectorAll('button:not([disabled]), input, summary, [tabindex="0"]')].filter(e => e.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if(objects&&objects.key(event))return;
    if (event.key === 'Escape') { event.preventDefault(); if (drag) cancelDrag(); else selected = null; render(read()); return; }
    if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
      if (drag||objects?.dragging) { event.preventDefault(); cancelDrag(); render(read()); return; }
      event.preventDefault(); const a = event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo'; toolbar.querySelector(`[data-canvas-action="${a}"]`)?.click(); return;
    }
    if (!marker() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    mutate(g => { const m = marker(), step = event.shiftKey ? 10 : 1; m.wall = null; m.x += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0; m.y += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0; });
  }
  function statusText(g) {
    const outside = G.overflow(g);
    return outside.length ? say('有內容超出外框，請調整位置、加大外框或按「等比適配內容」。', 'Content outside room. Move objects, enlarge the room or fit content.') : selected === 'bounds' ? `${say('寬：高', 'Width : height')} ${Math.round(g.bounds.width)} : ${Math.round(g.bounds.height)} · ${say('比例單位，非公尺', 'Relative units, not meters')}` : selected === 'tables' ? say('拖曳桌組標籤、座位或通道把手；細部工具在屬性面板。', 'Drag table labels, seats or pathway handles. Detailed tools are in Properties.') : say('拖移位置；拉控制點改大小；拖圓形把手旋轉。', 'Drag to move; use handles to resize and the round handle to rotate.');
  }
  function handles(bounds = false) {
    const m = marker(), e = m ? G.extents(m) : null;
    const small = e && (m.width * camera.scale < 85 || m.height * camera.scale < 65);
    return (bounds ? ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] : small ? ['se'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']).map(h => `<span class="geometry-handle handle-${h}" data-geometry-handle="${h}" aria-hidden="true"></span>`).join('') + (bounds ? '' : '<span class="geometry-handle handle-rotate" data-geometry-handle="rotate" aria-hidden="true"></span>');
  }
  function paint() {
    const g = read().classroomGeometry;
    if(editing&&objects)SM.ui.renderSeatGrid(read(),false,'layout',null);
    document.body.classList.toggle('classroom-editing', editing);
    document.body.classList.toggle('classroom-table-editing', editing && selected === 'tables');
    root.classList.toggle('geometry-enabled', !!g); root.classList.toggle('geometry-editing', editing);
    root.classList.toggle('geometry-tables', editing && selected === 'tables');
    if (!g) {
      layer.innerHTML = ''; root.style.removeProperty('width'); root.style.removeProperty('max-width');
      root.querySelector('.grid-scroll').removeAttribute('style'); root.classList.remove('has-geometry-overflow'); return;
    }
    root.style.setProperty('aspect-ratio', `${g.bounds.width} / ${g.bounds.height}`);
    if (editing) {
      root.style.width = `${g.bounds.width}px`; root.style.height = `${g.bounds.height}px`;
      root.style.transformOrigin = '0 0'; root.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
      workspace.classList.toggle('properties-open', propertiesOpen); viewport.classList.toggle('pan-tool', panTool || space);
      toolbar.querySelector('[data-canvas-action="pan"]')?.setAttribute('aria-pressed', String(panTool));
      toolbar.querySelector('[data-canvas-action="select"]')?.setAttribute('aria-pressed', String(!panTool));
      viewport.dataset.scale = camera.scale; viewport.dataset.offsetX = camera.x; viewport.dataset.offsetY = camera.y;
      footer.innerHTML = button('zoom-out', '−', 'aria-label="Zoom out"') + `<output id="classroomZoom">${Math.round(camera.scale * 100)}%</output>` + button('zoom-in', '+', 'aria-label="Zoom in"') + button('zoom-fit', say('看全圖', 'Show whole room')) + button('zoom-selection', say('放大選取物件', 'Zoom to selection'), marker() || selected === 'bounds' ? '' : 'disabled') + button('properties', say('屬性', 'Properties'), `aria-expanded="${propertiesOpen}" aria-controls="classroomProperties"`);
      tableTools.hidden = !!objects || selected !== 'tables';workspace.dataset.busy=String(finishing);
      toolbar.querySelectorAll('button').forEach(b=>{if(finishing)b.disabled=true;});
      if(finishing)footer.insertAdjacentHTML('beforeend',button('cancel-finish',say('取消計算','Cancel calculation')));
    } else {
      selectionLayer.innerHTML = '';
      const parentStyle = getComputedStyle(root.parentElement);
      const availableWidth = root.parentElement.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight) - 6;
      const availableHeight = Math.max(220, Math.min(window.innerHeight, root.parentElement.clientHeight) - 150);
      root.style.width = `${Math.min(availableWidth, availableHeight * g.bounds.width / g.bounds.height) * zoom}px`;
      root.style.removeProperty('height'); root.style.removeProperty('transform');
    }
    root.style.maxWidth = 'none';
    const c = g.content, area = root.querySelector('.grid-scroll');
    Object.assign(area.style, { left: `${c.x / g.bounds.width * 100}%`, top: `${c.y / g.bounds.height * 100}%`, width: `${c.width / g.bounds.width * 100}%`, height: `${c.height / g.bounds.height * 100}%` });
    const grid = $('seatGrid');
    grid.style.setProperty('--rows', read().config.rows);
    if (read().roomLayout) { grid.style.aspectRatio = `${c.width} / ${c.height}`; grid.style.zoom = '1'; }
    const outside = G.overflow(g);
    root.classList.toggle('has-geometry-overflow', outside.length > 0);
    layer.innerHTML = g.markers.filter(m => m.visible).map(m => `<div class="canvas-marker marker-${m.type}${editing && selected === m.id ? ' geometry-selected' : ''}${outside.includes(m.id) ? ' geometry-outside' : ''}" data-marker-id="${m.id}" data-room-marker="${m.type}" role="${editing ? 'button' : 'img'}" tabindex="${editing ? '0' : '-1'}" aria-label="${names()[m.type]}" style="left:${m.x / g.bounds.width * 100}%;top:${m.y / g.bounds.height * 100}%;width:${m.width / g.bounds.width * 100}%;height:${m.height / g.bounds.height * 100}%;transform:translate(-50%,-50%) rotate(${m.rotation}deg)"><span style="transform:rotate(${-m.rotation}deg)">${names()[m.type]}</span></div>`).join('');
    if (editing) {
      const m = marker(), bounds = selected === 'bounds';
      if (m || bounds) {
        const p = C.toScreen(camera, m || { x: g.bounds.width / 2, y: g.bounds.height / 2 });
        selectionLayer.innerHTML = `<div class="canvas-selection ${bounds ? 'geometry-bounds-selection' : ''}" style="left:${p.x}px;top:${p.y}px;width:${(m?.width || g.bounds.width) * camera.scale}px;height:${(m?.height || g.bounds.height) * camera.scale}px;transform:translate(-50%,-50%) rotate(${m?.rotation || 0}deg)">${handles(bounds)}</div>`;
      } else selectionLayer.innerHTML = '';
      viewport.classList.toggle('low-detail', camera.scale < 0.5);
      root.style.setProperty('--editor-camera-scale', camera.scale);
      if(objects)objects.overlay(selectionLayer,camera);
    }
  }
  function render(state) {
    if (!root) return;
    if(state.layoutCheck&&state.layoutCheck.signature!==SM.layoutPlanner.signature(state))state.layoutCheck=null;
    if (owner !== state) { stop(); owner = state; zoom = 1; }
    if (document.body.classList.contains('presentation-mode')) { stop(); zoom = 1; }
    const lock = $('canvasLock')?.checked || false;
    const preciseOpen = panel.querySelector('.canvas-precise')?.open || false;
    $('classroomEditorShortcut').textContent = say('在教室圖上調整形狀與標記', 'Edit room shape and markers on canvas');
    toolbar.innerHTML = button(editing ? 'done' : 'edit', editing ? say('完成編輯', 'Done editing') : say('編輯教室', 'Edit classroom')) +
      (editing ? button('select', say('選取', 'Select'), `aria-pressed="${!panTool}"`) + button('pan', say('移動畫面', 'Pan view'), `aria-pressed="${panTool}"`) + ['board', 'door', 'teacher', 'bounds', ...(state.roomLayout?.tables.length ? ['tables'] : [])].map(type => button(type, type === 'tables' ? say('選取桌組', 'Select table') : names()[type], selected === type ? 'aria-pressed="true"' : 'aria-pressed="false"')).join('') + button('undo', say('復原', 'Undo'), history.canUndo() ? '' : 'disabled') + button('redo', say('重做', 'Redo'), history.canRedo() ? '' : 'disabled') : button('zoom-out', '−', 'aria-label="Zoom out"') + button('zoom-fit', say('符合畫面', 'Fit view')) + button('zoom-in', '+', 'aria-label="Zoom in"'));
    panel.hidden = !editing;
    if (editing) {
      const g = state.classroomGeometry, m = marker(), b = selected === 'bounds', item = b ? g.bounds : m;
      const field = (key, label) => `<label>${label}<input type="number" data-geometry-value="${key}" aria-label="${label}" value="${Math.round(item[key] * 10) / 10}" step="1" ${key === 'rotation' ? 'min="0" max="359"' : key === 'width' || key === 'height' ? `min="${b ? 300 : 20}" max="4000"` : ''}></label>`;
      panel.innerHTML = (item ? `<strong>${names()[selected]||names()[m?.type]}</strong> ` + (m ? button('left', '↶ 90°') + button('right', '↷ 90°') + button('hide', say('隱藏', 'Hide')) + (['board','door','teacher'].includes(selected)?button('reset', say('重設此標記', 'Reset marker')):'') + `<label><input id="canvasWall" type="checkbox" ${m.wall ? 'checked' : ''}>${say('貼牆', 'Attach to wall')}</label>` : ['4:3', '16:9', '1:1', '3:4'].map(r => button('ratio-' + r, r)).join('')) + `<label><input id="canvasLock" type="checkbox" ${lock ? 'checked' : ''}>${say('鎖定比例', 'Lock ratio')}</label><details class="canvas-precise"><summary>${say('精確設定', 'Precise settings')}</summary><div>${(m ? field('x', 'X') + field('y', 'Y') : '') + field('width', say('寬', 'Width')) + field('height', say('高', 'Height')) + (m ? field('rotation', say('角度', 'Angle')) : '')}</div></details>` : '') +
        button('fit', say('等比適配內容', 'Fit content proportionally')) + `<p id="canvasStatus" role="status" tabindex="-1" class="${G.overflow(g).length ? 'is-error' : ''}">${statusText(g)}</p>`;
    }
    if(editing&&objects){
      toolbar.insertAdjacentHTML('beforeend','<button type="button" class="button button-secondary" data-drawing-action="select-all">全選物件</button>');
      toolbar.insertAdjacentHTML('beforeend','<button type="button" class="button button-secondary" data-drawing-action="add-table">＋ 方桌</button><button type="button" class="button button-secondary" data-drawing-action="add-round">＋ 圓桌</button><button type="button" class="button button-secondary" data-drawing-action="add-u">＋ U 型桌</button><button type="button" class="button button-secondary" data-drawing-action="add-seat">＋ 座位</button><button type="button" class="button button-secondary" data-drawing-action="add-path">＋ 通道</button>'+button('close-editor',say('稍後繼續','Continue later')));
      if(selected!=='bounds'&&!marker())panel.innerHTML=objects.inspector()+button('fit',say('等比適配內容','Fit content proportionally'))+'<p id="canvasStatus" role="status" tabindex="-1"></p>';
      else panel.insertAdjacentHTML('beforeend','<div class="drawing-extra-tools">'+objects.inspector()+'</div>');
    }
    if (panel.querySelector('.canvas-precise')) panel.querySelector('.canvas-precise').open = preciseOpen;
    if (editing && selected === 'bounds') {
      const ratio = document.createElement('div'); ratio.className = 'canvas-ratio-fields';
      ratio.innerHTML = `<strong>${say('教室形狀長寬比', 'Room shape ratio')}</strong><label>${say('寬', 'Width')}<input id="canvasRatioWidth" type="number" min="0.1" step="0.1" value="${Math.round(state.classroomGeometry.bounds.width)}"></label><span>:</span><label>${say('高', 'Height')}<input id="canvasRatioHeight" type="number" min="0.1" step="0.1" value="${Math.round(state.classroomGeometry.bounds.height)}"></label>${button('ratio-custom', say('套用長寬比', 'Apply room ratio'))}<small>${say('改變教室形狀；不會改變觀看倍率。', 'Changes the room shape, not the view zoom.')}</small>`;
      panel.prepend(ratio);
    }
    paint();
  }
  SM.classroomEditor = { init, render, stop, get editing() { return editing; }, get view() { return { ...camera }; }, get dragging() { return !!drag||!!objects?.dragging; },get savingState(){return objects?.stable?G.clone(objects.stable):null;}, get savingGeometry() { return drag ? G.clone(drag.before) : null; } };
})();
