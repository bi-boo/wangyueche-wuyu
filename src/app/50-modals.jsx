function Tutorial({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [measuredSpot, setMeasuredSpot] = React.useState(null);
  const STEPS = [
    {
      tag: '开局',
      title: '把两辆桑塔纳先跑起来',
      text: <>你现在有 <strong>¥10,000</strong>、<strong>2 名司机</strong> 和 <strong>2 辆桑塔纳</strong>。第一局先别想复杂经营,目标就是让车队开始接单、赚钱、涨口碑。</>,
      bubble: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    },
    {
      spotSelector: '.topbar-kpis',
      tag: '状态',
      title: '先看钱和口碑',
      text: <>顶部只需要盯两件事:<strong>资金</strong>别变负,<strong>口碑</strong>越高越容易解锁新片区。时间和供需用来判断车队是不是跑得顺。</>,
      bubble: { top: 96, left: '50%', transform: 'translateX(-50%)' },
    },
    {
      spot: { top: 88, left: 14, width: 300, height: 118 },
      tag: '任务',
      title: '照着任务推进',
      text: <>左上角会告诉你<strong>当前目标</strong>。看不懂为什么卡住时,点<strong>查看目标</strong>,里面会说明下一类订单需要什么车、什么司机。</>,
      bubble: { top: 100, left: 334 },
    },
    {
      spot: { top: 210, left: 14, width: 300, height: 276 },
      tag: '车队',
      title: '车组是核心对象',
      text: <>一名司机配一辆车才算一个<strong>车组</strong>。点左侧车组,右侧可以训练司机、换车或处理空车,这是后面解锁专车和豪华车的关键。</>,
      bubble: { top: 244, left: 334 },
    },
    {
      spot: { bottom: 20, left: 'calc(50% - 124px)', width: 248, height: 62 },
      tag: '开始',
      title: '现在点开始运营',
      text: <>司机会自动从已解锁片区接单。第一次只需要点<strong>开始运营</strong>;跑起来后再用 2×/4×/8× 压缩等待时间。</>,
      bubble: { bottom: 100, left: '50%', transform: 'translateX(-50%)' },
      isLast: true,
    },
  ];

  const cur = STEPS[step];
  React.useEffect(() => {
    if (!cur.spotSelector) {
      setMeasuredSpot(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(cur.spotSelector);
      if (!el) {
        setMeasuredSpot(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const pad = 5;
      setMeasuredSpot({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step, cur.spotSelector]);

  const handleNext = () => {
    SFX.click && SFX.click();
    if (step >= STEPS.length - 1) onClose();
    else setStep(step + 1);
  };
  const handleSkip = () => { SFX.click && SFX.click(); onClose(); };

  return (
    <div className="coach-root">
      {(measuredSpot || cur.spot)
        ? <div className="coach-spot" style={measuredSpot || cur.spot} />
        : <div className="coach-mask-full" />}
      <div className="coach-bubble" style={cur.bubble}>
        <div className="coach-step-num">{cur.tag}</div>
        <div className="coach-title">{cur.title}</div>
        <div className="coach-text">{cur.text}</div>
        <div className="coach-actions">
          <div className="coach-progress" aria-label={`引导进度 ${step + 1}/${STEPS.length}`}>
            {STEPS.map((_, idx) => (
              <span key={idx} className={idx <= step ? 'active' : ''} />
            ))}
          </div>
          <button className="coach-skip" onClick={handleSkip}>跳过</button>
          <button className="coach-next" onClick={handleNext}>
            {cur.isLast ? '知道了' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

function previewEventEffect(event, option, state) {
  try {
    const raw = option.apply(state) || {};
    if (event?.skipScale || raw.skipScale) return raw;
    return E.scaleEventEffect ? E.scaleEventEffect(raw, state) : raw;
  } catch (e) {
    return { previewError: true };
  }
}

function getEventOptionDisabledReason(option, state) {
  if (!option || !state) return '';
  if (option.requireFunds !== undefined && state.funds < option.requireFunds) {
    return `资金不足,需要 ¥${option.requireFunds.toLocaleString()}`;
  }
  return '';
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

function detailLooksLikeNumericEffect(detail) {
  return /[¥+\-−]|忠诚|信任|口碑|抽成|事故|订单|失去|留队|合规/.test(detail || '');
}

function formatOrderBoostText(effect) {
  if (!effect.orderBoost || effect.orderBoost === 1) return '';
  const percent = Math.round(Math.abs(effect.orderBoost - 1) * 100);
  const duration = effect.boostDuration ? `,持续 ${effect.boostDuration} 天` : ',持续今天';
  return effect.orderBoost > 1
    ? `接单收入临时提高 ${percent}%${duration}`
    : `接单收入临时降低 ${percent}%${duration}`;
}

// V14: 投资人压力多选弹窗 — 三个开关任意组合 + 兜底「靠流水硬扛」单选
function EventResourceSnapshot({ state, thirdLabel, thirdValue, thirdTone = '' }) {
  if (!state) return null;
  // V15.16 audit:第三列改为可选 — 普通事件不再显示「今日流水」(对决策无意义),
  // 只有显式传 thirdLabel + thirdValue 才显示(债务危机用「到期缺口」、破产用「距破产」)
  const metrics = [
    { label: '资金', value: `¥${state.funds.toLocaleString()}`, tone: state.funds < 0 ? 'danger' : '' },
    { label: '口碑', value: state.reputation },
  ];
  if (thirdLabel && thirdValue !== undefined) {
    metrics.push({ label: thirdLabel, value: thirdValue, tone: thirdTone });
  }
  metrics.push({ label: '司机/车辆', value: `${state.drivers.length}/${state.vehicles.length}` });
  return (
    <div className="event-resource-snapshot" aria-label="当前经营状态">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <strong className={metric.tone}>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DebtCrisisModal({ state, crisis, onResolve }) {
  if (!crisis) return null;
  const debts = E.getDebtSummary ? E.getDebtSummary(state).debts : (crisis.allDebts || []);
  const dueDebts = crisis.dueDebts || [];
  const totalDue = crisis.totalDue || dueDebts.reduce((sum, debt) => sum + (debt.repay || 0), 0);
  const shortfall = Math.max(0, totalDue - (state.funds || 0));
  const totalAll = debts.reduce((sum, debt) => sum + (debt.repay || 0), 0);
  const remainingDays = debts.reduce((sum, debt) => sum + Math.max(0, (debt.dueDay || state.day) - state.day), 0);
  const newDays = Math.max(14, Math.min(60, remainingDays));
  const rawNewTotal = Math.ceil(totalAll * 1.05);
  const newStep = rawNewTotal <= 20000 ? 1000 : rawNewTotal <= 100000 ? 5000 : 10000;
  const newTotal = Math.ceil(rawNewTotal / newStep) * newStep;
  return (
    <div className="modal-overlay debt-crisis-overlay">
      <div className="modal debt-crisis-modal">
        <div className="modal-tag">债务危机</div>
        <div className="modal-title">今日债务到期</div>
        <div className="modal-desc">
          到期应还 <strong>¥{totalDue.toLocaleString()}</strong>,当前资金 <strong>¥{(state.funds || 0).toLocaleString()}</strong>,缺口 <strong className="negative">¥{shortfall.toLocaleString()}</strong>。
        </div>
        {/* V15.16 audit:删除 EventResourceSnapshot 数据栏 — 与描述行重复(到期应还/当前资金/缺口都已展示),
             口碑和司机/车辆与债务决策无关,只增加视觉噪音 */}
        <div className="debt-crisis-section">
          <div className="monthly-section-title">今日到期</div>
          <div className="debt-crisis-list">
            {dueDebts.map((debt) => (
              <div key={debt.id} className="debt-crisis-row danger">
                <span>第 {debt.dueDay} 日 · {debt.label || '债务'}</span>
                <strong>¥{(debt.repay || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="debt-crisis-section">
          <div className="monthly-section-title">全部未还债务</div>
          <div className="debt-crisis-list compact">
            {debts.map((debt) => (
              <div key={debt.id} className="debt-crisis-row">
                <span>{Math.max(0, debt.dueDay - state.day)} 天后 · {debt.label || '债务'}</span>
                <strong>¥{(debt.repay || 0).toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="debt-restructure-preview">
          <span>债务重组</span>
          <strong>合并为 ¥{newTotal.toLocaleString()} · {newDays} 天后到期</strong>
          <em>全部未还债务打包,+5% 手续费;期限按剩余天数累加,最少 14 天、最多 60 天。</em>
        </div>
        <div className="modal-options debt-crisis-actions">
          <button className="modal-option danger-option" onClick={() => onResolve('bankrupt')}>
            <div className="modal-option-label">放弃经营</div>
            <div className="modal-option-effect">进入破产结算</div>
          </button>
          <button className="modal-option primary-option" onClick={() => onResolve('restructure')}>
            <div className="modal-option-label">债务重组</div>
            <div className="modal-option-effect">合并所有贷款,总待还 +5%</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function compactNames(items, getName, limit = 3) {
  const names = (items || []).map(getName).filter(Boolean);
  if (!names.length) return '';
  const shown = names.slice(0, limit).join('、');
  return names.length > limit ? `${shown} 等 ${names.length} 个` : shown;
}

function InvestorPressureModal({ event, state, onResolve }) {
  const [fire, setFire] = useState(false);
  const [sell, setSell] = useState(false);
  const [debt, setDebt] = useState(false);
  const anyPicked = fire || sell || debt;
  const plan = E.getInvestorPressurePlan ? E.getInvestorPressurePlan(state) : null;
  const fireDisabled = !plan || !plan.fireDrivers.length;
  const sellDisabled = !plan || !plan.sellVehicles.length;
  const fireNames = compactNames(plan?.fireDrivers, (d) => d.name);
  const vehicleNames = compactNames(plan?.sellVehicles, (v) => E.getVehicleData(v)?.name || v.name);
  const debtInterestPct = Math.round((plan?.debtInterestRate || 0) * 100);
  // V14.9 修复:之前没考虑 bankruptcyGraceBonus,导致玩家裁过员后再触发投资人事件时
  // 倒计时显示数字会少 +graceBonus 天(实际死亡判定用的是 DEATH_FUNDS_DAYS+graceBonus)
  const daysLeft = Math.max(0, GAME.DEATH_FUNDS_DAYS + (state.bankruptcyGraceBonus || 0) - (state.negFundsDays || 0));
  return (
    <div className="modal-overlay">
      <div className="modal event-modal">
        <div className="event-modal-header">
          <div className="modal-tag">{event.tag}事件</div>
          <div className="modal-title">{event.title}</div>
          <div className="modal-desc">{event.desc}</div>
        </div>
        <EventResourceSnapshot state={state} thirdLabel="距破产" thirdValue={`${daysLeft} 天`} thirdTone="danger" />
        <div className="investor-choices">
          <label className={`investor-choice ${fireDisabled ? 'disabled' : ''}`}>
            <input type="checkbox" checked={fire} disabled={fireDisabled}
              onChange={(e) => setFire(e.target.checked)} />
            <div className="investor-choice-body">
              <div className="investor-choice-label">
                {fireDisabled ? '裁员止血 — 只剩 1 名司机,不可裁' : `裁撤 ${plan.fireDrivers.length} 名高薪司机`}
              </div>
              {!fireDisabled && (
                <div className="investor-choice-detail">
                  {fireNames} · 月省 ¥{plan.monthlySavings.toLocaleString()} · 破产宽容 +{plan.fireGraceDays} 天
                </div>
              )}
            </div>
          </label>
          <label className={`investor-choice ${sellDisabled ? 'disabled' : ''}`}>
            <input type="checkbox" checked={sell} disabled={sellDisabled}
              onChange={(e) => setSell(e.target.checked)} />
            <div className="investor-choice-body">
              <div className="investor-choice-label">
                {sellDisabled ? '卖车回血 — 只剩 1 辆车,不可卖' : `卖出 ${plan.sellVehicles.length} 辆高价车辆`}
              </div>
              {!sellDisabled && (
                <div className="investor-choice-detail">
                  {vehicleNames} · 立刻 +¥{plan.sellRefund.toLocaleString()}(60% 残值)
                </div>
              )}
            </div>
          </label>
          <label className="investor-choice">
            <input type="checkbox" checked={debt}
              onChange={(e) => setDebt(e.target.checked)} />
            <div className="investor-choice-body">
              <div className="investor-choice-label">借高利贷 ¥{(plan?.debtPrincipal || 10000).toLocaleString()}</div>
              <div className="investor-choice-detail">
                覆盖当前缺口 ¥{(plan?.deficit || 0).toLocaleString()} · {plan?.debtPeriodDays || 30} 天后还 ¥{(plan?.debtRepay || 12000).toLocaleString()} · 利息约 {debtInterestPct || 20}%
              </div>
            </div>
          </label>
        </div>
        <div className="investor-actions">
          <button className="btn btn-primary"
            disabled={!anyPicked}
            onClick={() => onResolve({ fire, sell, debt })}>
            提交方案{anyPicked ? '' : ' (至少选 1 项)'}
          </button>
          <div className="investor-divider">或</div>
          <button className="btn btn-ghost"
            disabled={anyPicked}
            onClick={() => onResolve({ holdOn: true })}>
            不采取措施,靠流水回正
          </button>
          <div className="investor-hold-note">
            适合你判断接下来订单流水足够强、现金很快能转正的情况。若 <strong>{daysLeft} 天内资金没有回正</strong>,投资人撤资,游戏结束。
          </div>
        </div>
      </div>
    </div>
  );
}

function getChainEventFamily(event) {
  const id = event?.id || '';
  const chain = event?.chain || '';
  if (id.startsWith('borrow_') || chain.startsWith('borrow')) return 'borrow';
  if (id === 'platform_pressure' || chain === 'platform') return 'platform';
  if (id.startsWith('rival_') || chain.startsWith('rival')) return 'rival';
  if (id.startsWith('accident_') || chain.startsWith('accident')) return 'accident';
  return null;
}

function getChainEventNpc(event) {
  const family = getChainEventFamily(event);
  if (!family) return null;
  const meta = D.EVENT_NPCS?.[family];
  return meta ? { ...meta, id: family } : null;
}

function EventModal({ event, state, onResolve, onResolveInvestor }) {
  if (event.multiChoice) {
    return <InvestorPressureModal event={event} state={state} onResolve={onResolveInvestor} />;
  }
  // V15: 政策事件(notice / verdict / resume)走专属布局,处罚项结构化展示
  if (event.isPolicyEvent) {
    return <PolicyNoticeModal event={event} state={state} onResolve={onResolve} />;
  }
  const npc = getChainEventNpc(event);
  return (
    <div className="modal-overlay">
      <div className={`modal event-modal ${npc ? `chain-event-modal chain-event-${npc.id}` : ''}`}>
        <div className="event-modal-header">
          {npc ? (
            <div className="event-dialog-shell">
              <div className="event-npc-frame">
                <img src={npc.avatar} alt={`${npc.name} 立绘`} />
              </div>
              <div className="event-dialog-card">
                <div className="event-dialog-meta">
                  <span className="event-npc-name">{npc.name}</span>
                </div>
                <div className="modal-title">{event.title}</div>
                <div className="modal-desc">{event.desc}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="modal-tag">{event.tag}事件</div>
              <div className="modal-title">{event.title}</div>
              <div className="modal-desc">{event.desc}</div>
            </>
          )}
        </div>
        <EventResourceSnapshot state={state} />
        <div className="modal-options">
          {event.options.map((o, i) => {
            const eff = previewEventEffect(event, o, state);
            const hasImmediateEffect = Object.keys(eff).some((key) => key !== 'eventScale' && key !== 'previewError');
            const nextFunds = eff.funds !== undefined && state ? state.funds + eff.funds : null;
            const bestDriver = getBestDriverForEvent(state);
            const salaryAfter = bestDriver && eff.salaryRaise ? bestDriver.salary + eff.salaryRaise : null;
            const salaryDaily = eff.salaryRaise ? Math.round(eff.salaryRaise / 30) : 0;
            const optionDetail = getEventOptionDetail(o, eff);
            const showNoImmediateEffect = !hasImmediateEffect && !detailLooksLikeNumericEffect(optionDetail);
            const orderBoostText = formatOrderBoostText(eff);
            const disabledReason = getEventOptionDisabledReason(o, state);
            // V15.x: blindOptions 事件(如 rival_pricing 4 选项盲选)隐藏 effect chips,选完才揭晓
            if (event.blindOptions) {
              return (
                <button key={i} className="modal-option" disabled={!!disabledReason} onClick={() => onResolve(i)}>
                  <div className="modal-option-label">{o.label}</div>
                  {optionDetail && <div className="modal-option-effect">{optionDetail}</div>}
                  {disabledReason && <div className="event-effect-preview"><span className="negative">{disabledReason}</span></div>}
                </button>
              );
            }
            return (
              <button key={i} className="modal-option" disabled={!!disabledReason} onClick={() => onResolve(i)}>
                <div className="modal-option-label">{o.label}</div>
                {optionDetail && <div className="modal-option-effect">{optionDetail}</div>}
                <div className="event-effect-preview">
                  {disabledReason && <span className="negative">{disabledReason}</span>}
                  {eff.funds !== undefined && (
                    <span className={eff.funds < 0 ? 'negative' : 'positive'}>
                      资金 {eff.funds > 0 ? '+' : ''}{eff.funds.toLocaleString()}
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
                      {eff.accidentRisk.funds ? ` · 修车 ${eff.accidentRisk.funds.toLocaleString()}` : ''}
                      {eff.accidentRisk.allLoyalty ? ` · 全员忠诚 ${eff.accidentRisk.allLoyalty}` : ''}
                      {eff.accidentRisk.trustLoyalty ? ` · 全员信任 ${eff.accidentRisk.trustLoyalty}` : ''}
                      {eff.accidentRisk.reputation ? ` · 口碑 ${eff.accidentRisk.reputation}` : ''}
                    </span>
                  )}
                  {eff.loseBest && <span className="negative">失去最强司机{bestDriver ? ` ${bestDriver.name}` : ''}</span>}
                  {eff.previewError && <span className="negative">事件预览异常,请选择其他方案</span>}
                  {showNoImmediateEffect && <span>无立即数值变化</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// V15: 政策决策弹窗(用于监管整改 Day 60 决策点等)
// 与 EventModal 区别:支持选项的 extraToggle(子勾选)
// V15: 政策事件通知/结果/解禁弹窗(单按钮关闭,处罚项结构化展示)
// 用于 notice_1 / verdict_pass / verdict_fine / verdict_ban / resume 五种阶段
function PolicyNoticeModal({ event, state, onResolve }) {
  const previews = event.policyEffectPreview || [];
  const footerNote = event.policyFooterNote || '';
  const buttonLabel = event.options?.[0]?.label || '知道了';
  const isBan = event.policyStage === 'verdict_ban';
  return (
    <div className="modal-overlay">
      <div className={`modal event-modal policy-notice-modal ${isBan ? 'policy-notice-ban' : ''}`}>
        <div className="event-modal-header">
          <div className="modal-tag">{event.tag || '政策事件'}</div>
          <div className="modal-title">{event.title}</div>
          <div className="modal-desc" style={{whiteSpace: 'pre-line'}}>{event.desc}</div>
        </div>
        {/* V15.16 audit:政策事件是叙事/信息性事件,不需要展示玩家当前数据(无决策权衡需要参考) */}
        {previews.length > 0 && (
          <div className="policy-effect-list" style={{margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 6}}>
            {(event.policyStage === 'verdict_ban' || event.policyStage === 'verdict_fine') && (
              <div style={{fontSize: 14, color: 'var(--ink-2)', fontWeight: 700, marginBottom: 2}}>
                处罚清单
              </div>
            )}
            {previews.map((eff, i) => {
              const sideColor = eff.tone === 'negative' ? 'var(--warn)' : eff.tone === 'positive' ? 'var(--green)' : 'var(--ink-3)';
              const valueColor = eff.tone === 'negative' ? 'var(--warn)' : eff.tone === 'positive' ? 'var(--green)' : 'var(--ink)';
              return (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  background: 'var(--sub)',
                  border: '1.5px solid var(--border-soft)',
                  borderLeft: `4px solid ${sideColor}`,
                  borderRadius: 'var(--ui-radius)',
                  fontSize: 14,
                }}>
                  <span style={{fontWeight: 700, color: 'var(--ink)'}}>{eff.label}</span>
                  <strong style={{fontWeight: 800, color: valueColor, whiteSpace: 'nowrap'}}>{eff.value}</strong>
                </div>
              );
            })}
          </div>
        )}
        {footerNote && (
          <div style={{margin: '4px 0 12px', padding: '10px 12px', fontSize: 14, color: 'var(--ink-2)', background: 'var(--accent-soft)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--ui-radius)', whiteSpace: 'pre-line', lineHeight: 1.55}}>
            {footerNote}
          </div>
        )}
        <div className="modal-options">
          <button
            className="modal-option"
            onClick={() => onResolve(0)}
          >
            <div className="modal-option-label">{buttonLabel}</div>
          </button>
        </div>
      </div>
    </div>
  );
}

function PolicyDecisionModal({ decision, state, onResolve }) {
  const [extraToggles, setExtraToggles] = React.useState({});
  const r0 = decision.refMonthlyRevenue || 0;
  const params = decision.params || {};

  // 基于 R₀ 预算各档具体金额(玩家看到具体数字,不展示 R₀ 概念)
  const startupFee = Math.round(r0 * (params.A_STARTUP_FEE_PCT || 0.40));
  const fineAmount = Math.round(r0 * (params.A_VERDICT_FINE_PCT || 0.10));
  const complianceSchedule = params.COMPLIANCE_SCHEDULE_PCT || [0.25, 0.20, 0.15, 0.10];
  const complianceFirstPct = Math.round((complianceSchedule[0] || 0.25) * 100);
  const complianceFloorPct = Math.round((complianceSchedule[complianceSchedule.length - 1] || 0.10) * 100);
  const loanAmount = Math.round(r0 * (params.B_LOAN_PCT || 1.00));
  const loanInterest = Math.round(loanAmount * (params.B_LOAN_RATE || 0.10) * ((params.B_LOAN_DUE_DAYS || 90) / 365));
  const loanRepay = loanAmount + loanInterest;

  function renderEffects(optId) {
    if (optId === 'A') {
      // 注意:不展示"监管检查 50% 通过 / 50% 罚 X"——这会剧透 Day 90 的剧情
      return (
        <div className="event-effect-preview">
          <span className="negative">立即扣 ¥{startupFee.toLocaleString()}</span>
          <span className="negative">合规成本按月流水扣:首月 {complianceFirstPct}% → 稳定后 {complianceFloorPct}%</span>
          <span className="negative">30 天内招募/购车 5 天冷却</span>
        </div>
      );
    }
    if (optId === 'B') {
      return (
        <div className="event-effect-preview">
          <span className="positive">订单量 +25%</span>
          <span className="positive">单均利润 +15%</span>
          <span>持续 30 天</span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal event-modal policy-decision-modal">
        <div className="event-modal-header">
          <div className="modal-tag">{decision.tag || '政策决策'}</div>
          <div className="modal-title">{decision.title}</div>
          <div className="modal-desc" style={{whiteSpace: 'pre-line'}}>{decision.desc}</div>
        </div>
        <EventResourceSnapshot state={state} />
        <div className="modal-options">
          {decision.options.map((opt) => {
            const toggleVal = extraToggles[opt.id] || {};
            const hasExtra = !!opt.extraToggle;
            return (
              <div
                key={opt.id}
                className="policy-decision-card"
                style={{
                  marginBottom: 12,
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <button
                  className="modal-option"
                  onClick={() => onResolve(opt.id, toggleVal)}
                  style={{
                    width: '100%',
                    margin: 0,
                    border: 'none',
                    borderRadius: 0,
                    background: 'transparent',
                    textAlign: 'left',
                  }}
                >
                  <div className="modal-option-label">{opt.label}</div>
                  {opt.detail && <div className="modal-option-effect" style={{whiteSpace: 'pre-line'}}>{opt.detail}</div>}
                  {renderEffects(opt.id)}
                </button>
                {hasExtra && (
                  <label
                    className="policy-decision-toggle"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 16px',
                      cursor: 'pointer',
                      fontSize: 13,
                      background: 'rgba(255, 180, 70, 0.10)',
                      borderTop: '1px dashed rgba(0,0,0,0.12)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={!!toggleVal[opt.extraToggle.id]}
                      onChange={(e) => setExtraToggles({
                        ...extraToggles,
                        [opt.id]: { ...(extraToggles[opt.id] || {}), [opt.extraToggle.id]: e.target.checked },
                      })}
                      style={{marginTop: 3}}
                    />
                    <span style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 3}}>
                      <strong>{opt.extraToggle.label}</strong>
                      <span style={{fontSize: 12, color: 'var(--ink-3, #888)'}}>
                        一次性 <span className="positive">+¥{loanAmount.toLocaleString()}</span> · 90 天后一次还本付息 <span className="negative">¥{loanRepay.toLocaleString()}</span>
                      </span>
                    </span>
                  </label>
                )}
              </div>
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
  const feedbackAssetMap = {
    achievement: 'feedback-achievement',
    mission: 'feedback-mission',
    reward: 'feedback-reward',
    story: 'feedback-story',
    warning: 'feedback-warning',
  };
  const iconAsset = feedbackAssetMap[asset] || asset || (tone === 'gold' ? 'feedback-reward' : 'feedback-mission');
  return (
    <div className={`game-feedback-card tone-${tone} ${modal ? 'modal-card' : ''} ${className}`} onClick={(e) => modal && e.stopPropagation()}>
      <div className="game-feedback-media">
        {media || (
          <div className="game-feedback-icon" data-asset={iconAsset}>
            <img src={`assets/pixel/icons/${iconAsset}.png`} alt={iconLabel} draggable="false" />
          </div>
        )}
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

// V14: 月度结算弹窗 — 每 30 天暂停游戏,展示收入构成 / 支出构成 / 司机贡献排行 / 期末状态
function MonthlyReportModal({ report, onClose }) {
  if (!report) return null;
  const fmt = (n) => `¥${Math.round(n).toLocaleString()}`;
  const sign = (n) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);
  const commissionPct = Math.round((GAME.COMMISSION || 0) * 100);
  const eventItems = report.eventItems && report.eventItems.length
    ? report.eventItems
    : (report.eventImpact ? [{ day: report.day - 1, title: '本月事件合计', label: '历史版本未记录明细', amount: report.eventImpact }] : []);
  return (
    <div className="modal-overlay">
      <div className="modal monthly-report-modal">
        <div className="modal-tag">月度结算</div>
        <div className="modal-title">
          第 {report.monthCounter} 月经营报告
          <span className="monthly-day-tag">第 {report.day - 1} 日发薪</span>
        </div>

        <div className="monthly-section">
          <div className="monthly-section-title">收入构成</div>
          <div className="monthly-row">
            <span>总流水(乘客付的)</span>
            <strong>{fmt(report.earnedGross)}</strong>
          </div>
          <div className="monthly-row danger">
            <span>− 平台抽成 ({commissionPct}%)</span>
            <strong>−{fmt(report.commission)}</strong>
          </div>
          <div className="monthly-row monthly-subtotal">
            <span>净流水</span>
            <strong>{fmt(report.earnedNet)}</strong>
          </div>
        </div>

        {/* V15.16 audit:支出按"已扣 vs 今日扣"分组 */}
        {/* 第 1 组:本月日常变动 — 过去 30 天逐日已扣(事件 / 债务到期 / 解雇补偿) */}
        {(report.eventImpact !== 0 || report.debtPaid > 0 || report.severance > 0) && (
          <div className="monthly-section">
            <div className="monthly-section-title">本月日常变动 <em className="monthly-section-hint">(过去 30 天逐日已扣)</em></div>
            {report.eventImpact !== 0 && (
              <>
                <div className={`monthly-row ${report.eventImpact < 0 ? 'danger' : 'positive'}`}>
                  <span>事件合计</span>
                  <strong>{sign(report.eventImpact)}</strong>
                </div>
                {eventItems.length > 0 && (
                  <div className="monthly-event-list">
                    {eventItems.map((item, idx) => (
                      <div key={`${item.day}-${item.title}-${idx}`} className={`monthly-event-item ${item.amount < 0 ? 'danger' : 'positive'}`}>
                        <div className="monthly-event-copy">
                          <strong>第 {item.day} 日 · {item.title}</strong>
                          <span>{item.label || '事件现金变动'}</span>
                          {item.detail && <span className="monthly-event-detail">{item.detail}</span>}
                        </div>
                        <em>{sign(item.amount)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {report.debtPaid > 0 && (
              <div className="monthly-row danger">
                <span>债务到期扣款</span>
                <strong>−{fmt(report.debtPaid)}</strong>
              </div>
            )}
            {report.severance > 0 && (
              <div className="monthly-row danger">
                <span>解雇补偿</span>
                <strong>−{fmt(report.severance)}</strong>
              </div>
            )}
          </div>
        )}

        {/* 第 2 组:本次月结新扣 — 月底统一结算的薪酬 */}
        <div className="monthly-section">
          <div className="monthly-section-title">本次月结新扣 <em className="monthly-section-hint">(今日结算)</em></div>
          {report.salary > 0 ? (
            <div className="monthly-row danger">
              <span>司机工资 ({report.drivers.length} 人)</span>
              <strong>−{fmt(report.salary)}</strong>
            </div>
          ) : (
            <div className="monthly-empty-row">本月无司机,无工资支出</div>
          )}
        </div>

        <div className={`monthly-net-profit ${report.netProfit >= 0 ? 'positive' : 'danger'}`}>
          <span>当月净利润</span>
          <strong>{sign(report.netProfit)}</strong>
        </div>

        {report.drivers.length > 0 && (
          <div className="monthly-section">
            <div className="monthly-section-title">司机贡献排行</div>
            <div className="monthly-driver-list">
              {report.drivers.map((d, i) => (
                <div key={d.id}
                  className={`monthly-driver-row ${d.leftDay ? 'left-team' : ''} ${d.contribution < 0 ? 'negative' : ''}`}>
                  <span className="monthly-driver-rank">{i + 1}</span>
                  <div className="monthly-driver-body">
                    <div className="monthly-driver-name">
                      {d.name} <em>{d.bgName}</em>
                      {d.leftDay && <span className="monthly-left-tag">已离队 (第 {d.leftDay} 日)</span>}
                    </div>
                    <div className="monthly-driver-stats">
                      完单 {d.completed} · 月薪 ¥{d.salary.toLocaleString()} · 本月工资 {fmt(d.salaryPaid || d.salary)} · 净赚 {fmt(d.earnedNet)}
                    </div>
                  </div>
                  <strong className={`monthly-driver-contrib ${d.contribution < 0 ? 'danger' : 'positive'}`}>
                    {sign(d.contribution)}
                    {d.contribution < 0 && <span className="monthly-warn-tag">⚠ 负贡献</span>}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="monthly-section monthly-final-state">
          <div className="monthly-section-title">期末状态</div>
          <div className="monthly-final-grid">
            <div><span>资金</span><strong>{fmt(report.funds)}</strong></div>
            <div><span>口碑</span><strong>{report.reputation}</strong></div>
            <div><span>车组</span><strong>{report.crews}</strong></div>
          </div>
        </div>

        <button className="btn btn-primary monthly-continue" onClick={onClose}>继续运营</button>
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
const TICKET_STAGE_TEXT = {
  normal: '起步补人',
  vip: '中期主力',
  headhunter: '后期挖人',
};
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
          <div className="modal-desc">选一张招募券 — 每次出 3 名候选,挑 1 名加入车队。概率按每名候选单独计算。</div>
          <div className="ticket-list">
            {RECRUIT_TICKETS.map((t) => {
              const enough = funds >= t.cost;
              const probRows = getTicketProbRows(t);
              return (
                <div key={t.id} className={`ticket-card ${t.id}`}>
                  <div className="ticket-top">
                    <img className="ticket-icon" src={`assets/pixel/icons/ticket-${t.id}.png`} alt="" draggable="false" />
                    <div className="ticket-top-copy">
                      <span className="ticket-stage">{TICKET_STAGE_TEXT[t.id]}</span>
                      <span className="ticket-name">{t.name}</span>
                    </div>
                    <span className="ticket-cost">¥{t.cost.toLocaleString()}</span>
                  </div>
                  <div className="ticket-desc">{t.desc}</div>
                  <div className="ticket-prob-card">
                    <div className="ticket-prob-title">单名候选概率</div>
                    <div className="ticket-prob-list">
                      {probRows.map((row) => (
                        <span key={row.rarity} className="ticket-prob-chip" style={{ '--prob-color': row.meta.color }}>
                          <span>{row.meta.name}</span>
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
        <div className="modal-desc">{ticket?.name} · 选 1 名加入车队</div>
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
                  <div className="gacha-bg">{getDriverRoleLabel(card)}</div>
                  <div className="gacha-salary">月薪 ¥{card.salary.toLocaleString()}</div>
                </div>
                <div className="gacha-stats-block">
                  <StatBars stats={card.stats} caps={card.statCaps || E.computeStatCaps(card)} compact />
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
      <div className="modal shop-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">4S 店:买新车</div>
        <div className="modal-desc">快车由片区解锁,桑塔纳也能跑。凯美瑞起能跑专车订单,奔驰 E 能跑豪华车订单。</div>
        <div className="shop-grid">
          {VEHICLES.map((v) => {
            // V12: 车型只用钱解锁,口碑门槛已删除
            const cantAfford = state.funds < v.price;
            return (
              <div key={v.id} className="shop-item">
                <div className="shop-image"><VehicleIcon template={v} size={84} /></div>
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
  const currentIdx = Math.min(state.currentMissionIdx || 0, MISSIONS.length);
  return MISSIONS.map((mission, idx) => {
    const orderId = MISSION_ORDER_TARGETS[mission.id];
    const orderStatus = orderId ? orderStatusById[orderId] : null;
    const stateClass = idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'locked';
    const stateLabel = idx < currentIdx ? '已完成' : idx === currentIdx ? '当前任务' : '后续任务';
    return { mission, idx, orderStatus, stateClass, stateLabel };
  });
}
