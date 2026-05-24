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

function normalizeNarrativePunctuation(text) {
  if (typeof text !== 'string') return text;
  let quoteOpen = true;
  return text
    .replace(/([\u4e00-\u9fff])\s*,\s*/g, '$1，')
    .replace(/,\s*([\u4e00-\u9fff])/g, '，$1')
    .replace(/([\u4e00-\u9fff])\s*:\s*/g, '$1：')
    .replace(/:\s*([\u4e00-\u9fff])/g, '：$1')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\?/g, '？')
    .replace(/!/g, '！')
    .replace(/"/g, () => {
      const mark = quoteOpen ? '“' : '”';
      quoteOpen = !quoteOpen;
      return mark;
    });
}

function formatNarrativeText(text, maxLineLength = 34) {
  const normalized = normalizeNarrativePunctuation(text);
  if (typeof normalized !== 'string' || normalized.includes('\n') || normalized.length <= maxLineLength) {
    return normalized;
  }
  const sentences = normalized.match(/[^。！？]+[。！？]?/g);
  if (!sentences || sentences.length <= 1) return normalized;
  const lines = [];
  let current = '';
  sentences.forEach((sentence) => {
    if (current && `${current}${sentence}`.length > maxLineLength) {
      lines.push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  });
  if (current) lines.push(current);
  return lines.join('\n');
}

function getEventOptionDetail(option, hasVisibleEffectPreview = false) {
  if (!option || !option.detail) return '';
  if (hasVisibleEffectPreview) return '';
  return normalizeNarrativePunctuation(option.detail);
}

function formatOrderBoostText(effect) {
  if (!effect.orderBoost || effect.orderBoost === 1) return '';
  const percent = Math.round(Math.abs(effect.orderBoost - 1) * 100);
  const duration = effect.boostDuration ? `,持续 ${effect.boostDuration} 天` : ',持续今天';
  return effect.orderBoost > 1
    ? `接单收入临时提高 ${percent}%${duration}`
    : `接单收入临时降低 ${percent}%${duration}`;
}

function getEffectVehicleName(effect) {
  const vehicle = D.VEHICLES?.find((v) => v.id === effect?.vehicleType);
  return vehicle?.name || '车辆';
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

// V15.16:调薪弹窗 — 玩家手动给单个司机调薪,月薪永久上调,按 pct 计算忠诚变化
// 1-3% 侮辱性涨薪(忠诚减) / 4% 中性 / 5-49% 线性加 / 50% 拉满
function SalaryRaiseModal({ driver, onClose, onConfirm }) {
  const [pct, setPct] = useState(10);
  const effect = E.getSalaryRaiseLoyaltyEffect(pct) || { delta: 0, fillMax: false, hint: '' };
  const newSalary = Math.round(driver.salary * (1 + pct / 100));
  // V15.16:调薪可突破 normalCap 到 100,所以 modal 上限统一用 100
  const trustCap = 100;
  const currentLoyalty = driver.loyalty ?? 50;
  const previewLoyalty = effect.fillMax
    ? trustCap
    : effect.delta < 0
      ? Math.max(0, currentLoyalty + effect.delta)
      : Math.min(trustCap, currentLoyalty + effect.delta);
  const isInsult = effect.delta < 0;
  const isMax = effect.fillMax;
  const monthlyDelta = newSalary - driver.salary;
  return (
    <div className="modal-overlay">
      <div className="modal salary-raise-modal" style={{maxWidth: 460}}>
        <div className="modal-tag">调薪</div>
        <div className="modal-title">给 {driver.name} 调薪</div>
        <div className="modal-desc">
          当前月薪 <strong>¥{driver.salary.toLocaleString()}</strong> · 忠诚 <strong>{currentLoyalty}</strong>(调薪可突破上限到 100)
        </div>

        <div className="salary-raise-slider-row">
          <input
            type="range"
            min="1"
            max="50"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="salary-raise-slider"
            aria-label="调薪幅度"
          />
          <div className={`salary-raise-pct ${isInsult ? 'negative' : isMax ? 'positive' : ''}`}>+{pct}%</div>
        </div>

        <div className="salary-raise-preview">
          <div className="salary-raise-row">
            <span>月薪</span>
            <strong>¥{driver.salary.toLocaleString()} → ¥{newSalary.toLocaleString()}</strong>
            <em className="negative">+¥{monthlyDelta.toLocaleString()}/月(永久)</em>
          </div>
          <div className="salary-raise-row">
            <span>忠诚</span>
            <strong className={isInsult ? 'negative' : 'positive'}>
              {currentLoyalty} → {previewLoyalty}
              {isMax && <em className="positive"> (拉满)</em>}
            </strong>
          </div>
          <div className={`salary-raise-hint ${isInsult ? 'negative' : isMax ? 'positive' : ''}`}>
            {effect.hint}
          </div>
        </div>

        <div className="modal-options" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16}}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onConfirm(driver.id, pct)}>确认调薪</button>
        </div>
      </div>
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
  // V15.16 audit fix:已经全部是重组债务时禁止再次重组(避免无限延期 +5% 滚雪球)
  // 例:玩家已重组过 1 次,所有债务合并成 1 笔 restructure,再次到期还不上时
  // 不应允许"再重组一次" — 那会让玩家无限延期游戏不结束。强制选「放弃经营」走 game over。
  const isAllRestructured = debts.length > 0 && debts.every((d) => d.type === 'restructure');
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
        {!isAllRestructured && (
          <div className="debt-restructure-preview">
            <span>债务重组</span>
            <strong>合并为 ¥{newTotal.toLocaleString()} · {newDays} 天后到期</strong>
            <em>全部未还债务打包,+5% 手续费;期限按剩余天数累加,最少 14 天、最多 60 天。</em>
          </div>
        )}
        {isAllRestructured && (
          <div className="debt-restructure-preview" style={{borderStyle: 'solid', borderColor: 'var(--warn)', background: 'color-mix(in srgb, var(--warn) 10%, var(--card) 90%)'}}>
            <span style={{color: 'var(--warn)'}}>已重组过,无法再次重组</span>
            <strong style={{color: 'var(--warn)', fontSize: 16}}>债务已是合并状态,只能选择放弃经营</strong>
            <em>第二次重组会让滚雪球无限延期,游戏到此结束。</em>
          </div>
        )}
        <div className="modal-options debt-crisis-actions">
          <button className="modal-option danger-option" onClick={() => onResolve('bankrupt')}>
            <div className="modal-option-label">放弃经营</div>
            <div className="modal-option-effect">进入破产结算</div>
          </button>
          <button
            className="modal-option primary-option"
            onClick={() => onResolve('restructure')}
            disabled={isAllRestructured}
            title={isAllRestructured ? '已重组过,无法再次重组' : ''}
          >
            <div className="modal-option-label">债务重组</div>
            <div className="modal-option-effect">{isAllRestructured ? '已重组过,选项不可用' : '合并所有贷款,总待还 +5%'}</div>
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
          <div className="modal-desc">{formatNarrativeText(event.desc)}</div>
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
  if (event?.eventType !== 'chain' && !event?.chainId) return null;
  const id = event?.id || '';
  const chain = event?.chain || '';
  if (event?.chainId) return event.chainId;
  if (id.startsWith('borrow_') || chain.startsWith('borrow')) return 'borrow';
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
                <div className="modal-desc">{formatNarrativeText(event.desc)}</div>
              </div>
            </div>
          ) : (
            <>
              <div className="modal-tag">{event.tag}事件</div>
              <div className="modal-title">{event.title}</div>
              <div className="modal-desc">{formatNarrativeText(event.desc)}</div>
            </>
          )}
        </div>
        <EventResourceSnapshot state={state} />
        <div className="modal-options">
          {event.options.map((o, i) => {
            const eff = previewEventEffect(event, o, state);
            const bestDriver = getBestDriverForEvent(state);
            const salaryAfter = bestDriver && eff.salaryRaise ? bestDriver.salary + eff.salaryRaise : null;
            const salaryDaily = eff.salaryRaise ? Math.round(eff.salaryRaise / 30) : 0;
            const orderBoostText = formatOrderBoostText(eff);
            const disabledReason = getEventOptionDisabledReason(o, state);
            const effectPreviewItems = [];
            const addPreview = (content, className = '') => {
              effectPreviewItems.push(<span key={effectPreviewItems.length} className={className}>{normalizeNarrativePunctuation(content)}</span>);
            };
            if (disabledReason) addPreview(disabledReason, 'negative');
            if (eff.funds !== undefined) {
              addPreview(`资金 ${eff.funds > 0 ? '+' : ''}${eff.funds.toLocaleString()}`, eff.funds < 0 ? 'negative' : 'positive');
            }
            if (eff.reputation !== undefined) {
              addPreview(`口碑 ${eff.reputation > 0 ? '+' : ''}${eff.reputation}`, eff.reputation < 0 ? 'negative' : 'positive');
            }
            if (eff.allLoyalty !== undefined) {
              addPreview(`全员忠诚 ${eff.allLoyalty > 0 ? '+' : ''}${eff.allLoyalty}`, eff.allLoyalty < 0 ? 'negative' : 'positive');
            }
            if (eff.trustLoyalty !== undefined) {
              addPreview(`全员忠诚 ${eff.trustLoyalty > 0 ? '+' : ''}${eff.trustLoyalty}`, eff.trustLoyalty < 0 ? 'negative' : 'positive');
            }
            if (eff.salaryRaise && eff.keepBest && bestDriver) {
              addPreview(`${bestDriver.name} 月薪 +¥${eff.salaryRaise} → ¥${salaryAfter}`, 'negative');
              addPreview(`日成本约 +¥${salaryDaily}`, 'negative');
            }
            if (orderBoostText) addPreview(orderBoostText, eff.orderBoost < 1 ? 'negative' : 'positive');
            if (eff.commissionRate !== undefined) addPreview(`平台抽成调整为 ${Math.round(eff.commissionRate * 100)}%`);
            if (eff.platformDone) addPreview('后续不再涨抽成', 'positive');
            if (eff.certifyFleet) addPreview('当前车辆合规升级', 'positive');
            if (eff.addDrivers) addPreview(`新增司机 +${eff.addDrivers}`, 'positive');
            if (eff.addVehicles) addPreview(`${getEffectVehicleName(eff)} +${eff.addVehicles}`, 'positive');
            if (eff.accidentRisk) {
              addPreview(
                `${Math.round(eff.accidentRisk.chance * 100)}% 事故风险` +
                `${eff.accidentRisk.funds ? ` · 修车 ${eff.accidentRisk.funds.toLocaleString()}` : ''}` +
                `${eff.accidentRisk.allLoyalty ? ` · 全员忠诚 ${eff.accidentRisk.allLoyalty}` : ''}` +
                `${eff.accidentRisk.trustLoyalty ? ` · 全员忠诚 ${eff.accidentRisk.trustLoyalty}` : ''}` +
                `${eff.accidentRisk.reputation ? ` · 口碑 ${eff.accidentRisk.reputation}` : ''}`,
                'negative'
              );
            }
            if (eff.previewError) addPreview('事件预览异常,请选择其他方案', 'negative');
            const optionDetail = event.isInvestorReview
              ? normalizeNarrativePunctuation(o.detail || '')
              : (event.blindOptions ? normalizeNarrativePunctuation(o.detail || '') : getEventOptionDetail(o, effectPreviewItems.length > 0));
            // V15.x: blindOptions 事件(如 rival_pricing 4 选项盲选)隐藏 effect chips,选完才揭晓
            if (event.blindOptions) {
              return (
                <button key={i} className="modal-option" disabled={!!disabledReason} onClick={() => onResolve(i)}>
                  <div className="modal-option-label">{o.label}</div>
                  {optionDetail && <div className="modal-option-effect">{optionDetail}</div>}
                  {disabledReason && <div className="event-effect-preview">{effectPreviewItems}</div>}
                </button>
              );
            }
            return (
              <button key={i} className="modal-option" disabled={!!disabledReason} onClick={() => onResolve(i)}>
                <div className="modal-option-label">{o.label}</div>
                {optionDetail && <div className="modal-option-effect">{optionDetail}</div>}
                {effectPreviewItems.length > 0 && <div className="event-effect-preview">{effectPreviewItems}</div>}
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
          <div className="modal-desc" style={{whiteSpace: 'pre-line'}}>{formatNarrativeText(event.desc)}</div>
        </div>
        {/* V15.16 audit:政策事件是叙事/信息性事件,不需要展示玩家当前数据(无决策权衡需要参考) */}
        {previews.length > 0 && (
          <div className="policy-effect-list">
            {(event.policyStage === 'verdict_ban' || event.policyStage === 'verdict_fine') && (
              <div className="policy-effect-heading">
                处罚清单
              </div>
            )}
            {previews.map((eff, i) => {
              return (
                <div key={i} className={`policy-effect-row ${eff.tone || ''}`}>
                  <span className="policy-effect-label">{eff.label}</span>
                  <strong className="policy-effect-value">{eff.value}</strong>
                </div>
              );
            })}
          </div>
        )}
        {footerNote && (
          <div className="policy-footer-note">
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
          <span className="negative">合规成本按每月净流水滚动扣:首月 {complianceFirstPct}% → 稳定后 {complianceFloorPct}%</span>
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
          <div className="modal-desc" style={{whiteSpace: 'pre-line'}}>{formatNarrativeText(decision.desc)}</div>
        </div>
        <EventResourceSnapshot state={state} />
        <div className="modal-options">
          {decision.options.map((opt) => {
            const toggleVal = extraToggles[opt.id] || {};
            const hasExtra = !!opt.extraToggle;
            return (
              <div
                key={opt.id}
                className={`policy-decision-card policy-decision-${opt.id}`}
              >
                <button
                  className="policy-decision-main"
                  onClick={() => onResolve(opt.id, toggleVal)}
                >
                  <div className="modal-option-label">{opt.label}</div>
                  {opt.detail && <div className="modal-option-effect" style={{whiteSpace: 'pre-line'}}>{normalizeNarrativePunctuation(opt.detail)}</div>}
                  {renderEffects(opt.id)}
                </button>
                {hasExtra && (
                  <label
                    className="policy-decision-toggle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={!!toggleVal[opt.extraToggle.id]}
                      onChange={(e) => setExtraToggles({
                        ...extraToggles,
                        [opt.id]: { ...(extraToggles[opt.id] || {}), [opt.extraToggle.id]: e.target.checked },
                      })}
                    />
                    <span className="policy-decision-toggle-copy">
                      <strong>{opt.extraToggle.label}</strong>
                      <span>
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
