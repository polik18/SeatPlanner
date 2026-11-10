(function () {
  'use strict';
  const SM = window.SeatMaster;
  const $ = id => document.getElementById(id);
  const t = (...args) => SM.i18n.t(...args);
  let getState;
  const priorityGuideKey = 'seatplanner:priority-guide:v1';
  let priorityGuideSeen = false, priorityGuideStep = 0, priorityGuideFocus;
  const guideSay = (zh, en) => SM.i18n.getLanguage() === 'en' ? en : zh;
  function renderPriorityGuide() {
    const steps = [
      [guideSay('先保留一個適合的位置', 'Reserve a suitable seat'), guideSay('在「預排個別座位」模式，點選教室中的座位，為需要優先安排的學生保留位置。', 'In Preassign individual seats mode, click a classroom seat to reserve a suitable place for a student.')],
      [guideSay('選擇學生，確認預排', 'Choose a student and confirm'), guideSay('從選單選擇學生，再按「套用」。座位會顯示預排標記；需要調整時，再點同一座位即可更換或取消。', 'Choose a student from the list and click Apply. A private marker identifies the reserved seat. Click it again to change or remove the preassignment.')],
      [guideSay('保留預排，再讓全班抽位', 'Keep reserved seats when drawing'), guideSay('完成後開始展示並抽位，系統會保留預排位置，再安排其餘學生。展示不公開預排標記與分開規則；易干擾同儕可在下方另設分開安排。', 'Start presentation and draw seats. Reserved places stay assigned while the remaining students are seated. Presentations hide preassignment markers and separation rules. Set peer separation below when needed.')]
    ];
    const [title, text] = steps[priorityGuideStep], esc = SM.ui.escapeHtml;
    $('priorityGuideTitle').textContent = title;
    $('priorityGuideText').textContent = text;
    $('priorityGuideProgress').textContent = `${String(priorityGuideStep + 1).padStart(2, '0')} / 03`;
    $('priorityGuidePrevious').hidden = priorityGuideStep === 0;
    $('priorityGuidePrevious').textContent = guideSay('上一步', 'Back');
    $('priorityGuideNext').textContent = priorityGuideStep === 2 ? guideSay('開始預排個別座位', 'Start preassigning seats') : guideSay('下一步', 'Next');
    $('priorityGuideClose').textContent = guideSay('略過介紹', 'Skip introduction');
    $('priorityGuideScene').dataset.scene = priorityGuideStep;
    $('priorityGuideScene').innerHTML = `<div class="priority-demo-board">${esc(guideSay('黑板', 'Board'))}</div><div class="priority-demo-grid">${Array.from({length:6},(_,i)=>`<div class="priority-demo-seat ${i===1?'priority-demo-chosen':''}">${i===1?'<span class="priority-demo-person">07</span><span class="priority-demo-pin">✓</span>':String(i+1).padStart(2,'0')}</div>`).join('')}</div><div class="priority-demo-cursor" aria-hidden="true">↖</div><div class="priority-demo-select"><span>${esc(guideSay('選擇學生', 'Choose a student'))}</span><strong>07 · ${esc(guideSay('學生', 'Student'))}</strong><span class="priority-demo-confirm">${esc(guideSay('套用', 'Apply'))} ✓</span></div><span class="priority-demo-badge">${esc(guideSay('展示隱藏預排標記', 'Private markers stay hidden'))}</span>`;
  }
  function showPriorityGuide(force = false) {
    if (!force) {
      try { priorityGuideSeen ||= localStorage.getItem(priorityGuideKey) === 'seen'; } catch (_) {}
      if (priorityGuideSeen) return;
    }
    if ($('priorityGuideDialog').open) return;
    priorityGuideFocus = document.activeElement;
    priorityGuideStep = 0; renderPriorityGuide();
    $('priorityGuideDialog').showModal(); $('priorityGuideNext').focus();
  }
  function initPriorityGuide() {
    const dialog = document.createElement('dialog');
    dialog.id = 'priorityGuideDialog'; dialog.className = 'priority-guide';
    dialog.setAttribute('aria-labelledby', 'priorityGuideTitle');
    dialog.setAttribute('aria-describedby', 'priorityGuideText');
    dialog.innerHTML = '<div class="priority-guide-top"><span class="step-label">SEATPLANNER INCLUSIVE</span><span id="priorityGuideProgress"></span></div><div id="priorityGuideScene" class="priority-guide-scene" aria-hidden="true"></div><div class="priority-guide-copy" aria-live="polite"><h2 id="priorityGuideTitle"></h2><p id="priorityGuideText"></p></div><div class="priority-guide-actions"><button id="priorityGuideClose" class="text-button" type="button"></button><button id="priorityGuidePrevious" class="button button-secondary" type="button"></button><button id="priorityGuideNext" class="button button-primary" type="button"></button></div>';
    document.body.append(dialog);
    $('priorityGuideNext').addEventListener('click', () => {
      if (priorityGuideStep === 2) dialog.close();
      else { priorityGuideStep++; renderPriorityGuide(); }
    });
    $('priorityGuidePrevious').addEventListener('click', () => { priorityGuideStep = Math.max(0, priorityGuideStep - 1); renderPriorityGuide(); });
    $('priorityGuideClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      priorityGuideSeen = true;
      try { localStorage.setItem(priorityGuideKey, 'seen'); } catch (_) {}
      if (priorityGuideFocus?.isConnected) priorityGuideFocus.focus({preventScroll:true});
    });
    const replay = document.createElement('button'); replay.type = 'button'; replay.id = 'priorityGuideReplay'; replay.className = 'text-button';
    const translate = () => { replay.textContent = guideSay('觀看預排個別座位介紹', 'Watch the seat preassignment guide'); if (dialog.open) renderPriorityGuide(); };
    replay.addEventListener('click', () => showPriorityGuide(true));
    $('separationPanel').prepend(replay); translate();
    window.addEventListener('seatmaster:languagechange', translate);
  }
  const selectors = { class: '#classSelector', room: '#gridDimensions', priority: '[data-admin-mode="prearrange"]', separation: '#separationTitle', seat: '#manualStartButton', share: '#exportButton' };
  function initSeatScrollHint() {
    const grid = $('seatGrid'), hint = document.createElement('button');
    hint.type = 'button'; hint.id = 'seatScrollHint'; hint.className = 'seat-scroll-hint'; hint.hidden = true;
    hint.setAttribute('aria-controls', 'seatGrid');
    hint.innerHTML = '<span class="seat-scroll-copy"><strong></strong><small></small></span><span class="seat-scroll-arrow" aria-hidden="true">↓</span>';
    document.body.append(hint);
    const translate = () => {
      hint.querySelector('strong').textContent = guideSay('座位表在下方', 'Your seating chart is below');
      hint.querySelector('small').textContent = guideSay('往下捲動，或點這裡查看', 'Scroll down or tap to view');
    };
    let frame;
    function update() {
      frame = null;
      const bounds = grid.getBoundingClientRect();
      const visible = !document.querySelector('dialog[open]') &&
        !document.body.matches('.presentation-mode, .classroom-editing, .manual-mode, .tour-active, .welcome-active') &&
        grid.getClientRects().length > 0 && bounds.height > 0 && bounds.top >= innerHeight - 100;
      if (hint.hidden === visible) hint.hidden = !visible;
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(update); }
    hint.addEventListener('click', () => {
      grid.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('calm-mode') ? 'instant' : 'smooth' });
      grid.setAttribute('tabindex', '-1'); grid.focus({ preventScroll: true });
    });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('seatmaster:languagechange', () => { translate(); schedule(); });
    new ResizeObserver(schedule).observe(document.body);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'open', 'hidden'] });
    translate(); schedule();
  }
  function initIntroCollapse() {
    const intro = $('workflowIntro'), body = $('workflowIntroBody'), summary = intro.querySelector('summary');
    let timer, animation, automatic = true;
    function stopAnimation() {
      if (animation) { const current = animation; animation = null; current.cancel(); }
      intro.classList.remove('is-closing');
    }
    function collapse() {
      if (!intro.open || animation) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('calm-mode')) { intro.open = false; return; }
      intro.classList.add('is-closing');
      animation = body.animate([
        { height: `${body.getBoundingClientRect().height}px`, opacity: 1, transform: 'translateY(0)', overflow: 'hidden' },
        { height: '0px', opacity: 0, transform: 'translateY(-8px)', overflow: 'hidden' }
      ], { duration: 600, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
      animation.onfinish = () => { intro.open = false; stopAnimation(); };
    }
    function schedule() {
      clearTimeout(timer);
      if (!automatic || !intro.open) return;
      if (document.hidden || document.querySelector('dialog[open]') || intro.contains(document.activeElement)) {
        timer = setTimeout(schedule, 200); return;
      }
      timer = setTimeout(() => {
        if (document.hidden || document.querySelector('dialog[open]') || intro.contains(document.activeElement)) schedule();
        else { automatic = false; collapse(); }
      }, 3000);
    }
    summary.addEventListener('click', event => {
      event.preventDefault(); automatic = false; clearTimeout(timer);
      if (animation) { stopAnimation(); return; }
      if (intro.open) collapse(); else intro.open = true;
    });
    intro.addEventListener('focusin', () => { clearTimeout(timer); stopAnimation(); });
    intro.addEventListener('focusout', () => { if (automatic) timer = setTimeout(schedule, 0); });
    intro.addEventListener('pointerdown', event => {
      if (event.target.closest('summary') === summary) return;
      automatic = false; clearTimeout(timer); stopAnimation();
    });
    schedule();
  }
  function reveal(element) {
    let parent = element;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
  }
  function go(key) {
    const target = document.querySelector(selectors[key]);
    if (!target) return;
    if (key === 'separation') { $('separationDetails').open = true; target.tabIndex = 0; }
    reveal(target);
    if (key === 'priority') target.click();
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    target.focus({ preventScroll: true });
    document.querySelectorAll('[data-workflow]').forEach(button => button.setAttribute('aria-current', button.dataset.workflow === key ? 'step' : 'false'));
  }
  function render(state) {
    const students = SM.engine.buildStudents(state.config).length;
    const seats = state.seats.filter(seat => seat.type !== 'aisle').length;
    const pins = state.seats.filter(seat => seat.pin).length;
    $('workflowStudents').textContent = t('workflow.students', { count: students });
    $('workflowSeats').textContent = t('workflow.capacity', { count: seats });
    $('workflowPins').textContent = t('workflow.pins', { count: pins });
    $('workflowResult').textContent = t(state.hasDrawn ? 'workflow.done' : 'workflow.pending');
  }
  function downloadChart() {
    const state = getState();
    const chart = {
      format: 'seatplanner-reduced-chart', version: 1,
      seats: state.seats.filter(seat => seat.type !== 'aisle').map(seat => ({ id: seat.id, row: seat.row, col: seat.col, number: state.hasDrawn ? state.assignment[seat.id] ?? null : null })),
      tables: state.roomLayout?.tables.map(table => ({ type: table.type, x: table.x, y: table.y, width: table.width, height: table.height, rotation: table.rotation, seatIds: table.seatIds, seatPositions: table.seatPositions })) || []
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'SeatPlanner-Inclusive-share-chart.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function init(readState) {
    getState = readState;
    initPriorityGuide();
    initIntroCollapse();
    const card = document.querySelector('.workflow-card');
    const stage = document.querySelector('.classroom-stage');
    const placeCard = () => {
      if (window.matchMedia('(max-width: 980px)').matches) $('workflowMobileSlot').append(card);
      else stage.prepend(card);
    };
    window.addEventListener('resize', placeCard); placeCard();
    initSeatScrollHint();
    document.querySelectorAll('[data-workflow]').forEach(button => button.addEventListener('click', () => {
      go(button.dataset.workflow);
      if (button.dataset.workflow === 'priority' && button.closest('.workflow-steps')) showPriorityGuide();
    }));
    for (const selector of ['.gender-patterns', '.room-marker-settings', '.layout-rotation']) {
      const element = document.querySelector(selector);
      if (!element) continue;
      const details = document.createElement('details'); details.className = 'advanced-settings';
      const summary = document.createElement('summary'); summary.dataset.i18n = 'workflow.advanced'; summary.textContent = t('workflow.advanced');
      element.before(details); details.append(summary, element);
    }
    $('shareChartButton').addEventListener('click', downloadChart);
    $('observationButton').addEventListener('click', () => $('observationDialog').showModal());
    $('observationClose').addEventListener('click', () => $('observationDialog').close());
    $('observationPrint').addEventListener('click', () => window.print());
    for (const [id, className] of [['calmButton', 'calm-mode'], ['contrastButton', 'high-contrast']]) $(id).addEventListener('click', () => {
      const active = document.body.classList.toggle(className); $(id).setAttribute('aria-pressed', String(active));
      if (className === 'calm-mode' && active) SM.sound.setEnabled(false);
    });
    SM.i18n.apply();
  }
  SM.workflow = { init, render, reveal, go };
})();
