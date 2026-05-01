/* 网约车物语 — runtime / helpers / hooks(V14.93 反向拆分入口文件) */
/* HTML 是 106 行薄壳,用 <script type="text/babel" src="src/app/*.jsx"> 加载本文件及其同级文件。 */
/* 修改本文件后直接刷新浏览器(http:// 协议) — 不需要构建步骤,Babel standalone 在浏览器内编译。 */
const { useState, useReducer, useEffect, useRef, useMemo } = React;

/* ============== 8-bit 音效引擎 ============== */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let __audioCtx = null;
let __muted = localStorage.getItem('wycwy-muted') === '1';
let __audioUnlocked = false;
function getAudio() { if (!AudioCtx) return null; if (!__audioCtx) __audioCtx = new AudioCtx(); return __audioCtx; }
function unlockAudio() {
  if (__muted) return;
  const ctx = getAudio();
  if (!ctx) return;
  const markReady = () => { __audioUnlocked = true; };
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
const SFX = {
  click: () => beep({ freq: 660, duration: 0.04, volume: 0.03 }),
  takeOrder: () => beep({ freq: 880, duration: 0.06, volume: 0.04 }),
  complete: () => {
    beep({ freq: 880, duration: 0.05 });
    setTimeout(() => beep({ freq: 1320, duration: 0.08 }), 50);
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
const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, TRAININGS, MISSIONS, ENDINGS, RECRUIT_TICKETS, RARITY_META, RARITY_STAT_CAPS } = D;

/* ============== 占位元素(后续可替换为图片素材) ============== */

