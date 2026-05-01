/* 网约车物语 V9 - React 组件源码 */
/* 修改本文件后运行 `node scripts/build-html.mjs`,同步到可双击运行的 HTML。 */
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
  achievement: () => {
    [880, 1100].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.15, volume: 0.05 }), i * 100)
    );
  },
  buy: () => {
    beep({ freq: 440, duration: 0.05, type: 'sawtooth' });
    setTimeout(() => beep({ freq: 660, duration: 0.08, type: 'sawtooth' }), 70);
  },
  warn: () => beep({ freq: 220, duration: 0.15, type: 'sawtooth', volume: 0.05 }),
  // V7: 司机晋升升阶音 — 三频递进,克制版,不抢戏
  rankUp: () => {
    [660, 880, 1320].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.1, volume: 0.05 }), i * 70)
    );
  },
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
const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, TRAININGS, RANKS, MISSIONS, ENDINGS, RECRUIT_TICKETS, RARITY_META, RARITY_STAT_CAPS } = D;

/* ============== 占位元素(后续可替换为图片素材) ============== */

function DriverAvatar({ avatar, size = 36, name = '?' }) {
  const bg = avatar?.hatColor || '#FF6B35';
  const hat = avatar?.hat || 'default';
  return (
    <div className="ph-avatar" data-asset={`avatar-${avatar?.hat || 'default'}`}
      style={{ width: size, height: size, background: bg, color: '#fff', fontSize: Math.round(size * 0.42) }}>
      <span className={`avatar-hat avatar-hat-${hat}`} />
      <span className="avatar-face" />
      <span className="avatar-eye left" />
      <span className="avatar-eye right" />
      <span className="avatar-mouth" />
    </div>
  );
}

function VehicleIcon({ template, size = 60 }) {
  if (!template) return null;
  const labelMap = { santana: 'S', camry: 'C', han_ev: 'EV', odyssey: 'M', benz_e: 'E' };
  return (
    <div className={`ph-vehicle vehicle-${template.id}`} data-asset={`vehicle-${template.id}`}
      style={{ width: size * 1.32, height: size * 0.62, background: template.color, color: '#fff',
        fontSize: Math.max(10, Math.round(size * 0.20)) }}>
      <span className="vehicle-window front" />
      <span className="vehicle-window rear" />
      <span className="vehicle-badge">{labelMap[template.id] || template.name.slice(0, 1)}</span>
      <span className="vehicle-wheel left" />
      <span className="vehicle-wheel right" />
    </div>
  );
}

function OrderIcon({ orderId, color, size = 14 }) {
  return <span className="ph-order-dot" data-asset={`order-${orderId}`}
    style={{ width: size, height: size, background: color || '#FF6B35' }} />;
}

function StatIcon({ stat, color, size = 12 }) {
  return <span className="ph-stat" data-asset={`stat-${stat}`}
    style={{ width: size, height: size, background: color || '#FF6B35' }} />;
}

/* ============== 通用组件 ============== */

function StatBars({ stats, compact, caps }) {
  const items = [
    { key: 'driving', label: '驾驶', short: '驾', color: '#FF6B35' },
    { key: 'service', label: '服务', short: '服', color: '#0EA5E9' },
    { key: 'road', label: '路感', short: '路', color: '#10B981' },
    { key: 'mind', label: '心力', short: '心', color: '#8B5CF6' },
  ];
  return (
    <div className={`stat-bars ${compact ? 'compact' : ''}`}>
      {items.map((it) => (
        <div key={it.key} className={`stat-bar-row ${caps ? 'with-cap' : ''}`}>
          <span className="stat-bar-label" style={{color: it.color}}>{compact ? it.short : it.label}</span>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{width: `${Math.min(100, stats[it.key])}%`, background: it.color}} />
            {caps && <span className="stat-cap-marker" style={{left: `${Math.min(100, caps[it.key] || 99)}%`}} />}
          </div>
          <span className="stat-bar-num">{caps ? `${stats[it.key]}/${caps[it.key] || 99}` : stats[it.key]}</span>
        </div>
      ))}
    </div>
  );
}

function Clock24({ hour }) {
  const isDay = hour >= 6 && hour < 19;
  const timeText = `${String(hour).padStart(2, '0')}:00`;
  return (
    <div className={`ph-clock ${isDay ? 'day' : 'night'}`} data-asset="clock" title={`当前时间 ${timeText}`}>
      <span className="clock-time">{timeText}</span>
    </div>
  );
}

const CITY_MAP_IMAGE = 'assets/maps/city-map-clean-v1.png';

