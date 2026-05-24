// V6: 抽卡式招募 — 付一次券钱 → 看 3 名候选 → 挑 1 名入队
const RARITY_ORDER = ['N', 'R', 'SR', 'SSR'];

function formatTicketRate(prob) {
  return `${Math.round((prob || 0) * 100)}%`;
}

function getTicketProbRows(ticket) {
  return RARITY_ORDER.map((rarity, idx) => ({
    rarity,
    meta: RARITY_META[rarity],
    prob: ticket.probs?.[idx] || 0,
  })).filter((row) => row.prob > 0);
}

function RecruitModal({ state, dispatch, onClose }) {
  const cards = state.gachaCards;
  const funds = state.funds;

  // 没抽过卡:展示券选择
  if (!cards) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal recruit-modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 980}}>
          <div className="modal-title">招募新司机</div>
          <div className="modal-desc">付一次券钱,先看 3 名候选,再挑 1 名加入车队。</div>
          <div className="ticket-list">
            {RECRUIT_TICKETS.map((t) => {
              const enough = funds >= t.cost;
              const probRows = getTicketProbRows(t);
              return (
                <div key={t.id} className={`ticket-card ${t.id}`}>
                  <div className="ticket-top">
                    <img className="ticket-icon" src={`assets/pixel/icons/ticket-${t.id}.png`} alt="" draggable="false" />
                    <div className="ticket-top-copy">
                      <span className="ticket-name">{t.name}</span>
                    </div>
                    <span className="ticket-cost">¥{t.cost.toLocaleString()}</span>
                  </div>
                  <div className="ticket-desc">{t.desc}</div>
                  <div className="ticket-prob-card">
                    <div className="ticket-prob-title">候选水平</div>
                    <div className="ticket-prob-list">
                      {probRows.map((row) => (
                        <span
                          key={row.rarity}
                          className="ticket-prob-chip"
                          style={{
                            '--prob-color': row.meta.color,
                            '--prob-width': `${Math.round((row.prob || 0) * 100)}%`,
                          }}
                        >
                          <span className="ticket-prob-name">
                            <i aria-hidden="true" />
                            {row.meta.name}
                          </span>
                          <span className="ticket-prob-meter" aria-hidden="true"><span /></span>
                          <strong>{formatTicketRate(row.prob)}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm btn-block"
                    disabled={!enough}
                    onClick={() => dispatch({type: 'GACHA_START', ticketId: t.id})}
                  >
                    {enough ? `花 ¥${t.cost.toLocaleString()} 看 3 人` : '资金不足'}
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
        <div className="modal-desc">{ticket?.name} · 选 1 名加入车队</div>
        <div className="gacha-grid">
          {cards.map((card) => {
            const meta = RARITY_META[card.rarity];
            // V15.16:展示初始忠诚 + 离队阈值,让玩家知道高稀有度反直觉留人成本
            const loyaltyRule = E.getRarityLoyaltyRule(card.rarity);
            const normalCap = loyaltyRule?.normalCap ?? 100;
            const quitLine = loyaltyRule?.quitBelow ?? 30;
            const isHighRarity = card.rarity === 'SR' || card.rarity === 'SSR';
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
                  <div className="gacha-bg">{getDriverRoleLabel(card)}</div>
                  <div className="gacha-salary">月薪 ¥{card.salary.toLocaleString()}</div>
                </div>
                <div className="gacha-stats-block">
                  <StatBars stats={card.stats} caps={card.statCaps || E.computeStatCaps(card)} compact />
                </div>
                <div className="gacha-loyalty-info">
                  忠诚 {card.loyalty ?? 50} · 普通上限 {normalCap} · 跌破 {quitLine} 离队
                </div>
                {isHighRarity && (
                  <div className="gacha-rarity-warning">
                    稀有度高 · 初始忠诚低 · 留人成本大
                  </div>
                )}
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
      <div className="modal shop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">4S 店:买新车</div>
        <div className="shop-grid">
          {VEHICLES.map((v) => {
            // V12: 车型只用钱解锁,口碑门槛已删除
            const cantAfford = state.funds < v.price;
            return (
              <div key={v.id} className="shop-item">
                <div className="shop-image"><VehicleIcon template={v} size={72} /></div>
                <div className="shop-info">
                  <div className="shop-name-row">
                    <span className="shop-name">{v.name}</span>
                    <span className="shop-price">¥{v.price.toLocaleString()}</span>
                  </div>
                  <div className="shop-meta">可接 {v.eligible.length} 类订单</div>
                  <div className="shop-orders">
                    {v.eligible.map((o) => {
                      const od = ORDERS.find((x) => x.id === o);
                      return (
                        <span key={o} className="shop-order-chip">
                          <OrderIcon orderId={o} color="currentColor" size={10} />
                          {od.name}
                        </span>
                      );
                    })}
                  </div>
                  <button className="btn btn-primary btn-sm btn-block" disabled={cantAfford} onClick={() => onBuyVehicle(v.id)}>
                    {cantAfford ? '资金不足' : '购买'}
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

// V14.29: 订单目标 — 用 zone.orderMix 推导可刷出该订单的片区集合,挑门槛最低的;
//      车组判断要"同一司机配能接此订单的车"(canTakeOrder 等价),避免分别匹配出错。
function computeOrderUnlockStatus(order, state) {
  const reqStat = order.req || {};
  const reqStatKeys = Object.keys(reqStat);

  // 1. 片区:从 zone.orderMix 找出能刷该订单的所有片区,挑门槛最低
  const candidateZones = ZONES.filter((z) => getZoneOrderWeight(z, order.id) > 0);
  const sortedByThreshold = candidateZones.slice().sort((a, b) => {
    const aT = (a.unlock && a.unlock.reputation) || 0;
    const bT = (b.unlock && b.unlock.reputation) || 0;
    return aT - bT;
  });
  const easiestZone = sortedByThreshold[0];
  const unlockedZone = sortedByThreshold.find((z) => E.isZoneUnlocked(state, z));
  const zoneStatus = unlockedZone
    ? { ok: true, label: `片区 · ${unlockedZone.name} 已解锁`, missing: null }
    : easiestZone
      ? {
          ok: false,
          label: `片区 · ${easiestZone.name}`,
          missing: `口碑 ≥ ${(easiestZone.unlock && easiestZone.unlock.reputation) || 0}(当前 ${state.reputation})`,
        }
      : { ok: false, label: '片区', missing: '该订单暂无片区可刷出' };

  // 2. 车组配对:必须存在"司机+车"组合同时满足属性门槛 + 车型 eligible
  const validCrew = state.drivers.find((d) => {
    if (!d.vehicleId) return false;
    if (!reqStatKeys.every((k) => (d.stats[k] || 0) >= (reqStat[k] || 0))) return false;
    const v = state.vehicles.find((x) => x.id === d.vehicleId);
    if (!v) return false;
    const vd = E.getVehicleData(v);
    return vd && vd.eligible.includes(order.id);
  });

  const driverMatch = state.drivers.find((d) =>
    reqStatKeys.every((k) => (d.stats[k] || 0) >= (reqStat[k] || 0))
  );
  const vehicleMatch = state.vehicles.find((v) => {
    const vd = E.getVehicleData(v);
    return vd && vd.eligible.includes(order.id);
  });
  const eligibleVehicleNames = VEHICLES.filter((v) => v.eligible.includes(order.id)).map((v) => v.name);

  const statStatus = reqStatKeys.length === 0
    ? { ok: true, label: '司机属性 · 无门槛', missing: null }
    : driverMatch
      ? { ok: true, label: `司机属性 · ${driverMatch.name} 已达标`, missing: null }
      : {
          ok: false,
          label: '司机属性',
          missing: reqStatKeys.map((k) => `${E.statName(k)} ≥ ${reqStat[k]}`).join(' + '),
        };

  const vehicleStatus = vehicleMatch
    ? { ok: true, label: `车型 · ${E.getVehicleData(vehicleMatch).name} 可接`, missing: null }
    : {
        ok: false,
        label: '车型',
        missing: `需要 ${eligibleVehicleNames.join(' / ')}`,
        actionable: 'shop',
      };

  // 司机和车都达标但不在同一车组 → 加一条"配对"提示(避免误标已解锁)
  if (!validCrew && driverMatch && vehicleMatch) {
    return {
      order,
      zone: zoneStatus,
      stat: { ok: false, label: '车组配对', missing: `把 ${driverMatch.name} 配到 ${E.getVehicleData(vehicleMatch).name}(司机和能接此单的车要在同一车组)` },
      vehicle: vehicleStatus,
      unlocked: false,
    };
  }

  return {
    order,
    zone: zoneStatus,
    stat: statStatus,
    vehicle: vehicleStatus,
    unlocked: zoneStatus.ok && !!validCrew && statStatus.ok && vehicleStatus.ok,
  };
}

function getNextRoadmapTarget(allStatus) {
  const locked = allStatus.filter((s) => !s.unlocked);
  if (locked.length === 0) return null;
  return locked.slice().sort((a, b) => {
    const am = (a.zone.ok ? 0 : 1) + (a.stat.ok ? 0 : 1) + (a.vehicle.ok ? 0 : 1);
    const bm = (b.zone.ok ? 0 : 1) + (b.stat.ok ? 0 : 1) + (b.vehicle.ok ? 0 : 1);
    if (am !== bm) return am - bm;
    return a.order.fare - b.order.fare;
  })[0];
}

const MISSION_ORDER_TARGETS = {
  m11_first_airport: 'airport',
  m16_first_luxury: 'luxury',
};

function getMissionRouteRows(state, orderStatusById) {
  // V15.16:路线只展示玩家需要主动推进的任务;hidden 里程碑在后台静默完成。
  const completedSet = new Set(state.completedMissionIds || []);
  const missionVisible = (m) => !m.hidden && (!E.isMissionAvailable || E.isMissionAvailable(state, m));
  const currentMission = MISSIONS.find((m) => !completedSet.has(m.id) && missionVisible(m));
  return MISSIONS
    .filter(missionVisible)
    .map((mission, idx) => {
    const orderId = MISSION_ORDER_TARGETS[mission.id];
    const orderStatus = orderId ? orderStatusById[orderId] : null;
    const isDone = completedSet.has(mission.id);
    const isCurrent = currentMission && currentMission.id === mission.id;
    const stateClass = isDone ? 'done' : isCurrent ? 'current' : 'locked';
    const stateLabel = isDone
      ? '已完成'
      : isCurrent
        ? '当前任务'
        : '未开始';
    return { mission, idx, orderStatus, stateClass, stateLabel };
  });
}
