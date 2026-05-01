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