function CityMap({ zones, zoneHeat, drivers, state, selectedZoneId, onSelectZone }) {
  return (
    <svg viewBox="0 0 100 100" className="city-map-svg" preserveAspectRatio="none">
      <image
        className="city-map-bg"
        href={CITY_MAP_IMAGE}
        x="0"
        y="0"
        width="100"
        height="100"
        preserveAspectRatio="none"
        aria-hidden="true"
      />
      {zones.map((z) => {
        const heat = zoneHeat[z.id] || 0.3;
        const unlocked = !state || !E.isZoneUnlocked ? true : E.isZoneUnlocked(state, z);
        const points = (z.shape || []).map((p) => p.join(',')).join(' ');
        const unlockText = state && E.getZoneUnlockText ? E.getZoneUnlockText(state, z) : '';
        return (
          <g
            key={z.id}
            className={`district ${unlocked ? 'unlocked' : 'locked'} ${selectedZoneId === z.id ? 'selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`查看${z.name}${unlocked ? '' : `, ${unlockText}`}`}
            onClick={() => onSelectZone && onSelectZone(z.id)}
            onKeyDown={(e) => {
              if (!onSelectZone) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectZone(z.id);
              }
            }}
          >
            <title>{`${z.name} · ${unlocked ? z.desc : unlockText}`}</title>
            {points ? (
              <polygon
                points={points}
                fill={unlocked ? z.color : '#64748B'}
                opacity={unlocked ? '0.12' : '0.62'}
              />
            ) : (
              <circle cx={z.x} cy={z.y} r={8 + heat * 7} fill={unlocked ? z.color : '#64748B'} opacity={unlocked ? '0.12' : '0.62'} />
            )}
            <circle cx={z.x} cy={z.y} r={unlocked ? 3.2 : 2.5} fill={unlocked ? z.color : '#8B7D64'} stroke="#FFF8E7" strokeWidth="1" />
            <text className="district-name" x={z.x} y={z.y - 6.5} fontSize="3.4" textAnchor="middle" fontWeight="800">{z.name}</text>
            <text className="district-stat" x={z.x} y={z.y + 1.4} fontSize="2.5" textAnchor="middle" fontWeight="800">{unlocked ? Math.round(heat * 100) : '锁'}</text>
            {!unlocked && (
              <text className="district-lock-text" x={z.x} y={z.y + 7.2} fontSize="2.3" textAnchor="middle" fontWeight="700">{unlockText.replace('解锁: ', '')}</text>
            )}
          </g>
        );
      })}
      {drivers.filter((d) => d.status === 'driving').map((d, i) => {
        const order = d.currentOrder;
        if (!order) return null;
        const zone = zones.find((z) => z.id === order.zone);
        if (!zone) return null;
        const progress = (order.totalHours - order.remainHours) / order.totalHours;
        const angle = progress * Math.PI * 2 + i;
        const r = 6;
        const x = zone.x + Math.cos(angle) * r;
        const y = zone.y + Math.sin(angle) * r;
        return (
          <g key={d.id} className="city-car" style={{animationDelay: `${-i * 0.25}s`}}>
            <rect x={x - 3.2} y={y - 1.6} width="6.4" height="3.2" rx="0.8" fill={order.color || '#FF6B35'} stroke="#2A2320" strokeWidth="0.5" />
            <circle cx={x - 1.9} cy={y + 1.8} r="0.7" fill="#2A2320" />
            <circle cx={x + 1.9} cy={y + 1.8} r="0.7" fill="#2A2320" />
            <text x={x} y={y - 3.7} fontSize="2.2" fill="#2A2320" textAnchor="middle" fontWeight="800">{d.name.slice(0, 1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function CityOrderLayer({ offers, zones, drivers = [] }) {
  const zonePresence = drivers.reduce((acc, driver) => {
    const runningZone = driver.status === 'driving' && driver.currentOrder?.zone;
    const zoneId = runningZone;
    if (!zoneId) return acc;
    if (!acc[zoneId]) acc[zoneId] = { running: 0, total: 0 };
    if (runningZone) acc[zoneId].running += 1;
    acc[zoneId].total += 1;
    return acc;
  }, {});
  const hasPresence = Object.keys(zonePresence).length > 0;
  if ((!offers || offers.length === 0) && !hasPresence) {
    return null;
  }
  const zoneCards = zones
    .map((zone) => {
      const zoneOffers = (offers || []).filter((offer) => offer.zoneId === zone.id);
      const presence = zonePresence[zone.id] || { running: 0, total: 0 };
      if (zoneOffers.length === 0 && presence.total === 0) return null;
      const heat = zoneOffers.length ? Math.max(...zoneOffers.map((offer) => offer.heat || 0)) : presence.total;
      return { zone, offers: zoneOffers, heat, presence };
    })
    .filter(Boolean);
  return (
    <div className="city-order-layer">
      {zoneCards.map(({ zone, offers: zoneOffers, heat, presence }, idx) => {
      const jitterX = ((idx % 2) * 2 - 1) * 4;
      const jitterY = (Math.floor(idx / 2) % 2 === 0 ? -1 : 1) * 4;
      const orderNames = zoneOffers.map((offer) => offer.orderName);
      if (presence.total > 0) {
          const label = '运营中';
          return (
            <div
              key={`${zone.id}-busy`}
              className="zone-busy-badge"
              style={{
                left: `${Math.max(8, Math.min(84, zone.x + 5))}%`,
                top: `${Math.max(10, Math.min(84, zone.y - 9))}%`,
                borderColor: zone.color || primary.color,
              }}
              title={`${zone.name} 有 ${presence.total} 名司机运营中`}
            >
              <span>{label}</span>
              <strong>{presence.total}</strong>
            </div>
          );
        }
        return (
          <div
            key={`${zone.id}-heat`}
            className="zone-busy-badge zone-heat-badge"
            style={{
              left: `${Math.max(8, Math.min(78, zone.x + jitterX))}%`,
              top: `${Math.max(10, Math.min(78, zone.y + jitterY))}%`,
              borderColor: zone.color,
            }}
            title={`${zone.name} 当前热点: ${orderNames.join(' / ')}`}
          >
            <span>热点</span>
            <strong>{heat}</strong>
          </div>
        );
      })}
    </div>
  );
}

/* ============== V10.6: 左侧目标板 ============== */

function MissionBar({ state, onOpenRoadmap }) {
  const idx = state.currentMissionIdx;
  if (idx >= MISSIONS.length) {
    return (
      <div className="mission-bar objective-card finale">
        <div className="mb-head">
          <span className="mb-tag" style={{background: 'var(--gold)'}}>已通关</span>
          <span className="mb-kicker">主线目标</span>
        </div>
        <div className="mb-content">
          <div className="mb-title">所有任务完成 — 你是真大佬</div>
          <div className="mb-action">继续运营累积资金,或重开一周目挑战更高目标</div>
          <div className="mb-footer">
            <div className="mission-stepbar" aria-label="主线任务进度">
              {MISSIONS.map((_, stepIdx) => <span key={stepIdx} className="done" />)}
            </div>
            {onOpenRoadmap && (
              <button className="mb-roadmap-btn" onClick={onOpenRoadmap}>
                <span>目标路线</span>
                <span className="mb-roadmap-btn-arrow">→</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  const m = MISSIONS[idx];
  return (
    <div className="mission-bar objective-card">
      <div className="mb-head">
        <span className="mb-tag">任务 {idx + 1}/{MISSIONS.length}</span>
        <span className="mb-kicker">当前动作</span>
      </div>
      <div className="mb-content">
        <div className="mb-title">{m.title}</div>
        <div className="mb-action">{m.desc}</div>
        <div className="mb-hint">{m.hint}</div>
        <div className="mb-footer">
          <div className="mission-stepbar" aria-label="主线任务进度">
            {MISSIONS.map((_, stepIdx) => (
              <span key={stepIdx} className={stepIdx <= idx ? 'done' : ''} />
            ))}
          </div>
          {onOpenRoadmap && (
            <button className="mb-roadmap-btn" onClick={onOpenRoadmap}>
              <span>目标路线</span>
              <span className="mb-roadmap-btn-arrow">→</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== V3: 顶栏 ============== */

function TopBar({ state, fundsDisplay, repDisplay, muted, onToggleMute, crtOn, onToggleCrt }) {
  const currentTier = state.unlockedEndingTier || 0;
  const tierEnding = ENDINGS.find((e) => e.tier === currentTier);
  const tierName = tierEnding ? tierEnding.name : '初创期';
  const hourText = `${String(state.hour).padStart(2, '0')}:00`;
  const dayProgress = Math.round((state.hour / 24) * 100);
  const topStats = [
    { label: '资金', value: `¥${(fundsDisplay ?? state.funds).toLocaleString()}`, cls: 'accent' },
    { label: '口碑', value: repDisplay ?? state.reputation, cls: 'green' },
  ];
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>网约车物语 <span className="v">V10.16</span></h1>
        <div className="run-status" aria-label="游戏时间">
          <div className="game-time-chip" title={`第 ${state.day} 日 ${hourText} · ${tierName}`}>
            <div className="game-time-main">
              <span>第 {state.day} 日</span>
              <strong>{hourText}</strong>
            </div>
            <div className="game-time-sub">{tierName} · 今日进度 {dayProgress}%</div>
            <div className="game-time-bar"><span style={{width: `${dayProgress}%`}} /></div>
          </div>
        </div>
      </div>
      <div className="topbar-stats">
        <div className="topbar-kpis" aria-label="经营状态">
          {topStats.map((item) => (
            <div className="ts-stat topbar-stat" key={item.label}>
              <span className="ts-label">{item.label}</span>
              <strong className={`ts-value ${item.cls}`}>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="topbar-settings" aria-label="设置">
          <button className={`toggle-btn ${muted ? '' : 'on'}`} onClick={onToggleMute} title={muted ? '已静音' : '音效开'}>
            {muted ? '静' : '音'}
          </button>
          <button className={`toggle-btn ${crtOn ? 'on' : ''}`} onClick={onToggleCrt} title={crtOn ? '复古滤镜开' : '关'}>
            CRT
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomHUD({ state, dispatch, onOpenLog }) {
  const currentTier = state.unlockedEndingTier || 0;
  const tierEnding = ENDINGS.find((e) => e.tier === currentTier);
  const latestLog = state.log[0];
  return (
    <div className="bottom-hud">
      <div className="hud-controls">
        <button className="hud-log-btn" onClick={onOpenLog} title="查看事件日志" aria-label="查看事件日志">
          <span className="hud-log-head">
            <b>事件日志</b>
            <em>查看</em>
          </span>
          <strong>{latestLog ? latestLog.text : '暂无事件'}</strong>
        </button>
        <div className="run-control-group">
        <div className="speed-controls">
          <button
            className={`speed-btn play-toggle ${state.paused || (!state.paused && state.speed === 1) ? 'active' : ''}`}
            onClick={() => {
              SFX.click();
              dispatch(state.paused ? {type: 'SET_SPEED', speed: 1} : {type: 'TOGGLE_PAUSE'});
            }}
            title={state.paused ? '以 1 倍速开始运营' : `暂停运营,当前 ${state.speed} 倍速`}
            aria-label={state.paused ? '以 1 倍速开始运营' : `暂停运营,当前 ${state.speed} 倍速`}
            aria-pressed={!state.paused}
          >
            {state.paused || state.speed === 1 ? `1×${state.paused ? '开始' : '暂停'}` : '暂停'}
          </button>
          {[2, 4, 8].map((speed) => (
            <button
              key={speed}
              className={`speed-btn ${!state.paused && state.speed === speed ? 'active' : ''}`}
              onClick={() => { SFX.click(); dispatch({type: 'SET_SPEED', speed}); }}
              title={`${speed}倍速`}
              aria-label={`${speed}倍速`}
              aria-pressed={!state.paused && state.speed === speed}
            >
              {speed}×
            </button>
          ))}
        </div>
        {currentTier > 0 && (
          <button className="btn btn-primary btn-sm hud-end-btn" onClick={() => { if (confirm(`以《${tierEnding.name}》结局结束游戏?`)) dispatch({type: 'CONCEDE'}); }}>
            结束运营
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

/* ============== V10.16: 车组卡 ============== */

function getDriverWorkState(driver, vehicle) {
  if (!vehicle) return '未配车';
  if (E.isDriverResting(driver)) return '休息中';
  return '等待接单';
}

function getVehicleOrderSummary(vd) {
  return `可接 ${vd.eligible.length} 类订单${vd.unlock > 0 ? ` · 口碑 ${vd.unlock} 解锁` : ' · 开局可用'}`;
}

function CrewCompact({ driver, vehicle, selected, linked, onClick, floatGains, rankUp }) {
  const rank = E.computeRank(driver);
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const status = getDriverWorkState(driver, vehicle);
  const lightClass = E.isDriverResting(driver) ? 'tired'
    : !vehicle ? 'empty' : 'idle';
  const statCaps = driver.statCaps || E.computeStatCaps(driver);
  const topStats = ['driving', 'service', 'road', 'mind']
    .map((key) => ({ key, val: driver.stats[key], cap: statCaps[key] || 99 }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 2);
  const statShort = { driving: '驾', service: '服', road: '路', mind: '心' };
  const myGain = (floatGains || []).find((g) => g.driverId === driver.id);
  const particles = myGain
    ? [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const dist = 30 + Math.random() * 16;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 12,
          delay: i * 30,
        };
      })
    : null;
  return (
    <div className={`compact-card crew-card ${selected ? 'selected' : ''} ${linked ? 'linked' : ''} ${myGain ? 'just-paid' : ''} ${rankUp ? 'rank-up-flash' : ''}`} onClick={onClick}>
      <div className="crew-pair-icons" aria-hidden="true">
        <DriverAvatar avatar={driver.avatar} size={34} name={driver.name} />
        {vd ? <VehicleIcon template={vd} size={30} /> : <div className="crew-no-vehicle">无车</div>}
      </div>
      <div className="cc-info crew-info">
        <div className="crew-title">
          <span>{driver.name}</span>
          <em>×</em>
          <span>{vd ? vd.name : '未配车'}</span>
        </div>
        <div className="cc-sub">{driver.bgName} · {status}</div>
        <div className="crew-stat-chips">
          {topStats.map((s) => (
            <span key={s.key}>{statShort[s.key]} {s.val}/{s.cap}</span>
          ))}
        </div>
      </div>
      <div className="crew-side">
        <span className={`cc-status-light ${lightClass}`} title={status} />
        <span className="cc-badge" style={{background: rank.color + '22', color: rank.color}}>{rank.name}</span>
      </div>
      {myGain && <div key={myGain.id} className="float-gain">+¥{myGain.amount}</div>}
      {particles && particles.map((p, i) => (
        <div key={`p${myGain.id}-${i}`} className="coin-particle" style={{
          top: 18, left: 24,
          '--dx': `${p.dx}px`, '--dy': `${p.dy}px`,
          animationDelay: `${p.delay}ms`,
        }} />
      ))}
    </div>
  );
}

function FleetPanel({
  state,
  selectedDriverId,
  selectedVehicleId,
  selectedVehicle,
  selectedDriver,
  rankUpDriverIds,
  onSelectDriver,
  onSelectVehicle,
  onClearSelection,
  onRecruit,
  onShop,
}) {
  const [tab, setTab] = useState('crews');
  const drivers = state.drivers;
  const vehicles = state.vehicles;
  const unassignedDrivers = drivers.filter((d) => !d.vehicleId);
  const emptyVehicles = vehicles.filter((v) => !drivers.some((d) => d.vehicleId === v.id));
  const operatingCrews = drivers.filter((d) => d.vehicleId && vehicles.some((v) => v.id === d.vehicleId)).length;
  const pendingCount = unassignedDrivers.length + emptyVehicles.length;
  const sortedDrivers = [...drivers].sort((a, b) => {
    const av = a.vehicleId ? 1 : 0;
    const bv = b.vehicleId ? 1 : 0;
    if (av !== bv) return bv - av;
    return a.id - b.id;
  });
  const hasFleetIssue = unassignedDrivers.length > 0 || emptyVehicles.length > 0;
  const issueSummary = [
    unassignedDrivers.length ? `${unassignedDrivers.length} 名司机未配车` : '',
    emptyVehicles.length ? `${emptyVehicles.length} 辆车空闲` : '',
  ].filter(Boolean).join(' · ');
  const actions = [
    ...unassignedDrivers.map((d) => ({ type: 'driver', level: 'warn', title: `${d.name} 未配车`, text: '先给他分配车辆,否则不能接单。', id: `d-${d.id}`, driver: d })),
    ...emptyVehicles.map((v) => ({ type: 'vehicle', level: 'info', title: `${E.getVehicleData(v).name} 空闲`, text: '可以分配给未配车司机。', id: `v-${v.id}`, vehicle: v })),
  ];
  const visibleFloatGains = [];
  return (
    <div className="panel panel-tight fleet-panel">
      <MissionBar state={state} />
      <div className="panel-header fleet-panel-header">
        <span className="panel-title">车队</span>
        <div className="fleet-actions">
          <button className="btn btn-ghost btn-xs" onClick={onRecruit}>+ 招募</button>
          <button className="btn btn-ghost btn-xs" onClick={onShop}>+ 买车</button>
        </div>
        <div className="fleet-status-line">
          <span>{operatingCrews} 车组</span>
          {pendingCount > 0 && <span>{pendingCount} 待处理</span>}
          <span>点击司机训练/配车</span>
        </div>
      </div>
      <div className="fleet-summary-grid">
        <div><span>车组</span><strong>{operatingCrews}</strong></div>
        <div><span>待配对</span><strong>{pendingCount}</strong></div>
      </div>
      {hasFleetIssue && (
        <button className="fleet-issue-banner" onClick={() => setTab('pending')}>
          <span className="fleet-action-dot" />
          <strong>{issueSummary}</strong>
          <em>点这里处理配车关系</em>
        </button>
      )}
      <div className="fleet-tabs crew-tabs">
        <button className={tab === 'crews' ? 'active' : ''} onClick={() => setTab('crews')}>车组</button>
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>待配对</button>
      </div>
      <div className="compact-list fleet-list">
        {tab === 'crews' && sortedDrivers.map((d) => {
          const vehicle = vehicles.find((v) => v.id === d.vehicleId);
          return (
            <CrewCompact
              key={d.id}
              driver={d}
              vehicle={vehicle}
              selected={selectedDriverId === d.id || (selectedVehicle ? d.vehicleId === selectedVehicle.id : false)}
              linked={selectedVehicle ? d.vehicleId === selectedVehicle.id : false}
              rankUp={rankUpDriverIds.has(d.id)}
              floatGains={visibleFloatGains}
              onClick={() => onSelectDriver(d.id)}
            />
          );
        })}
        {tab === 'pending' && (
          actions.length === 0 ? (
            <div className="fleet-empty">
              <strong>车组已全部配对</strong>
              <span>有车的司机会自动从城市片区里接单。</span>
            </div>
          ) : (
            actions.slice(0, 12).map((item) => (
              <button
                key={item.id}
                className={`fleet-action-row ${item.level}`}
                onClick={() => item.driver ? onSelectDriver(item.driver.id) : onSelectVehicle(item.vehicle.id)}
              >
                <span className="fleet-action-dot" />
                <span>
                  <strong>{item.title}</strong>
                  <em>{item.text}</em>
                </span>
              </button>
            ))
          )
        )}
      </div>
    </div>
  );
}

/* ============== V3: 司机抽屉 ============== */

function DriverDrawer({ driver, vehicles, drivers, dispatch, funds, onClose, onSwitchToVehicle }) {
  if (!driver) return null;
  const rank = E.computeRank(driver);
  const vehicle = vehicles.find((v) => v.id === driver.vehicleId);
  const vd = vehicle ? E.getVehicleData(vehicle) : null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <DriverAvatar avatar={driver.avatar} size={48} name={driver.name} />
          <div className="drawer-header-info">
            <div className="drawer-header-title">{driver.name}</div>
            <div className="drawer-header-sub">
              {driver.bgName} · <span style={{color: rank.color, fontWeight: 700}}>{rank.name}</span>
              {' · 月薪 ¥' + driver.salary}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <div className="drawer-section-title">能力属性</div>
            <StatBars stats={driver.stats} caps={driver.statCaps || E.computeStatCaps(driver)} />
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">培训(花钱提升属性)</div>
            {TRAININGS.map((t) => {
              const cur = driver.stats[t.stat];
              const statCaps = driver.statCaps || E.computeStatCaps(driver);
              const limit = statCaps[t.stat] || 99;
              const expected = Math.min(limit, cur + Math.round((t.gainMin + t.gainMax) / 2));
              const enough = funds >= t.cost;
              return (
                <div key={t.id} className="drawer-train-row">
                  <div className="drawer-train-head">
                    <StatIcon stat={t.stat} color={t.color} size={12} />
                    <span className="drawer-train-name">{t.name}</span>
                    <span className="drawer-train-cost">¥{t.cost}</span>
                  </div>
                  <div className="drawer-train-preview">
                    <span>{E.statName(t.stat)}</span>
                    <span className="drawer-train-num">{cur}</span>
                    <span style={{color: 'var(--ink-3)'}}>→</span>
                    <span className="drawer-train-after" style={{color: t.color}}>~{expected}</span>
                  </div>
                  <button className="btn btn-primary btn-xs btn-block"
                    disabled={!enough || cur >= limit}
                    onClick={() => dispatch({type: 'TRAIN', driverId: driver.id, trainingId: t.id})}>
                    {cur >= limit ? `已到上限 ${limit}` : enough ? `训练 +${t.gainMin}~${t.gainMax}` : '资金不足'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">驾驶车辆</div>
            <div className="vehicle-assign-row">
              {vd ? (
                <>
                  <VehicleIcon template={vd} size={36} />
                  <span className="vehicle-assign-current">
                    <strong>{vd.name}</strong> · {getVehicleOrderSummary(vd)}
                  </span>
                  <button className="btn btn-ghost btn-xs" onClick={() => onSwitchToVehicle(vehicle.id)}>查看车辆</button>
                </>
              ) : (
                <span className="vehicle-assign-current" style={{color: 'var(--accent)'}}>
                  未配车 — 在车辆栏点一辆给他
                </span>
              )}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">个人统计</div>
            <div className="drawer-train-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
              <div><div style={{fontSize: 14, color: 'var(--ink-3)'}}>累计单数</div><div style={{fontWeight: 800, fontSize: 18}}>{driver.completedOrders}</div></div>
              <div><div style={{fontSize: 14, color: 'var(--ink-3)'}}>累计赚得</div><div style={{fontWeight: 800, fontSize: 18, color: 'var(--accent)'}}>¥{driver.totalEarned}</div></div>
              <div><div style={{fontSize: 14, color: 'var(--ink-3)'}}>评分</div><div style={{fontWeight: 800, fontSize: 18, color: 'var(--green)'}}>{(driver.rating || 4.5).toFixed(1)}</div></div>
            </div>
          </div>

          {drivers.length > 1 && (
            <div className="drawer-section">
              <button className="btn btn-ghost btn-xs btn-block" style={{color: 'var(--warn)'}}
                onClick={() => {
                  if (confirm(`确定让 ${driver.name} 离开车队?`)) {
                    dispatch({type: 'FIRE_DRIVER', driverId: driver.id});
                    onClose();
                  }
                }}>
                解雇 {driver.name}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ============== V3: 车辆抽屉 ============== */

function VehicleDrawer({ vehicle, drivers, dispatch, funds, state, onClose, onSwitchToDriver }) {
  if (!vehicle) return null;
  const vd = E.getVehicleData(vehicle);
  const driver = drivers.find((d) => d.vehicleId === vehicle.id);
  const freeDrivers = drivers.filter((d) => !d.vehicleId);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <VehicleIcon template={vd} size={50} />
          <div className="drawer-header-info">
            <div className="drawer-header-title">{vd.name}</div>
            <div className="drawer-header-sub">
              {getVehicleOrderSummary(vd)}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">
          <div className="drawer-section">
            <div className="drawer-section-title">驾驶员</div>
            <div className="vehicle-assign-row">
              {driver ? (
                <>
                  <DriverAvatar avatar={driver.avatar} size={32} name={driver.name} />
                  <span className="vehicle-assign-current">
                    <strong>{driver.name}</strong> · {driver.bgName}
                  </span>
                  <button className="btn btn-ghost btn-xs" onClick={() => onSwitchToDriver(driver.id)}>查看司机</button>
                </>
              ) : (
                <span className="vehicle-assign-current" style={{color: 'var(--ink-3)'}}>无人驾驶</span>
              )}
            </div>
            {freeDrivers.length > 0 && (
              <div style={{marginTop: 8}}>
                <div style={{fontSize: 14, color: 'var(--ink-3)', marginBottom: 4}}>分配未配车的司机:</div>
                {freeDrivers.map((d) => (
                  <button key={d.id} className="btn btn-ghost btn-xs" style={{marginRight: 6, marginBottom: 4}}
                    onClick={() => dispatch({type: 'ASSIGN_VEHICLE', driverId: d.id, vehicleId: vehicle.id})}>
                    分配给 {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">可接订单类型</div>
            <div>
              {vd.eligible.map((oid) => {
                const o = ORDERS.find((x) => x.id === oid);
                return (
                  <span key={oid} className="order-list-chip" style={{borderColor: o.color, color: o.color}}>
                    <OrderIcon orderId={oid} color={o.color} size={8} />
                    {o.name} ¥{o.fare}
                  </span>
                );
              })}
            </div>
            {vd.id === 'santana' && (
              <div style={{fontSize: 14, color: 'var(--ink-3)', marginTop: 6}}>
                提示:快车靠片区解锁;升级到凯美瑞/奔驰 E 可接专车和豪华车订单
              </div>
            )}
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">购入信息</div>
            <div className="drawer-train-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10}}>
              <div><div style={{fontSize: 14, color: 'var(--ink-3)'}}>购入价</div><div style={{fontWeight: 800, fontSize: 14}}>¥{vd.price.toLocaleString()}</div></div>
              <div><div style={{fontSize: 14, color: 'var(--ink-3)'}}>解锁口碑</div><div style={{fontWeight: 800, fontSize: 14}}>{vd.unlock || '开局'}</div></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============== V8: 常驻调度台 ============== */

function getOrderRequirementText(order) {
  const reqs = [];
  Object.entries(order.req || {}).forEach(([key, val]) => {
    reqs.push(`${E.statName(key)}≥${val}`);
  });
  return reqs.length > 0 ? reqs.join(' · ') : '无门槛';
}

function getInspectorVehicleOrderSummary(vd) {
  return `可接 ${vd.eligible.length} 类订单${vd.unlock > 0 ? ` · 口碑 ${vd.unlock} 解锁` : ' · 开局可用'}`;
}

function ZoneInspector({ zone, offers, state, onClose }) {
  if (!zone) return null;
  const zoneOffers = offers || [];
  const unlocked = E.isZoneUnlocked(state, zone);
  const unlockText = E.getZoneUnlockText(state, zone);
  const fareMin = zoneOffers.length ? Math.min(...zoneOffers.map((offer) => offer.fare)) : 0;
  const fareMax = zoneOffers.length ? Math.max(...zoneOffers.map((offer) => offer.fare)) : 0;
  return (
    <div className="panel panel-tight inspector-panel order-inspector zone-inspector">
      <div className="panel-header">
        <span className="panel-title">片区信息</span>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>关闭</button>
      </div>
      <div className="inspector-scroll">
        <div className="inspector-hero order-hero" style={{borderColor: zone.color}}>
          <div className="inspector-hero-main">
            <div className="inspector-title">{zone.name}</div>
            <div className="inspector-sub">
              {unlocked
                ? `${zone.desc} · 系统会自动从这里匹配订单`
                : `${zone.desc} · ${unlockText}`}
            </div>
          </div>
          <div className="order-hero-fare">{unlocked ? (zoneOffers.length ? `¥${fareMin === fareMax ? fareMin : `${fareMin}-${fareMax}`}` : '暂无') : '锁定'}</div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section-title">片区订单</div>
          <div className="zone-offer-list">
            {!unlocked ? (
              <div className="inspector-card zone-state-card">
                <div className="order-req-line">片区暂未解锁</div>
                <div className="inspector-sub">{unlockText} 后会自动加入接单池。</div>
              </div>
            ) : zoneOffers.length === 0 ? (
              <div className="inspector-card zone-state-card">
                <div className="order-req-line">当前时段暂无合适订单</div>
                <div className="inspector-sub">不用手动处理,司机会继续从其他已解锁片区找单。</div>
              </div>
            ) : zoneOffers.map((offer) => {
              const order = ORDERS.find((o) => o.id === offer.orderId);
              if (!order) return null;
              return (
                <div key={offer.id} className="zone-offer-row" style={{borderColor: offer.color}}>
                  <OrderIcon orderId={offer.orderId} color={offer.color} size={12} />
                  <div>
                    <div className="zone-offer-title">{offer.orderName} · ¥{offer.fare}</div>
                    <div className="zone-offer-sub">{offer.distance}km / {offer.hours}h · {getOrderRequirementText(order)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section-title">接单规则</div>
          <div className="inspector-card zone-state-card">
            <div className="order-req-line">{unlocked ? '司机自动匹配片区订单' : '先提升口碑解锁片区'}</div>
            <div className="inspector-sub">
              {unlocked
                ? '只要司机有车、属性达标、车型可接,系统会自动在已解锁片区里挑合适订单。'
                : '继续跑单提升口碑,达到门槛后这里会自动加入城市订单池。'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InspectorEmpty({ state }) {
  const idleDrivers = state.drivers.filter((d) => !d.vehicleId).length;
  const emptyVehicles = state.vehicles.filter((v) => !state.drivers.some((d) => d.vehicleId === v.id)).length;
  return (
    <div className="panel panel-tight inspector-panel">
      <div className="panel-header">
        <span className="panel-title">调度台</span>
        <span className="panel-sub">选中对象后直接操作</span>
      </div>
      <div className="inspector-scroll inspector-empty">
        <div className="inspector-hero">
          <div className={`dispatch-state-badge ${state.paused ? 'paused' : 'running'}`}>
            <span>{state.paused ? '待启动' : `${state.speed}×运营中`}</span>
          </div>
          <div className="inspector-hero-main">
            <div className="inspector-title">从左侧选择车组</div>
            <div className="inspector-sub">有车司机会自动接单;需要训练、换车或配车时,选中车组或待配对对象。</div>
          </div>
        </div>
        {(idleDrivers > 0 || emptyVehicles > 0) && (
          <div className="inspector-card">
            <div className="inspector-section-title">当前缺口</div>
            <div className="inspector-sub">
              {idleDrivers > 0 ? `${idleDrivers} 名司机未配车` : '司机都有车'}
              {' · '}
              {emptyVehicles > 0 ? `${emptyVehicles} 辆车无人驾驶` : '车辆都有司机'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DriverTrainingRows({ driver, statCaps, funds, dispatch }) {
  return (
    <div className="stat-train-list">
      {TRAININGS.map((t) => {
        const cur = driver.stats[t.stat];
        const limit = statCaps[t.stat] || 99;
        const pct = Math.min(100, (cur / limit) * 100);
        const enough = funds >= t.cost;
        const maxed = cur >= limit;
        return (
          <div key={t.id} className={`stat-train-row ${maxed ? 'maxed' : ''}`}>
            <span className="stat-train-label" style={{color: t.color}}>{E.statName(t.stat)}</span>
            <div className="stat-train-meter" aria-label={`${E.statName(t.stat)} ${cur}/${limit}`}>
              <div className="stat-train-fill" style={{width: `${pct}%`, background: t.color}} />
            </div>
            <span className="stat-train-value">{cur}/{limit}</span>
            <span className={`stat-train-cost ${!enough && !maxed ? 'poor' : ''}`}>¥{t.cost}/次</span>
            <button
              className="stat-train-plus"
              disabled={!enough || maxed}
              title={maxed ? '已到上限' : `花 ¥${t.cost},${E.statName(t.stat)} +${t.gainMin}~${t.gainMax}`}
              aria-label={maxed ? `${E.statName(t.stat)}已到上限` : `花 ${t.cost} 提升${E.statName(t.stat)}`}
              onClick={() => dispatch({type: 'TRAIN', driverId: driver.id, trainingId: t.id})}
            >
              {maxed ? '满' : '+'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CrewInspector({ driver, vehicle: inspectedVehicle, vehicles, drivers, dispatch, funds, onSelectVehicle, onSelectDriver }) {
  if (!driver && !inspectedVehicle) return null;
  const vehicle = driver ? vehicles.find((v) => v.id === driver.vehicleId) : inspectedVehicle;
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const vehicleDriver = vehicle ? drivers.find((d) => d.vehicleId === vehicle.id) : null;
  const rank = driver ? E.computeRank(driver) : null;
  const driverBusy = driver && driver.status === 'driving' && driver.currentOrder;
  const vehicleBusy = vehicleDriver && vehicleDriver.status === 'driving' && vehicleDriver.currentOrder;
  const statCaps = driver ? (driver.statCaps || E.computeStatCaps(driver)) : null;
  const title = driver
    ? `${driver.name} × ${vd ? vd.name : '未配车'}`
    : `${vd.name} × 待分配`;
  const subtitle = driver
    ? `${driver.bgName} · ${rank.name} · 月薪 ¥${driver.salary}`
    : `${getInspectorVehicleOrderSummary(vd)}${inspectedVehicle.policyCertified ? ' · 合规已更新' : ''}`;
  return (
    <div className="panel panel-tight inspector-panel driver-inspector crew-inspector">
      <div className="panel-header">
        <span className="panel-title">车组详情</span>
        <span className="panel-sub">{driver ? '训练 / 换车 / 看订单' : '分配司机 / 看订单'}</span>
      </div>
      <div className="inspector-scroll driver-inspector-grid">
        <div className="inspector-hero crew-hero">
          <div className="crew-pair-hero" aria-hidden="true">
            {driver ? <DriverAvatar avatar={driver.avatar} size={48} name={driver.name} /> : <div className="crew-empty-avatar">待配</div>}
            <span>×</span>
            {vd ? <VehicleIcon template={vd} size={42} /> : <div className="vehicle-empty-icon">无车</div>}
          </div>
          <div className="inspector-hero-main">
            <div className="inspector-title">{title}</div>
            <div className="inspector-sub">
              {driver && rank ? (
                <>{driver.bgName} · <span style={{color: rank.color, fontWeight: 800}}>{rank.name}</span> · 月薪 ¥{driver.salary}</>
              ) : subtitle}
            </div>
          </div>
        </div>

        {driver ? (
          <div className="inspector-section">
            <div className="inspector-section-title">车组配对</div>
            <div className="driver-vehicle-control">
              <div className="driver-current-vehicle">
                {vd ? <VehicleIcon template={vd} size={38} /> : <div className="vehicle-empty-icon">无车</div>}
                <div className="driver-current-vehicle-copy">
                  <strong>{vd ? vd.name : '未配车'}</strong>
                  <span>{vd ? getInspectorVehicleOrderSummary(vd) : '选择一辆车后才能稳定接单'}</span>
                </div>
              </div>
              <div className="vehicle-select-row">
                <select
                  className="vehicle-select"
                  value={driver.vehicleId || ''}
                  disabled={driverBusy}
                  onChange={(e) => dispatch({type: 'ASSIGN_VEHICLE', driverId: driver.id, vehicleId: Number(e.target.value)})}
                >
                  <option value="" disabled>选择车辆</option>
                  {vehicles.map((v) => {
                    const tpl = E.getVehicleData(v);
                    const owner = drivers.find((d) => d.vehicleId === v.id);
                    const current = driver.vehicleId === v.id;
                    const occupiedBusy = owner && owner.id !== driver.id && owner.status === 'driving';
                    const disabled = occupiedBusy || (owner && owner.id !== driver.id && driverBusy);
                    return (
                      <option key={v.id} value={v.id} disabled={disabled}>
                        {tpl.name}{owner && !current ? ` · 当前 ${owner.name}` : current ? ' · 当前驾驶' : ' · 空车'}
                      </option>
                    );
                  })}
                </select>
                <button className="btn btn-ghost btn-xs" disabled={!vehicle} onClick={() => vehicle && onSelectVehicle(vehicle.id)}>看车</button>
              </div>
            </div>
            {!vd && (
              <div className="inspector-sub" style={{marginTop: 8, color: 'var(--accent-deep)'}}>
                这个司机还没车,选一辆空车或替换空闲司机的车。
              </div>
            )}
          </div>
        ) : (
          <div className="inspector-section">
            <div className="inspector-section-title">分配司机</div>
            <div className="link-list">
              {drivers.map((d) => {
                const current = vehicle && d.vehicleId === vehicle.id;
                const ownVehicle = d.vehicleId
                  ? (vehicles.find((v) => v.id === d.vehicleId) ? E.getVehicleData(vehicles.find((v) => v.id === d.vehicleId)).name : '已有车辆')
                  : '未配车';
                const disabled = (d.status === 'driving' && !current) || (vehicleBusy && !current);
                return (
                  <div key={d.id} className={`link-row ${current ? 'current' : ''} ${disabled ? 'disabled' : ''}`}>
                    <DriverAvatar avatar={d.avatar} size={34} name={d.name} />
                    <div className="link-row-info">
                      <div className="link-row-name">{d.name}</div>
                      <div className="link-row-sub">{d.bgName} · {ownVehicle}</div>
                    </div>
                    {current ? (
                      <button className="btn btn-primary btn-xs" onClick={() => onSelectDriver(d.id)}>查看</button>
                    ) : (
                      <button className="btn btn-primary btn-xs" disabled={disabled}
                        onClick={() => dispatch({type: 'ASSIGN_VEHICLE', driverId: d.id, vehicleId: vehicle.id})}>
                        分配
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {driver && (
          <div className="inspector-section">
            <div className="inspector-section-title">能力训练</div>
            <DriverTrainingRows driver={driver} statCaps={statCaps} funds={funds} dispatch={dispatch} />
          </div>
        )}

        {vd && (
          <div className="inspector-section">
            <div className="inspector-section-title">车辆信息</div>
            <div className="inspector-card crew-vehicle-card">
              <div className="crew-vehicle-line">
                <VehicleIcon template={vd} size={34} />
                <div>
                  <strong>{vd.name}</strong>
                  <span>{getInspectorVehicleOrderSummary(vd)}{vehicle.policyCertified ? ' · 合规已更新' : ''}</span>
                </div>
              </div>
              <div className="crew-order-chips">
                {vd.eligible.map((oid) => {
                  const o = ORDERS.find((x) => x.id === oid);
                  return (
                    <span key={oid} className="order-list-chip" style={{borderColor: o.color, color: o.color}}>
                      <OrderIcon orderId={oid} color={o.color} size={8} />
                      {o.name} ¥{o.fare}
                    </span>
                  );
                })}
              </div>
              <div className="crew-vehicle-meta">
                <span>购入价 <strong>¥{vd.price.toLocaleString()}</strong></span>
                <span>解锁口碑 <strong>{vd.unlock || '开局'}</strong></span>
              </div>
            </div>
          </div>
        )}

        {driver && (
          <div className="inspector-section">
            <div className="inspector-section-title">个人统计</div>
            <div className="inspector-grid">
              <div className="inspector-metric">
                <div className="inspector-metric-label">累计单数</div>
                <div className="inspector-metric-value">{driver.completedOrders}</div>
              </div>
              <div className="inspector-metric">
                <div className="inspector-metric-label">累计赚得</div>
                <div className="inspector-metric-value" style={{color: 'var(--accent)'}}>¥{driver.totalEarned}</div>
              </div>
              <div className="inspector-metric">
                <div className="inspector-metric-label">好评 / 投诉</div>
                <div className="inspector-metric-value" style={{color: 'var(--green)'}}>{driver.goodReviews || 0} / {driver.badReviews || 0}</div>
              </div>
              <div className="inspector-metric">
                <div className="inspector-metric-label">个人评分</div>
                <div className="inspector-metric-value" style={{color: (driver.rating || 4.5) >= 4.7 ? 'var(--green)' : 'var(--ink)'}}>{(driver.rating || 4.5).toFixed(1)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============== 弹窗 ============== */

function Tutorial({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="tutorial-card">
        <div className="tut-tag">第 1 周目 · 起步</div>
        <div className="tut-title">网约车物语</div>
        <div className="tut-text">
          你刚下岗,亲戚借了你 <strong>¥10,000</strong>,买了 <strong>2 辆桑塔纳</strong>,
          招了 <strong>2 名司机</strong>(老张、李大伟)。你的目标是把这个小车队跑出来。
        </div>
        <div className="tut-tips">
          <div className="tut-tip">
            <div className="tut-tip-num">1</div>
            <div><strong>看左侧目标</strong> — 左侧目标板告诉你现在该做什么,左上角看运营时间,顶栏看资金和口碑</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">2</div>
            <div>点底部 <strong>1×开始</strong>,司机会自动从已解锁片区里接单</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">3</div>
            <div>点左侧 <strong>车组卡</strong>,训练司机属性,同时确认车辆可接订单</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">4</div>
            <div>点左侧 <strong>待配对</strong>,给新司机或空车补齐人车关系</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">5</div>
            <div>1× 下主线约 25-35 分钟;2×/4×/8× 只用来压缩等待,关键选择会暂停</div>
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onClose} style={{padding: 12, marginTop: 12}}>
          开始营业
        </button>
      </div>
    </div>
  );
}

function previewEventEffect(option, state) {
  try {
    return option.apply(state) || {};
  } catch (e) {
    return {};
  }
}

function getBestDriverForEvent(state) {
  if (!state || !state.drivers || state.drivers.length === 0) return null;
  const total = (driver) => Object.values(driver.stats || {}).reduce((sum, val) => sum + val, 0);
  return [...state.drivers].sort((a, b) => total(b) - total(a))[0];
}

function getEventOptionDetail(option, effect) {
  if (!option || !option.detail) return '';
  if (effect.eventScale || effect.orderBoost) return '';
  return option.detail;
}

function formatOrderBoostText(effect) {
  if (!effect.orderBoost || effect.orderBoost === 1) return '';
  const percent = Math.round(Math.abs(effect.orderBoost - 1) * 100);
  const duration = effect.boostDuration ? `,持续 ${effect.boostDuration} 天` : ',持续今天';
  return effect.orderBoost > 1
    ? `接单收入临时提高 ${percent}%${duration}`
    : `接单收入临时降低 ${percent}%${duration}`;
}

function EventResourceSnapshot({ state }) {
  if (!state) return null;
  const metrics = [
    { label: '资金', value: `¥${state.funds.toLocaleString()}`, tone: state.funds < 0 ? 'danger' : '' },
    { label: '口碑', value: state.reputation },
    { label: '今日流水', value: `¥${state.todayEarned.toLocaleString()}` },
    { label: '司机/车辆', value: `${state.drivers.length}/${state.vehicles.length}` },
  ];
  return (
    <div className="event-resource-snapshot" aria-label="当前经营状态">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <strong className={metric.tone || ''}>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

function EventModal({ event, state, onResolve }) {
  return (
    <div className="modal-overlay">
      <div className="modal event-modal">
        <div className="event-modal-header">
          <div className="modal-tag">{event.tag}事件</div>
          <div className="modal-title">{event.title}</div>
          <div className="modal-desc">{event.desc}</div>
        </div>
        <EventResourceSnapshot state={state} />
        <div className="modal-options">
          {event.options.map((o, i) => {
            const eff = previewEventEffect(o, state);
            const nextFunds = eff.funds !== undefined && state ? state.funds + eff.funds : null;
            const bestDriver = getBestDriverForEvent(state);
            const salaryAfter = bestDriver && eff.salaryRaise ? bestDriver.salary + eff.salaryRaise : null;
            const salaryDaily = eff.salaryRaise ? Math.round(eff.salaryRaise / 30) : 0;
            const optionDetail = getEventOptionDetail(o, eff);
            const orderBoostText = formatOrderBoostText(eff);
            return (
              <button key={i} className="modal-option" onClick={() => onResolve(i)}>
                <div className="modal-option-label">{o.label}</div>
                {optionDetail && <div className="modal-option-effect">{optionDetail}</div>}
                <div className="event-effect-preview">
                  {eff.funds !== undefined && (
                    <span className={eff.funds < 0 ? 'negative' : 'positive'}>
                      资金 {eff.funds > 0 ? '+' : ''}{eff.funds.toLocaleString()} · 选后 ¥{nextFunds.toLocaleString()}
                    </span>
                  )}
                  {eff.reputation !== undefined && (
                    <span className={eff.reputation < 0 ? 'negative' : 'positive'}>
                      口碑 {eff.reputation > 0 ? '+' : ''}{eff.reputation}
                    </span>
                  )}
                  {eff.allLoyalty !== undefined && (
                    <span className={eff.allLoyalty < 0 ? 'negative' : 'positive'}>
                      全员忠诚 {eff.allLoyalty > 0 ? '+' : ''}{eff.allLoyalty}
                    </span>
                  )}
                  {eff.trustLoyalty !== undefined && (
                    <span className={eff.trustLoyalty < 0 ? 'negative' : 'positive'}>
                      全员信任 {eff.trustLoyalty > 0 ? '+' : ''}{eff.trustLoyalty}
                    </span>
                  )}
                  {eff.salaryRaise && eff.keepBest && bestDriver && (
                    <>
                      <span className="negative">
                        {bestDriver.name} 月薪 +¥{eff.salaryRaise} → ¥{salaryAfter}
                      </span>
                      <span className="negative">日成本约 +¥{salaryDaily}</span>
                      <span className="positive">{bestDriver.name} 留队 · 忠诚 +30</span>
                    </>
                  )}
                  {orderBoostText && (
                    <span className={eff.orderBoost < 1 ? 'negative' : 'positive'}>
                      {orderBoostText}
                    </span>
                  )}
                  {eff.commissionRate !== undefined && (
                    <span>平台抽成调整为 {Math.round(eff.commissionRate * 100)}%</span>
                  )}
                  {eff.certifyFleet && <span className="positive">当前车辆合规升级</span>}
                  {eff.accidentRisk && (
                    <span className="negative">
                      {Math.round(eff.accidentRisk.chance * 100)}% 事故风险
                      {eff.accidentRisk.funds ? ` · 可能 ${eff.accidentRisk.funds.toLocaleString()}` : ''}
                    </span>
                  )}
                  {eff.loseBest && <span className="negative">失去最强司机{bestDriver ? ` ${bestDriver.name}` : ''}</span>}
                  {(eff.fireMostExpensive || eff.sellMostExpensive) && <span className="negative">会失去关键资源</span>}
                  {Object.keys(eff).length === 0 && <span>无立即数值变化</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GameFeedbackCard({
  tone = 'accent',
  tag,
  title,
  message,
  reward,
  iconLabel = '提示',
  asset,
  media,
  actionLabel,
  onClose,
  modal = false,
  children,
  className = '',
}) {
  return (
    <div className={`game-feedback-card tone-${tone} ${modal ? 'modal-card' : ''} ${className}`} onClick={(e) => modal && e.stopPropagation()}>
      <div className="game-feedback-media">
        {media || <div className="game-feedback-icon" data-asset={asset}>{iconLabel}</div>}
      </div>
      <div className="game-feedback-main">
        <div className="game-feedback-tag">{tag}</div>
        <div className="game-feedback-title">{title}</div>
        {message && <div className="game-feedback-message">{message}</div>}
        {reward && (
          typeof reward === 'object' ? (
            <div className="game-feedback-reward">
              <span className="game-feedback-reward-label">{reward.label}</span>
              <strong className="game-feedback-reward-value">{reward.value}</strong>
            </div>
          ) : (
            <div className="game-feedback-reward">{reward}</div>
          )
        )}
        {children}
        {actionLabel && (
          <button className="btn btn-primary btn-block game-feedback-action" onClick={onClose}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// V7: 司机故事线里程碑(使用统一游戏反馈强提醒)
function StoryModal({ story, drivers, onClose }) {
  if (!story) return null;
  const driver = drivers.find((d) => d.id === story.driverId);
  const milestoneTag = story.milestone === 100 ? '初次相识'
    : story.milestone === 500 ? '一路同行'
    : story.milestone === 1000 ? '故友重逢'
    : '';
  const r = story.reward || {};
  const rewardLines = [];
  if (r.funds) rewardLines.push(`资金 +¥${r.funds}`);
  if (r.reputation) rewardLines.push(`口碑 +${r.reputation}`);
  if (r.loyalty) rewardLines.push(`信任 +${r.loyalty}`);
  if (r.badge) rewardLines.push(`称号「${r.badge}」`);
  return (
    <div className="modal-overlay game-feedback-overlay">
      <GameFeedbackCard
        tone="gold"
        tag={`${milestoneTag} · 司机里程碑`}
        title={story.title}
        message={`${story.driverName} 完成 ${story.milestone} 单`}
        media={driver && <DriverAvatar avatar={driver.avatar} size={72} name={driver.name} />}
        actionLabel="继续运营"
        onClose={onClose}
        modal
        className="story-feedback"
      >
        <div className="story-text">{story.text}</div>
        {rewardLines.length > 0 && (
          <div className="story-rewards">
            {rewardLines.map((line, i) => (
              <div key={i} className="story-reward-row">{line}</div>
            ))}
          </div>
        )}
      </GameFeedbackCard>
    </div>
  );
}

// V6: 抽卡式招募 — 选券 → 抽 3 张 → 挑 1 张
function RecruitModal({ state, dispatch, onClose }) {
  const cards = state.gachaCards;
  const funds = state.funds;

  // 没抽过卡:展示券选择
  if (!cards) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal recruit-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 820}}>
          <div className="modal-title">招募新司机</div>
          <div className="modal-desc">选一张招募券抽卡 — 每抽出 3 张候选,可挑 1 张加入车队。</div>
          <div className="ticket-list">
            {RECRUIT_TICKETS.map((t) => {
              const enough = funds >= t.cost;
              return (
                <div key={t.id} className={`ticket-card ${t.id}`}>
                  <div className="ticket-head">
                    <span className="ticket-name">{t.name}</span>
                    <span className="ticket-cost">¥{t.cost.toLocaleString()}</span>
                  </div>
                  <div className="ticket-desc">{t.desc}</div>
                  <button
                    className="btn btn-primary btn-sm btn-block"
                    disabled={!enough}
                    onClick={() => dispatch({type: 'GACHA_START', ticketId: t.id})}
                  >
                    {enough ? '抽卡 3 张' : '资金不足'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 抽到卡:展示 3 张候选
  const ticket = RECRUIT_TICKETS.find((t) => t.id === state.gachaTicketId);
  return (
    <div className="modal-overlay" onClick={() => dispatch({type: 'GACHA_CANCEL'})}>
        <div className="modal recruit-modal gacha-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 980}}>
          <div className="modal-title">候选司机(挑 1 加入)</div>
        <div className="modal-desc">{ticket?.name} 抽出的 3 名候选。横向比较稀有度、背景、属性上限和月薪,选 1 名加入车队。</div>
        <div className="gacha-grid">
          {cards.map((card) => {
            const meta = RARITY_META[card.rarity];
            return (
              <div key={card.id} className={`gacha-card rarity-${card.rarity}`} style={{borderColor: meta.color, background: meta.bg}}>
                <div className="gacha-id-block">
                  <div className="gacha-rarity" style={{background: meta.color}}>
                    {meta.name} · {'★'.repeat(meta.stars)}
                  </div>
                  <div className="gacha-avatar-wrap">
                    <DriverAvatar avatar={card.avatar} size={56} name={card.name} />
                  </div>
                </div>
                <div className="gacha-profile">
                  <div className="gacha-name">{card.name}</div>
                  <div className="gacha-bg">{card.bgName}</div>
                  <div className="gacha-desc">{card.bgDesc}</div>
                  <div className="gacha-salary">月薪 ¥{card.salary.toLocaleString()}</div>
                </div>
                <div className="gacha-stats-block">
                  <StatBars stats={card.stats} caps={card.statCaps || E.computeStatCaps(card)} compact />
                  <div className="gacha-cap-line">上限: {Object.values(card.statCaps || E.computeStatCaps(card)).join(' / ')}</div>
                </div>
                <button
                  className="btn btn-primary btn-sm btn-block"
                  onClick={() => {
                    dispatch({type: 'GACHA_PICK', cardId: card.id});
                    onClose();
                  }}
                >
                  招这位
                </button>
              </div>
            );
          })}
        </div>
        <div className="gacha-footer">
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({type: 'GACHA_CANCEL'})}>关闭(放弃)</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={funds < (ticket?.cost || 0)}
            onClick={() => dispatch({type: 'GACHA_REROLL'})}
          >
            重抽(¥{ticket?.cost.toLocaleString()})
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopModal({ onClose, onBuyVehicle, state }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600}}>
        <div className="modal-title">4S 店:买新车</div>
        <div className="modal-desc">快车由片区解锁,桑塔纳也能跑。凯美瑞起能跑专车订单,奔驰 E 能跑豪华车订单。</div>
        <div className="shop-grid">
          {VEHICLES.map((v) => {
            const locked = state.reputation < v.unlock;
            const cantAfford = state.funds < v.price;
            return (
              <div key={v.id} className="shop-item">
                <div className="shop-image"><VehicleIcon template={v} size={70} /></div>
                <div className="shop-info">
                  <div className="shop-name-row">
                    <span className="shop-name">{v.name}</span>
                    <span className="shop-price">¥{v.price.toLocaleString()}</span>
                  </div>
                  <div className="shop-meta">可接 {v.eligible.length} 类订单{v.unlock > 0 ? ` · 口碑 ${v.unlock} 解锁` : ' · 开局可用'}</div>
                  <div className="shop-orders">
                    {v.eligible.map((o) => {
                      const od = ORDERS.find((x) => x.id === o);
                      return (
                        <span key={o} className="shop-order-chip" style={{borderColor: od.color, color: od.color}}>
                          <OrderIcon orderId={o} color={od.color} size={10} />
                          {od.name}
                        </span>
                      );
                    })}
                  </div>
                  <button className="btn btn-primary btn-sm btn-block" disabled={locked || cantAfford} onClick={() => onBuyVehicle(v.id)}>
                    {locked ? `口碑需 ${v.unlock}` : cantAfford ? '资金不足' : '购买'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EndingModal({ ending, onReset }) {
  // V6 fix: 优先用 endingName/endingDesc(胜利);失败用 reason;deathCause 作为 fallback(codex review Medium)
  const isWin = ending.type === 'win';
  const isLose = ending.type === 'lose';
  const titleMap = { win: '恭喜! 车队跑出来了', end: '一周目结束', lose: '车队破产' };
  const headline = isWin && ending.endingName ? `《${ending.endingName}》` : titleMap[ending.type];
  const story = isWin && ending.endingDesc
    ? ending.endingDesc
    : ending.reason || '';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="ending-card">
          <div className="ending-title">{headline}</div>
          {isWin && ending.endingName && (
            <div style={{color: 'var(--ink-3)', fontSize: 14, marginBottom: 10}}>{titleMap[ending.type]}</div>
          )}
          <div style={{color: 'var(--ink-2)', marginBottom: 8, lineHeight: 1.6}}>{story}</div>
          <div className="ending-stats">
            <div className="ending-stat"><div className="ending-stat-label">营运天数</div><div className="ending-stat-value">{ending.stats.days}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">总流水</div><div className="ending-stat-value">¥{ending.stats.totalEarned.toLocaleString()}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">完成订单</div><div className="ending-stat-value">{ending.stats.totalCompleted}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">城市口碑</div><div className="ending-stat-value">{ending.stats.reputation}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">可运营车组</div><div className="ending-stat-value">{ending.stats.crews ?? Math.min(ending.stats.drivers, ending.stats.vehicles)}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">里程碑</div><div className="ending-stat-value">{ending.stats.achievements}</div></div>
          </div>
          <button className="btn btn-primary btn-block" onClick={onReset} style={{padding: 12}}>再来一遍</button>
        </div>
      </div>
    </div>
  );
}

// V6: 达成新结局时弹窗 — 提供"领奖结束/继续冲击"
function EndingUnlockModal({ ending, onClaim, onContinue }) {
  return (
    <div className="modal-overlay" style={{zIndex: 110}}>
      <div className="modal" style={{maxWidth: 480, textAlign: 'center', borderColor: 'var(--gold)', borderWidth: 3, borderStyle: 'solid'}}>
        <div className="modal-tag" style={{background: 'var(--gold)', color: 'var(--ink)'}}>
          已解锁结局 · 阶段 {ending.tier}
        </div>
        <div className="modal-title" style={{fontSize: 24, marginTop: 8}}>{ending.name}</div>
        <div className="modal-desc" style={{margin: '14px 0', lineHeight: 1.7}}>{ending.desc}</div>
        <div className="ending-detail-line">{ending.detail}</div>
        <div className="modal-options" style={{marginTop: 20}}>
          <button className="btn btn-primary btn-block" style={{padding: 12, background: 'var(--gold)', color: 'var(--ink)'}} onClick={onClaim}>
            领奖结束(以《{ending.name}》收尾)
          </button>
          <button className="btn btn-ghost btn-block" style={{padding: 10}} onClick={onContinue}>
            继续运营 · 冲击更高结局
          </button>
        </div>
      </div>
    </div>
  );
}

function MissionToast({ mission, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, mission.reward?.isFinale ? 10000 : 8000);
    return () => clearTimeout(t);
  }, [mission]);
  const rewardAmount = mission.reward?.funds || 0;
  if (mission.reward?.isFinale) {
    return (
      <div className="modal-overlay game-feedback-overlay" onClick={onClose}>
        <GameFeedbackCard
          tone="gold"
          tag="通关达成"
          title={mission.title}
          message={mission.reward?.message}
          reward={mission.reward?.funds > 0 ? `奖励 +¥${mission.reward.funds}` : ''}
          iconLabel="通关"
          asset="achievement"
          actionLabel="继续运营"
          onClose={onClose}
          modal
        />
      </div>
    );
  }
  return (
    <GameFeedbackCard
      tone="accent"
      tag="任务完成"
      title={mission.title}
      message={mission.reward?.message}
      reward={rewardAmount > 0 ? { label: '奖励', value: `+¥${rewardAmount}` } : ''}
      iconLabel="任务"
      asset="mission"
      actionLabel="领取奖励"
      onClose={onClose}
      className="mission-feedback"
    />
  );
}

/* ============== App 主组件 ============== */

function App() {
  const [state, dispatch] = useReducer(E.gameReducer, null, E.makeInitialState);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [mobileTab, setMobileTab] = useState('city');
  const [showRecruit, setShowRecruit] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [configUpdated, setConfigUpdated] = useState(false);

  // V5: 监听 admin 后台的配置变化(跨 tab 通讯)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel('wycwy-config');
    ch.onmessage = (ev) => {
      if (ev.data?.type === 'config-update') setConfigUpdated(true);
    };
    return () => ch.close();
  }, []);
  const [crtOn, setCrtOn] = useState(() => {
    if (localStorage.getItem('wycwy-visual-version') !== 'v10.3') {
      localStorage.setItem('wycwy-visual-version', 'v10.3');
      localStorage.setItem('wycwy-crt', '0');
      return false;
    }
    return localStorage.getItem('wycwy-crt') === '1';
  });
  const [flashKey, setFlashKey] = useState(0);
  // V7: 当前正在播放晋升闪光的司机 id 集合(0.6s 后自动移除)
  const [rankUpDriverIds, setRankUpDriverIds] = useState(new Set());

  // 上一次的关键状态 — 用于差分触发 sfx
  const prevRef = useRef({
    completedTotal: 0,
    trainings: 0,
    vehicles: state.vehicles.length,
    drivers: state.drivers.length,
  });

  useEffect(() => {
    if (state.paused || state.activeEvent || state.activeStory || state.showTutorial || state.gameOver) return;
    const interval = setInterval(() => dispatch({type: 'TICK'}), GAME.TICK_MS / state.speed);
    return () => clearInterval(interval);
  }, [state.paused, state.speed, state.activeEvent, state.activeStory, state.showTutorial, state.gameOver]);

  useEffect(() => {
    if (!selectedZoneId) return;
    if (!ZONES.some((z) => z.id === selectedZoneId)) setSelectedZoneId(null);
  }, [selectedZoneId]);

  useEffect(() => {
    state.floatGains.forEach((g) => {
      setTimeout(() => dispatch({type: 'CLEAR_FLOAT_GAIN', id: g.id}), 1700);
    });
  }, [state.floatGains.length]);

  useEffect(() => {
    state.notifications.forEach((n) => {
      setTimeout(() => dispatch({type: 'CLEAR_NOTIF', id: n.id}), 3000);
    });
  }, [state.notifications.length]);

  // CRT toggle
  useEffect(() => {
    document.body.classList.toggle('crt-on', crtOn);
    localStorage.setItem('wycwy-crt', crtOn ? '1' : '0');
  }, [crtOn]);

  // 音效触发(差分检测)
  useEffect(() => {
    const p = prevRef.current;
    if (state.totalCompleted > p.completedTotal) SFX.complete();
    if ((state.totalTrainings || 0) > p.trainings) SFX.train();
    if (state.vehicles.length > p.vehicles || state.drivers.length > p.drivers) SFX.buy();
    prevRef.current = {
      completedTotal: state.totalCompleted,
      trainings: state.totalTrainings || 0,
      vehicles: state.vehicles.length,
      drivers: state.drivers.length,
    };
  }, [state.totalCompleted, state.totalTrainings, state.vehicles, state.drivers]);

  // 任务完成 → 非阻塞提示 + 短闪光
  useEffect(() => {
    if (state.newMissionComplete) {
      SFX.mission();
      setFlashKey((k) => k + 1);
    }
  }, [state.newMissionComplete]);

  // V7: 司机晋升 — 升阶音 + 该司机卡片闪边 0.6s
  useEffect(() => {
    if (!state.rankUpEvent) return;
    SFX.rankUp();
    const did = state.rankUpEvent.driverId;
    setRankUpDriverIds((prev) => {
      const next = new Set(prev);
      next.add(did);
      return next;
    });
    const t = setTimeout(() => {
      setRankUpDriverIds((prev) => {
        const next = new Set(prev);
        next.delete(did);
        return next;
      });
    }, 600);
    // 立即清空 state.rankUpEvent,避免重复触发
    dispatch({ type: 'CLEAR_RANK_UP' });
    return () => clearTimeout(t);
  }, [state.rankUpEvent && state.rankUpEvent.ts]);

  // 通知警告音
  useEffect(() => {
    if (state.notifications.length > 0 && state.notifications.slice(-1)[0].level === 'warn') {
      SFX.warn();
    }
  }, [state.notifications.length]);

  // 滚动数字
  const fundsDisplay = useCountUp(state.funds, 350);
  const repDisplay = useCountUp(state.reputation, 300);

  const selectedDriver = state.drivers.find((d) => d.id === selectedDriverId);
  const selectedVehicle = state.vehicles.find((v) => v.id === selectedVehicleId);
  const selectedVehicleDriver = selectedVehicle ? state.drivers.find((d) => d.vehicleId === selectedVehicle.id) : null;
  const selectedCrewDriver = selectedDriver || selectedVehicleDriver;
  const selectedCrewVehicle = selectedDriver
    ? state.vehicles.find((v) => v.id === selectedDriver.vehicleId)
    : selectedVehicle;
  const selectedZone = ZONES.find((z) => z.id === selectedZoneId);
  const selectedZoneOffers = selectedZoneId ? state.dispatchOffers.filter((o) => o.zoneId === selectedZoneId) : [];
  const hasFinaleMissionNotice = !!state.newMissionComplete?.reward?.isFinale;
  const showFeedbackStack = !!state.newMissionComplete && !hasFinaleMissionNotice;

  const toggleMute = () => {
    const v = !muted;
    setMutedState(v);
    setMuted(v);
    if (!v) SFX.click();
  };
  const toggleCrt = () => {
    setCrtOn((v) => !v);
    SFX.click();
  };
  const selectZone = (zoneId) => {
    setSelectedZoneId(zoneId);
    setSelectedDriverId(null);
    setSelectedVehicleId(null);
    setMobileTab('inspector');
  };

  return (
    <>
      <TopBar
        state={state}
        fundsDisplay={fundsDisplay}
        repDisplay={repDisplay}
        muted={muted} onToggleMute={toggleMute}
        crtOn={crtOn} onToggleCrt={toggleCrt}
      />
      {flashKey > 0 && <div key={flashKey} className="flash-overlay" />}

      <div className={`main-v3 mobile-${mobileTab}`}>
        <div className="col fleet-col">
          <FleetPanel
            state={state}
            selectedDriverId={selectedDriverId}
            selectedVehicleId={selectedVehicleId}
            selectedVehicle={selectedVehicle}
            selectedDriver={selectedDriver}
            rankUpDriverIds={rankUpDriverIds}
            onSelectDriver={(driverId) => { setSelectedZoneId(null); setSelectedVehicleId(null); setSelectedDriverId(driverId); setMobileTab('inspector'); }}
            onSelectVehicle={(vehicleId) => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(vehicleId); setMobileTab('inspector'); }}
            onClearSelection={() => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(null); }}
            onRecruit={() => setShowRecruit(true)}
            onShop={() => setShowShop(true)}
          />
        </div>

        <div className="col ops-col">
          <div className="panel city-panel">
            <div className="panel-header">
              <span className="panel-title">城市订单地图</span>
              <span className="panel-sub">片区自动匹配 · 小车显示订单去向</span>
            </div>
            <div className="city-wrap">
              <CityMap
                zones={ZONES}
                zoneHeat={state.zoneHeat}
                drivers={state.drivers}
                hour={state.hour}
                state={state}
                selectedZoneId={selectedZoneId}
                onSelectZone={selectZone}
              />
              <CityOrderLayer
                offers={state.dispatchOffers}
                zones={ZONES}
                drivers={state.drivers}
              />
            </div>
          </div>

          {/* 事件 mini 横条 - 主屏只看最新一条,点开看全部 */}
          {state.log.length > 0 && (
            <div className="event-mini" onClick={() => setShowLog(true)}>
              <span className="event-mini-label">最新事件</span>
              <span className="event-mini-time">{state.log[0].time}</span>
              <span className={`event-mini-text ${state.log[0].level}`}>{state.log[0].text}</span>
              <button className="event-mini-btn" onClick={(e) => { e.stopPropagation(); setShowLog(true); }}>
                全部 {state.log.length} 条
              </button>
            </div>
          )}
        </div>

        <div className="col inspector-col">
          {selectedZone ? (
            <ZoneInspector
              zone={selectedZone}
              offers={selectedZoneOffers}
              state={state}
              onClose={() => setSelectedZoneId(null)}
            />
          ) : (selectedCrewDriver || selectedCrewVehicle) ? (
            <CrewInspector
              driver={selectedCrewDriver}
              vehicle={selectedCrewVehicle}
              drivers={state.drivers}
              vehicles={state.vehicles}
              dispatch={dispatch}
              funds={state.funds}
              onSelectVehicle={(vid) => { setSelectedDriverId(null); setSelectedVehicleId(vid); }}
              onSelectDriver={(did) => { setSelectedVehicleId(null); setSelectedDriverId(did); }}
            />
          ) : (
            <InspectorEmpty state={state} />
          )}
        </div>
      </div>

      <BottomHUD
        state={state}
        dispatch={dispatch}
        onOpenLog={() => setShowLog(true)}
      />

      <div className="mobile-tabs" role="tablist" aria-label="游戏主区域">
        <button className={mobileTab === 'fleet' ? 'active' : ''} onClick={() => setMobileTab('fleet')}>车队</button>
        <button className={mobileTab === 'city' ? 'active' : ''} onClick={() => setMobileTab('city')}>城市</button>
        <button className={mobileTab === 'inspector' ? 'active' : ''} onClick={() => setMobileTab('inspector')}>调度</button>
      </div>

      {state.showTutorial && <Tutorial onClose={() => dispatch({type: 'CLOSE_TUTORIAL'})} />}
      {state.activeEvent && <EventModal event={state.activeEvent} state={state} onResolve={(idx) => dispatch({type: 'RESOLVE_EVENT', optionIdx: idx})} />}
      {state.activeStory && <StoryModal story={state.activeStory} drivers={state.drivers} onClose={() => dispatch({type: 'STORY_SHOWN'})} />}
      {hasFinaleMissionNotice && (
        <MissionToast mission={state.newMissionComplete} onClose={() => dispatch({type: 'CLEAR_MISSION_COMPLETE'})} />
      )}
      {showFeedbackStack && (
        <div className="game-feedback-stack" aria-live="polite">
          {state.newMissionComplete && !hasFinaleMissionNotice && (
            <MissionToast mission={state.newMissionComplete} onClose={() => dispatch({type: 'CLEAR_MISSION_COMPLETE'})} />
          )}
        </div>
      )}
      {state.newEndingUnlocked && !state.gameOver && (
        <EndingUnlockModal
          ending={state.newEndingUnlocked}
          onClaim={() => dispatch({type: 'CLAIM_ENDING'})}
          onContinue={() => dispatch({type: 'CLEAR_NEW_ENDING'})}
        />
      )}
      {(showRecruit || state.gachaCards) && (
        <RecruitModal
          state={state}
          dispatch={dispatch}
          onClose={() => { setShowRecruit(false); dispatch({type: 'GACHA_CANCEL'}); }}
        />
      )}
      {showShop && <ShopModal state={state} onClose={() => setShowShop(false)} onBuyVehicle={(t) => { dispatch({type: 'BUY_VEHICLE', templateId: t}); setShowShop(false); }} />}
      {showLog && (
        <>
          <div className="drawer-overlay" onClick={() => setShowLog(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <div className="drawer-header-info">
                <div className="drawer-header-title">事件日志</div>
                <div className="drawer-header-sub">完整运营记录 · 最近 {state.log.length} 条</div>
              </div>
              <button className="drawer-close" onClick={() => setShowLog(false)}>×</button>
            </div>
            <div className="drawer-body">
              <div className="log-drawer-list">
                {state.log.map((l) => (
                  <div key={l.id} className={`log-row ${l.level}`}>
                    <span className="log-time">{l.time}</span>
                    <span className="log-text">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {state.gameOver && <EndingModal ending={state.gameOver} onReset={() => dispatch({type: 'RESET'})} />}

      {state.notifications.length > 0 && state.notifications.slice(-1).map((n) => (
        <div key={n.id} className={`notification notification-${n.level || 'info'}`}>{n.text}</div>
      ))}

      {configUpdated && (
        <div className="config-update-banner">
          <span>数值后台已更新配置</span>
          <button className="btn btn-primary btn-xs" onClick={() => location.reload()}>重启游戏应用</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setConfigUpdated(false)}>稍后</button>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
