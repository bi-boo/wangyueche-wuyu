const VEHICLE_ASSET_VERSION = 'vehicle-art-20260512-2';

function DriverAvatar({ avatar, size = 36, name = '?' }) {
  const bg = avatar?.hatColor || '#FF6B35';
  const hat = avatar?.hat || 'default';
  const fallbackAssets = {
    'cap-army': 'veteran',
    'cap-flat': 'beidrift',
    glasses: 'dad',
    bald: 'unemployed',
    headset: 'influencer',
    default: 'beidrift',
  };
  const assetId = avatar?.asset || fallbackAssets[hat] || fallbackAssets.default;
  const src = `assets/pixel/avatars/${assetId}.png`;
  return (
    <div className="ph-avatar" data-asset={`avatar-${assetId}`}
      style={{ width: size, height: size, background: bg, color: '#FFF8E7', fontSize: Math.round(size * 0.42) }}>
      <img src={src} alt={name} draggable="false" />
    </div>
  );
}

function VehicleIcon({ template, size = 60 }) {
  if (!template) return null;
  const src = `assets/pixel/vehicles/${template.id}.png?v=${VEHICLE_ASSET_VERSION}`;
  return (
    <div className={`ph-vehicle asset-vehicle vehicle-${template.id}`} data-asset={`vehicle-${template.id}`}
      style={{ width: size * 2.15, height: size * 0.86, background: template.color, color: '#FFF8E7',
        fontSize: Math.max(10, Math.round(size * 0.20)) }}>
      <img src={src} alt={template.name} draggable="false" />
    </div>
  );
}

const ORDER_ICON_META = {
  short: { label: '租', cls: 'short' },
  business: { label: '快', cls: 'business' },
  airport: { label: '专', cls: 'airport' },
  luxury: { label: '豪', cls: 'luxury' },
};

function OrderIcon({ orderId, color, size = 14 }) {
  const meta = ORDER_ICON_META[orderId] || ORDER_ICON_META.short;
  const badgeSize = Math.max(16, size);
  return (
    <span
      className={`ph-order-dot order-${meta.cls}`}
      data-asset={`order-${orderId}`}
      style={{ width: badgeSize, height: badgeSize }}
      aria-hidden="true"
    >
      {meta.label}
    </span>
  );
}

/* ============== 通用组件 ============== */

