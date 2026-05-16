function CrewCompact({ driver, vehicle, selected, linked, onClick }) {
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const status = getDriverWorkState(driver, vehicle);
  const lightClass = driver.status === 'driving' ? 'driving'
    : !vehicle ? 'empty' : 'idle';
  const showWorkStatus = lightClass === 'empty';
  const loyaltyMeta = getLoyaltyMeta(driver);
  // V15.17:经典三段式 — 头像(left) + 名字+车型(center) + 状态/忠诚(right),
  //         横向单行,跟打车软件司机卡视觉一致。
  const orderText = vd ? getVehicleOrderSummary(vd) : null;
  return (
    <div className={`compact-card crew-card crew-card-row ${selected ? 'selected' : ''} ${linked ? 'linked' : ''}`} onClick={onClick}>
      <div className="crew-row-avatar">
        <DriverAvatar avatar={driver.avatar} size={36} name={driver.name} />
      </div>
      <div className="crew-row-info">
        <strong className="crew-row-name">{driver.name}</strong>
        {vd ? (
          <span className="crew-row-meta" title={`${vd.name} · 可接 ${getVehicleOrderFullSummary(vd)}`}>
            <VehicleIcon template={vd} size={18} />
            <span className="crew-row-order">{orderText}</span>
          </span>
        ) : (
          <span className="crew-row-meta empty">
            <span className="crew-row-no-vehicle">未配车</span>
            <span className="crew-row-meta-divider">·</span>
            <span className="crew-row-order">点击分配</span>
          </span>
        )}
      </div>
      <div className="crew-row-right">
        {showWorkStatus && (
          <span className={`crew-status-pill ${lightClass}`} title={status}>
            <i className={`cc-status-light ${lightClass}`} />
            {status}
          </span>
        )}
        <span className={`crew-loyalty-mini ${loyaltyMeta.cls}`} title={`${loyaltyMeta.label} · ${loyaltyMeta.effect}`}>
          忠诚 {driver.loyalty ?? 50}
        </span>
      </div>
    </div>
  );
}

