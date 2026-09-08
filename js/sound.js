(function () {
  "use strict";

  const SeatMaster = (window.SeatMaster = window.SeatMaster || {});
  const SOUND_KEY = "classroom-seat-master:sound-enabled";
  let context = null;
  let master = null;
  const voices = new Set();
  let enabled = localStorage.getItem(SOUND_KEY) !== "false";

  function ensureContext() {
    if (!enabled) return null;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
    }
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function tone(frequency, delay, duration, volume, type, endFrequency) {
    const audio = ensureContext();
    if (!audio) return;
    const start = audio.currentTime + (delay || 0);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.08, start + Math.min(0.025, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    voices.add(oscillator);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function playLaunch() {
    if (!enabled) return;
    ensureContext();
    tone(180, 0, 0.28, 0.11, "sine", 360);
    tone(270, 0.12, 0.32, 0.07, "triangle", 540);
    tone(420, 0.28, 0.3, 0.05, "sine", 760);
  }

  function playTick(index) {
    if (!enabled) return;
    const notes = [620, 700, 780, 860];
    tone(notes[index % notes.length], 0, 0.045, 0.045, "triangle");
  }

  function playCount(number) {
    if (!enabled) return;
    const frequency = number === "GO" ? 740 : 360 + Number(number) * 65;
    tone(frequency, 0, number === "GO" ? 0.2 : 0.1, 0.1, "sine", number === "GO" ? 1040 : null);
  }

  function playReveal() {
    if (!enabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(frequency, index * 0.075, 0.48 - index * 0.035, 0.105 - index * 0.01, index < 2 ? "triangle" : "sine");
    });
    tone(1568, 0.34, 0.45, 0.045, "sine", 2093);
    [261.63, 329.63, 392].forEach((frequency) => tone(frequency, 0.3, 1.1, 0.08, "triangle"));
    [1046.5, 1318.5, 1568, 2093].forEach((frequency, index) => tone(frequency, 0.65 + index * 0.09, 0.35, 0.055, "sine"));
  }

  function percussion(delay, duration, volume) {
    const audio = ensureContext();
    if (!audio) return;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 900;
    const start = audio.currentTime + delay;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start); source.stop(start + duration);
  }

  function playDrumRoll(duration) {
    if (!enabled) return;
    for (let time = 0; time < duration; time += 0.15 - 0.1 * (time / duration)) {
      percussion(time, 0.1, 0.12 + 0.12 * time / duration);
      tone(100, time, 0.08, 0.07, "sine", 45);
    }
    tone(180, 0, duration, 0.035, "triangle", 720);
  }

  function stop() {
    voices.forEach((voice) => { try { voice.stop(); } catch (_) { /* Already ended. */ } });
    voices.clear();
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    localStorage.setItem(SOUND_KEY, String(enabled));
    if (master) master.gain.setValueAtTime(enabled ? 0.18 : 0, context.currentTime);
    if (!enabled) stop();
    if (enabled) {
      ensureContext();
      tone(660, 0, 0.08, 0.06, "sine");
      tone(880, 0.07, 0.1, 0.05, "sine");
    }
    return enabled;
  }

  SeatMaster.sound = {
    isEnabled: () => enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
    unlock: ensureContext,
    playLaunch,
    playTick,
    playCount,
    playReveal,
    playDrumRoll,
    stop
  };
})();
