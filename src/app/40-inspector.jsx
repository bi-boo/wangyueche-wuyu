function ZoneInspector({ zone, state, onClose }) {
  if (!zone) return null;
  const unlocked = E.isZoneUnlocked(state, zone);
  const unlockText = E.getZoneUnlockText(state, zone);
  const orderRows = getZoneOrderRows(zone);
  return (
    <div className="panel panel-tight inspector-panel order-inspector zone-inspector">
      <div className="panel-header">
        <span className="panel-title">片区信息</span>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>关闭</button>
      </div>
      <div className="inspector-scroll">
        <div className="zone-summary">
          <div className="inspector-title">{zone.name}</div>
          <div className="inspector-sub">
            {unlocked
              ? zone.desc
              : `${zone.desc} · ${unlockText}`}
          </div>
        </div>

        <div className="inspector-section">
          <div className="inspector-section-title">片区订单</div>
          <div className="zone-offer-list">
            {!unlocked && (
              <div className="inspector-card zone-state-card">
                <div className="order-req-line">片区暂未解锁</div>
                <div className="inspector-sub">{unlockText} 后会按下方结构进入接单池。</div>
              </div>
            )}
            {orderRows.map(({ order, percent, freq, minFare, maxFare }) => {
              return (
                <div key={`${zone.id}-${order.id}`} className="zone-offer-row">
                  <OrderIcon orderId={order.id} color="currentColor" size={12} />
                  <div>
                    <div className="zone-offer-title">{order.name}</div>
                    <div className="zone-offer-sub">{order.km}km / {order.hours}h · {getOrderRequirementText(order)}</div>
                  </div>
                  <div>
                    <div className="zone-offer-price">¥{minFare}-{maxFare}</div>
                    <div className="zone-offer-weight">{freq} {percent}%</div>
                  </div>
                </div>
              );
            })}
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

function LogInspector({ state }) {
  const scrollRef = useRef(null);
  const followLatestRef = useRef(true);
  const logs = state.log || [];
  const chronologicalLogs = [...logs].reverse();
  const latestId = logs[0]?.id;

  const compactLogText = (text) => {
    const orderDone = text.match(/^(.+?) 完成 (?:(.+?) · )?(.+?订单) · 收入 ¥([\d,]+)(?: · (好评|投诉)(?: · 城市口碑 ([+-]\d+))?)?$/);
    if (orderDone) {
      const [, driverName, zoneName, orderName, income, review, reputationDelta] = orderDone;
      return [
        driverName,
        zoneName ? zoneName.replace(/区$/, '') : null,
        orderName.replace(/订单$/, ''),
        `¥${income}`,
        review,
        reputationDelta ? `口碑${reputationDelta}` : null,
      ].filter(Boolean).join(' ');
    }
    const dayClose = text.match(/^第 (\d+) 日结算: 流水 ¥([\d,]+), 应付工资 ¥([\d,]+), 完成 (\d+) 单$/);
    if (dayClose) {
      const [, day, revenue, salary, completed] = dayClose;
      return `D${day} 结算 流水¥${revenue} 工资¥${salary} ${completed}单`;
    }
    return text
      .replace(/城市口碑/g, '口碑')
      .replace(/出租车订单/g, '出租车')
      .replace(/快车订单/g, '快车')
      .replace(/专车订单/g, '专车')
      .replace(/豪华车订单/g, '豪华')
      .replace(/收入 ¥/g, '¥')
      .replace(/\s+/g, ' ');
  };

  const scrollToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    followLatestRef.current = true;
  };

  useEffect(() => {
    if (followLatestRef.current) requestAnimationFrame(scrollToLatest);
  }, [latestId]);

  const handleLogScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    followLatestRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 18;
  };

  return (
    <div className="panel panel-tight inspector-panel log-inspector">
      <div className="panel-header">
        <span className="panel-title">事件日志</span>
        <span className="panel-sub">时间正序 · 最新在底部</span>
      </div>
      <div className="inspector-scroll log-inspector-scroll" ref={scrollRef} onScroll={handleLogScroll}>
        {logs.length === 0 ? (
          <div className="inspector-card log-empty-card">
            <div className="inspector-section-title">暂无记录</div>
            <div className="inspector-sub">开始运营后,接单、完单、事件和运营提示会显示在这里。</div>
          </div>
        ) : (
          <div className="log-drawer-list inspector-log-list">
            {chronologicalLogs.map((l) => (
              <div key={l.id} className={`log-row ${l.level} ${l.id === latestId ? 'latest' : ''}`} title={`${l.time} ${l.text}`}>
                <span className="log-time">{l.time}</span>
                <span className="log-text">{compactLogText(l.text)}</span>
              </div>
            ))}
            <button className="log-latest-anchor" onClick={scrollToLatest} title="回到最新日志">
              回到最新
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InspectorTabs({ active, onChange }) {
  return (
    <div className="inspector-tabs" role="tablist" aria-label="调度台视图">
      <button
        className={active === 'details' ? 'active' : ''}
        onClick={() => onChange('details')}
        role="tab"
        aria-selected={active === 'details'}
      >
        调整
      </button>
      <button
        className={active === 'log' ? 'active' : ''}
        onClick={() => onChange('log')}
        role="tab"
        aria-selected={active === 'log'}
      >
        日志
      </button>
    </div>
  );
}

function DriverAttributeRows({ driver, statCaps, funds, dispatch, vehicleData, loyaltyMeta, onRequestSalaryRaise, canTrain = true, canRaiseSalary = true }) {
  // V14.65: 忠诚、车技、服务统一成同一种属性行;差异只体现在是否可主动训练。
  const goodRate = Math.round(E.getDriverGoodReviewRate(driver) * 100);
  const loyalty = Math.max(0, Math.min(100, driver.loyalty ?? 50));
  const loyaltyNormalCap = E.getDriverLoyaltyCap ? E.getDriverLoyaltyCap(driver) : 100;
  const loyaltyLimit = loyalty > loyaltyNormalCap ? 100 : loyaltyNormalCap;
  const rows = [
    {
      id: 'loyalty',
      type: 'loyalty',
      label: '忠诚',
      color: loyaltyMeta.cls === 'danger' || loyaltyMeta.cls === 'warn' ? 'var(--warn)' : 'var(--green)',
      value: loyalty,
      limit: loyaltyLimit,
      pct: Math.min(100, (loyalty / loyaltyLimit) * 100),
      meta: loyaltyMeta.label,
      hint: loyaltyMeta.effect,
      className: loyaltyMeta.cls,
    },
    ...TRAININGS.map((t) => {
      const cur = driver.stats[t.stat];
      const limit = statCaps[t.stat] || 99;
      const pct = Math.min(100, (cur / limit) * 100);
      const trainCost = getTrainingCost(t, cur);
      const enough = funds >= trainCost;
      const maxed = cur >= limit;
      return {
        id: t.id,
        type: 'training',
        training: t,
        label: getDriverStatLabel(t.stat),
        color: t.color,
        value: cur,
        limit,
        pct,
        enough,
        maxed,
        trainCost,
        meta: maxed ? '已满' : `¥${trainCost.toLocaleString()}/次`,
        hint: getStatTrainHint(t.stat, cur, vehicleData, goodRate),
        className: maxed ? 'maxed' : '',
      };
    }),
  ];
  return (
    <div className="driver-attr-list">
      {rows.map((row) => {
        const t = row.training;
        return (
          <div key={row.id} className={`driver-attr-row ${row.type} ${row.className || ''}`} style={{'--attr-color': row.color}}>
            <span className="driver-attr-label">{row.label}</span>
            <span className="driver-attr-value">{row.value}/{row.limit}</span>
            <span className={`driver-attr-meta ${row.enough === false && !row.maxed ? 'poor' : ''}`}>{row.meta}</span>
            <div className="driver-attr-meter" aria-label={`${row.label} ${row.value}/${row.limit}`}>
              <div className="driver-attr-fill" style={{transform: `scaleX(${row.pct / 100})`}} />
            </div>
            {t && canTrain ? (
              <button
                className="driver-attr-action"
                disabled={!row.enough || row.maxed}
                title={row.maxed ? '已到上限' : `花 ¥${row.trainCost.toLocaleString()} 做${t.name},${row.label} +${t.gainMin}~${t.gainMax}`}
                aria-label={row.maxed ? `${row.label}已到上限` : `花 ${row.trainCost.toLocaleString()} 做${t.name}`}
                onClick={() => dispatch({type: 'TRAIN', driverId: driver.id, trainingId: t.id})}
              >
                {row.maxed ? '满' : '+'}
              </button>
            ) : row.type === 'loyalty' && canRaiseSalary && onRequestSalaryRaise ? (
              <button
                type="button"
                className="driver-attr-action"
                disabled={row.value >= 100}
                title={row.value >= 100 ? '忠诚已满,无需调薪' : `给 ${driver.name} 调薪以提升忠诚`}
                aria-label={row.value >= 100 ? '忠诚已满' : '调薪'}
                onClick={() => onRequestSalaryRaise(driver)}
              >
                {row.value >= 100 ? '满' : '+'}
              </button>
            ) : (
              <span className="driver-attr-action-placeholder" aria-hidden="true" />
            )}
            {row.hint && <div className="driver-attr-hint">{row.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}

function VehicleSwapModal({ driver, vehicles, drivers, dispatch, onClose }) {
  const currentVehicle = vehicles.find((v) => v.id === driver.vehicleId);
  const currentName = currentVehicle ? E.getVehicleData(currentVehicle).name : '未配车';
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 560}}>
        <div className="modal-title">{currentVehicle ? '换车 / 互换' : '分配车辆'}</div>
        <div className="modal-desc">{driver.name} 当前车辆:{currentName}。选择空车会直接分配,选择其他司机的车会互换。</div>
        <div className="vehicle-swap-modal-grid">
          {vehicles.map((v) => {
            const tpl = E.getVehicleData(v);
            const owner = drivers.find((d) => d.vehicleId === v.id);
            const isCurrent = owner && owner.id === driver.id;
            const isOccupied = owner && !isCurrent;
            return (
              <button
                key={v.id}
                className={`vehicle-swap-card ${isCurrent ? 'current' : isOccupied ? 'occupied' : 'empty'}`}
                onClick={() => {
                  if (isCurrent) return;
                  dispatch({type: 'ASSIGN_VEHICLE', driverId: driver.id, vehicleId: v.id});
                  onClose();
                }}
                disabled={isCurrent}
                title={isCurrent ? '当前驾驶' : isOccupied ? `点击与 ${owner.name} 互换车辆` : '点击分配这辆车'}
              >
                <VehicleIcon template={tpl} size={34} />
                <div className="vsc-name">{tpl.name}</div>
                <div className="vsc-status">
                  {isCurrent ? '当前' : isOccupied ? `${owner.name} 的车` : '空车'}
                </div>
              </button>
            );
          })}
        </div>
        <button className="btn btn-ghost btn-block" onClick={onClose} style={{padding: 12, marginTop: 14}}>关闭</button>
      </div>
    </div>
  );
}

function CrewInspector({ driver, vehicle: inspectedVehicle, vehicles, drivers, dispatch, funds, reputation, state, requestConfirm, onSelectVehicle, onSelectDriver, onRequestSalaryRaise }) {
  // V15.17:渐进解锁判定 — 训练/调薪/接单诊断按 gate 控制
  const canTrain = E.isUIGateUnlocked(state, 'training_actions');
  const canRaiseSalary = E.isUIGateUnlocked(state, 'salary_raise');
  const showTryRateCard = E.isUIGateUnlocked(state, 'tryrate_card');
  const [showVehicleSwap, setShowVehicleSwap] = useState(false);
  if (!driver && !inspectedVehicle) return null;
  const vehicle = driver ? vehicles.find((v) => v.id === driver.vehicleId) : inspectedVehicle;
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const vehicleDriver = vehicle ? drivers.find((d) => d.vehicleId === vehicle.id) : null;
  const driverBusy = driver && driver.status === 'driving' && driver.currentOrder;
  const vehicleBusy = vehicleDriver && vehicleDriver.status === 'driving' && vehicleDriver.currentOrder;
  const statCaps = driver ? (driver.statCaps || E.computeStatCaps(driver)) : null;
  const workStatus = driver ? getDriverWorkState(driver, vehicle) : '空车';
  const statusClass = driver
    ? (!vehicle ? 'empty' : 'idle')
    : 'empty';
  const showWorkStatus = !driver || statusClass === 'empty';
  const loyaltyMeta = driver ? getLoyaltyMeta(driver) : null;
  const canFireDriver = driver && drivers.length > 1;
  const canSellVehicle = vehicle && vd && vehicles.length > 1;
  return (
    <>
    <div className="panel panel-tight inspector-panel driver-inspector crew-inspector">
      <div className="panel-header">
        <span className="panel-title">车组详情</span>
        <span className="panel-sub">{driver ? '概览 / 档案 / 训练' : '分配司机 / 车辆订单'}</span>
      </div>
      <div className="inspector-scroll driver-inspector-grid">
        {/* V15.17:hero 跟左侧车队卡完全一致 — 头像 + 名字+车型 meta + 忠诚 chip
            身份/月薪/接单诊断移到下方独立「司机档案」卡 */}
        <div className="inspector-hero crew-hero">
          <div className="crew-overview-row crew-card-row">
            {driver ? (
              <>
                <div className="crew-row-avatar">
                  <DriverAvatar avatar={driver.avatar} size={40} name={driver.name} />
                </div>
                <div className="crew-row-info">
                  <strong className="crew-row-name">{driver.name}</strong>
                  {vd ? (
                    <span className="crew-row-meta" title={`${vd.name} · 可接 ${getVehicleOrderFullSummary(vd)}`}>
                      <VehicleIcon template={vd} size={18} />
                      <span className="crew-row-order">{getInspectorVehicleOrderSummary(vd)}{vehicle && vehicle.policyCertified ? ' · 合规已更新' : ''}</span>
                    </span>
                  ) : (
                    <span className="crew-row-meta empty">
                      <span className="crew-row-no-vehicle">未配车</span>
                      <span className="crew-row-meta-divider">·</span>
                      <span className="crew-row-order">下方选择空车分配</span>
                    </span>
                  )}
                </div>
                <div className="crew-row-right">
                  {showWorkStatus && (
                    <span className={`crew-status-pill ${statusClass}`} title={workStatus}>
                      <i className={`cc-status-light ${statusClass}`} />
                      {workStatus}
                    </span>
                  )}
                  <span className={`crew-loyalty-mini ${loyaltyMeta?.cls || ''}`}
                        title={loyaltyMeta ? `${loyaltyMeta.label} · ${loyaltyMeta.effect}` : ''}>
                    忠诚 {driver.loyalty ?? 50}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="crew-row-avatar">
                  <div className="crew-empty-avatar">空</div>
                </div>
                <div className="crew-row-info">
                  <strong className="crew-row-name">{vd ? vd.name : '空车'}</strong>
                  <span className="crew-row-meta" title={`可接 ${getVehicleOrderFullSummary(vd)}`}>
                    <VehicleIcon template={vd} size={18} />
                    <span className="crew-row-order">{getInspectorVehicleOrderSummary(vd)}{vehicle && vehicle.policyCertified ? ' · 合规已更新' : ''}</span>
                  </span>
                </div>
                <div className="crew-row-right">
                  <span className="crew-status-pill empty" title="空车">
                    <i className="cc-status-light empty" />
                    空车
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* V15.17:司机档案卡 — 整合身份 + 月薪 + 接单诊断(原 tryrate-card 合并进来) */}
        {driver && (
          <div className="inspector-section">
            <div className="inspector-section-title">司机档案</div>
            <div className="driver-detail-card">
              <div className="driver-detail-row">
                <span className="driver-detail-label">身份</span>
                <span className="driver-detail-value">{getDriverMetaLine(driver)}</span>
              </div>
              <div className="driver-detail-row">
                <span className="driver-detail-label">月薪</span>
                <span className="driver-detail-value">¥{driver.salary.toLocaleString()}</span>
              </div>
              {showTryRateCard && (() => {
                const diagnosis = getDriverOrderDiagnosis(driver, vd, reputation);
                return (
                  <>
                    <div className="driver-diagnosis-card">
                      {diagnosis.map((item) => (
                        <div className="diagnosis-row" key={item.key}>
                          <span className="diagnosis-label">{item.label}</span>
                          <span className={`diagnosis-state ${item.tone}`}>{item.state}</span>
                          <span className="diagnosis-hint">{item.hint}</span>
                        </div>
                      ))}
                    </div>
                    <div className="tryrate-hint">单子少时,先看订单机会、接单意愿和可接订单。</div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* V14.2: 选中空车(无司机) → 顶部显示分配司机列表;
            选中司机 → 优先看状态和训练,低频管理动作收在底部。 */}
        {!driver && vehicle && (
          <div className="inspector-section">
            <div className="inspector-section-title">分配司机</div>
            <div className="link-list">
              {drivers.map((d) => {
                const current = d.vehicleId === vehicle.id;
                const ownVehicle = d.vehicleId
                  ? (vehicles.find((v) => v.id === d.vehicleId) ? E.getVehicleData(vehicles.find((v) => v.id === d.vehicleId)).name : '已有车辆')
                  : '未配车';
                return (
                  <div key={d.id} className={`link-row ${current ? 'current' : ''}`}>
                    <DriverAvatar avatar={d.avatar} size={34} name={d.name} />
                    <div className="link-row-info">
                      <div className="link-row-name">{d.name}</div>
                      <div className="link-row-sub">{getDriverMetaLine(d, ownVehicle)}</div>
                    </div>
                    {current ? (
                      <button className="btn btn-primary btn-xs" onClick={() => onSelectDriver(d.id)}>查看</button>
                    ) : (
                      <button className="btn btn-primary btn-xs"
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
            <DriverAttributeRows
              driver={driver}
              statCaps={statCaps}
              funds={funds}
              dispatch={dispatch}
              vehicleData={vd}
              loyaltyMeta={loyaltyMeta}
              onRequestSalaryRaise={onRequestSalaryRaise}
              canTrain={canTrain}
              canRaiseSalary={canRaiseSalary}
            />
          </div>
        )}

        {/* V14.2: 选中空车时,车辆信息单独展示(无 hover 操作) */}
        {!driver && vd && (
          <div className="inspector-section">
            <div className="inspector-section-title">车辆与订单</div>
            <div className="inspector-card crew-vehicle-card">
              <div className="crew-vehicle-line">
                <VehicleIcon template={vd} size={34} />
                <div>
                  <strong>{vd.name}</strong>
                  <span>{getInspectorVehicleOrderSummary(vd)}{vehicle && vehicle.policyCertified ? ' · 合规已更新' : ''}</span>
                </div>
              </div>
              <div className="crew-order-chips">
                {vd.eligible.map((oid) => {
                  const o = ORDERS.find((x) => x.id === oid);
                  return (
                    <span key={oid} className="order-list-chip">
                      <OrderIcon orderId={oid} color="currentColor" size={8} />
                      {o.name} ¥{o.fare}
                    </span>
                  );
                })}
              </div>
              <div className="crew-vehicle-meta">
                <span>购入价 <strong>¥{vd.price.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* V15.22: 换车/分配、解雇、卖车统一收到底部,避免训练区被低频操作打断。
            V15.40b:组建第三车组后解锁解雇/卖车,并保留二次确认。 */}
        {driver && (
          <details className="inspector-section inspector-other-actions" open>
            <summary className="inspector-section-title">其他操作</summary>
            <div className="inspector-other-action-list">
              <div className="vehicle-manage-card">
                <div>
                  <div className="vehicle-manage-title">{vd ? `车辆: ${vd.name}` : '车辆: 未分配'}</div>
                  <div className="vehicle-manage-sub">{vd ? getInspectorVehicleOrderSummary(vd) : '分配车辆后才能接单'}</div>
                </div>
                <button className="btn btn-primary btn-xs" onClick={() => setShowVehicleSwap(true)}>
                  {vd ? '换车' : '分配'}
                </button>
              </div>
              {E.isUIGateUnlocked(state, 'risk_actions') && canFireDriver && (
                <button className="btn btn-ghost btn-danger"
                  onClick={() => {
                    const severance = driver.salary * 2;
                    requestConfirm({
                      tag: '其他操作',
                      title: `确认解雇 ${driver.name}？`,
                      message: `需支付 2 个月补偿 ¥${severance.toLocaleString()}。${driverBusy ? '\n注意：当前正在跑单，订单会中断。' : ''}`,
                      confirmLabel: '解雇',
                      danger: true,
                      onConfirm: () => dispatch({ type: 'FIRE_DRIVER', driverId: driver.id }),
                    });
                  }}>
                  解雇 {driver.name}(补偿 ¥{(driver.salary * 2).toLocaleString()})
                </button>
              )}
              {E.isUIGateUnlocked(state, 'risk_actions') && canSellVehicle && (() => {
                const refund = Math.round(vd.price * 0.6);
                return (
                  <button className="btn btn-ghost btn-danger"
                    onClick={() => {
                      requestConfirm({
                        tag: '其他操作',
                        title: `卖出 ${vd.name}？`,
                        message: `回收 ¥${refund.toLocaleString()}（60% 残值）。${vehicleBusy ? '\n注意：当前正在跑单，订单会中断。' : ''}`,
                        confirmLabel: '卖车',
                        danger: true,
                        onConfirm: () => dispatch({ type: 'SELL_VEHICLE', vehicleId: vehicle.id }),
                      });
                    }}>
                    卖车 {vd.name}(回收 ¥{refund.toLocaleString()})
                  </button>
                );
              })()}
            </div>
          </details>
        )}
      </div>
    </div>
    {driver && showVehicleSwap && (
      <VehicleSwapModal
        driver={driver}
        vehicles={vehicles}
        drivers={drivers}
        dispatch={dispatch}
        onClose={() => setShowVehicleSwap(false)}
      />
    )}
    </>
  );
}

/* ============== 弹窗 ============== */
