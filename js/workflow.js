(function () {
  'use strict';
  const SM = window.SeatMaster;
  const $ = id => document.getElementById(id);
  const t = (...args) => SM.i18n.t(...args);
  let getState;
  const selectors = { class: '#classSelector', room: '#gridDimensions', priority: '[data-admin-mode="prearrange"]', separation: '#separationTitle', seat: '#manualStartButton', share: '#exportButton' };
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
    const card = document.querySelector('.workflow-card');
    const stage = document.querySelector('.classroom-stage');
    const placeCard = () => {
      if (window.matchMedia('(max-width: 980px)').matches) $('workflowMobileSlot').append(card);
      else stage.prepend(card);
    };
    window.addEventListener('resize', placeCard); placeCard();
    document.querySelectorAll('[data-workflow]').forEach(button => button.addEventListener('click', () => go(button.dataset.workflow)));
    // Keep advanced tools in the existing DOM so all original features survive.
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
