  function clonePlayerStory(id) {
    const story = PLAYER_STORIES?.[id];
    if (!story) return null;
    return {
      ...story,
      buttons: [...(story.buttons || [])],
      paragraphs: [...(story.paragraphs || [])],
    };
  }

  function isRealTimeRunning(state) {
    return !!state.hasStarted
      && !state.paused
      && !state.activeEvent
      && !state.activePolicyDecision
      && !state.activePlayerStory
      && !state.activeStory
      && !state.showTutorial
      && !state.showMonthlyReport
      && !state.debtCrisis
      && !state.gameOver;
  }

  function computeGameHoursElapsed(state) {
    return Math.max(0, ((state.day || START_DAY) - START_DAY) * 24 + ((state.hour || START_HOUR) - START_HOUR));
  }

  function stampRealTime(state, actionType) {
    if (!state) return state;
    const now = Date.now();
    const prev = state.realTime || {};
    const alreadyStarted = !!prev.startedAt;
    const shouldStart = alreadyStarted || state.hasStarted || actionType === 'SET_SPEED';
    const startedAt = shouldStart ? (prev.startedAt || now) : null;
    const lastUpdatedAt = prev.lastUpdatedAt || now;
    const delta = alreadyStarted ? Math.max(0, now - lastUpdatedAt) : 0;
    const wasRunning = alreadyStarted && isRealTimeRunning(state);
    const totalElapsedMs = (prev.totalElapsedMs || 0) + delta;
    const activeElapsedMs = (prev.activeElapsedMs || 0) + (wasRunning ? delta : 0);
    return {
      ...state,
      realTime: {
        ...prev,
        createdAt: prev.createdAt || now,
        startedAt,
        lastUpdatedAt: now,
        totalElapsedMs,
        activeElapsedMs,
        pausedElapsedMs: Math.max(0, totalElapsedMs - activeElapsedMs),
        gameHoursElapsed: computeGameHoursElapsed(state),
        updatedBy: actionType || 'UNKNOWN',
      },
    };
  }

  function getDebtDisplayName(debt) {
    if (debt?.label) return debt.label;
    if (debt?.type === 'expansion_loan') return '扩张贷款';
    if (debt?.type === 'restructured') return '重组债务';
    if (debt?.type === 'event_loan') return '事件贷款';
    return '高利贷';
  }

  function getDebtSourceText(debt) {
    if (debt?.source) return debt.source;
    if (debt?.type === 'expansion_loan') return '监管扩张';
    if (debt?.type === 'restructured') return '债务重组';
    if (debt?.type === 'event_loan') return '事件选择';
    return '投资人压力';
  }

  function normalizeDebts(state) {
    const rawDebts = Array.isArray(state?.debts) ? state.debts : [];
    let debts = rawDebts
      .map((debt, idx) => {
        const dueDay = Math.max(0, Math.round(debt?.dueDay || 0));
        const repay = Math.max(0, Math.round(debt?.repay ?? debt?.amount ?? 0));
        if (!dueDay || !repay) return null;
        const type = debt?.type || 'high_interest';
        return {
          id: debt?.id || `${type}-${dueDay}-${idx + 1}`,
          type,
          label: debt?.label || getDebtDisplayName({ type }),
          source: debt?.source || getDebtSourceText({ type }),
          principal: Math.max(0, Math.round(debt?.principal ?? repay)),
          repay,
          dueDay,
          createdDay: Math.max(1, Math.round(debt?.createdDay || state?.day || 1)),
          interestRate: Number.isFinite(debt?.interestRate) ? debt.interestRate : null,
        };
      })
      .filter(Boolean);

    // 旧存档兼容:老版本只有 debtAmount/debtDueDay,没有债务明细。
    // TODO V17:V15.11 后所有新存档已是 debts 数组结构,迁移期满后可移除此兼容分支
    if (debts.length === 0 && state?.debtAmount > 0 && state?.debtDueDay > 0) {
      debts = [{
        id: `legacy-debt-${state.debtDueDay}`,
        type: 'high_interest',
        label: '历史债务',
        source: '旧存档',
        principal: Math.round(state.debtAmount),
        repay: Math.round(state.debtAmount),
        dueDay: Math.round(state.debtDueDay),
        createdDay: Math.max(1, Math.round(state.day || 1)),
        interestRate: null,
      }];
    }

    return debts.sort((a, b) => (a.dueDay - b.dueDay) || (a.repay - b.repay));
  }

  function getDebtSummary(state) {
    const debts = normalizeDebts(state);
    const totalRepay = debts.reduce((sum, debt) => sum + debt.repay, 0);
    const nextDebt = debts[0] || null;
    return {
      debts,
      count: debts.length,
      totalRepay,
      nextDebt,
      nextDueDay: nextDebt ? nextDebt.dueDay : 0,
      nextDaysLeft: nextDebt ? Math.max(0, nextDebt.dueDay - (state?.day || 1)) : 0,
    };
  }

  function syncDebtLegacyFields(state) {
    const debts = normalizeDebts(state);
    const summary = getDebtSummary({ ...state, debts, debtAmount: 0, debtDueDay: 0 });
    return {
      ...state,
      debts,
      debtAmount: summary.totalRepay,
      debtDueDay: summary.nextDueDay,
    };
  }

  function makeDebtId(state, type) {
    const prefix = type || 'debt';
    const existing = normalizeDebts(state).filter((debt) => String(debt.id || '').startsWith(`${prefix}-`)).length;
    return `${prefix}-${state.day || 1}-${state.hour || 0}-${existing + 1}`;
  }

  function addDebt(state, debt) {
    const nextDebt = {
      id: debt.id || makeDebtId(state, debt.type),
      createdDay: state.day || 1,
      ...debt,
    };
    return syncDebtLegacyFields({
      ...state,
      debts: [...normalizeDebts(state), nextDebt],
    });
  }

  function describeDebt(debt) {
    return `${getDebtDisplayName(debt)} ¥${(debt?.repay || 0).toLocaleString()}(第 ${debt?.dueDay || 0} 日)`;
  }

  // V14.67: 删除疲劳机制 — fatigue 字段、isDriverResting、FATIGUE_* 常量整套移除。
  //         玩家无感、阈值过高几乎不触发,且没区分长短途订单。

  function computeStatCaps(bgOrDriver) {
    const rarity = bgOrDriver?.rarity || 'N';
    const base = RARITY_STAT_CAPS?.[rarity] || RARITY_STAT_CAPS?.N || {
      driving: GAME.STAT_CAP, service: GAME.STAT_CAP,
    };
    const caps = { ...base };
    const boosts = bgOrDriver?.boosts || null;
    if (boosts) {
      const sorted = STAT_KEYS
        .map((key) => ({ key, val: boosts[key] || 0 }))
        .sort((a, b) => b.val - a.val);
      sorted.slice(0, 2).forEach(({ key }, idx) => {
        caps[key] = Math.min(GAME.STAT_CAP, caps[key] + (idx === 0 ? 5 : 3));
      });
    }
    return caps;
  }

  function getRarityLoyaltyRule(rarity = 'N') {
    return (RARITY_LOYALTY_RULES || []).find((rule) => rule.id === rarity)
      || DEFAULT_LOYALTY_RULES[rarity]
      || DEFAULT_LOYALTY_RULES.N;
  }

  function getDriverLoyaltyCap(driver, trustBreakthrough = false) {
    if (trustBreakthrough) return 100;
    return getRarityLoyaltyRule(driver?.rarity || 'N').normalCap || 100;
  }

  function getDriverQuitLine(driver) {
    return getRarityLoyaltyRule(driver?.rarity || 'N').quitBelow || 30;
  }

  function rollInitialLoyalty(bg) {
    const rule = getRarityLoyaltyRule(bg?.rarity || 'N');
    const min = rule.initialMin ?? 50;
    const max = rule.initialMax ?? min;
    const base = randInt(min, max);
    const legacyBias = Math.round(((bg?.loyalty ?? 60) - 60) / 10);
    return cap(base + legacyBias, min, max);
  }

  // V15.16: 调薪 → 忠诚变化映射
  // 1-3% 侮辱性涨薪(司机觉得被嘲讽,忠诚减),4% 中性(不变),
  // 5-49% 线性递增(忠诚 += pct),≥50% 拉满到 normalCap
  function getSalaryRaiseLoyaltyEffect(pct) {
    if (typeof pct !== 'number' || pct < 1 || pct > 50) return null;
    if (pct === 1) return { delta: -5, fillMax: false, hint: '司机心里嘀咕「就这?」' };
    if (pct === 2) return { delta: -3, fillMax: false, hint: '太抠了,司机不爽' };
    if (pct === 3) return { delta: -1, fillMax: false, hint: '聊胜于无,司机略不悦' };
    if (pct === 4) return { delta: 0, fillMax: false, hint: '调薪幅度过小,司机不会注意到' };
    if (pct >= 50) return { delta: 0, fillMax: true, hint: '一步到位,司机感动,忠诚直接拉满到 100(突破普通上限)' };
    return { delta: pct, fillMax: false, hint: `司机满意,忠诚 +${pct}` };
  }

  function applyDriverLoyaltyDelta(driver, delta, { trustBreakthrough = false } = {}) {
    const current = driver?.loyalty ?? 50;
    if (!delta) return { ...driver, loyalty: current };
    if (delta > 0) {
      const max = getDriverLoyaltyCap(driver, trustBreakthrough);
      return { ...driver, loyalty: current >= max ? current : cap(current + delta, 0, max) };
    }
    // 负向变化只按当前忠诚扣减,突破过上限也不提供额外保护。
    return { ...driver, loyalty: cap(current + delta, 0, 100) };
  }

  function recomputeReviewRating(goodReviews = 0, badReviews = 0) {
    return Number(cap(4.5 + goodReviews * 0.03 - badReviews * 0.15, 3, 5).toFixed(1));
  }

  // V15.16 audit fix:片区解锁加 hysteresis 滞后机制,避免口碑临界值波动反复解锁/反锁
  // 已解锁的片区用 unlock.reputation - ZONE_HYSTERESIS_GAP 作为反锁阈值
  // 例:解锁阈值 90 → 反锁阈值 80;玩家达到 90 解锁,降到 89 不会立刻反锁,跌到 79 才反锁
  // funds / day 阈值无 hysteresis(funds 一般稳定、day 单调递增)
  const ZONE_HYSTERESIS_GAP = 10;
  function isZoneUnlocked(state, zone) {
    if (!zone || !zone.unlock) return true;
    const u = zone.unlock;
    const wasUnlocked = state.zoneLockSnapshot?.[zone.id] === true;
    if (u.reputation !== undefined) {
      const threshold = wasUnlocked
        ? Math.max(0, u.reputation - ZONE_HYSTERESIS_GAP)
        : u.reputation;
      if (state.reputation < threshold) return false;
    }
    if (u.funds !== undefined && state.funds < u.funds) return false;
    if (u.day !== undefined && state.day < u.day) return false;
    return true;
  }

  function getZoneUnlockText(state, zone) {
    if (!zone || !zone.unlock || isZoneUnlocked(state, zone)) return '已解锁';
    const req = [];
    const u = zone.unlock;
    if (u.reputation !== undefined && state.reputation < u.reputation) req.push(`口碑 ${u.reputation}`);
    if (u.funds !== undefined && state.funds < u.funds) req.push(`资金 ¥${u.funds}`);
    if (u.day !== undefined && state.day < u.day) req.push(`第 ${u.day} 日`);
    return req.length ? `解锁: ${req.join(' + ')}` : '未解锁';
  }

  function getZoneOrderWeight(zone, orderId) {
    // V14.9: 删除 zone.hot 兼容分支 — 当前所有 ZONES 都用 orderMix,hot 是 V14.29 之前的旧数据格式
    return zone?.orderMix?.[orderId] || 0;
  }

  // V14.49: 事件效果按经营规模动态结算。
  // 目标:后期车队和现金变大后,事件仍有经营压力;同时所有展示数值保持整数和好理解的整百/整千。
  function roundEventMoney(value) {
    if (!value) return 0;
    const sign = value < 0 ? -1 : 1;
    const abs = Math.abs(value);
    const step = abs < 3000 ? 500 : abs < 20000 ? 1000 : 5000;
    return sign * Math.max(step, Math.round(abs / step) * step);
  }

  function getEventBusinessScale(state) {
    const crews = (state?.drivers || []).filter((d) =>
      d.vehicleId && (state?.vehicles || []).some((v) => v.id === d.vehicleId)
    ).length;
    const funds = Math.max(0, state?.funds || 0);
    const reputation = Math.max(0, state?.reputation || 0);
    const crewScale = Math.max(0, crews - 2) * 0.55;
    const fundsScale = Math.max(0, funds - GAME.STARTING_FUNDS) / 30000;
    const repScale = Math.max(0, reputation - GAME.STARTING_REPUTATION) / 120;
    return Number(cap(1 + crewScale + fundsScale + repScale, 1, 15).toFixed(2));
  }

  function scaleEventMoneyDelta(amount, state, opts = {}) {
    if (!amount) return amount;
    const scale = getEventBusinessScale(state);
    // 普通奖励弱放大;拿钱换口碑/忠诚的逐利选项要更像诱惑,收益随规模明显放大。
    const gainScale = opts.profitSeeking ? 0.8 : 0.35;
    const factor = amount > 0 ? 1 + (scale - 1) * gainScale : scale;
    return roundEventMoney(amount * factor);
  }

  function scaleEventReputationDelta(delta, state) {
    if (!delta) return delta;
    if (delta > 0) return Math.round(delta);
    const rep = Math.max(0, state?.reputation || 0);
    const tier = rep >= 1200 ? { factor: 10, cap: 300 }
      : rep >= 800 ? { factor: 7, cap: 220 }
      : rep >= 500 ? { factor: 5, cap: 170 }
      : rep >= 300 ? { factor: 3.5, cap: 110 }
      : rep >= 120 ? { factor: 2, cap: 70 }
      : { factor: 1, cap: 40 };
    return -Math.min(tier.cap, Math.max(1, Math.round(Math.abs(delta) * tier.factor)));
  }

  function isProfitSeekingEffect(effect) {
    if (!effect || effect.funds <= 0) return false;
    return (effect.reputation || 0) < 0
      || (effect.allLoyalty || 0) < 0
      || (effect.trustLoyalty || 0) < 0;
  }

  function getAverageDriverLoyalty(state) {
    const drivers = state?.drivers || [];
    if (drivers.length === 0) return 60;
    const total = drivers.reduce((sum, d) => sum + (d.loyalty ?? 50), 0);
    return total / drivers.length;
  }

  function scaleEventLoyaltyDelta(delta, state) {
    if (!delta) return delta;
    const avg = getAverageDriverLoyalty(state);
    const factor = delta > 0
      ? (avg < 50 ? 1.4 : avg > 75 ? 0.7 : 1)
      : (avg < 50 ? 0.7 : avg > 75 ? 1.3 : 1);
    const capAbs = delta > 0 ? 35 : 45;
    const abs = Math.min(capAbs, Math.max(1, Math.round(Math.abs(delta) * factor)));
    return delta > 0 ? abs : -abs;
  }

  function scaleEventSalaryRaise(amount, state) {
    if (!amount) return amount;
    const scale = getEventBusinessScale(state);
    return roundEventMoney(amount * (1 + (scale - 1) * 0.6));
  }

  function scaleEventEffect(rawEffect, state) {
    const eff = { ...(rawEffect || {}) };
    const scale = getEventBusinessScale(state);
    const profitSeeking = isProfitSeekingEffect(eff);
    let dynamic = false;
    if (eff.funds !== undefined) {
      const next = scaleEventMoneyDelta(eff.funds, state, { profitSeeking });
      dynamic = dynamic || next !== eff.funds;
      eff.funds = next;
    }
    if (eff.reputation !== undefined) {
      const next = scaleEventReputationDelta(eff.reputation, state);
      dynamic = dynamic || next !== eff.reputation;
      eff.reputation = next;
    }
    if (eff.allLoyalty !== undefined) {
      const next = scaleEventLoyaltyDelta(eff.allLoyalty, state);
      dynamic = dynamic || next !== eff.allLoyalty;
      eff.allLoyalty = next;
    }
    if (eff.trustLoyalty !== undefined) {
      const next = scaleEventLoyaltyDelta(eff.trustLoyalty, state);
      dynamic = dynamic || next !== eff.trustLoyalty;
      eff.trustLoyalty = next;
    }
    if (eff.salaryRaise !== undefined) {
      const next = scaleEventSalaryRaise(eff.salaryRaise, state);
      dynamic = dynamic || next !== eff.salaryRaise;
      eff.salaryRaise = next;
    }
    if (eff.accidentRisk) {
      const risk = { ...eff.accidentRisk };
      const riskProfitSeeking = isProfitSeekingEffect(risk);
      if (risk.funds !== undefined) {
        const next = scaleEventMoneyDelta(risk.funds, state, { profitSeeking: riskProfitSeeking });
        dynamic = dynamic || next !== risk.funds;
        risk.funds = next;
      }
      if (risk.reputation !== undefined) {
        const next = scaleEventReputationDelta(risk.reputation, state);
        dynamic = dynamic || next !== risk.reputation;
        risk.reputation = next;
      }
      if (risk.allLoyalty !== undefined) {
        const next = scaleEventLoyaltyDelta(risk.allLoyalty, state);
        dynamic = dynamic || next !== risk.allLoyalty;
        risk.allLoyalty = next;
      }
      if (risk.trustLoyalty !== undefined) {
        const next = scaleEventLoyaltyDelta(risk.trustLoyalty, state);
        dynamic = dynamic || next !== risk.trustLoyalty;
        risk.trustLoyalty = next;
      }
      eff.accidentRisk = risk;
    }
    if (dynamic) {
      eff.eventScale = scale;
    }
    return eff;
  }

  // V14.9: isOrderZoneUnlocked 已删除 — 仅 dispatchOffers 内部用,跟着死代码一起清理
