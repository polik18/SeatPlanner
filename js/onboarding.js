(function () {
  'use strict';
  const SM = window.SeatMaster;
  const $ = id => document.getElementById(id);
  const t = (...args) => SM.i18n.t(...args);
  const store = SM.onboardingStorage;
  let metadata = store.defaults(), previousFocus, step = 0, target, initialized = false;
  const steps = [
    ['class', '#classSelector'], ['room', '#gridDimensions'], ['priority', '[data-admin-mode="prearrange"]'],
    ['seat', '#manualStartButton'], ['share', '#exportButton']
  ];
  function persist() {
    if (!store.write(metadata).ok) { $('tutorialStorageNotice').hidden = false; $('tutorialStorageNotice').textContent = t('tour.storageError'); }
  }
  function clearTarget() { target?.classList.remove('tour-target'); target = null; }
  function close(restoreFocus = true) {
    clearTarget();
    if ($('welcomeDialog').open) $('welcomeDialog').close();
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
    clearTarget(); step = index;
    if ($('welcomeDialog').open) $('welcomeDialog').close();
    document.body.classList.remove('welcome-active');
    document.body.classList.add('tour-active');
    $('tourPanel').hidden = false;
    const [key, selector] = steps[step];
    $('tourProgress').textContent = t('tour.progress', { step: step + 1 });
    $('tourTitle').textContent = t('tour.' + key);
    $('tourText').textContent = t('tour.' + key + 'Text');
    $('tourNext').textContent = t(step === steps.length - 1 ? 'tour.finish' : 'tour.next');
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
  function init() {
    $('welcomeStart').addEventListener('click', () => showStep(0));
    $('welcomeSkip').addEventListener('click', skip);
    $('welcomeDialog').addEventListener('cancel', event => { event.preventDefault(); skip(); });
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
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('tourPanel').hidden) { event.preventDefault(); skip(); } });
    window.addEventListener('seatmaster:languagechange', () => { if (!$('tourPanel').hidden) showStep(step); });
  }
  function reportImportError(message) {
    if (!$('welcomeDialog').open) return;
    $('welcomeError').hidden = false; $('welcomeError').textContent = message;
  }
  SM.onboarding = { init, startIfNeeded, markMeaningfulActivity, showWelcome, close, reportImportError, reset: () => { store.reset(); metadata = store.defaults(); showWelcome(); } };
})();
