// WHITEOUT — every sound is synthesised with WebAudio: no audio files, no network.
// Footsteps crunch (filtered noise), guards tick nearby, alerts sting, pickups blip,
// the storm is a wind loop whose gain follows the gust, and winning plays a little
// arpeggio. The context is created on the first user gesture, so it never blocks load.
export function createAudio() {
  let context = null;
  let windGain = null;
  let windSource = null;
  let muted = false;
  let lastGuardTick = 0;

  function ensureContext() {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    // Looping wind: two seconds of white noise through a low bandpass, gain driven
    // by the storm; it starts quiet and the game turns it up during gusts.
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0.015;
    windSource = context.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windSource.connect(filter);
    filter.connect(windGain);
    windGain.connect(context.destination);
    windSource.start();
    return context;
  }

  /** Call from any user gesture (key, click) so the context is allowed to start. */
  function unlock() {
    const ctx = ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noiseBurst(duration, filterFrequency, volume, when = 0) {
    if (muted) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = context.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (windGain) windGain.gain.value = muted ? 0 : 0.015;
      return muted;
    },
    /** Wind gain follows the storm: 0.015 calm, 0.12 in a full gust. */
    setStorm(amount) {
      if (!windGain || muted) return;
      windGain.gain.setTargetAtTime(0.015 + amount * 0.105, context.currentTime, 0.4);
    },
    footstep(running) {
      noiseBurst(0.07, running ? 1400 : 900, running ? 0.16 : 0.09);
    },
    /** A guard's step: a soft tick whose volume the caller scales by distance. */
    guardStep(volume) {
      if (volume <= 0.01) return;
      noiseBurst(0.05, 700, volume);
    },
    /** Called every frame with the nearest guard's distance; ticks when close. */
    guardProximity(distance) {
      if (muted) return;
      const now = performance.now();
      if (distance > 260 || now - lastGuardTick < 520) return;
      lastGuardTick = now;
      this.guardStep(0.12 * (1 - distance / 260));
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.2);
      tone(990, 0.18, 'sine', 0.18, 0.08);
    },
    alert() {
      tone(220, 0.22, 'sawtooth', 0.16);
      tone(311, 0.3, 'sawtooth', 0.16, 0.16);
    },
    spotted() {
      tone(880, 0.1, 'square', 0.1);
      tone(1174, 0.14, 'square', 0.1, 0.09);
    },
    caught() {
      tone(196, 0.5, 'sawtooth', 0.2);
      tone(147, 0.7, 'sawtooth', 0.2, 0.25);
    },
    exitUnlocked() {
      tone(523, 0.14, 'sine', 0.2);
      tone(784, 0.2, 'sine', 0.2, 0.12);
    },
    levelClear() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone(frequency, 0.22, 'triangle', 0.2, index * 0.11);
      });
    },
    gameWin() {
      [523, 659, 784, 1046, 1318].forEach((frequency, index) => {
        tone(frequency, 0.3, 'triangle', 0.2, index * 0.13);
      });
    },
  };
}
