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
