function MissionBar({ state, onOpenRoadmap }) {
  // V15.16:进度只数非 hidden 任务,被动等型/复合首单 hidden 后台静默达成
  const completedSet = new Set(state.completedMissionIds || []);
  const visibleMissions = MISSIONS.filter((m) => !m.hidden && (!E.isMissionAvailable || E.isMissionAvailable(state, m)));
  const completedVisibleCount = visibleMissions.filter((m) => completedSet.has(m.id)).length;
  const currentMission = visibleMissions.find((m) => !completedSet.has(m.id));

  if (!currentMission) {
    return (
      <div className="mission-bar objective-card finale">
        <div className="mb-head">
          <span className="mb-tag" style={{background: 'var(--gold)'}}>已通关</span>
          <button className="mb-roadmap-btn" onClick={onOpenRoadmap} aria-label="查看目标">
            <span>查看目标</span>
            <span className="mb-roadmap-btn-arrow">→</span>
          </button>
        </div>
        <div className="mb-content">
          <strong className="mb-action">主线已完成</strong>
          <p className="mb-hint">继续运营累积资金,或重开一周目挑战更高目标</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mission-bar objective-card" aria-label={`当前任务:${currentMission.title}`}>
      <div className="mb-head">
        <span className="mb-tag">任务 {completedVisibleCount + 1}/{visibleMissions.length}</span>
        <button className="mb-roadmap-btn" onClick={onOpenRoadmap} aria-label="查看目标">
          <span>查看目标</span>
          <span className="mb-roadmap-btn-arrow">→</span>
        </button>
      </div>
      <div className="mb-content">
        <strong className="mb-action">{currentMission.title}</strong>
        <p className="mb-hint">{currentMission.desc}</p>
      </div>
    </div>
  );
}

/* ============== V3: 顶栏 ============== */

function TopbarHelp({ id, title, children }) {
  return (
    <div className="rep-help-popover" id={id} role="tooltip">
      <div className="rep-help-title">{title}</div>
      {children}
    </div>
  );
}

function HelpRow({ label, children }) {
  return (
    <div className="rep-help-row">
      <strong>{label}</strong>
      <span>{children}</span>
    </div>
  );
}

function TopBar({ state, fundsDisplay, repDisplay, onOpenPauseMenu }) {
  const currentTier = state.unlockedEndingTier || 0;
  const tierEnding = ENDINGS.find((e) => e.tier === currentTier);
  const tierName = tierEnding ? tierEnding.name : '初创期';
  const hourText = `${String(state.hour).padStart(2, '0')}:00`;
  // V14.67: 删除 supplyTotal/supplyTaken/supplyLost/activeDrivers/idleDrivers 5 个未使用的局部变量。
  // V15.31:顶栏从“供需匹配”改为供给视角,只回答“司机/车辆供给够不够”。
  // V15.16 audit:供给判定从 lossAvg/idleAvg 改为「已解锁区订单密度 vs 实际车组」比例
  // 引导玩家「解锁越多区 → 需要越多车」,而不是看实时流失/闲置(玩家不直观)。
  // 公式:density 之和(高峰 ×1.3) / 车组数 = 供给压力比
  //   > 0.8 → 供给不足(每辆车要服务 >0.8 个区的订单密度,会有流失)
  //   其他   → 供给充足(能覆盖当前已解锁片区)
  const supplyHistory = state.supplyHistory || [];
  const histLen = supplyHistory.length;
  const lossSum = supplyHistory.reduce((a, b) => a + (b.lost || 0), 0);
  const idleSum = supplyHistory.reduce((a, b) => a + (b.idle || 0), 0);
  const lossAvg = histLen > 0 ? lossSum / histLen : 0;
  const idleAvg = histLen > 0 ? idleSum / histLen : 0;
  const unlockedDensitySum = ZONES.filter((z) => E.isZoneUnlocked(state, z))
    .reduce((sum, z) => sum + (z.density || 1.0), 0);
  const operatingCrews = (state.drivers || []).filter((d) => d.vehicleId).length;
  const supplyPressure = operatingCrews > 0 ? unlockedDensitySum / operatingCrews : 99;
  const unlockedZoneCount = ZONES.filter((z) => E.isZoneUnlocked(state, z)).length;
  // 风险轴 0-100:基于 supplyPressure 映射(0.4=宽裕/18%,0.6=够用/50%,0.8+=不足/85%+)
  const supplyRisk = Math.max(0, Math.min(100, (supplyPressure - 0.2) / 0.8 * 80 + 10));
  const showAxis = !state.paused;
  let supplyValue = '供给充足';
  let supplySubText = `${operatingCrews} 车组覆盖 ${unlockedZoneCount} 片区`;
  let supplyCls = 'supply-balanced';
  let supplyCardCls = 'balanced';
  if (state.paused) {
    supplyValue = '待启动';
    supplySubText = '点地图下方开始';
    supplyCls = 'supply-idle';
    supplyCardCls = 'idle';
  } else if (operatingCrews === 0) {
    supplyValue = '无可运营车组';
    supplyCls = 'supply-undersupply';
    supplyCardCls = 'undersupply';
  } else if (supplyPressure > 0.8) {
    supplyValue = '供给不足';
    supplySubText = `${operatingCrews} 车组覆盖 ${unlockedZoneCount} 片区偏紧`;
    supplyCls = 'supply-undersupply';
    supplyCardCls = 'undersupply';
  } else {
    supplyValue = '供给充足';
    supplyCls = 'supply-balanced';
    supplyCardCls = 'balanced';
  }
  // V12: 流失副标 — 直接挂在口碑胶囊下方,把"流失 → 口碑"因果显式化。
  const todayLost = state.todayLost || 0;
  const todayRepLoss = state.todayRepLoss || 0;
  let repSubText = null;
  let repSubCls = '';
  let repSubTitle = '';
  if (todayRepLoss > 0) {
    repSubText = `流失 −${todayRepLoss}`;
    repSubTitle = `今日流失 ${todayLost} 单 · 城市口碑 −${todayRepLoss}`;
    repSubCls = 'rep-sub-warn';
  } else if (todayLost > 0) {
    repSubText = `流失 ${todayLost} 单`;
    repSubTitle = `今日流失 ${todayLost} 单`;
    repSubCls = 'rep-sub-warn';
  }
  const unlockedZones = ZONES.filter((z) => E.isZoneUnlocked(state, z));
  const lockedZones = ZONES
    .filter((z) => !E.isZoneUnlocked(state, z))
    .sort((a, b) => ((a.unlock && a.unlock.reputation) || 0) - ((b.unlock && b.unlock.reputation) || 0));
  const nextZone = lockedZones[0];
  const unlockedZoneText = unlockedZones.length > 0 ? unlockedZones.map((z) => z.name).join('、') : '暂无';
  const nextZoneText = nextZone
    ? `${nextZone.name} 需要口碑 ${(nextZone.unlock && nextZone.unlock.reputation) || 0},还差 ${Math.max(0, ((nextZone.unlock && nextZone.unlock.reputation) || 0) - state.reputation)}`
    : '所有片区已解锁';
  const tickSeconds = (GAME.TICK_MS / 1000).toFixed(1).replace('.0', '');
  const commissionText = Math.round((GAME.COMMISSION || 0) * 100);
  const debtSummary = E.getDebtSummary ? E.getDebtSummary(state) : {
    debts: state.debtDueDay > 0 ? [{ label: '高利贷', repay: state.debtAmount, dueDay: state.debtDueDay }] : [],
    count: state.debtDueDay > 0 ? 1 : 0,
    totalRepay: state.debtAmount || 0,
    nextDebt: state.debtDueDay > 0 ? { label: '高利贷', repay: state.debtAmount, dueDay: state.debtDueDay } : null,
    nextDaysLeft: Math.max(0, (state.debtDueDay || 0) - state.day),
  };
  const nextDebt = debtSummary.nextDebt;
  const debtUrgent = nextDebt && debtSummary.nextDaysLeft <= 7;
  return (
    <div className="topbar">
      <div className="topbar-left">
        <h1>网约车物语 <span className="v">{APP_VERSION}</span></h1>
      </div>
      <div className="topbar-stats">
        {(() => {
        // V15.17:KPI 容器宽度按可见 stat 数自适应,避免渐进解锁时露出深色背景
        const supplyVisible = E.isUIGateUnlocked(state, 'supply_chip');
        const statCount = 3 + (supplyVisible ? 1 : 0);
        return (
        <div className="topbar-kpis"
             data-stat-count={statCount}
             aria-label="经营状态">
          <div className="ts-stat topbar-stat time-stat has-help" tabIndex="0" aria-describedby="time-help-popover" title="时间规则">
            <span className="ts-label">时间</span>
            <strong className="ts-value time-value">第 {state.day} 日 {hourText}</strong>
            <span className="ts-sub">{tierName}</span>
            <TopbarHelp id="time-help-popover" title="时间规则">
              <HelpRow label="推进">1× 速度下,现实约 {tickSeconds} 秒推进 1 个游戏小时;一天有 24 个游戏小时。</HelpRow>
              <HelpRow label="倍速">2× / 4× / 8× 会按比例加快时间,也会更快触发接单、流失和事件判断。</HelpRow>
              <HelpRow label="结算">每天 24:00 做日结;每满 30 天生成月报,统一结算司机工资、补偿和债务等支出。</HelpRow>
            </TopbarHelp>
          </div>
          <div className="ts-stat topbar-stat funds-stat has-help" tabIndex="0" aria-describedby="funds-help-popover" title="资金规则">
            <span className="ts-label">资金</span>
            <strong className={`ts-value accent ${state.funds < 0 ? 'danger' : ''}`}>¥{(fundsDisplay ?? state.funds).toLocaleString()}</strong>
            {/* V14: 资金负数 → 显示破产倒计时 */}
            {state.funds < 0 && (() => {
              const threshold = GAME.DEATH_FUNDS_DAYS + (state.bankruptcyGraceBonus || 0);
              const daysLeft = Math.max(0, threshold - (state.negFundsDays || 0));
              const cls = daysLeft <= 1 ? 'ts-death-pulse' : daysLeft <= 2 ? 'ts-death-warn' : 'ts-death-info';
              return <span className={`ts-death-countdown ${cls}`}>距破产 {daysLeft} 天</span>;
            })()}
            {nextDebt && (() => {
              // V15.16 简化:多笔时顶栏显示「总待还」让玩家先感知总额,单笔时保留具体到期信息
              const fmtAmount = (v) => v >= 10000
                ? `¥${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)} 万`
                : `¥${(v || 0).toLocaleString()}`;
              if (debtSummary.count > 1) {
                const totalText = fmtAmount(debtSummary.totalRepay || 0);
                return (
                  <span className={`ts-debt-countdown ${debtUrgent ? 'urgent' : ''}`}
                        title={`总待还 ${totalText}(共 ${debtSummary.count} 笔),最近一笔 ${debtSummary.nextDaysLeft} 天后到期`}>
                    总待还 {totalText} · 最近 {debtSummary.nextDaysLeft} 天
                  </span>
                );
              }
              const amountText = fmtAmount(nextDebt.repay || 0);
              return (
                <span className={`ts-debt-countdown ${debtUrgent ? 'urgent' : ''}`}
                      title={`${debtSummary.nextDaysLeft} 天后 · ${nextDebt.label || '债务'} ¥${(nextDebt.repay || 0).toLocaleString()}`}>
                  {debtSummary.nextDaysLeft} 天 · {nextDebt.label || '债务'} {amountText}
                </span>
              );
            })()}
            <TopbarHelp id="funds-help-popover" title="资金规则">
              <HelpRow label="收入">司机完成订单后入账,平台抽成 {commissionText}% 后剩余收入进入资金。</HelpRow>
              <HelpRow label="支出">招募司机、购买车辆、训练能力、事件选择、还债和解雇补偿都会消耗资金。</HelpRow>
              <HelpRow label="月结">司机工资按月累计,每满 30 天月报时统一扣除;月末临时扩招会带来额外工资压力。</HelpRow>
              {debtSummary.count > 0 && (
                <HelpRow label="债务">
                  <span className="debt-help-list">
                    {debtSummary.debts.map((debt) => (
                      <span key={debt.id || `${debt.label}-${debt.dueDay}`}>
                        第 {debt.dueDay} 日 · {debt.label || '债务'} · ¥{(debt.repay || 0).toLocaleString()}
                      </span>
                    ))}
                  </span>
                </HelpRow>
              )}
              <HelpRow label="破产">资金 &lt; 0 连续 5 天 → 公司破产。两种常见触发:现金流断裂 / 投资人 Q3 撤资大额扣款。</HelpRow>
            </TopbarHelp>
          </div>
          <div className="ts-stat topbar-stat rep-stat has-help" tabIndex="0" aria-describedby="rep-help-popover" title={repSubTitle || '城市口碑'}>
            <span className="ts-label">口碑</span>
            <strong className="ts-value green">{repDisplay ?? state.reputation}</strong>
            {repSubText && <span className={`ts-rep-sub ${repSubCls}`}>{repSubText}</span>}
            <TopbarHelp id="rep-help-popover" title="口碑规则">
              <HelpRow label="怎么涨">司机完单拿到好评会累计,每 3 个好评 → 城市口碑 +1;提升服务质量能提高好评率。</HelpRow>
              <HelpRow label="怎么降">投诉会让口碑 -2;订单 1 小时没人接会流失,每流失 1 单 → 城市口碑 -1。</HelpRow>
              <HelpRow label="片区">口碑达到门槛会自动解锁片区;跌破门槛会反锁,回升后自动恢复。已解锁:{unlockedZoneText}<br /><span className="rep-help-next">下一片区:{nextZoneText}</span></HelpRow>
            </TopbarHelp>
          </div>
          {E.isUIGateUnlocked(state, 'supply_chip') && (
          <div className={`ts-stat topbar-stat supply-stat has-help ${supplyCardCls}`}
               tabIndex="0"
               aria-describedby="supply-help-popover"
               title={showAxis ? `近 ${histLen}h 平均流失 ${lossAvg.toFixed(1)} 单/h · 闲置 ${idleAvg.toFixed(1)} 司机/h` : ''}>
            <span className="ts-label">供给</span>
            <strong className={`ts-value supply-value ${supplyCls}`}>{supplyValue}</strong>
            {showAxis ? (
              <div className="ts-supply-axis" aria-label={`供给压力:${supplyValue}`}>
                <div className="ts-axis-bar">
                  <span className="ts-axis-zone-left" />
                  <span className="ts-axis-zone-mid" />
                  <span className="ts-axis-zone-right" />
                  <div className="ts-axis-pointer" style={{left: `${supplyRisk}%`}} />
                </div>
                <div className="ts-axis-labels">
                  <span>宽裕</span><span>够用</span><span>不足</span>
                </div>
              </div>
            ) : (
              <span className="ts-sub">{supplySubText}</span>
            )}
            <TopbarHelp id="supply-help-popover" title="供给规则">
              <HelpRow label="怎么看">这里看的是车队供给:当前司机和车辆够不够覆盖已解锁片区。绿色表示供给充足,红色表示供给不足。</HelpRow>
              <HelpRow label="不足">司机太少、车不够或车型不对时,订单没人接就会流失;流失订单会让城市口碑下降。</HelpRow>
              <HelpRow label="充足">车组足够覆盖当前片区时,显示“供给充足”。此时可以优先解锁更高价片区和订单。</HelpRow>
              <HelpRow label="建议">供给不足就招司机、买合适车型或训练司机;供给充足就扩张片区和收入结构。</HelpRow>
            </TopbarHelp>
          </div>
          )}
        </div>
        );
        })()}
        <div className="topbar-settings" aria-label="系统菜单">
          <button
            className="topbar-menu-btn"
            onClick={onOpenPauseMenu}
            title="打开系统菜单(ESC)"
            aria-label="打开系统菜单"
          >
            <span>设置</span>
            <em>ESC</em>
          </button>
        </div>
      </div>
    </div>
  );
}

function hasRunStarted(state) {
  return !!state.hasStarted || state.day > 1 || state.hour !== 6 || state.totalCompleted > 0 || state.totalEarned > 0;
}

function SpeedControlGroup({ state, dispatch }) {
  const started = hasRunStarted(state);
  const firstStart = state.paused && !started;
  const speeds = started ? [1, 2, 4, 8] : [];
  const controlsClass = [
    'speed-controls',
    firstStart ? 'is-first-start is-cta' : '',
    state.paused && started ? 'is-paused' : '',
  ].filter(Boolean).join(' ');
  const playLabel = firstStart ? '开始运营' : (state.paused ? '继续运营' : '暂停');

  const runAtSpeed = (speed) => {
    SFX.click();
    dispatch({type: 'SET_SPEED', speed});
  };

  return (
    <div className={controlsClass}>
      <button
        className={`speed-btn play-toggle ${firstStart ? 'is-first-start is-cta' : ''}`}
        onClick={() => {
          SFX.click();
          dispatch(state.paused ? {type: 'SET_SPEED', speed: state.speed || 1} : {type: 'TOGGLE_PAUSE'});
        }}
        title={firstStart ? '以 1 倍速开始运营' : (state.paused ? `以 ${state.speed || 1} 倍速继续运营` : `暂停运营,当前 ${state.speed} 倍速`)}
        aria-label={firstStart ? '以 1 倍速开始运营' : (state.paused ? `以 ${state.speed || 1} 倍速继续运营` : `暂停运营,当前 ${state.speed} 倍速`)}
        aria-pressed={!state.paused}
      >
        {firstStart ? (
          <>
            <span className="run-btn-main">开始运营</span>
            <span className="run-btn-sub">1× 正常速度</span>
          </>
        ) : playLabel}
      </button>
      {speeds.map((speed) => (
        <button
          key={speed}
          className={`speed-btn ${state.speed === speed ? 'active' : ''}`}
          onClick={() => runAtSpeed(speed)}
          title={state.paused ? `${speed}倍速继续运营` : `${speed}倍速`}
          aria-label={state.paused ? `${speed}倍速继续运营` : `${speed}倍速`}
          aria-pressed={state.speed === speed}
        >
          {speed}×
        </button>
      ))}
    </div>
  );
}

function BottomHUD({ state, dispatch, onOpenLog, requestConfirm }) {
  const currentTier = state.unlockedEndingTier || 0;
  const tierEnding = ENDINGS.find((e) => e.tier === currentTier);
  const latestLog = state.log[0];
  return (
    <div className="bottom-hud">
      <div className="hud-controls">
        <button className="hud-log-btn" onClick={onOpenLog} title="查看事件日志" aria-label="查看事件日志">
          <span className="hud-log-head">
            <b>事件日志</b>
            <em>查看</em>
          </span>
          <strong>{latestLog ? latestLog.text : '暂无事件'}</strong>
        </button>
        <div className="run-control-group">
        <SpeedControlGroup state={state} dispatch={dispatch} />
        {currentTier > 0 && (
          <button
            className="btn btn-primary btn-sm hud-end-btn"
            onClick={() => requestConfirm?.({
              tag: '结束游戏',
              title: '确认结束运营？',
              message: `以《${tierEnding.name}》结局结算本局。结束后不可继续，将进入结局画面。`,
              confirmLabel: '结束运营',
              danger: true,
              onConfirm: () => dispatch({ type: 'CONCEDE' }),
            })}
          >
            结束运营
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

function RunControlsFloating({ state, dispatch, requestConfirm }) {
  const currentTier = state.unlockedEndingTier || 0;
  const tierEnding = ENDINGS.find((e) => e.tier === currentTier);
  const firstStart = state.paused && !hasRunStarted(state);
  return (
    <div className={`map-run-controls ${firstStart ? 'is-first-start' : ''}`} aria-label="运行控制">
      <SpeedControlGroup state={state} dispatch={dispatch} />
      {currentTier > 0 && (
        <button
          className="btn btn-primary btn-sm hud-end-btn"
          onClick={() => requestConfirm({
            tag: '结束游戏',
            title: '确认结束运营？',
            message: `以《${tierEnding.name}》结局结算本局。结束后不可继续，将进入结局画面。`,
            confirmLabel: '结束运营',
            danger: true,
            onConfirm: () => dispatch({ type: 'CONCEDE' }),
          })}
        >
          结束运营
        </button>
      )}
    </div>
  );
}

/* ============== V10.16: 车组卡 ============== */

function getDriverWorkState(driver, vehicle) {
  if (!vehicle) return '未配车';
  if (driver.status === 'driving') return '接单中';
  return '等待接单';
}

function getLoyaltyMeta(driver) {
  const loyalty = driver?.loyalty ?? 50;
  const quitLine = E.getDriverQuitLine ? E.getDriverQuitLine(driver) : 30;
  const normalCap = E.getDriverLoyaltyCap ? E.getDriverLoyaltyCap(driver) : 100;
  const effect = loyalty > normalCap
    ? '忠诚已经超过普通上限,别让负面事件把关系打回去'
    : `忠诚影响接单积极性,低于 ${quitLine} 有离队风险`;
  if (loyalty < quitLine) {
    return {
      cls: 'danger',
      label: '离队风险',
      effect,
    };
  }
  if (loyalty < quitLine + 20) {
    return {
      cls: 'warn',
      label: '不稳定',
      effect,
    };
  }
  if (loyalty >= 80) {
    return {
      cls: 'good',
      label: '稳定',
      effect,
    };
  }
  return {
    cls: 'normal',
    label: '正常',
    effect,
  };
}

function getDriverStatLabel(stat) {
  return stat === 'driving' ? '车技' : E.statName(stat);
}

function getVehicleOrderName(order, compact = false) {
  const name = (order?.name || '').replace(/订单$/, '');
  return compact && name === '豪华车' ? '豪华' : name;
}

function getVehicleOrderNames(vd, compact = false) {
  return (vd.eligible || [])
    .map((id) => getVehicleOrderName(ORDERS.find((o) => o.id === id), compact))
    .filter(Boolean);
}

function getVehicleOrderSummary(vd) {
  // V14.54: 订单类型一行全展示,用短名和紧凑分隔避免高级车撑开卡片。
  const names = getVehicleOrderNames(vd, true);
  if (names.length === 0) return '暂无可接订单';
  return names.join('·');
}

function getVehicleOrderFullSummary(vd) {
  const names = getVehicleOrderNames(vd);
  return names.length > 0 ? names.join('、') : '暂无可接订单';
}
