(function () {
  "use strict";
  const SeatMaster = window.SeatMaster;

  // One cancellable timeline for both seat draws and student draws.
  function run(options) {
    const { sound } = SeatMaster;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = new Set();
    let revealed = false;
    let cancelled = false;
    const later = (fn, delay) => {
      const timer = window.setTimeout(() => { timers.delete(timer); if (!cancelled) fn(); }, delay);
      timers.add(timer);
    };
    const clear = () => { timers.forEach(window.clearTimeout); timers.clear(); };
    const reveal = () => {
      if (cancelled || revealed) return;
      revealed = true;
      clear();
      sound.stop();
      options.onStage("reveal");
      options.onReveal();
      sound.playReveal();
      later(() => options.onFinish(), reduced ? 0 : 850);
    };
    sound.unlock();
    sound.stop();
    sound.playLaunch();
    if (reduced) later(reveal, 120);
    else {
      [3, 2, 1].forEach((number, index) => later(() => { options.onStage("countdown", number); sound.playCount(number); }, index * 650));
      later(() => {
        options.onStage("rolling");
        sound.playDrumRoll(2.2);
        let tick = 0;
        const roll = () => {
          if (revealed || cancelled) return;
          options.onTick(tick);
          if (tick % 2 === 0) sound.playTick(tick / 2);
          tick += 1;
          later(roll, 65 + Math.min(150, tick * tick * 0.4));
        };
        roll();
      }, 1950);
      later(reveal, 4250);
    }
    return { reveal, cancel() { cancelled = true; clear(); sound.stop(); } };
  }

  function celebrate(layer) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ffd166", "#ef8968", "#7fe0c1", "#b5b1ff", "#fff4d6"];
    layer.innerHTML = Array.from({ length: 70 }, (_, index) => `<i style="--left:${Math.random() * 100}%;--drift:${Math.random() * 240 - 120}px;--delay:${Math.random() * 0.35}s;--duration:${1.6 + Math.random()}s;--color:${colors[index % colors.length]}"></i>`).join("");
    layer.classList.remove("is-active");
    void layer.offsetWidth;
    layer.classList.add("is-active");
  }

  SeatMaster.effects = { run, celebrate };
})();