function FleetPanel({
  state,
  dispatch,
  selectedDriverId,
  selectedVehicleId,
  selectedVehicle,
  selectedDriver,
  onSelectDriver,
  onSelectVehicle,
  onClearSelection,
  onRecruit,
  onShop,
  onOpenRoadmap,
}) {
  // V14.6: 删除 crews/pending 两 tab 和顶部待处理横条,
  // 配车缺口直接由未配车司机/空车卡片自身表达。
  const drivers = state.drivers;
  const vehicles = state.vehicles;
  const emptyVehicles = vehicles.filter((v) => !drivers.some((d) => d.vehicleId === v.id));
  const operatingCrews = drivers.filter((d) => d.vehicleId && vehicles.some((v) => v.id === d.vehicleId)).length;
  const sortedDrivers = [...drivers].sort((a, b) => {
    const av = a.vehicleId ? 1 : 0;
    const bv = b.vehicleId ? 1 : 0;
    if (av !== bv) return bv - av;
    return a.id - b.id;
  });
  return (
    <div className="panel panel-tight fleet-panel">
      <MissionBar state={state} onOpenRoadmap={onOpenRoadmap} />
      {(() => {
        // V15.17 修订:去掉常态任务驱动 spotlight(用户反馈红点一直挂着烦)。
        // 改用 state.spotlight 模型 — 仅在新解锁后 12 游戏小时内闪,玩家点过即清。
        const spotGate = state.spotlight?.gateId;
        const recruitSpotlight = spotGate === 'recruit_btn';
        const shopSpotlight = spotGate === 'shop_btn';
        const onRecruitClick = () => {
          if (recruitSpotlight) dispatch({ type: 'ACK_SPOTLIGHT', gateId: 'recruit_btn' });
          onRecruit();
        };
        const onShopClick = () => {
          if (shopSpotlight) dispatch({ type: 'ACK_SPOTLIGHT', gateId: 'shop_btn' });
          onShop();
        };
        return (
          <div className="panel-header fleet-panel-header">
            <span className="fleet-title-row">
              <span className="panel-title">车队</span>
              <span className="fleet-count-inline">{operatingCrews} 车组</span>
            </span>
            <div className="fleet-actions">
              {/* V15.17:招募/买车按 gate 解锁,开局藏起,跑完第一日 / 买第三辆车后露出 */}
              {E.isUIGateUnlocked(state, 'recruit_btn') && (
                <button className={`btn btn-ghost btn-xs ${recruitSpotlight ? 'ui-spotlight' : ''}`} onClick={onRecruitClick}>+ 招募</button>
              )}
              {E.isUIGateUnlocked(state, 'shop_btn') && (
                <button className={`btn btn-ghost btn-xs ${shopSpotlight ? 'ui-spotlight' : ''}`} onClick={onShopClick}>+ 买车</button>
              )}
            </div>
          </div>
        );
      })()}
      <div className="compact-list fleet-list">
        {sortedDrivers.map((d) => {
          const vehicle = vehicles.find((v) => v.id === d.vehicleId);
          return (
            <CrewCompact
              key={`d-${d.id}`}
              driver={d}
              vehicle={vehicle}
              selected={selectedDriverId === d.id || (selectedVehicle ? d.vehicleId === selectedVehicle.id : false)}
              linked={selectedVehicle ? d.vehicleId === selectedVehicle.id : false}
              onClick={() => onSelectDriver(d.id)}
            />
          );
        })}
        {/* V14.2: 空车作为虚拟卡片排在列表最后,点击进入 CrewInspector 分配司机
            V15.17:同步改为三段式 — 空头像位 + 车型 meta + 「空车」chip */}
        {emptyVehicles.map((v) => {
          const tpl = E.getVehicleData(v);
          const isSelected = selectedVehicleId === v.id;
          return (
            <div key={`v-${v.id}`} className={`compact-card crew-card crew-card-row empty-vehicle-card ${isSelected ? 'selected' : ''}`}
                 onClick={() => onSelectVehicle(v.id)}>
              <div className="crew-row-avatar">
                <div className="crew-empty-avatar">空</div>
              </div>
              <div className="crew-row-info">
                <strong className="crew-row-name">{tpl.name}</strong>
                <span className="crew-row-meta" title={`${tpl.name} · 可接 ${getVehicleOrderFullSummary(tpl)}`}>
                  <VehicleIcon template={tpl} size={18} />
                  <span className="crew-row-order">{getVehicleOrderSummary(tpl)}</span>
                </span>
              </div>
              <div className="crew-row-right">
                <span className="crew-status-pill empty" title="空车">
                  <i className="cc-status-light empty" />
                  空车
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
  // V12: 车型只用钱解锁,不再展示"口碑 X 解锁"
  return `可接 ${getVehicleOrderSummary(vd)}`;
}

function getZoneOrderWeight(zone, orderId) {
  if (zone?.orderMix && zone.orderMix[orderId] !== undefined) return zone.orderMix[orderId];
  if (Array.isArray(zone?.hot)) return zone.hot.includes(orderId) ? 1 : 0;
  return 0;
}

function getZoneOrderRows(zone) {
  const total = ORDERS.reduce((sum, order) => sum + getZoneOrderWeight(zone, order.id), 0) || 1;
  // 固定为 ORDERS 的业务顺序:出租车 → 快车 → 专车 → 豪华车,方便横向比较片区。
  return ORDERS
    .map((order) => {
      const weight = getZoneOrderWeight(zone, order.id);
      const percent = Math.round(weight / total * 100);
      const minFare = Math.round(order.fare * 0.9);
      const maxFare = Math.round(order.fare * 1.2);
      const freq = percent >= 35 ? '高频' : percent >= 15 ? '常见' : '少量';
      return { order, weight, percent, freq, minFare, maxFare };
    })
    .filter((row) => row.weight > 0);
}
