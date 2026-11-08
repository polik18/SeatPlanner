(function () {
  'use strict';
  const SM = window.SeatMaster;
  const $ = id => document.getElementById(id);
  const t = (...args) => SM.i18n.t(...args);
  const store = SM.onboardingStorage;
  let metadata = store.defaults(), previousFocus, step = 0, target, initialized = false;
  const steps = [
    ['class', '#classSelector'], ['room', '#classroomEditorShortcut'], ['priority', '[data-admin-mode="prearrange"]'],
    ['seat', '#manualStartButton'], ['share', '#exportButton']
  ];
  function persist() {
    if (!store.write(metadata).ok) { $('tutorialStorageNotice').hidden = false; $('tutorialStorageNotice').textContent = t('tour.storageError'); }
  }
  function clearTarget() { target?.classList.remove('tour-target'); target = null; }
  function close(restoreFocus = true) {
    clearTarget();
    if ($('welcomeDialog').open) $('welcomeDialog').close();
    if ($('tourDialog').open) $('tourDialog').close();
    $('tourPanel').hidden = true;
    document.body.classList.remove('tour-active', 'welcome-active');
    if (restoreFocus) {
      if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
      else $('tutorialButton').focus({ preventScroll: true });
    }
  }
  function skip() { metadata.dismissed = true; metadata.tourVersionSeen = 1; persist(); close(); }
  function showWelcome() {
    if ($('tourPanel').hidden && !$('welcomeDialog').open) previousFocus = document.activeElement;
    close(false);
    $('welcomeError').hidden = true;
    document.body.classList.add('welcome-active');
    $('welcomeDialog').showModal();
    $('welcomeStart').focus();
  }
  function showStep(index) {
    const direction = index < step ? -1 : 1;
    clearTarget(); step = index;
    if ($('welcomeDialog').open) $('welcomeDialog').close();
    document.body.classList.remove('welcome-active');
    document.body.classList.add('tour-active');
    $('tourPanel').hidden = false;
    if (!$('tourDialog').open) $('tourDialog').showModal();
    const [key, selector] = steps[step];
    $('tourProgress').textContent = t('tour.progress', { step: step + 1 });
    $('tourTitle').textContent = t('tour.' + key);
    $('tourText').textContent = t('tour.' + key + 'Text');
    $('tourNext').textContent = t(step === steps.length - 1 ? 'tour.finish' : 'tour.next');
    $('tourMeterFill').style.width = `${(step + 1) / steps.length * 100}%`;
    $('tourSteps').innerHTML = steps.map(([name], i) => `<button type="button" data-tour-step="${i}" aria-label="${SM.ui.escapeHtml(t('tour.' + name))}" aria-current="${i === step ? 'step' : 'false'}"><span>${String(i + 1).padStart(2, '0')}</span></button>`).join('');
    $('tourScene').dataset.step = key;
    $('tourScene').innerHTML = `<div class="demo-window"><div class="demo-window-top"><i></i><i></i><i></i><span>SeatPlanner</span></div><div class="demo-roster"><span>01 <b>○ ○ ○</b><em>✓</em></span><span>02 <b>○ ○ ○</b><em>✓</em></span><span>03 <b>○ ○ ○</b><em>✓</em></span></div><div class="demo-room"><div class="demo-board"></div><div class="demo-seats">${Array.from({length: 9}, (_, i) => `<span style="--demo-index:${i}">${String(i + 1).padStart(2, '0')}</span>`).join('')}</div><span class="demo-room-handle"></span><span class="demo-pin">✓</span></div><div class="demo-share">↗<span>JSON</span></div></div><span class="demo-caption">${SM.ui.escapeHtml(t('intro.' + key + 'Caption'))}</span>`;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('calm-mode')) {
      const body = $('tourDialog').querySelector('.tour-body');
      body.getAnimations().forEach(animation => animation.cancel());
      body.animate([{ opacity: 0, transform: `translateX(${direction * 18}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    target = document.querySelector(selector);
    if (target?.hidden) target = document.querySelector('.room-template-tools > strong');
    if (target) {
      SM.workflow?.reveal(target);
      target.classList.add('tour-target');
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    $('tourNext').focus({ preventScroll: true });
  }
  function complete() {
    metadata.completed = true; metadata.tourVersionSeen = 1; persist(); close(false);
    $('readyDialog').showModal();
  }
  function markMeaningfulActivity() {
    if (!initialized) return;
    if (!metadata.hasUserActivity) { metadata.hasUserActivity = true; persist(); }
    close(false);
  }
  function startIfNeeded({ initialWorkspaceSnapshot }) {
    const result = store.read(); metadata = result.value; initialized = true;
    if (!result.ok) { $('tutorialStorageNotice').hidden = false; $('tutorialStorageNotice').textContent = t('tour.storageError'); }
    if (store.meaningful(initialWorkspaceSnapshot)) { metadata.hasUserActivity = true; persist(); }
    if (store.shouldShow(metadata, initialWorkspaceSnapshot)) showWelcome();
  }
  function initCarousel() {
    const carousel = $('welcomeCarousel'), slides = [...carousel.querySelectorAll('.welcome-art')], dots = [...carousel.querySelectorAll('[data-slide]')];
    let index = 0, paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches, timer;
    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => { slide.hidden = i !== index; });
      dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));
    }
    function schedule() {
      clearInterval(timer);
      if (!paused && $('welcomeDialog').open && !document.hidden && !carousel.matches(':hover') && !carousel.contains(document.activeElement)) timer = setInterval(() => show(index + 1), 6000);
    }
    dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); schedule(); }));
    $('carouselPrevious').addEventListener('click', () => { show(index - 1); schedule(); });
    $('carouselNext').addEventListener('click', () => { show(index + 1); schedule(); });
    function updatePause() { $('carouselPause').setAttribute('aria-pressed', String(paused)); $('carouselPause').textContent = paused ? '▶' : 'Ⅱ'; $('carouselPause').setAttribute('aria-label', paused ? '播放 / Play' : '暫停 / Pause'); }
    updatePause();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
      paused = event.matches; updatePause(); schedule();
      if (event.matches) $('tourDialog').querySelector('.tour-body').getAnimations().forEach(animation => animation.cancel());
    });
    $('carouselPause').addEventListener('click', () => { paused = !paused; updatePause(); schedule(); });
    carousel.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); show(index + (event.key === 'ArrowRight' ? 1 : -1)); schedule(); } });
    carousel.addEventListener('mouseenter', schedule);
    carousel.addEventListener('mouseleave', schedule);
    carousel.addEventListener('focusin', schedule);
    carousel.addEventListener('focusout', () => setTimeout(schedule, 0));
    let touchX;
    carousel.addEventListener('touchstart', event => { touchX = event.changedTouches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', event => { const delta = event.changedTouches[0].clientX - touchX; if (Math.abs(delta) > 50) { show(index + (delta < 0 ? 1 : -1)); schedule(); } }, { passive: true });
    new MutationObserver(schedule).observe($('welcomeDialog'), { attributes: true, attributeFilter: ['open'] });
    document.addEventListener('visibilitychange', schedule);
  }
  function init() {
    initCarousel();
    $('welcomeStart').addEventListener('click', () => showStep(0));
    $('welcomeSkip').addEventListener('click', skip);
    $('welcomeDialog').addEventListener('cancel', event => { event.preventDefault(); skip(); });
    $('tourDialog').addEventListener('cancel', event => { event.preventDefault(); skip(); });
    $('tourClose').addEventListener('click', skip);
    $('tourSteps').addEventListener('click', event => { const button = event.target.closest('[data-tour-step]'); if (button) showStep(Number(button.dataset.tourStep)); });
    $('tourTry').addEventListener('click', () => {
      const key = steps[step][0]; metadata.dismissed = true; persist(); close(false);
      if (key === 'room') $('classroomEditorShortcut').click();
      else { SM.workflow?.go(key); if (key === 'class') $('classNameInput').focus(); }
    });
    $('welcomeDialog').addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...$('welcomeDialog').querySelectorAll('button:not([disabled]), input:not([hidden]), select, a[href]')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    $('welcomeImport').addEventListener('click', () => $('importFileInput').click());
    $('tutorialButton').addEventListener('click', showWelcome);
    $('tourSkip').addEventListener('click', skip);
    $('tourPrevious').addEventListener('click', () => step > 0 ? showStep(step - 1) : showWelcome());
    $('tourNext').addEventListener('click', () => step < steps.length - 1 ? showStep(step + 1) : complete());
    $('readyCreate').addEventListener('click', () => { $('readyDialog').close(); SM.workflow?.go('class'); $('classNameInput').focus(); });
    $('tourDialog').addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const controls = [...$('tourDialog').querySelectorAll('button:not([disabled])')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener('seatmaster:languagechange', () => { if (!$('tourPanel').hidden) showStep(step); });
  }
  function reportImportError(message) {
    if (!$('welcomeDialog').open) return;
    $('welcomeError').hidden = false; $('welcomeError').textContent = message;
  }
  SM.onboarding = { init, startIfNeeded, markMeaningfulActivity, showWelcome, close, reportImportError, reset: () => { store.reset(); metadata = store.defaults(); showWelcome(); } };
})();