function StatBars({ stats, compact, caps }) {
  // V14: 属性砍到 2 项,driving 决定订单解锁,service 影响好评率
  const items = [
    { key: 'driving', label: '车技', color: '#FF6B35' },
    { key: 'service', label: '服务', color: '#0EA5E9' },
  ];
  return (
    <div className={`stat-bars ${compact ? 'compact' : ''}`}>
      {items.map((it) => (
        <div key={it.key} className={`stat-bar-row ${caps ? 'with-cap' : ''}`}>
          <span className="stat-bar-label" style={{color: it.color}}>
            <span>{it.label}</span>
          </span>
          <div className="stat-bar-track">
            <div className="stat-bar-fill" style={{transform: `scaleX(${Math.min(100, stats[it.key]) / 100})`, background: it.color}} />
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

function CityMap({ zones, drivers, state, selectedZoneId, onSelectZone }) {
  const floatGains = state?.floatGains || [];
  return (
    <svg viewBox="0 0 100 100" className="city-map-svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* V14.7.1: 战争迷雾 — 加强模糊半径(0.9 → 1.6)让边缘更柔,
            外溢区域扩大到 ±30% 避免雾被裁切。雾色改用项目主墨色调和暖色底图。 */}
        <filter id="zone-fog" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
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
                fill={unlocked ? z.color : '#2A2320'}
                opacity={unlocked ? '0.12' : '0.45'}
                filter={!unlocked ? 'url(#zone-fog)' : undefined}
              />
            ) : (
              <circle cx={z.x} cy={z.y} r={10} fill={unlocked ? z.color : '#2A2320'} opacity={unlocked ? '0.12' : '0.45'}
                filter={!unlocked ? 'url(#zone-fog)' : undefined} />
            )}
            {/* V14.6: 删除 heat 圆圈/数字 ; V14.7: 战争迷雾 + 锁/解锁条件合并成单行 */}
            <text className="district-name" x={z.x} y={unlocked ? z.y + 0.6 : z.y - 2.5} fontSize="3.4" textAnchor="middle" fontWeight="800">{z.name}</text>
            {!unlocked && (
              <text className="district-lock-text" x={z.x} y={z.y + 4.5} fontSize="2.6" textAnchor="middle" fontWeight="700">
                {unlockText.replace('解锁: ', '')} 解锁
              </text>
            )}
          </g>
        );
      })}
      {drivers.filter((d) => d.status === 'driving').map((d) => {
        const order = d.currentOrder;
        if (!order) return null;
        const zone = zones.find((z) => z.id === order.zone);
        if (!zone) return null;
        const vehicle = state?.vehicles?.find((v) => v.id === d.vehicleId);
        const template = vehicle ? E.getVehicleData(vehicle) : null;
        const vehicleSrc = template ? `assets/pixel/vehicles/${template.id}.png?v=${VEHICLE_ASSET_VERSION}` : null;
        // V14.67: lane / animationDelay 只依赖 d.id(稳定),避免数组 index 因其他司机完单/解雇导致位置跳跃。
        const lane = ((d.id * 3) % 8) / 8;
        const angle = lane * Math.PI * 2;
        const r = 3.8;
        const x = zone.x + Math.cos(angle) * r;
        const y = zone.y + Math.sin(angle) * r;
        const carW = template?.shape === 'luxury' ? 12.8 : 11.4;
        const carH = carW * 0.4;
        return (
          <g key={d.id} className="city-car" style={{animationDelay: `${-(d.id % 8) * 0.25}s`}}>
            {vehicleSrc ? (
              <image
                className="city-map-vehicle-image"
                href={vehicleSrc}
                x={x - carW / 2}
                y={y - carH / 2}
                width={carW}
                height={carH}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <rect x={x - 3.2} y={y - 1.6} width="6.4" height="3.2" rx="0.8" fill={order.color || '#FF6B35'} stroke="#2A2320" strokeWidth="0.5" />
            )}
            <g className="city-car-driver-badge">
              <circle cx={x - carW / 2 + 1.15} cy={y - carH / 2 - 0.45} r="1.15" />
              <text x={x - carW / 2 + 1.15} y={y - carH / 2 + 0.08} fontSize="1.18" textAnchor="middle">{d.name.slice(0, 1)}</text>
            </g>
          </g>
        );
      })}
      {floatGains.map((gain, idx) => {
        const zone = zones.find((z) => z.id === gain.zoneId);
        if (!zone) return null;
        const jitter = ((gain.driverId || idx) % 5 - 2) * 1.8;
        const x = Math.max(9, Math.min(91, zone.x + jitter));
        const y = Math.max(11, Math.min(86, zone.y - 9 - (idx % 3) * 2.8));
        const text = `+¥${gain.amount}`;
        const coinX = Math.min(94, x + Math.min(8.2, text.length * 1.1 + 1.6));
        return (
          <g key={`${gain.id}-${idx}`} className="city-income-pop">
            <text x={x} y={y} fontSize="2.55" textAnchor="middle">{text}</text>
            <g className="city-income-coin-anchor" transform={`translate(${coinX} ${y - 0.75})`}>
              <g className="city-income-coin">
                <circle r="1.18" />
                <path d="M -0.38 -0.66 L 0.46 -0.66 L 0.18 0.66 L -0.66 0.66 Z" />
                <rect x="-0.16" y="-0.78" width="0.24" height="1.56" />
              </g>
            </g>
            <g className="city-income-sparkles-anchor" transform={`translate(${coinX} ${y - 0.75})`}>
              <g className="city-income-sparkles">
                <circle className="sparkle s1" cx="-1.5" cy="-1.35" r="0.26" />
                <circle className="sparkle s2" cx="1.52" cy="-1.1" r="0.22" />
                <circle className="sparkle s3" cx="1.2" cy="1.35" r="0.2" />
              </g>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* V14.9: CityOrderLayer 已删除 — 永远 return null,带着整套 dispatchOffers 一起死代码清理 */

/* ============== V10.6: 左侧目标板 ============== */
