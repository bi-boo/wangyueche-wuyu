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
