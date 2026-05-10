function CrewCompact({ driver, vehicle, selected, linked, onClick }) {
  const vd = vehicle ? E.getVehicleData(vehicle) : null;
  const status = getDriverWorkState(driver, vehicle);
  const lightClass = driver.status === 'driving' ? 'driving'
    : !vehicle ? 'empty' : 'idle';
  const showWorkStatus = lightClass === 'empty';
  const loyaltyMeta = getLoyaltyMeta(driver);
  // V14.27: 左侧车队只承载状态和累计值,收入动效统一放在地图里。
  return (
    <div className={`compact-card crew-card ${selected ? 'selected' : ''} ${linked ? 'linked' : ''}`} onClick={onClick}>
      <div className="crew-stack">
        <div className="crew-entity crew-person">
          <DriverAvatar avatar={driver.avatar} size={34} name={driver.name} />
          <div className="crew-entity-copy">
            <strong>{driver.name}</strong>
          </div>
        </div>
        <div className={`crew-entity crew-vehicle ${vd ? '' : 'empty'}`}>
          {vd ? <VehicleIcon template={vd} size={28} /> : <div className="crew-no-vehicle">无车</div>}
          <div className={`crew-entity-copy ${vd ? 'vehicle-order-copy' : ''}`}>
            {vd ? (
              <span className="crew-order-summary" title={getVehicleOrderFullSummary(vd)}>
                {getVehicleOrderSummary(vd)}
              </span>
            ) : (
              <>
                <strong>未配车</strong>
                <span>选择空车</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="crew-side">
        {showWorkStatus && (
          <span className={`crew-status-pill ${lightClass}`} title={status}>
            <i className={`cc-status-light ${lightClass}`} />
            {status}
          </span>
        )}
        <span className={`crew-loyalty-mini ${loyaltyMeta.cls}`} title={`${loyaltyMeta.label} · ${loyaltyMeta.effect}`}>
          忠诚 {driver.loyalty ?? 50}
        </span>
        {/* V15.16 audit:已赚累计金额对玩家决策无意义,移除以减少视觉噪音 */}
        {/* V15.16:调薪入口移到右侧 inspector 「能力训练」忠诚行,与车技/服务统一交互 */}
      </div>
    </div>
  );
}

function FleetPanel({
  state,
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
        // V15.17:任务驱动 spotlight — 当前任务对应的入口加 pulse 动画 + 红点
        const completedSet = new Set(state.completedMissionIds || []);
        const currentMission = MISSIONS.find((m) => !completedSet.has(m.id) && !m.hidden);
        const currentId = currentMission?.id;
        const recruitTargets = ['m4_recruit_third_driver', 'm12_five_crews'];
        const shopTargets = ['m3_buy_third_car', 'm9_buy_camry', 'm13_buy_benz'];
        const recruitSpotlight = recruitTargets.includes(currentId);
        const shopSpotlight = shopTargets.includes(currentId);
        return (
          <div className="panel-header fleet-panel-header">
            <span className="panel-title">车队</span>
            <div className="fleet-actions">
              {/* V15.17:招募/买车按 gate 解锁,开局藏起,m1/m2 完成后露出 */}
              {E.isUIGateUnlocked(state, 'recruit_btn') && (
                <button className={`btn btn-ghost btn-xs ${recruitSpotlight ? 'ui-spotlight' : ''}`} onClick={onRecruit}>+ 招募</button>
              )}
              {E.isUIGateUnlocked(state, 'shop_btn') && (
                <button className={`btn btn-ghost btn-xs ${shopSpotlight ? 'ui-spotlight' : ''}`} onClick={onShop}>+ 买车</button>
              )}
            </div>
            <div className="fleet-status-line">
              <span>{operatingCrews} 车组</span>
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
        {/* V14.2: 空车作为虚拟卡片排在列表最后,点击进入 CrewInspector 分配司机 */}
        {emptyVehicles.map((v) => {
          const tpl = E.getVehicleData(v);
          const isSelected = selectedVehicleId === v.id;
          return (
            <div key={`v-${v.id}`} className={`compact-card crew-card empty-vehicle-card ${isSelected ? 'selected' : ''}`}
                 onClick={() => onSelectVehicle(v.id)}>
              <div className="crew-stack">
                <div className="crew-entity crew-vehicle">
                  <VehicleIcon template={tpl} size={28} />
                  <div className="crew-entity-copy vehicle-order-copy">
                    <span className="crew-order-summary" title={getVehicleOrderFullSummary(tpl)}>
                      {getVehicleOrderSummary(tpl)}
                    </span>
                  </div>
                </div>
                <div className="crew-entity crew-person empty">
                  <div className="crew-empty-avatar">空</div>
                  <div className="crew-entity-copy">
                    <strong>待配司机</strong>
                    <span>点击分配</span>
                  </div>
                </div>
              </div>
              <div className="crew-side">
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
  // 固定为 ORDERS 的业务顺序:特惠 → 快车 → 专车 → 豪华车,方便横向比较片区。
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

