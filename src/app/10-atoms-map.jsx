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
