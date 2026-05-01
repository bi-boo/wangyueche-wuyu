/* 网约车物语 V2 - React 组件 + 入口 */
const { useState, useReducer, useEffect, useRef, useMemo } = React;
const D = window.WYCWY_DATA;
const E = window.WYCWY_ENGINE;
const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, PARTS, TRAININGS, RANKS } = D;

/* ============== 占位元素(后续可替换为图片素材) ============== */
/* 所有占位元素都带 data-asset="..." 标记,后期用 <img> 或背景图直接替换 */

function DriverAvatar({ avatar, size = 36, name = '?' }) {
  const bg = avatar?.hatColor || '#FF6B35';
  return (
    <div
      className="ph-avatar"
      data-asset={`avatar-${avatar?.hat || 'default'}`}
      style={{
        width: size, height: size, background: bg, color: '#fff',
        fontSize: Math.round(size * 0.42),
      }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function VehicleIcon({ template, size = 60 }) {
  if (!template) return null;
  const shortMap = { santana: '桑塔纳', camry: '凯美瑞', han_ev: '汉 EV', odyssey: '奥德赛', benz_e: '奔驰 E' };
  const label = shortMap[template.id] || template.name;
  return (
    <div
      className="ph-vehicle"
      data-asset={`vehicle-${template.id}`}
      style={{
        width: size * 1.3, height: size * 0.55, background: template.color, color: '#fff',
        fontSize: Math.max(10, Math.round(size * 0.22)),
      }}
    >
      {label}
    </div>
  );
}

function OrderIcon({ orderId, color, size = 14 }) {
  return (
    <span
      className="ph-order-dot"
      data-asset={`order-${orderId}`}
      style={{ width: size, height: size, background: color || '#FF6B35' }}
    />
  );
}

function PartIcon({ part, size = 14 }) {
  const labelMap = { massage: '按', aroma: '香', recorder: '录', etc: 'E', rack: '架', fridge: '冰' };
  return (
    <span
      className="ph-part"
      data-asset={`part-${part}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6), lineHeight: `${size}px` }}
    >
      {labelMap[part] || '?'}
    </span>
  );
}

function StatIcon({ stat, color, size = 12 }) {
  return (
    <span
      className="ph-stat"
      data-asset={`stat-${stat}`}
      style={{ width: size, height: size, background: color || '#FF6B35' }}
    />
  );
}

/* ============== 通用组件 ============== */

function StatBars({ stats, compact }) {
  const items = [
    { key: 'driving', label: '驾驶', short: '驾', color: '#FF6B35' },
    { key: 'service', label: '服务', short: '服', color: '#0EA5E9' },
    { key: 'road', label: '路感', short: '路', color: '#10B981' },
    { key: 'mind', label: '心力', short: '心', color: '#8B5CF6' },
  ];
  return (
    <div className="stat-bars">
      {items.map((it) => (
        <div key={it.key} className="stat-bar-row">
          <span className="stat-bar-label" style={{color: it.color}}>{compact ? it.short : it.label}</span>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{width: `${stats[it.key]}%`, background: it.color}} />
          </div>
          <span className="stat-bar-num">{stats[it.key]}</span>
        </div>
      ))}
    </div>
  );
}

function DayTimeline({ history, hour, paused }) {
  return (
    <div className="day-timeline">
      {Array.from({length: 24}, (_, h) => {
        const cell = history[h];
        let bg = 'rgba(0,0,0,0.05)';
        let title = `${h}:00 空闲`;
        if (cell) {
          if (cell.type === 'driving') {
            const order = ORDERS.find((o) => o.id === cell.orderId);
            bg = order?.color || '#9CA3AF';
            title = `${h}:00 ${order?.name}`;
          } else if (cell.type === 'rest') {
            bg = '#94A3B8';
            title = `${h}:00 疲劳休息`;
          } else if (cell.type === 'idle') {
            bg = 'rgba(0,0,0,0.10)';
            title = `${h}:00 等单`;
          }
        }
        const isCurrent = h === hour - 1 || (h === 23 && hour === 0);
        return (
          <div
            key={h}
            className="timeline-cell"
            style={{background: bg}}
            title={title}
          >
            {isCurrent && <div className="timeline-now" />}
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data, color = '#FF6B35', height = 24, width = 80, fill = true }) {
  if (data.length === 0) {
    return <div style={{height, width, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--ink-3)'}}>暂无数据</div>;
  }
  const max = Math.max(...data, 1);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const step = data.length > 1 ? width / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height * 0.85}`).join(' ');
  const areaPts = `0,${height} ${pts} ${(data.length - 1) * step},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{display: 'block'}}>
      {fill && (
        <polyline points={areaPts} fill={color} opacity="0.15" />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(data.length - 1) * step} cy={height - ((data[data.length - 1] - min) / range) * height * 0.85} r="2" fill={color} stroke="#fff" strokeWidth="0.5" />
    </svg>
  );
}

function Clock24({ hour }) {
  const isDay = hour >= 6 && hour < 19;
  const isDawn = hour >= 5 && hour < 7;
  const isDusk = hour >= 17 && hour < 19;
  let bg = isDay ? '#FFF7E6' : '#1F2937';
  if (isDawn || isDusk) bg = '#FFC58A';
  const fg = isDay ? '#FF6B35' : '#FCD34D';
  const tag = isDay ? '日' : '夜';
  return (
    <div
      className="ph-clock"
      data-asset="clock"
      style={{ background: bg, color: fg }}
    >
      <span style={{fontSize: 14, fontWeight: 800, lineHeight: 1}}>{String(hour).padStart(2, '0')}</span>
      <span style={{fontSize: 9, opacity: 0.8, lineHeight: 1}}>{tag}</span>
    </div>
  );
}

function CityMap({ zones, zoneHeat, drivers, hour }) {
  return (
    <svg viewBox="0 0 100 100" style={{width: '100%', height: '100%'}} preserveAspectRatio="xMidYMid meet">
      {/* 网格 */}
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#grid)" />
      {/* 主路 */}
      <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5" />
      <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(0,0,0,0.10)" strokeWidth="1.5" />
      {/* 区域热度泡泡 */}
      {zones.map((z) => {
        const heat = zoneHeat[z.id] || 0.3;
        return (
          <g key={z.id}>
            <circle cx={z.x} cy={z.y} r={5 + heat * 7} fill={`rgba(255,107,53,${heat * 0.3})`} />
            <circle cx={z.x} cy={z.y} r="3" fill={`rgba(255,107,53,${0.4 + heat * 0.5})`} />
            <text x={z.x} y={z.y - 7} fontSize="3" fill="#2A2320" textAnchor="middle" fontWeight="600">{z.name}</text>
            <text x={z.x} y={z.y + 1.2} fontSize="2.5" fill="#fff" textAnchor="middle" fontWeight="700">{Math.round(heat * 100)}</text>
          </g>
        );
      })}
      {/* 司机的车 */}
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
          <g key={d.id}>
            <circle cx={x} cy={y} r="2.2" fill={order.color || '#FF6B35'} stroke="#fff" strokeWidth="0.7" />
            <text x={x} y={y - 3.5} fontSize="2.2" fill="#2A2320" textAnchor="middle" fontWeight="600">{d.name.slice(0, 1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============== 顶栏 ============== */

function TopBar({ state, dispatch }) {
  const dayPct = (state.day - 1) / GAME.DAYS_PER_GAME * 100;
  const winPct = Math.min(100, state.funds / GAME.WIN_FUNDS * 100);
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>网约车物语 <span className="v">V2</span></h1>
        <div className="day-progress">
          <span className="day-label">第 {state.day}/{GAME.DAYS_PER_GAME} 日</span>
          <div className="day-progress-bar"><div style={{width: `${dayPct}%`}} /></div>
        </div>
      </div>
      <div className="topbar-stats">
        <div className="ts-clock">
          <Clock24 hour={state.hour} />
        </div>
        <div className="ts-stat">
          <span className="ts-label">资金</span>
          <span className="ts-value accent">¥{state.funds.toLocaleString()}</span>
          <div className="ts-progress"><div style={{width: `${winPct}%`}} /></div>
          <span className="ts-sub">目标 ¥{GAME.WIN_FUNDS.toLocaleString()}</span>
        </div>
        <div className="ts-stat">
          <span className="ts-label">城市口碑</span>
          <span className="ts-value green">{state.reputation}</span>
          <div className="ts-progress"><div className="green-bar" style={{width: `${Math.min(100, state.reputation / GAME.WIN_REPUTATION * 100)}%`}} /></div>
          <span className="ts-sub">目标 {GAME.WIN_REPUTATION}</span>
        </div>
        <div className="ts-stat">
          <span className="ts-label">总单</span>
          <span className="ts-value">{state.totalCompleted}</span>
          <span className="ts-sub">流水累计 ¥{state.totalEarned.toLocaleString()}</span>
        </div>
        <div className="speed-controls">
          <button className={`speed-btn ${state.paused ? 'active' : ''}`} onClick={() => dispatch({type: 'TOGGLE_PAUSE'})} title="暂停">
            {state.paused ? '已暂停' : '暂停'}
          </button>
          <button className={`speed-btn ${!state.paused && state.speed === 1 ? 'active' : ''}`} onClick={() => dispatch({type: 'SET_SPEED', speed: 1})}>1×</button>
          <button className={`speed-btn ${!state.paused && state.speed === 2 ? 'active' : ''}`} onClick={() => dispatch({type: 'SET_SPEED', speed: 2})}>2×</button>
          <button className={`speed-btn ${!state.paused && state.speed === 4 ? 'active' : ''}`} onClick={() => dispatch({type: 'SET_SPEED', speed: 4})}>4×</button>
        </div>
      </div>
    </div>
  );
}

/* ============== 司机卡 ============== */

function DriverCard({ driver, vehicle, selected, onClick }) {
  const rank = E.computeRank(driver);
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const status = driver.status === 'driving'
    ? `跑 ${driver.currentOrder?.orderName}`
    : driver.fatigue >= 80 ? '疲劳休息' : '空闲等单';
  const statusColor = driver.status === 'driving' ? 'var(--accent)' : driver.fatigue >= 80 ? 'var(--ink-3)' : 'var(--green)';
  return (
    <div className={`dc ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className="dc-top">
        <div className="dc-avatar"><DriverAvatar avatar={driver.avatar} size={42} name={driver.name} /></div>
        <div className="dc-name-area">
          <div className="dc-name">{driver.name}</div>
          <div className="dc-bg">{driver.bgName}</div>
        </div>
        <div className="dc-rank" style={{background: rank.color + '22', color: rank.color}}>{rank.name}</div>
      </div>
      <div className="dc-status" style={{color: statusColor}}>
        <span className="dc-status-dot" style={{background: statusColor}}></span>
        {status}
        {driver.currentOrder && <span style={{marginLeft: 'auto', fontWeight: 700}}>¥{driver.currentOrder.fare}</span>}
      </div>
      <StatBars stats={driver.stats} compact />
      <div className="dc-meters">
        <div className="dc-meter">
          <div className="dc-meter-row">
            <span>疲劳</span><span>{driver.fatigue}</span>
          </div>
          <div className="dc-meter-bar"><div className="dc-meter-fill" style={{width: `${driver.fatigue}%`, background: driver.fatigue >= 60 ? 'var(--warn)' : 'var(--accent)'}} /></div>
        </div>
        <div className="dc-meter">
          <div className="dc-meter-row">
            <span>忠诚</span><span>{driver.loyalty}</span>
          </div>
          <div className="dc-meter-bar"><div className="dc-meter-fill" style={{width: `${driver.loyalty}%`, background: 'var(--green)'}} /></div>
        </div>
      </div>
      <div className="dc-timeline-section">
        <div className="dc-timeline-label">今日节奏</div>
        <DayTimeline history={driver.todayHistory} hour={selected ? null : null} />
      </div>
      <div className="dc-vehicle-row">
        {vd ? (
          <>
            <VehicleIcon template={vd} size={22} />
            <span className="dc-vehicle-name">{vd.name}</span>
          </>
        ) : (
          <span className="dc-no-vehicle">未配车</span>
        )}
      </div>
    </div>
  );
}

/* ============== 车辆卡 ============== */

function VehicleCard({ vehicle, driver, onShop, onAssign, freeDrivers }) {
  const vd = E.getVehicleData(vehicle);
  return (
    <div className="vc">
      <div className="vc-image">
        <VehicleIcon template={vd} size={56} />
      </div>
      <div className="vc-info">
        <div className="vc-name-row">
          <span className="vc-name">{vehicle.name}</span>
          {driver ? (
            <span className="vc-driver">{driver.name}</span>
          ) : (
            <span className="vc-driver vc-driver-empty">空闲</span>
          )}
        </div>
        <div className="vc-meta">
          <span>维护 ¥{vd.maint}/天</span>
          <span>速 {vd.speed}×</span>
          {vd.srvBonus > 0 && <span>服务 +{vd.srvBonus}</span>}
        </div>
        {vehicle.parts.length > 0 && (
          <div className="vc-parts">
            {vehicle.parts.map((p) => {
              const pp = PARTS.find((x) => x.id === p);
              return (
                <span key={p} className="vc-part" title={pp.effect}>
                  <PartIcon part={p} size={10} />
                  <span>{pp.name}</span>
                </span>
              );
            })}
          </div>
        )}
        <div className="vc-actions">
          <button className="btn btn-ghost btn-xs" onClick={onShop}>改装</button>
          {!driver && freeDrivers.length > 0 && (
            <button className="btn btn-ghost btn-xs" onClick={() => onAssign(freeDrivers[0].id)}>分配</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== KPI 卡片 ============== */

function KpiCard({ label, value, sub, sparkline, color, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-head">
        {icon}
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-main">
        <span className="kpi-value" style={{color: color || 'var(--ink)'}}>{value}</span>
        {sparkline}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

/* ============== 培训卡片 ============== */

function TrainingPanel({ driver, dispatch, funds }) {
  if (!driver) {
    return <div className="empty-hint">点左侧任意司机卡片,在这里给他培训</div>;
  }
  return (
    <div className="training-panel">
      <div className="training-driver">
        <DriverAvatar avatar={driver.avatar} size={28} name={driver.name} />
        <div>
          <div className="training-driver-name">培训 {driver.name}</div>
          <div className="training-driver-bg">{driver.bgName}</div>
        </div>
      </div>
      {TRAININGS.map((t) => {
        const cur = driver.stats[t.stat];
        const expected = Math.min(99, cur + Math.round((t.gainMin + t.gainMax) / 2));
        const enough = funds >= t.cost;
        return (
          <div key={t.id} className="training-card">
            <div className="training-card-head">
              <StatIcon stat={t.stat} color={t.color} size={14} />
              <span className="training-card-name">{t.name}</span>
              <span className="training-card-cost">¥{t.cost}</span>
            </div>
            <div className="training-card-preview">
              <span style={{color: 'var(--ink-3)'}}>{E.statName(t.stat)}</span>
              <span className="training-num">{cur}</span>
              <span className="training-arrow">→</span>
              <span className="training-num training-num-after" style={{color: t.color}}>~{expected}</span>
            </div>
            <button className="btn btn-primary btn-xs btn-block" disabled={!enough}
              onClick={() => dispatch({type: 'TRAIN', driverId: driver.id, trainingId: t.id})}>
              {enough ? '训练 +' + (t.gainMin) + '~' + (t.gainMax) : '资金不足'}
            </button>
          </div>
        );
      })}
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
          你刚下岗,亲戚借了你 <strong>¥10,000</strong>。
          买了 <strong>2 辆桑塔纳</strong>,招了 <strong>2 名司机</strong>(老张、李大伟),决定干网约车。
        </div>
        <div className="tut-tips">
          <div className="tut-tip">
            <div className="tut-tip-num">1</div>
            <div>右上角 <strong>1× / 2× / 4×</strong> 控制游戏速度,司机自动接单跑车</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">2</div>
            <div>点司机卡片 → 右下方培训四项属性,提升后能接更高级订单</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">3</div>
            <div>每辆车可装改装件,买高级车解锁机场单/城际单等</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">4</div>
            <div>每 4 天有随机事件,带来策略选择</div>
          </div>
          <div className="tut-tip">
            <div className="tut-tip-num">5</div>
            <div>胜利条件:30 天内攒够 <strong>¥30,000</strong> 或口碑达 500</div>
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onClose} style={{padding: 12, marginTop: 12}}>
          开始营业
        </button>
      </div>
    </div>
  );
}

function EventModal({ event, onResolve }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-tag">{event.tag}事件</div>
        <div className="modal-title">{event.title}</div>
        <div className="modal-desc">{event.desc}</div>
        <div className="modal-options">
          {event.options.map((o, i) => (
            <button key={i} className="modal-option" onClick={() => onResolve(i)}>
              <div className="modal-option-label">{o.label}</div>
              <div className="modal-option-effect">{o.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RecruitModal({ onClose, onHire, funds }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">招募新司机</div>
        <div className="modal-desc">招聘费 ¥500,从 5 类背景中选一名加入车队。</div>
        <div className="recruit-grid">
          {BACKGROUNDS.map((bg) => (
            <div key={bg.id} className="recruit-item">
              <div className="recruit-head">
                <DriverAvatar avatar={bg.avatar} size={36} name={bg.name} />
                <div className="recruit-info">
                  <div className="recruit-name">{bg.name}</div>
                  <div className="recruit-desc">{bg.desc}</div>
                </div>
                <div className="recruit-price">¥{bg.salary}/月</div>
              </div>
              <StatBars stats={bg.boosts} compact />
              <button className="btn btn-primary btn-sm btn-block" disabled={funds < 500} onClick={() => onHire(bg.id)}>
                招募 ¥500
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShopModal({ vehicleId, vehicles, onClose, onBuyVehicle, onBuyPart, state }) {
  const [tab, setTab] = useState(vehicleId ? 'parts' : 'vehicles');
  const targetVehicle = vehicles.find((v) => v.id === vehicleId);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 600}}>
        <div className="modal-title">4S 店</div>
        <div className="tabs">
          <button className={`tab ${tab === 'vehicles' ? 'active' : ''}`} onClick={() => setTab('vehicles')}>买车</button>
          <button className={`tab ${tab === 'parts' ? 'active' : ''}`} onClick={() => setTab('parts')}>改装件 {targetVehicle ? `(${targetVehicle.name})` : ''}</button>
        </div>
        {tab === 'vehicles' && (
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
                    <div className="shop-meta">维护 ¥{v.maint}/天 · 速 {v.speed}× · 服务 +{v.srvBonus}</div>
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
        )}
        {tab === 'parts' && (
          <div>
            {!vehicleId && <div className="modal-desc">从右侧车辆面板点"改装"按钮,可针对单辆车买配件。</div>}
            <div className="shop-grid">
              {PARTS.map((p) => {
                const installed = targetVehicle && targetVehicle.parts.includes(p.id);
                const cantAfford = state.funds < p.price;
                return (
                  <div key={p.id} className="shop-item shop-part">
                    <div className="shop-part-icon"><PartIcon part={p.id} size={28} /></div>
                    <div className="shop-info">
                      <div className="shop-name-row">
                        <span className="shop-name">{p.name}</span>
                        <span className="shop-price">¥{p.price}</span>
                      </div>
                      <div className="shop-meta">{p.effect}</div>
                      {targetVehicle && (
                        <button className="btn btn-primary btn-sm btn-block" disabled={installed || cantAfford} onClick={() => onBuyPart(vehicleId, p.id)}>
                          {installed ? '已安装' : cantAfford ? '资金不足' : '购买安装'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EndingModal({ ending, onReset }) {
  const titleMap = { win: '恭喜!车队跑出来了', end: '一周目结束', lose: '车队破产' };
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="ending-card">
          <div className="ending-title">{titleMap[ending.type]}</div>
          <div style={{color: 'var(--ink-2)', marginBottom: 8}}>{ending.reason}</div>
          <div className="ending-stats">
            <div className="ending-stat">
              <div className="ending-stat-label">营运天数</div>
              <div className="ending-stat-value">{ending.stats.days}</div>
            </div>
            <div className="ending-stat">
              <div className="ending-stat-label">总流水</div>
              <div className="ending-stat-value">¥{ending.stats.totalEarned.toLocaleString()}</div>
            </div>
            <div className="ending-stat">
              <div className="ending-stat-label">完成订单</div>
              <div className="ending-stat-value">{ending.stats.totalCompleted}</div>
            </div>
            <div className="ending-stat">
              <div className="ending-stat-label">城市口碑</div>
              <div className="ending-stat-value">{ending.stats.reputation}</div>
            </div>
            <div className="ending-stat">
              <div className="ending-stat-label">司机数</div>
              <div className="ending-stat-value">{ending.stats.drivers}</div>
            </div>
            <div className="ending-stat">
              <div className="ending-stat-label">成就</div>
              <div className="ending-stat-value">{ending.stats.achievements}</div>
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={onReset} style={{padding: 12}}>再来一遍</button>
        </div>
      </div>
    </div>
  );
}

function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [achievement]);
  return (
    <div className="ach-toast">
      <div className="ach-icon" data-asset="achievement">成就</div>
      <div>
        <div className="ach-tag">成就解锁</div>
        <div className="ach-name">{achievement.name}</div>
        <div className="ach-desc">{achievement.desc}</div>
      </div>
    </div>
  );
}

/* ============== App 主组件 ============== */

function App() {
  const [state, dispatch] = useReducer(E.gameReducer, null, E.makeInitialState);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [showRecruit, setShowRecruit] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopVehicleId, setShopVehicleId] = useState(null);

  // 游戏循环
  useEffect(() => {
    if (state.paused || state.activeEvent || state.showTutorial || state.gameOver) return;
    const interval = setInterval(() => dispatch({type: 'TICK'}), GAME.TICK_MS / state.speed);
    return () => clearInterval(interval);
  }, [state.paused, state.speed, state.activeEvent, state.showTutorial, state.gameOver]);

  // 浮动收益清理
  useEffect(() => {
    state.floatGains.forEach((g) => {
      setTimeout(() => dispatch({type: 'CLEAR_FLOAT_GAIN', id: g.id}), 1500);
    });
  }, [state.floatGains.length]);

  useEffect(() => {
    state.notifications.forEach((n) => {
      setTimeout(() => dispatch({type: 'CLEAR_NOTIF', id: n.id}), 3000);
    });
  }, [state.notifications.length]);

  const selectedDriver = state.drivers.find((d) => d.id === selectedDriverId);
  const freeDrivers = state.drivers.filter((d) => !d.vehicleId);
  const drivingCount = state.drivers.filter((d) => d.status === 'driving').length;

  return (
    <>
      <TopBar state={state} dispatch={dispatch} />

      <div className="main">
        {/* 左 - 司机面板 */}
        <div className="col col-left">
          <div className="panel panel-flush">
            <div className="panel-header">
              <span className="panel-title">司机 ({state.drivers.length})</span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowRecruit(true)}>+ 招募</button>
            </div>
            <div className="driver-list">
              {state.drivers.map((d) => (
                <DriverCard
                  key={d.id}
                  driver={d}
                  vehicle={state.vehicles.find((v) => v.id === d.vehicleId)}
                  selected={selectedDriverId === d.id}
                  onClick={() => setSelectedDriverId(selectedDriverId === d.id ? null : d.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 中 - 仪表盘 */}
        <div className="col col-center">
          {/* KPI 行 */}
          <div className="kpi-row">
            <KpiCard
              label="今日流水"
              value={`¥${state.todayEarned}`}
              color="var(--accent)"
              sub={`昨日 ¥${state.yesterdayEarned}`}
              icon={<span className="kpi-dot" data-asset="kpi-funds" style={{background: 'var(--accent)'}} />}
              sparkline={<Sparkline data={state.kpiHistory.earned} color="var(--accent)" width={56} height={20} />}
            />
            <KpiCard
              label="完成订单"
              value={state.todayCompleted}
              sub={`昨日 ${state.yesterdayCompleted}`}
              icon={<span className="kpi-dot" data-asset="kpi-orders" style={{background: 'var(--ink)'}} />}
              sparkline={<Sparkline data={state.kpiHistory.completed} color="var(--ink)" width={56} height={20} />}
            />
            <KpiCard
              label="好评 / 差评"
              value={`${state.todayGood} / ${state.todayBad}`}
              color="var(--green)"
              sub={`口碑 ${state.reputation}`}
              icon={<span className="kpi-dot" data-asset="kpi-rep" style={{background: 'var(--green)'}} />}
              sparkline={<Sparkline data={state.kpiHistory.reputation} color="var(--green)" width={56} height={20} />}
            />
            <KpiCard
              label="平台抽成"
              value={`${Math.round(state.commissionRate * 100)}%`}
              sub={`运营中 ${drivingCount}/${state.drivers.length}`}
              icon={<span className="kpi-dot" data-asset="kpi-cut" style={{background: '#9A8C7E'}} />}
            />
          </div>

          {/* 城市地图 */}
          <div className="panel city-panel">
            <div className="panel-header">
              <span className="panel-title">城市订单热度</span>
              <span className="panel-sub">圆圈大小 = 当前订单密度</span>
            </div>
            <div className="city-wrap">
              <CityMap zones={ZONES} zoneHeat={state.zoneHeat} drivers={state.drivers} hour={state.hour} />
            </div>
            {/* 运营中列表 */}
            <div className="ongoing-list">
              {state.drivers.filter((d) => d.status === 'driving').length === 0 ? (
                <div className="empty-hint" style={{padding: '12px 0'}}>
                  {state.paused ? '点击右上角 1× / 2× / 4× 开始营业' : '司机在等单 / 休息...'}
                </div>
              ) : (
                state.drivers.filter((d) => d.status === 'driving').map((d) => {
                  const o = d.currentOrder;
                  const pct = ((o.totalHours - o.remainHours) / o.totalHours) * 100;
                  return (
                    <div key={d.id} className="ongoing-card">
                      <div className="oc-driver">
                        <DriverAvatar avatar={d.avatar} size={26} name={d.name} />
                        <span className="oc-name">{d.name}</span>
                      </div>
                      <div className="oc-order">
                        <OrderIcon orderId={o.orderId} color={o.color} size={14} />
                        <span style={{color: o.color, fontWeight: 600}}>{o.orderName}</span>
                        <span style={{color: 'var(--ink-3)'}}>· {o.distance}km</span>
                      </div>
                      <div className="oc-progress">
                        <div className="oc-bar"><div className="oc-bar-fill" style={{width: `${pct}%`, background: o.color}} /></div>
                        <span className="oc-time">剩 {o.remainHours}h</span>
                      </div>
                      <div className="oc-fare">¥{o.fare}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 事件流 */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">事件流</span>
              <span className="panel-sub">最近 12 条</span>
            </div>
            <div className="log-list">
              {state.log.slice(0, 12).map((l) => (
                <div key={l.id} className={`log-row ${l.level}`}>
                  <span className="log-time">{l.time}</span>
                  <span className="log-text">{l.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右 - 车辆 + 培训 */}
        <div className="col col-right">
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">车队 ({state.vehicles.length})</span>
              <button className="btn btn-ghost btn-xs" onClick={() => { setShopVehicleId(null); setShowShop(true); }}>+ 4S 店</button>
            </div>
            <div className="vehicle-list">
              {state.vehicles.map((v) => {
                const d = state.drivers.find((x) => x.vehicleId === v.id);
                return (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    driver={d}
                    freeDrivers={freeDrivers}
                    onShop={() => { setShopVehicleId(v.id); setShowShop(true); }}
                    onAssign={(driverId) => dispatch({type: 'ASSIGN_VEHICLE', driverId, vehicleId: v.id})}
                  />
                );
              })}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">培训中心</span>
              {selectedDriver && <button className="btn btn-ghost btn-xs" onClick={() => setSelectedDriverId(null)}>取消选择</button>}
            </div>
            <TrainingPanel driver={selectedDriver} dispatch={dispatch} funds={state.funds} />
            {selectedDriver && state.drivers.length > 1 && (
              <button className="btn btn-ghost btn-xs btn-block" style={{marginTop: 8, color: 'var(--warn)'}}
                onClick={() => {
                  if (confirm(`确定让 ${selectedDriver.name} 离开?`)) {
                    dispatch({type: 'FIRE_DRIVER', driverId: selectedDriver.id});
                    setSelectedDriverId(null);
                  }
                }}>
                解雇该司机
              </button>
            )}
          </div>
        </div>
      </div>

      {state.showTutorial && <Tutorial onClose={() => dispatch({type: 'CLOSE_TUTORIAL'})} />}
      {state.activeEvent && <EventModal event={state.activeEvent} onResolve={(idx) => dispatch({type: 'RESOLVE_EVENT', optionIdx: idx})} />}
      {showRecruit && <RecruitModal funds={state.funds} onClose={() => setShowRecruit(false)} onHire={(bg) => { dispatch({type: 'HIRE_DRIVER', bgId: bg}); setShowRecruit(false); }} />}
      {showShop && <ShopModal vehicleId={shopVehicleId} vehicles={state.vehicles} state={state} onClose={() => setShowShop(false)} onBuyVehicle={(t) => { dispatch({type: 'BUY_VEHICLE', templateId: t}); setShowShop(false); }} onBuyPart={(vid, pid) => dispatch({type: 'BUY_PART', vehicleId: vid, partId: pid})} />}
      {state.gameOver && <EndingModal ending={state.gameOver} onReset={() => dispatch({type: 'RESET'})} />}
      {state.newAchievement && <AchievementToast achievement={state.newAchievement} onClose={() => dispatch({type: 'CLEAR_ACHIEVEMENT'})} />}

      {state.notifications.length > 0 && state.notifications.slice(-1).map((n) => (
        <div key={n.id} className={`notification notification-${n.level || 'info'}`}>{n.text}</div>
      ))}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
