/* 网约车物语 — runtime / helpers / hooks */
/* HTML 线上入口加载 dist/wycwy-app.bundle.js;修改 src/app 后运行 scripts/build-entry-assets.mjs。 */
const { useState, useReducer, useEffect, useRef, useMemo } = React;

/* ============== 8-bit 音效引擎 ============== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let __audioCtx = null;
let __muted = localStorage.getItem('wycwy-muted') === '1';
let __audioUnlocked = false;
const SFX_FILES = { coin: 'assets/audio/coin-pickup.wav' };
const __sfxAudio = {};
let __lastCoinSfxAt = 0;
function getAudio() { if (!AudioCtx) return null; if (!__audioCtx) __audioCtx = new AudioCtx(); return __audioCtx; }
function getSfxAudio(name) {
  if (!SFX_FILES[name]) return null;
  if (!__sfxAudio[name]) {
    const audio = new Audio(SFX_FILES[name]);
    audio.preload = 'auto';
    __sfxAudio[name] = audio;
  }
  return __sfxAudio[name];
}
function unlockAudio() {
  if (__muted) return;
  const ctx = getAudio();
  if (!ctx) return;
  const markReady = () => {
    __audioUnlocked = true;
    Object.keys(SFX_FILES).forEach((name) => getSfxAudio(name)?.load());
  };
  if (ctx.state === 'suspended') {
    ctx.resume().then(markReady).catch(() => {});
  } else {
    markReady();
  }
}
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);
function beep({ freq = 440, duration = 0.08, type = 'square', volume = 0.04 }) {
  if (__muted || !AudioCtx || !__audioUnlocked) return;
  try {
    const ctx = getAudio();
    if (!ctx || ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {}
}
function playSfxFile(name, { volume = 0.42, cooldown = 0 } = {}) {
  if (__muted || !__audioUnlocked) return false;
  try {
    const now = performance.now();
    if (cooldown && name === 'coin' && now - __lastCoinSfxAt < cooldown) return true;
    const base = getSfxAudio(name);
    if (!base) return false;
    const audio = base.cloneNode(true);
    audio.volume = volume;
    audio.currentTime = 0;
    const playing = audio.play();
    if (playing?.catch) playing.catch(() => {});
    if (name === 'coin') __lastCoinSfxAt = now;
    return true;
  } catch (e) {
    return false;
  }
}
const SFX = {
  click: () => beep({ freq: 660, duration: 0.04, volume: 0.03 }),
  takeOrder: () => beep({ freq: 880, duration: 0.06, volume: 0.04 }),
  complete: ({ speed = 1 } = {}) => {
    const fast = speed >= 8;
    const volume = fast ? 0.18 : speed >= 4 ? 0.26 : 0.34;
    const cooldown = fast ? 560 : speed >= 4 ? 440 : 260;
    if (playSfxFile('coin', { volume, cooldown })) return;
    if (performance.now() - __lastCoinSfxAt < cooldown) return;
    __lastCoinSfxAt = performance.now();
    beep({ freq: 1047, duration: 0.035, type: 'triangle', volume: fast ? 0.018 : 0.032 });
    setTimeout(() => beep({ freq: 1568, duration: 0.035, type: 'triangle', volume: fast ? 0.016 : 0.028 }), 36);
    setTimeout(() => beep({ freq: 2093, duration: 0.045, type: 'square', volume: fast ? 0.012 : 0.02 }), 76);
  },
  train: () => {
    beep({ freq: 660, duration: 0.05 });
    setTimeout(() => beep({ freq: 880, duration: 0.05 }), 60);
    setTimeout(() => beep({ freq: 1320, duration: 0.1 }), 120);
  },
  mission: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.12, volume: 0.07 }), i * 80)
    );
  },
  // V14.9: SFX.achievement 已删除 — 全项目无调用方,V14 删 ACHIEVEMENTS 系统后失去意义
  buy: () => {
    beep({ freq: 440, duration: 0.05, type: 'sawtooth' });
    setTimeout(() => beep({ freq: 660, duration: 0.08, type: 'sawtooth' }), 70);
  },
  warn: () => beep({ freq: 220, duration: 0.15, type: 'sawtooth', volume: 0.05 }),
};
function setMuted(v) {
  __muted = v;
  localStorage.setItem('wycwy-muted', v ? '1' : '0');
  if (!v) unlockAudio();
}
function isMuted() { return __muted; }

function getDriverRoleLabel(driver) {
  return driver?.bgName || '';
}
function getDriverTierLabel(driver) {
  return RARITY_META[driver?.rarity]?.name || '';
}
function getDriverMetaLine(driver, extra = '') {
  return [getDriverTierLabel(driver), getDriverRoleLabel(driver), extra].filter(Boolean).join(' · ');
}

/* ============== 数字滚动 hook ============== */
function useCountUp(target, duration = 400) {
  const [val, setVal] = useState(target);
  const ref = useRef({ from: target, to: target, start: 0 });
  useEffect(() => {
    if (val === target) return;
    ref.current = { from: val, to: target, start: performance.now() };
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - ref.current.start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = Math.round(ref.current.from + (ref.current.to - ref.current.from) * eased);
      setVal(cur);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return val;
}
const D = window.WYCWY_DATA;
const E = window.WYCWY_ENGINE;
const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, TRAININGS, MISSIONS, ENDINGS, PLAYER_STORIES, RECRUIT_TICKETS, RARITY_META, RARITY_STAT_CAPS } = D;

/* ============== 占位元素(后续可替换为图片素材) ============== */
