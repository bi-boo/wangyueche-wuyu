/* 网约车物语 V3 - 游戏引擎 (reducer + 工具 + 任务系统) */
(function () {
  const D = window.WYCWY_DATA;
  const { GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES, TRAININGS, EVENTS, FIRST_NAMES, MISSIONS, ENDINGS, INVESTOR_PRESSURE, POLICY_EVENTS, INVESTOR_REVIEW, RARITY_STAT_CAPS, RARITY_LOYALTY_RULES, UI_GATES } = D;

  let driverIdCounter = 100;
  let vehicleIdCounter = 100;
  let orderOfferIdCounter = 0;
  let logIdCounter = 0;
  let actionHistoryIdCounter = 0;

  // 工具
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (v, min, max) => Math.max(min, Math.min(max, v));
  // V14.11: 属性砍到 2(driving + service)。driving 决定高端订单准入和收益,service 决定好评率。
  const sumStats = (s) => s.driving + s.service;
  const STAT_KEYS = ['driving', 'service'];
  const DEFAULT_LOYALTY_RULES = {
    N: { id: 'N', initialMin: 75, initialMax: 85, normalCap: 100, quitBelow: 25, moralePenalty: 4 },
    R: { id: 'R', initialMin: 60, initialMax: 75, normalCap: 95, quitBelow: 30, moralePenalty: 4 },
    SR: { id: 'SR', initialMin: 50, initialMax: 65, normalCap: 90, quitBelow: 35, moralePenalty: 6 },
    SSR: { id: 'SSR', initialMin: 40, initialMax: 55, normalCap: 85, quitBelow: 40, moralePenalty: 8 },
  };
  const START_DAY = 1;
  const START_HOUR = 6;
  const DEBT_RESTRUCTURE_FEE_RATE = 0.05;
  const DEBT_RESTRUCTURE_MIN_DAYS = 14;
  const DEBT_RESTRUCTURE_MAX_DAYS = 60;
  const SNOW_RESCUE_EVENT_ID = 'snow_night_breakthrough';

  function isRealTimeRunning(state) {
    return !!state.hasStarted
      && !state.paused
      && !state.activeEvent
      && !state.activePolicyDecision
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

  function scaleEventMoneyDelta(amount, state) {
    if (!amount) return amount;
    const scale = getEventBusinessScale(state);
    // 奖励也随规模走,但弱一些,避免后期事件变成主要赚钱方式。
    const factor = amount > 0 ? 1 + (scale - 1) * 0.35 : scale;
    return roundEventMoney(amount * factor);
  }

  function scaleEventReputationDelta(delta, state) {
    if (!delta) return delta;
    if (delta > 0) return Math.round(delta);
    const rep = Math.max(0, state?.reputation || 0);
    const factor = rep >= 800 ? 8 : rep >= 500 ? 5 : rep >= 300 ? 3.5 : rep >= 120 ? 2 : 1;
    return -Math.min(80, Math.max(1, Math.round(Math.abs(delta) * factor)));
  }

  function scaleEventSalaryRaise(amount, state) {
    if (!amount) return amount;
    const scale = getEventBusinessScale(state);
    return roundEventMoney(amount * (1 + (scale - 1) * 0.6));
  }

  function scaleEventEffect(rawEffect, state) {
    const eff = { ...(rawEffect || {}) };
    const scale = getEventBusinessScale(state);
    let dynamic = false;
    if (eff.funds !== undefined) {
      const next = scaleEventMoneyDelta(eff.funds, state);
      dynamic = dynamic || next !== eff.funds;
      eff.funds = next;
    }
    if (eff.reputation !== undefined) {
      const next = scaleEventReputationDelta(eff.reputation, state);
      dynamic = dynamic || next !== eff.reputation;
      eff.reputation = next;
    }
    if (eff.salaryRaise !== undefined) {
      const next = scaleEventSalaryRaise(eff.salaryRaise, state);
      dynamic = dynamic || next !== eff.salaryRaise;
      eff.salaryRaise = next;
    }
    if (eff.accidentRisk) {
      const risk = { ...eff.accidentRisk };
      if (risk.funds !== undefined) {
        const next = scaleEventMoneyDelta(risk.funds, state);
        dynamic = dynamic || next !== risk.funds;
        risk.funds = next;
      }
      if (risk.reputation !== undefined) {
        const next = scaleEventReputationDelta(risk.reputation, state);
        dynamic = dynamic || next !== risk.reputation;
        risk.reputation = next;
      }
      eff.accidentRisk = risk;
    }
    if (dynamic) {
      eff.eventScale = scale;
    }
    return eff;
  }

  // V14.9: isOrderZoneUnlocked 已删除 — 仅 dispatchOffers 内部用,跟着死代码一起清理

  // V7: 司机故事线 — 跨周目伪随机持久化
  const SEEN_STORIES_KEY = 'wycwy_seen_stories';
  function loadSeenStories() {
    try {
      const raw = localStorage.getItem(SEEN_STORIES_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
      // codex review fix(Medium):规范化 schema —
      // 只保留 { [bgId]: number[] } 形态的条目,丢弃任何非数组或含非数字元素的脏数据
      // codex review #2 fix(Low):防 prototype pollution —
      // 用 Object.create(null) 隔离原型链,并显式拒绝 __proto__/constructor/prototype 这类危险 key
      const cleaned = Object.create(null);
      const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
      for (const k of Object.keys(obj)) {
        if (FORBIDDEN_KEYS.includes(k)) continue;
        const v = obj[k];
        if (Array.isArray(v) && v.every((n) => typeof n === 'number' && Number.isFinite(n))) {
          cleaned[k] = v.slice();
        }
      }
      return cleaned;
    } catch (e) {
      return {};
    }
  }
  function saveSeenStories(seen) {
    try {
      localStorage.setItem(SEEN_STORIES_KEY, JSON.stringify(seen || {}));
    } catch (e) {}
  }
  // 伪随机:优先抽未看过的 slice,全看过后纯随机
  function pickUnseenSliceIndex(bgId, slicesPool, seen) {
    if (!slicesPool || slicesPool.length === 0) return -1;
    const seenIdx = (seen && seen[bgId]) || [];
    const allIdx = slicesPool.map((_, i) => i);
    const unseen = allIdx.filter((i) => !seenIdx.includes(i));
    if (unseen.length > 0) return unseen[Math.floor(Math.random() * unseen.length)];
    // 全看过:从全部里纯随机
    return allIdx[Math.floor(Math.random() * allIdx.length)];
  }

  const GIVEN_NAMES_SHORT = ['伟', '勇', '军', '强', '磊', '涛', '明', '辉', '兵', '波', '华', '刚', '鹏', '亮', '斌', '峰', '超', '龙'];
  const GIVEN_NAMES_LONG = ['建国', '建军', '志强', '志刚', '海军', '小刚', '大伟', '永福', '国庆', '立民', '卫东', '建华', '振华', '德胜', '长春', '和平'];
  const SR_NAME_PREFIXES = ['金牌', '王牌', '特级', '头牌', '首席', '明星', '老炮', '专车'];
  const SSR_RACING_NAMES = ['舒马赫', '塞纳', '汉密尔顿', '维斯塔潘', '阿隆索', '莱科宁', '维特尔', '勒克莱尔', '巴顿', '哈基宁', '普罗斯特', '曼塞尔'];
  const SSR_RACING_SUFFIXES = ['车神', '冠军', '传奇', '大师'];

  function genName(rarity = 'N') {
    if (rarity === 'SSR') return pick(SSR_RACING_NAMES) + pick(SSR_RACING_SUFFIXES);
    if (rarity === 'SR') return pick(SR_NAME_PREFIXES) + pick(FIRST_NAMES) + pick(GIVEN_NAMES_LONG);
    if (rarity === 'R') return pick(FIRST_NAMES) + pick(GIVEN_NAMES_LONG);
    return pick(FIRST_NAMES) + pick(GIVEN_NAMES_SHORT);
  }

  function genDriver(opts = {}) {
    const bg = opts.background || pick(BACKGROUNDS);
    const rarity = bg.rarity || 'N';
    const name = opts.name || genName(rarity);
    const baseSpread = randInt(-3, 5);
    const statCaps = computeStatCaps(bg);
    return {
      id: ++driverIdCounter,
      name,
      bg: bg.id,
      bgName: bg.name,
      rarity,  // V6: 稀有度
      avatar: bg.avatar,
      stats: {
        driving: cap(bg.boosts.driving + baseSpread, 1, statCaps.driving),
        service: cap(bg.boosts.service + baseSpread, 1, statCaps.service),
      },
      statCaps,
      salary: bg.salary,
      loyalty: opts.loyalty ?? rollInitialLoyalty(bg),
      completedOrders: 0,
      totalEarned: 0,
      goodReviews: 0,
      badReviews: 0,
      rating: 4.5,
      vehicleId: null,
      status: 'idle',
      currentOrder: null,
      orderRateBonus: bg.orderRateBonus || 1.0,
    };
  }

  function genUniqueDriver(opts = {}, usedNames = null) {
    let driver = genDriver(opts);
    if (!usedNames) return driver;
    let retry = 0;
    while (usedNames.has(driver.name) && retry < 12) {
      driver = genDriver(opts);
      retry += 1;
    }
    usedNames.add(driver.name);
    return driver;
  }

  // V11: 抽卡 — 根据券类型按固定概率随机稀有度(不再走玩家阶段),再从该稀有度池子里抽一个。
  function rollGacha(state, ticketId) {
    const ticket = D.RECRUIT_TICKETS.find((t) => t.id === ticketId);
    if (!ticket) return null;
    const probs = ticket.probs;
    const rarities = ['N', 'R', 'SR', 'SSR'];
    const usedNames = new Set((state?.drivers || []).map((d) => d.name));
    // 抽 3 张
    const cards = [];
    for (let i = 0; i < 3; i++) {
      let r = Math.random();
      let chosenRarity = 'N';
      for (let j = 0; j < probs.length; j++) {
        if (r < probs[j]) { chosenRarity = rarities[j]; break; }
        r -= probs[j];
      }
      const pool = BACKGROUNDS.filter((b) => b.rarity === chosenRarity);
      if (pool.length === 0) {
        // fallback 到下一档
        const fallback = BACKGROUNDS.filter((b) => b.rarity === 'N');
        cards.push(genUniqueDriver({ background: pick(fallback) }, usedNames));
      } else {
        cards.push(genUniqueDriver({ background: pick(pool) }, usedNames));
      }
    }
    return cards;
  }

  function genVehicle(template) {
    return {
      id: ++vehicleIdCounter,
      templateId: template.id,
      name: template.name,
    };
  }

  function getVehicleData(v) {
    return VEHICLES.find((t) => t.id === v.templateId);
  }

  function canTakeOrder(order, driver, vehicle) {
    for (const k in order.req) if (driver.stats[k] < order.req[k]) return false;
    const vd = getVehicleData(vehicle);
    if (!vd.eligible.includes(order.id)) return false;
    return true;
  }

  function fleetHasVehicleForOrder(vehicles, order) {
    return vehicles.some((vehicle) => {
      const vd = getVehicleData(vehicle);
      return vd && vd.eligible.includes(order.id);
    });
  }

  function inHourWindow(window, hour) {
    if (!window) return true;
    const [s, e] = window;
    if (s < e) return hour >= s && hour < e;
    return hour >= s || hour < e;
  }

  function computeFare(order, driver, vehicle) {
    let fare = order.fare;
    // V14.11: 高端订单不再只有"过线/不过线"。驾驶越高,专车/豪华车单价越稳。
    const driving = driver.stats.driving || 0;
    if (order.id === 'airport') {
      fare *= 1 + cap((driving - 35) / 35 * 0.25, 0, 0.25);
    } else if (order.id === 'luxury') {
      fare *= 1 + cap((driving - 70) / 29 * 0.2, 0, 0.2);
    }
    fare *= rand(0.95, 1.1);
    return Math.round(fare);
  }

  function rollGoodReview(driver, vehicle) {
    // V12: 服务系数 0.005 → 0.008,让"练服务"对好评率有更明显感知
    const base = 0.5 + driver.stats.service * 0.008;
    return Math.random() < base;
  }

  // V12: 计算司机服务对应的好评率(用于 UI 展示和外部调用)
  function getDriverGoodReviewRate(driver) {
    return Math.min(1, 0.5 + (driver.stats.service || 0) * 0.008);
  }

  function getDriverLoyaltyMultiplier(driver) {
    const loyalty = driver?.loyalty ?? 50;
    // 50 忠诚为基准;低忠诚会少接单,高忠诚会更积极。
    return Math.max(0.75, Math.min(1.25, 0.75 + loyalty / 200));
  }

  // V15.16:接单率拆解 — 司机详情面板用,让玩家能归因「今天单少」是哪个变量在压
  function getDriverTryRateBreakdown(driver, reputation) {
    const base = 0.7;
    const repMul = 0.5 + (reputation || 0) / 150;
    const loyaltyMul = getDriverLoyaltyMultiplier(driver);
    const bonus = driver?.orderRateBonus || 1.0;
    const raw = base * repMul * loyaltyMul * bonus;
    const final = Math.min(0.99, raw);
    return { base, repMul, loyaltyMul, bonus, raw, final, capped: raw > 0.99 };
  }

  function getDriverQuitRisk(driver) {
    const loyalty = driver?.loyalty ?? 50;
    const quitLine = getDriverQuitLine(driver);
    if (loyalty >= quitLine) return 0;
    return Math.min(0.25, (quitLine - loyalty) * 0.01);
  }

  function hasLowLoyaltyDriver(state) {
    return (state?.drivers || []).some((driver) => (driver.loyalty ?? 50) < getDriverQuitLine(driver));
  }

  // V12: 半订单池 — 每 tick 按片区 density 刷出实物订单名额,司机抢,未抢完即流失。
  // 时段倍率:早高峰(7-9)/晚高峰(17-19) ×1.3,深夜(22-5) ×0.7,其余 ×1.0。
  function buildHourlySupply(state) {
    const supply = [];
    const hour = state.hour;
    const isMorningRush = hour >= 7 && hour < 10;
    const isEveningRush = hour >= 17 && hour < 20;
    const isDeepNight = hour >= 22 || hour < 5;
    const hourMul = (isMorningRush || isEveningRush) ? 1.3
      : isDeepNight ? 0.7
      : 1.0;

    for (const zone of ZONES) {
      if (!isZoneUnlocked(state, zone)) continue;
      const baseDensity = zone.density || 1.0;
      const expected = baseDensity * hourMul;
      // 期望小数 → floor + 概率补偿,避免精度永远丢失
      const intPart = Math.floor(expected);
      const fracPart = expected - intPart;
      const count = intPart + (Math.random() < fracPart ? 1 : 0);
      if (count === 0) continue;

      // V14.29: 每个片区都有全量订单池,orderMix 决定出现权重。
      const candidates = ORDERS.filter((o) =>
        getZoneOrderWeight(zone, o.id) > 0 && inHourWindow(o.hours_window, hour)
      );
      if (candidates.length === 0) continue;

      for (let i = 0; i < count; i++) {
        // V15: 政策事件订单减量(如禁运期 orderMultiplier = 0.2 → 80% 订单丢弃)
        const policyMul = (state.policyOngoingEffects && state.policyOngoingEffects.orderMultiplier) ?? 1;
        if (policyMul < 1 && Math.random() > policyMul) continue;
        const weights = candidates.map((o) => getZoneOrderWeight(zone, o.id));
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let chosen = candidates[0];
        for (let j = 0; j < candidates.length; j++) {
          r -= weights[j];
          if (r <= 0) { chosen = candidates[j]; break; }
        }
        supply.push({
          zoneId: zone.id,
          orderId: chosen.id,
          order: chosen,
          taken: false,
        });
      }
    }
    return supply;
  }

  function hasEligibleDriverForOrder(state, drivers, vehicles, order) {
    return drivers.some((d) => {
      if (d.status !== 'idle') return false;
      if (!d.vehicleId) return false;
      const v = vehicles.find((x) => x.id === d.vehicleId);
      return v && canTakeOrder(order, d, v);
    });
  }

  // V14.9: buildDispatchOffers / refreshDispatchOffers 已删除 — 之前驱动 CityOrderLayer
  // 渲染地图气泡,但 CityOrderLayer 早已 return null 是死组件。真正派单看 buildHourlySupply。


  // === reducer ===
  function makeInitialState() {
    const now = Date.now();
    driverIdCounter = 100;
    vehicleIdCounter = 100;
    orderOfferIdCounter = 0;
    logIdCounter = 0;
    actionHistoryIdCounter = 0;
    const initialNames = new Set();
    const d1 = genUniqueDriver({ background: BACKGROUNDS[0], name: '老张' }, initialNames);
    const d2 = genUniqueDriver({ background: BACKGROUNDS[3] }, initialNames);
    const v1 = genVehicle(VEHICLES[0]);
    const v2 = genVehicle(VEHICLES[0]);
    d1.vehicleId = v1.id;
    d2.vehicleId = v2.id;
    const initial = {
      funds: GAME.STARTING_FUNDS,
      reputation: GAME.STARTING_REPUTATION,
      day: 1,
      hour: 6,
      speed: 1,
      paused: true,
      hasStarted: false,
      realTime: {
        createdAt: now,
        startedAt: null,
        lastUpdatedAt: now,
        totalElapsedMs: 0,
        activeElapsedMs: 0,
        pausedElapsedMs: 0,
        gameHoursElapsed: 0,
        updatedBy: 'INIT',
      },
      drivers: [d1, d2],
      vehicles: [v1, v2],
      log: [
        { id: ++logIdCounter, time: '6:00', text: `车队成立! 初始资金 ¥${(GAME.STARTING_FUNDS || 0).toLocaleString()}`, level: 'event' },
      ],
      actionHistory: [],
      activeEvent: null,
      showTutorial: true,
      gameOver: null,
      todayCompleted: 0,
      todayEarned: 0,
      todayGood: 0,
      todayBad: 0,
      reviewBank: 0,                // 每 3 个好评沉淀为 1 点城市口碑,避免开局口碑暴涨
      todayLost: 0,                  // V12: 今日订单流失数(运力不足)
      todayRepLoss: 0,               // V12: 今日因流失扣的口碑数
      hourSupplyTotal: 0,            // V12: 上一小时刷出的订单总数(用于运力徽章)
      hourSupplyTaken: 0,            // V12: 上一小时被司机抢走的订单数
      hourIdleDrivers: 0,            // V12: 上一小时闲置司机数(用于供需轴左半轴)
      hourActiveDrivers: 0,          // V12: 上一小时参与派单的司机总数(分母)
      supplyHistory: [],             // V14.4: 近 6 小时 [{ lost, idle }] 滑动窗口,用于平滑供需状态判定
      zoneLockSnapshot: {},          // V12: 上一 tick 各片区解锁状态,用于检测反锁/重解锁
      diagnostics: [],               // V12.2: 诊断历史,每 tick 1 条,用于导出分析(只保留近 720 条 = 30 游戏日)
      totalEarned: 0,
      totalCompleted: 0,
      commissionRate: GAME.COMMISSION,
      // V14.9: 删除 triggeredEvents(V6 兼容字段)、lowLoyaltyDays/lowRepDays(累而不读的死字段)
      // V14.67: 删除 yesterdayLost/Earned/Completed、kpiHistory、zoneHeat(累而不读)
      eventCooldowns: {},   // V7: 事件冷却 — { [eventId]: dayUnlocked }(仅本局有效,RESET 时重置;seenStories 才跨周目)
      // V15.16 cleanup:eventChainCount 字段彻底删除(V7 遗留,V15.x 改用 chainChoices)
      // V15.x: 真分支链式
      chainChoices: {},     // { [chain]: choiceKey } — 玩家在 chain 事件里选了什么,后续段据此过滤
      chainProgress: {},     // { [chainId]: { stage, lastDay, lastEventId, completedEventIds } } — 链式剧情节奏
      lastChainEventDay: 0,
      lastRandomEventDay: 0,
      eventTagLastDays: {},  // { [tag]: day } — 随机事件同类降权
      keyDriverIds: [],     // 钥匙司机 ID 列表(rival_pricing +¥3k/+¥4k 标记)
      platformChoseSelfop: false,  // 是否已选自营(platform_pressure 永久完结标记)
      floatGains: [],
      boostUntilDay: 0,
      boostMul: 1,
      notifications: [],
      // V3: 任务系统
      currentMissionIdx: 0,
      completedMissionIds: [],
      newMissionComplete: null,
      // V15.17:渐进解锁 — UI gate 状态(已解锁的入口 id 数组,持久化)
      unlockedUIGates: [],
      // 当前正在展示的解锁 splash 卡片队列(玩家点「继续运营」后弹下一个)
      activeUnlockSplash: null,
      // V15.17:刚解锁后的 spotlight — gateId + untilHour 自动过期 / 玩家点击 ack
      spotlight: null,
      // V14.10: 死亡条件计数器(连续天数)— 只剩资金破产
      negFundsDays: 0,
      // V15.23:第一次普通破产倒计时剩 1 天时触发“雪夜爆单”救场,一局只触发一次
      snowRescueFired: false,
      // V5: 投资人压力事件队列
      investorPressureFired: false,
      // V15.29: 投资人 early review 机制 — 早期防挂机,Day 30 看 3 车组,Day 60 看 5 车组
      reviewCounter: 0,           // 已处理的 early review 次数,仅用于调试 / 月报回顾
      investorReviewStages: {},   // { [stage]: true } — early_warning / early_final 是否已处理
      investorReviewDone: false,  // 达到 Day 60 最终车组目标后退出 review 体系
      investorReviewDeadlineDay: null, // Day 60 最后通牒后的撤资截止日
      investorMissCount: 0,       // 兼容旧 UI/存档,新逻辑只作为提醒等级计数
      lastReviewDay: 0,           // 最近一次评估的 day,防止重复触发
      investorBoosted: false,     // 兼容旧存档字段,新逻辑不再使用 Q3 加注路径
      investorPath: null,         // 兼容旧存档字段
      gameOverPending: null,      // 'kicked_out' | null,撤资事件触发后标记,死亡时归因使用
      // V5: 已解锁的最高结局 tier(从 0 开始,达成才更新)
      unlockedEndingTier: 0,
      newEndingUnlocked: null,
      // V16: 多笔债务明细。debtAmount/debtDueDay 保留为最近债务汇总兼容字段。
      debts: [],
      debtCrisis: null,
      debtRestructureCount: 0,
      debtAmount: 0,
      debtDueDay: 0,
      // V14: 投资人事件里勾选解雇,获得 +10 天破产宽容期(累加到 DEATH_FUNDS_DAYS 上)
      bankruptcyGraceBonus: 0,
      // V14: 月度结算(每 30 天聚合一次,弹窗暂停游戏)
      monthCounter: 1,
      monthlyEarnedGross: 0,        // 乘客支付总额(含抽成)
      monthlyCommission: 0,         // 平台抽成
      monthlySalary: 0,             // 本月累计应付工资(月结时一次性扣款)
      monthlyDebtPaid: 0,           // 债务扣款
      monthlySeverance: 0,          // 主动解雇补偿
      monthlyEventImpact: 0,        // 事件资金影响合计(signed)
      monthlyEventItems: [],         // 月报里的事件资金明细: [{ day, title, label, amount, detail }]
      monthlyDriverData: {},        // { [driverId]: { name, bgName, salary, salaryPaid, completed, earnedNet, leftDay } }
      showMonthlyReport: null,      // 月报弹窗 snapshot,关闭后清空
      // V6: 抽卡状态
      gachaCards: null,
      gachaTicketId: null,
      totalTrainings: 0,
      trainingCounts: {},
      orderCounts: {},
      // V7: 故事线 — 当前展示的故事(暂停游戏)+ 已看过切片记忆(跨周目持久化)
      activeStory: null,
      seenStories: loadSeenStories(),
      lastStoryDay: -999,
      // V15: 政策事件框架(按游戏绝对时间触发的链式黑天鹅事件)
      // 详见「监管整改机制设计-V1.md」。仅本局有效,RESET 时重置。
      policyState: {
        govBan: {
          notice1Fired: false,
          decisionFired: false,
          decision: null,            // 'A' | 'B'
          loanTaken: false,
          loanAmount: 0,
          verdictFired: false,
          verdictResult: null,       // 'pass' | 'fine' | 'ban'
          banLifted: false,
          complianceStartDay: 0,     // 合规月扣起始日(衰减曲线锚点)
          banUntilDay: 0,            // B 玩家禁运结束日
          cooldownUntilDay: 0,       // A 玩家招募/购车冷却结束日
          refMonthlyRevenue: 0,      // R₀:决策点当月营收基准
          stats: {                   // 复盘用累计统计
            fine: 0,
            banLossEstimate: 0,
            compliancePaid: 0,
            loanPaid: 0,
          },
        },
      },
      // V15: 政策事件统一汇总当前生效效果(派单/招募/购车/月结读取此处)
      policyOngoingEffects: {
        orderMultiplier: 1,          // 派单丢弃概率(禁运 0.2)
        recruitCooldownDays: 0,      // 司机招募冷却(预留,V1 内嵌检查 cooldownUntilDay)
        vehicleCooldownDays: 0,      // 车辆购买冷却(同上)
      },
    };
    return pushActionHistory(initial, {
      category: 'system',
      type: 'RUN_START',
      label: `车队成立,初始资金 ¥${(GAME.STARTING_FUNDS || 0).toLocaleString()}`,
      level: 'event',
    });
  }

  // V7: 故事弹窗确认 — 发奖励 + 写 seenStories + 清状态
  function applyStoryReward(state, story) {
    let s = { ...state };
    const r = story.reward || {};
    if (r.funds) s.funds += r.funds;
    if (r.reputation) s.reputation = Math.max(0, s.reputation + r.reputation);
    if (r.loyalty) {
      s.drivers = s.drivers.map((d) =>
        d.id === story.driverId ? applyDriverLoyaltyDelta(d, r.loyalty, { trustBreakthrough: true }) : d
      );
    }
    if (r.badge) {
      // 给该司机加称号(永久挂在 driver.badges 数组)
      s.drivers = s.drivers.map((d) =>
        d.id === story.driverId ? { ...d, badges: [...(d.badges || []), r.badge] } : d
      );
    }
    s = pushLog(s, `📖 ${story.driverName}「${story.title}」`, 'event');
    return s;
  }

  function checkMission(state) {
    let s = state;
    if (s.newMissionComplete) return s;

    // V15.16:乱序检查 — 找未完成且 check pass 的任务,支持 hidden 任务并行完成
    // hidden 任务静默 toast,非 hidden 任务弹 MissionToast(单弹窗,等用户清后下次再触发)
    let changed = true;
    while (changed) {
      changed = false;
      const completedSet = new Set(s.completedMissionIds || []);
      for (const mission of MISSIONS) {
        if (completedSet.has(mission.id)) continue;
        if (!mission.check(s)) continue;

        const reward = mission.reward || {};
        s = { ...s };
        if (reward.funds) s.funds += reward.funds;
        s.completedMissionIds = [...s.completedMissionIds, mission.id];

        // currentMissionIdx 重新指向第一个未完成的非 hidden 任务(MissionBar 显示用)
        const newCompleted = new Set(s.completedMissionIds);
        const firstActiveIdx = MISSIONS.findIndex((m) => !newCompleted.has(m.id) && !m.hidden);
        s.currentMissionIdx = firstActiveIdx >= 0 ? firstActiveIdx : MISSIONS.length;

        const rewardText = reward.funds ? ` (+¥${reward.funds})` : '';
        if (mission.hidden) {
          // 静默 toast,可继续连锁完成下一个
          s = pushLog(s, `✓ ${reward.message || mission.title}${rewardText}`, 'event');
          s = pushNotif(s, `✓ ${reward.message || mission.title}${rewardText}`, 'event');
          changed = true;
          break;
        }
        // 非 hidden 弹 MissionToast,等用户清后下次触发再继续检查
        s.newMissionComplete = mission;
        s = pushLog(s, `任务完成: ${mission.title}${rewardText} — ${reward.message || ''}`, 'event');
        // V15.17:任务完成后立刻扫一次 UI gate(让 mission 触发型解锁能在同一帧弹 splash)
        s = scanUIGates(s);
        return s;
      }
    }
    // V15.17:无任务完成也扫一次,处理 day 触发型 gate
    s = scanUIGates(s);
    return s;
  }

  // V15.17:渐进解锁 gate 状态机
  function isUIGateUnlocked(state, gateId) {
    return (state.unlockedUIGates || []).includes(gateId);
  }

  function isUIGateTriggered(state, gate) {
    if (!gate || !gate.trigger) return false;
    const { type, value } = gate.trigger;
    if (type === 'mission') return (state.completedMissionIds || []).includes(value);
    if (type === 'day') return (state.day || 0) >= value;
    if (type === 'low_loyalty') return hasLowLoyaltyDriver(state);
    return false;
  }

  function unlockUIGate(state, gate) {
    if (!gate || isUIGateUnlocked(state, gate.id)) return state;
    // V15.17:解锁时强制暂停 + 设 spotlight 让玩家关闭 splash 后能找到入口。
    // V15.22:splash=false 的辅助信息静默开放,避免同一阶段连续弹窗。
    const untilHour = (state.day || 1) * 24 + (state.hour || 6) + 12;
    let s = {
      ...state,
      unlockedUIGates: [...(state.unlockedUIGates || []), gate.id],
    };
    if (gate.splash !== false && !s.activeUnlockSplash) {
      s.paused = true;
      s.spotlight = { gateId: gate.id, untilHour };
      s.activeUnlockSplash = gate;
    }
    s = pushLog(s, `🔓 解锁:${gate.title} — ${gate.hint}`, 'event');
    return s;
  }

  // 每帧/每 dispatch 后扫一遍 gate,把已经满足条件的解锁
  function scanUIGates(state) {
    if (!UI_GATES || UI_GATES.length === 0) return state;
    let s = state;
    for (const gate of UI_GATES) {
      if (isUIGateUnlocked(s, gate.id)) continue;
      if (!isUIGateTriggered(s, gate)) continue;
      s = unlockUIGate(s, gate);
      // 一帧只触发一个 splash,避免连环弹窗;其他 gate 下帧再触发
      if (s.activeUnlockSplash && s.activeUnlockSplash.id === gate.id) break;
    }
    return s;
  }

  function pushLog(state, text, level = 'info') {
    const time = `${state.day}日${state.hour}:00`;
    const next = {
      ...state,
      log: [{ id: ++logIdCounter, time, text, level }, ...(state.log || [])].slice(0, 80),
    };
    return pushActionHistory(next, {
      category: 'log',
      type: 'GAME_LOG',
      label: text,
      level,
    });
  }

  function snapshotActionMetrics(state) {
    const vehicleIds = new Set((state.vehicles || []).map((v) => v.id));
    const debtSummary = getDebtSummary(state);
    return {
      day: state.day,
      hour: state.hour,
      funds: state.funds,
      reputation: state.reputation,
      drivers: (state.drivers || []).length,
      vehicles: (state.vehicles || []).length,
      crews: (state.drivers || []).filter((d) => d.vehicleId && vehicleIds.has(d.vehicleId)).length,
      totalCompleted: state.totalCompleted || 0,
      totalEarned: state.totalEarned || 0,
      todayCompleted: state.todayCompleted || 0,
      todayEarned: state.todayEarned || 0,
      todayLost: state.todayLost || 0,
      todayRepLoss: state.todayRepLoss || 0,
      currentMissionIdx: state.currentMissionIdx || 0,
      unlockedEndingTier: state.unlockedEndingTier || 0,
      monthlySalary: state.monthlySalary || 0,
      monthlyEventImpact: state.monthlyEventImpact || 0,
      debtAmount: debtSummary.totalRepay,
      debtDueDay: debtSummary.nextDueDay,
      debtCount: debtSummary.count,
      negFundsDays: state.negFundsDays || 0,
      paused: !!state.paused,
      speed: state.speed || 1,
      realTotalElapsedMs: state.realTime?.totalElapsedMs || 0,
      realActiveElapsedMs: state.realTime?.activeElapsedMs || 0,
      realPausedElapsedMs: state.realTime?.pausedElapsedMs || 0,
      gameHoursElapsed: computeGameHoursElapsed(state),
    };
  }

  function diffActionMetrics(before, after) {
    if (!before) return {};
    const prev = snapshotActionMetrics(before);
    const next = snapshotActionMetrics(after);
    return Object.keys(next).reduce((acc, key) => {
      if (prev[key] !== next[key]) {
        acc[key] = { before: prev[key], after: next[key] };
      }
      return acc;
    }, {});
  }

  function pushActionHistory(state, event) {
    const entry = {
      id: ++actionHistoryIdCounter,
      time: `${state.day}日${state.hour}:00`,
      day: state.day,
      hour: state.hour,
      category: event.category || 'system',
      type: event.type || 'UNKNOWN',
      label: event.label || '',
      level: event.level || 'info',
      details: event.details || {},
      realTimestamp: state.realTime?.lastUpdatedAt ? new Date(state.realTime.lastUpdatedAt).toISOString() : new Date().toISOString(),
      metrics: snapshotActionMetrics(state),
      diff: diffActionMetrics(event.before, state),
    };
    return {
      ...state,
      actionHistory: [entry, ...(state.actionHistory || [])].slice(0, 600),
    };
  }

  function pushNotif(state, text, level = 'info') {
    const next = {
      ...state,
      notifications: [...(state.notifications || []), { id: Date.now() + Math.random(), text, level }],
    };
    return pushActionHistory(next, {
      category: 'notification',
      type: 'NOTIFICATION',
      label: text,
      level,
    });
  }

  function shouldTriggerSnowRescueEvent(state) {
    if (!state || state.snowRescueFired || state.activeEvent || state.gameOver) return false;
    if (state.gameOverPending === 'kicked_out') return false;
    if ((state.funds || 0) >= GAME.DEATH_FUNDS_THRESHOLD) return false;
    const deathThreshold = GAME.DEATH_FUNDS_DAYS + (state.bankruptcyGraceBonus || 0);
    const lastChanceDay = Math.max(1, deathThreshold - 1);
    return (state.negFundsDays || 0) >= lastChanceDay;
  }

  function triggerSnowRescueEvent(state) {
    if (!shouldTriggerSnowRescueEvent(state)) return state;
    const ev = EVENTS.find((event) => event.id === SNOW_RESCUE_EVENT_ID);
    if (!ev) return state;
    let s = {
      ...state,
      activeEvent: ev,
      paused: true,
      snowRescueFired: true,
      eventCooldowns: {
        ...(state.eventCooldowns || {}),
        [ev.id]: (state.day || 1) + (ev.cooldown || 999),
      },
    };
    s = pushLog(s, `特殊事件出现: ${ev.title} — 破产倒计时最后一天`, 'event');
    s = pushNotif(s, '雪夜爆单 · 这是最后一次翻盘机会', 'warn');
    return s;
  }

  // V6: 抽卡 actions
  function startGacha(state, ticketId) {
    const ticket = D.RECRUIT_TICKETS.find((t) => t.id === ticketId);
    if (!ticket) return state;
    if (state.funds < ticket.cost) return pushNotif(state, `资金不足!需要 ¥${ticket.cost}`, 'warn');
    // V6 fix: 先用扣钱前 state 算 phase 再抽,避免临界值降档(codex review Medium)
    const cards = rollGacha(state, ticketId);
    let s = { ...state, funds: state.funds - ticket.cost };
    s.gachaCards = cards;
    s.gachaTicketId = ticketId;
    s = pushLog(s, `使用 ${ticket.name} 抽卡 (-¥${ticket.cost})`, 'event');
    return s;
  }

  function rerollGacha(state) {
    if (!state.gachaTicketId) return state;
    const ticket = D.RECRUIT_TICKETS.find((t) => t.id === state.gachaTicketId);
    if (!ticket) return state;
    if (state.funds < ticket.cost) return pushNotif(state, `资金不足!`, 'warn');
    const cards = rollGacha(state, state.gachaTicketId);
    let s = { ...state, funds: state.funds - ticket.cost };
    s.gachaCards = cards;
    s = pushLog(s, `重新抽 ${ticket.name} (-¥${ticket.cost})`, 'event');
    return s;
  }

  function pickGachaCard(state, cardId) {
    if (!state.gachaCards) return state;
    const card = state.gachaCards.find((c) => c.id === cardId);
    if (!card) return state;
    // V15: A 选项合规期招募冷却(Day 60-90 期间,每次招募后 5 天才能再招)
    const ps = state.policyState && state.policyState.govBan;
    if (ps && ps.decision === 'A' && state.day < ps.cooldownUntilDay) {
      const lastDay = state.lastRecruitDay || 0;
      const cd = state.policyOngoingEffects?.recruitCooldownDays || 0;
      if (cd > 0 && lastDay > 0 && state.day - lastDay < cd) {
        return pushNotif(state, `合规审查期招募冷却中 · 还剩 ${cd - (state.day - lastDay)} 天`, 'warn');
      }
    }
    let s = { ...state, gachaCards: null, gachaTicketId: null };
    const emptyVehicle = findEmptyVehicle(s.drivers, s.vehicles);
    const hiredDriver = emptyVehicle ? { ...card, vehicleId: emptyVehicle.id } : card;
    s.drivers = [...s.drivers, hiredDriver];
    s.lastRecruitDay = s.day;
    s = pushLog(s, `招募 ${card.name} (${D.RARITY_META[card.rarity].name} ${card.bgName}) 入队`, 'event');
    if (emptyVehicle) {
      const vd = getVehicleData(emptyVehicle);
      s = pushLog(s, `自动配车: ${card.name} 开上 ${vd.name}`, 'success');
    }
    s = checkMission(s);
    return s;
  }

  function cancelGacha(state) {
    return { ...state, gachaCards: null, gachaTicketId: null };
  }

  // V14.67: updateZoneHeat 整套删除(V14.6 已删 heat 圆圈渲染,字段累而不读)。

  function processDueDebts(state) {
    let s = syncDebtLegacyFields(state);
    if (s.gameOver || s.debtCrisis) return s;
    // V15.16 fix:被踢出局倒计时期间(投资人撤资,5 天破产判定)不应被债务危机弹窗打断
    // 让 deathCause = 'kicked_out' 的归因优先于 'bankruptcy'(原 debt_default 已合并)
    if (s.gameOverPending === 'kicked_out') return s;
    const debts = normalizeDebts(s);
    const dueDebts = debts.filter((debt) => debt.dueDay <= s.day);
    if (dueDebts.length === 0) return s;

    const dueIds = new Set(dueDebts.map((debt) => debt.id));
    const totalDue = dueDebts.reduce((sum, debt) => sum + debt.repay, 0);
    if (s.funds >= totalDue) {
      s.funds -= totalDue;
      s.monthlyDebtPaid = (s.monthlyDebtPaid || 0) + totalDue;
      s = pushLog(s, `债务到期扣款 ¥${totalDue.toLocaleString()}: ${dueDebts.map(describeDebt).join('、')}`, 'warn');
      s = pushNotif(s, `已偿还到期债务 ¥${totalDue.toLocaleString()}`, 'success');
      return syncDebtLegacyFields({
        ...s,
        debts: debts.filter((debt) => !dueIds.has(debt.id)),
      });
    }

    const shortfall = totalDue - s.funds;
    s.debtCrisis = {
      day: s.day,
      hour: s.hour,
      dueDebts,
      allDebts: debts,
      totalDue,
      shortfall,
      funds: s.funds,
    };
    s.paused = true;
    s = pushLog(s, `债务危机: 到期应还 ¥${totalDue.toLocaleString()},资金缺口 ¥${shortfall.toLocaleString()}`, 'warn');
    s = pushNotif(s, `债务危机 · 缺口 ¥${shortfall.toLocaleString()}`, 'warn');
    return syncDebtLegacyFields(s);
  }

  function tick(state) {
    if (state.gameOver || state.activeEvent || state.activePolicyDecision || state.showTutorial || state.activeStory || state.debtCrisis) return state;
    let s = { ...state };
    s = openDueMonthlyReport(s);
    if (s.showMonthlyReport) return s;
    let drivers = [...s.drivers];
    let vehicles = [...s.vehicles];

    s.hour += 1;
    if (s.hour >= 24) {
      s = endOfDay(s);
      drivers = s.drivers;
      vehicles = s.vehicles;
      // V6 fix: 日结可能触发投资人事件或死亡,触发后立即返回不要继续派单(codex review High)
      if (s.activeEvent || s.gameOver || s.debtCrisis) return s;
    }

    // 跑单中的司机推进
    drivers = drivers.map((d) => {
      if (d.status !== 'driving' || !d.currentOrder) return d;
      const newRemain = d.currentOrder.remainHours - 1;
      if (newRemain > 0) {
        return { ...d, currentOrder: { ...d.currentOrder, remainHours: newRemain } };
      }
      // 完单
      const v = vehicles.find((x) => x.id === d.vehicleId);
      const fare = d.currentOrder.fare;
      const net = Math.round(fare * (1 - s.commissionRate));
      s.funds += net;
      s.totalEarned += net;
      s.todayEarned += net;
      s.todayCompleted += 1;
      s.totalCompleted += 1;
      // V14: 月度累计 — 乘客付的 / 抽成 / 该司机贡献
      s.monthlyEarnedGross = (s.monthlyEarnedGross || 0) + fare;
      s.monthlyCommission = (s.monthlyCommission || 0) + (fare - net);
      const dmd = s.monthlyDriverData[d.id] || { name: d.name, bgName: d.bgName, salary: d.salary, salaryPaid: 0, completed: 0, earnedNet: 0, leftDay: null };
      s.monthlyDriverData = { ...s.monthlyDriverData, [d.id]: {
        ...dmd, salary: d.salary, completed: dmd.completed + 1, earnedNet: dmd.earnedNet + net,
      }};
      const goodReview = rollGoodReview(d, v);
      const complaint = !goodReview && Math.random() < 0.1;
      const nextGoodReviews = (d.goodReviews || 0) + (goodReview ? 1 : 0);
      const nextBadReviews = (d.badReviews || 0) + (complaint ? 1 : 0);
      const nextRating = recomputeReviewRating(nextGoodReviews, nextBadReviews);
      let reviewText = null;
      if (goodReview) {
        const nextReviewBank = (s.reviewBank || 0) + 1;
        if (nextReviewBank >= 3) {
          s.reputation += 1;
          s.reviewBank = nextReviewBank - 3;
          reviewText = `城市口碑 +1`;
        } else {
          s.reviewBank = nextReviewBank;
        }
        s.todayGood += 1;
      } else if (complaint) {
        s.reputation = Math.max(0, s.reputation - 2);
        s.reviewBank = 0;
        reviewText = `城市口碑 -2`;
        s.todayBad += 1;
      }
      s.floatGains = [...s.floatGains, {
        id: Date.now() + Math.random(),
        driverId: d.id,
        driverName: d.name,
        zoneId: d.currentOrder.zone,
        orderName: d.currentOrder.orderName,
        amount: net,
      }];
      const zoneName = ZONES.find((z) => z.id === d.currentOrder.zone)?.name || '';
      const orderLabel = `${zoneName ? `${zoneName} · ` : ''}${d.currentOrder.orderName}`;
      let resultText = '';
      if (goodReview) resultText = reviewText ? ` · 好评 · ${reviewText}` : ' · 好评';
      else if (complaint) resultText = reviewText ? ` · 投诉 · ${reviewText}` : ' · 投诉';
      // V14.62: 接单与完单合并为一条结果日志,避免日志列表高速刷屏。
      s = pushLog(
        s,
        `${d.name} 完成 ${orderLabel} · 收入 ¥${net}${resultText}`,
        goodReview ? 'success' : complaint ? 'warn' : 'info'
      );

      const orderId = d.currentOrder.orderId;
      // V3: 累计订单类型计数(用于任务系统)
      s.orderCounts = { ...(s.orderCounts || {}), [orderId]: ((s.orderCounts && s.orderCounts[orderId]) || 0) + 1 };
      return {
        ...d,
        status: 'idle',
        currentOrder: null,
        completedOrders: d.completedOrders + 1,
        totalEarned: d.totalEarned + net,
        goodReviews: nextGoodReviews,
        badReviews: nextBadReviews,
        rating: nextRating,
      };
    });

    // V7: 故事线触发 — 司机完单数刚好达到里程碑且未展示过
    // codex review fix(High):用 driver.shownStoryMilestones 去重,避免每 tick 重复触发
    const canShowStory = !s.activeStory && s.speed < 4 && (s.day - (s.lastStoryDay || -999)) >= 3;
    if (canShowStory) {
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];
        const shown = d.shownStoryMilestones || [];
        // V9: 支持 4× 快进后延迟补弹,避免因为跨过精确里程碑而永久错过故事。
        const milestone = [100, 500, 1000].find((m) => d.completedOrders >= m && !shown.includes(m));
        if (!milestone) continue;
        const bg = BACKGROUNDS.find((b) => b.id === d.bg);
        if (!bg || !bg.stories) continue;
        let chosen = null;
        let sliceIndex = -1;
        if (milestone === 100) {
          // 灵魂故事(固定)
          chosen = bg.stories.soul;
        } else {
          // 切片伪随机
          const pool = bg.stories.slices || [];
          sliceIndex = pickUnseenSliceIndex(bg.id, pool, s.seenStories || {});
          if (sliceIndex >= 0) chosen = pool[sliceIndex];
        }
        if (!chosen) continue;
        // 标记该司机已展示该里程碑(防止重复触发)
        drivers[i] = { ...d, shownStoryMilestones: [...shown, milestone] };
        s.activeStory = {
          driverId: d.id,
          driverName: d.name,
          bgId: bg.id,
          milestone,
          sliceIndex,
          title: chosen.title,
          text: chosen.text,
          reward: chosen.reward || {},
          ts: Date.now() + Math.random(),
        };
        s.lastStoryDay = s.day;
        s.paused = true;  // 故事弹窗暂停游戏(像 event 一样)
        // codex review fix(Medium):设置故事后写回 drivers/vehicles 立即 return,
        // 避免同一 tick 继续跑派单。
        s.drivers = drivers;
        s.vehicles = vehicles;
        s = checkMission(s);
        return s;
      }
    }

    // V12: 半订单池供需机制。先按片区 density 刷出本小时的订单名额。
    // V14.36: 未拥有对应车型的订单只作为潜在需求,不进入供需/流失/口碑结算。
    const supply = buildHourlySupply(s);
    const countableSupply = supply.filter((it) => fleetHasVehicleForOrder(vehicles, it.order));
    const ignoredSupply = supply.filter((it) => !fleetHasVehicleForOrder(vehicles, it.order));

    // 统计参与派单的司机数(用于 HUD 供需轴左半轴 idle 比例)
    let activeDriversCount = 0;
    let idleDriversCount = 0;

    // 司机随机化顺序,避免数组前后顺序的司机系统性占优
    const driverOrder = drivers.map((_, i) => i).sort(() => Math.random() - 0.5);

    for (const i of driverOrder) {
      const d = drivers[i];
      if (d.status !== 'idle') continue;
      if (!d.vehicleId) continue;

      const v = vehicles.find((x) => x.id === d.vehicleId);
      if (!v) continue;

      // V12: 这个司机参与本小时派单
      activeDriversCount += 1;

      // 从订单池中找司机能接的(片区已解锁 + 车队已拥有对应车型)
      const myAvailable = countableSupply.filter((it) => !it.taken && canTakeOrder(it.order, d, v));
      if (myAvailable.length === 0) {
        // 池子里没有可接的 — 司机闲置(供给不足或类型不匹配)
        idleDriversCount += 1;
        continue;
      }

      // V12: 司机自身倾向(取消 reputation 100 封顶,基础抬升到 0.7)
      // V14.38: 忠诚参与接单意愿,让事件里的忠诚奖惩产生可感知影响。
      const repMul = 0.5 + s.reputation / 150;
      const loyaltyMul = getDriverLoyaltyMultiplier(d);
      const tryRate = Math.min(0.99, 0.7 * repMul * loyaltyMul * d.orderRateBonus);
      if (Math.random() > tryRate) {
        idleDriversCount += 1;
        continue;
      }

      // 从可接的池里按 rate 加权选一个
      const totalWeight = myAvailable.reduce((sum, it) => sum + it.order.rate, 0);
      let r = Math.random() * totalWeight;
      let chosenItem = myAvailable[0];
      for (const it of myAvailable) {
        r -= it.order.rate;
        if (r <= 0) { chosenItem = it; break; }
      }
      chosenItem.taken = true;
      const chosen = chosenItem.order;

      const fare = computeFare(chosen, d, v);
      const boostMul = s.day <= s.boostUntilDay ? s.boostMul : 1;
      const finalFare = Math.round(fare * boostMul);

      drivers[i] = {
        ...d,
        status: 'driving',
        currentOrder: {
          orderId: chosen.id,
          orderName: chosen.name,
          fare: finalFare,
          distance: chosen.km,
          totalHours: chosen.hours,
          remainHours: chosen.hours,
          startedAt: s.hour,
          color: chosen.color,
          zone: chosenItem.zoneId,
        },
      };
    }

    // V12: 统计本小时供需 + 处理流失订单
    const supplyTotal = countableSupply.length;
    const supplyTaken = countableSupply.filter((it) => it.taken).length;
    const lostCount = supplyTotal - supplyTaken;
    s.hourSupplyTotal = supplyTotal;
    s.hourSupplyTaken = supplyTaken;
    s.hourActiveDrivers = activeDriversCount;
    s.hourIdleDrivers = idleDriversCount;
    // V14.4: 把本小时供需写入 6 小时滑动窗口,UI 用累计值判定状态,防止单小时抖动
    s.supplyHistory = [...(s.supplyHistory || []), { lost: lostCount, idle: idleDriversCount }].slice(-6);
    if (lostCount > 0) {
      const penalty = lostCount * GAME.LOSS_REPUTATION_PENALTY;
      s.todayLost = (s.todayLost || 0) + lostCount;
      s.reputation = Math.max(0, s.reputation - penalty);
      s.todayRepLoss = (s.todayRepLoss || 0) + penalty;
      if (lostCount >= 2) {
        s = pushLog(s, `运力不足 · 流失 ${lostCount} 单 · 城市口碑 -${penalty}`, 'warn');
      }
    }

    // V12.2: 诊断数据 — 每 tick 记录一条供分析,按订单类型 + 片区拆分流失明细
    const supplyByZone = {};
    const supplyByOrder = {};
    const ignoredByOrder = {};
    for (const it of countableSupply) {
      const zk = it.zoneId;
      const ok = it.orderId;
      if (!supplyByZone[zk]) supplyByZone[zk] = { total: 0, taken: 0 };
      if (!supplyByOrder[ok]) supplyByOrder[ok] = { total: 0, taken: 0 };
      supplyByZone[zk].total += 1;
      supplyByOrder[ok].total += 1;
      if (it.taken) {
        supplyByZone[zk].taken += 1;
        supplyByOrder[ok].taken += 1;
      }
    }
    for (const it of ignoredSupply) {
      ignoredByOrder[it.orderId] = (ignoredByOrder[it.orderId] || 0) + 1;
    }
    const diagEntry = {
      day: s.day,
      hour: s.hour,
      reputation: s.reputation,
      funds: s.funds,
      drivers: drivers.length,
      vehicles: vehicles.length,
      crews: drivers.filter((d) => d.vehicleId).length,
      activeDrivers: activeDriversCount,
      idleDrivers: idleDriversCount,
      supplyTotal,
      supplyTaken,
      lostCount,
      ignoredSupplyTotal: ignoredSupply.length,
      todayLost: s.todayLost || 0,
      todayRepLoss: s.todayRepLoss || 0,
      unlockedZones: ZONES.filter((z) => isZoneUnlocked(s, z)).map((z) => z.id),
      supplyByZone,
      supplyByOrder,
      ignoredByOrder,
    };
    s.diagnostics = [...(s.diagnostics || []), diagEntry].slice(-720);

    // V12: 反锁 / 重解锁检测 — 口碑变化后立即生效,推通知给玩家
    // V14.8: 反锁时强制中断该区跑单中的订单,避免"锁定区还有司机继续跑"的视觉/逻辑 bug
    const prevSnapshot = s.zoneLockSnapshot || {};
    const nextSnapshot = {};
    for (const zone of ZONES) {
      const unlocked = isZoneUnlocked(s, zone);
      nextSnapshot[zone.id] = unlocked;
      const prev = prevSnapshot[zone.id];
      if (prev === true && !unlocked) {
        // 之前解锁,现在锁了
        const lockBackThreshold = Math.max(0, (zone.unlock?.reputation ?? 0) - ZONE_HYSTERESIS_GAP);
        s = pushNotif(s, `⚠ ${zone.name} 因口碑下降被反锁(口碑 ${s.reputation})`, 'warn');
        s = pushLog(s, `⚠ ${zone.name} 反锁 · 口碑跌破反锁阈值 ${lockBackThreshold}(解锁阈值 ${zone.unlock?.reputation ?? 0})`, 'warn');
        // V14.8: 中断该区跑单中的司机。注意写入局部 drivers 变量而不是 s.drivers,
        // 因为 tick 末尾 (L963) 会执行 s.drivers = drivers 覆盖,如果只改 s.drivers 会被吃掉
        let interrupted = 0;
        drivers = drivers.map((d) => {
          if (d.status === 'driving' && d.currentOrder && d.currentOrder.zone === zone.id) {
            interrupted += 1;
            return { ...d, status: 'idle', currentOrder: null };
          }
          return d;
        });
        if (interrupted > 0) {
          s = pushLog(s, `${zone.name} 反锁中断 ${interrupted} 个司机正在跑的订单(无收入)`, 'warn');
        }
      } else if (prev === false && unlocked) {
        // 重新解锁
        s = pushNotif(s, `✨ ${zone.name} 口碑回升,自动重新解锁`, 'success');
        s = pushLog(s, `✨ ${zone.name} 重新解锁 · 口碑回到 ${s.reputation}`, 'success');
      }
    }
    s.zoneLockSnapshot = nextSnapshot;

    // V14: 破产倒计时 = 基础 5 天 + 投资人事件里勾选「解雇」获得的宽容期(默认 0)。
    // 玩家可以通过裁员让倒计时延长到 15 天,但只有"投资人事件里裁员"才能拿宽容,
    // CrewInspector 主界面平时主动解雇不计入。
    const deathThreshold = GAME.DEATH_FUNDS_DAYS + (s.bankruptcyGraceBonus || 0);
    if (s.negFundsDays >= deathThreshold) {
      // V15.16: 若由投资人撤资触发(gameOverPending = 'kicked_out'),改 deathCause + 文案
      if (s.gameOverPending === 'kicked_out') {
        const kickedConfig = INVESTOR_REVIEW && INVESTOR_REVIEW.endings && INVESTOR_REVIEW.endings.kicked_out;
        const reason = kickedConfig
          ? `${kickedConfig.reason}(资金负数超过 ${deathThreshold} 天)`
          : `投资人撤资,资金负数超过 ${deathThreshold} 天,公司清算`;
        s.gameOver = { type: 'lose', reason, deathCause: 'kicked_out', stats: snapshotStats(s) };
      } else {
        s.gameOver = { type: 'lose', reason: `资金负数超过 ${deathThreshold} 天,投资人撤资,公司破产`, deathCause: 'bankruptcy', stats: snapshotStats(s) };
      }
    }

    s = processDueDebts(s);
    if (s.debtCrisis || s.gameOver) return s;

    // V6: 结局检测 — 只解锁下一个 tier(防跳级,codex review Medium)
    // V15.16 audit fix:已有 activeEvent / activePolicyDecision / activeStory 弹着时跳过本次结局检测,
    // 让玩家先处理完当前弹窗,下次 endOfDay 再检测结局,避免双弹窗同屏。
    // forceEnd 强制结局例外:Tier 5 IPO 这种关键收尾仍立刻触发(不会和事件冲突,因为 forceEnd 直接 gameOver)
    const hasOpenModal = s.activeEvent || s.activePolicyDecision || s.activeStory;
    if (!s.gameOver && !hasOpenModal) {
      const nextEnding = ENDINGS.find((e) => e.tier === s.unlockedEndingTier + 1);
      if (nextEnding && nextEnding.check(s)) {
        s.unlockedEndingTier = nextEnding.tier;
        s.newEndingUnlocked = nextEnding;
        if (nextEnding.forceEnd) {
          s.gameOver = { type: 'win', endingId: nextEnding.id, endingName: nextEnding.name, endingDesc: nextEnding.desc, stats: snapshotStats(s), forced: true };
        }
      }
    }

    s.drivers = drivers;
    s.vehicles = vehicles;
    // V14.67: 城市口碑加上限,避免后期数字越界顶栏布局(0~9999)
    s.reputation = Math.max(0, Math.min(9999, s.reputation));
    s = checkMission(s);
    // V15.17:每 tick 扫一次 UI gate(任务完成 / day 阈值都可能触发解锁)
    s = scanUIGates(s);
    // V15.17:spotlight 过期清理(玩家忽略未点 → 12 游戏小时后自动消)
    if (s.spotlight) {
      const nowHour = (s.day || 1) * 24 + (s.hour || 6);
      if (nowHour >= (s.spotlight.untilHour || 0)) s = { ...s, spotlight: null };
    }
    return s;
  }

  function getOperatingCrewCount(state) {
    const vehicleIds = new Set((state?.vehicles || []).map((v) => v.id));
    return (state?.drivers || []).filter((d) => d.vehicleId && vehicleIds.has(d.vehicleId)).length;
  }

  function getCurrentEventPhase(state) {
    const day = state?.day || 1;
    const crews = getOperatingCrewCount(state);
    if (day >= 120 || crews >= 8) return 'late';
    if (day >= 31 || crews >= 4) return 'mid';
    return 'early';
  }

  function getEventPhaseRank(phase) {
    if (phase === 'late') return 3;
    if (phase === 'mid') return 2;
    return 1;
  }

  function isEventPhaseUnlocked(event, state) {
    return getEventPhaseRank(event.phase || 'early') <= getEventPhaseRank(getCurrentEventPhase(state));
  }

  function getEventChainId(event) {
    if (!event) return '';
    if (event.chainId) return event.chainId;
    if (event.eventType === 'chain' && event.chain) return event.chain.replace(/_(close|distance|intimate|trust|breach|loyalty|pricing).*$/, '');
    return '';
  }

  function isChainEvent(event) {
    return event?.eventType === 'chain' || !!event?.chainId;
  }

  function isRandomEvent(event) {
    if (!event || event.scripted || event.eventType === 'scripted') return false;
    if (isChainEvent(event)) return false;
    return event.eventType === 'random' || !event.eventType;
  }

  function isKeyDriverAlive(state) {
    return (state?.keyDriverIds || []).length > 0
      && (state.keyDriverIds || []).some((id) => (state.drivers || []).some((d) => d.id === id));
  }

  function satisfyChainChoice(requireChainChoice, chainChoices) {
    if (!requireChainChoice) return true;
    for (const key of Object.keys(requireChainChoice)) {
      const expected = requireChainChoice[key];
      const actual = (chainChoices || {})[key];
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false;
      } else if (actual !== expected) {
        return false;
      }
    }
    return true;
  }

  function satisfyEventBaseConditions(event, state) {
    if (!event || event.scripted || event.eventType === 'scripted') return false;
    const cooldowns = state.eventCooldowns || {};
    const unlockDay = cooldowns[event.id];
    if (unlockDay !== undefined && state.day < unlockDay) return false;
    if ((event.minDay || 0) > state.day) return false;
    if ((event.minCrews || 0) > getOperatingCrewCount(state)) return false;
    if ((event.minOrders || 0) > (state.totalCompleted || 0)) return false;
    if (!satisfyChainChoice(event.requireChainChoice, state.chainChoices || {})) return false;
    const keyAlive = isKeyDriverAlive(state);
    if (event.requireKeyDriverAlive === true && !keyAlive) return false;
    if (event.requireKeyDriverAlive === false && keyAlive) return false;
    if (event.id === 'platform_pressure' && state.platformChoseSelfop) return false;
    return true;
  }

  function isChainEventDue(event, state) {
    if (!isChainEvent(event)) return false;
    if (!satisfyEventBaseConditions(event, state)) return false;
    const chainId = getEventChainId(event);
    if (!chainId) return false;
    const progress = (state.chainProgress || {})[chainId] || {};
    const stage = event.stage || 1;
    if ((progress.stage || 0) >= stage) return false;
    const completedIds = new Set(progress.completedEventIds || []);
    if (completedIds.has(event.id)) return false;
    if (stage > 1 && !progress.lastDay) return false;
    if (event.delayAfter && progress.lastDay && state.day - progress.lastDay < event.delayAfter) return false;
    const minGap = GAME.CHAIN_EVENT_MIN_GAP_DAYS || 0;
    const lastAnyEventDay = Math.max(state.lastChainEventDay || 0, state.lastRandomEventDay || 0);
    if (minGap > 0 && lastAnyEventDay && state.day - lastAnyEventDay < minGap) return false;
    return true;
  }

  function selectDueChainEvent(state) {
    const available = (EVENTS || [])
      .filter((event) => isChainEventDue(event, state))
      .sort((a, b) =>
        (a.stage || 1) - (b.stage || 1)
        || (a.minDay || 0) - (b.minDay || 0)
        || String(a.id).localeCompare(String(b.id))
      );
    return available[0] || null;
  }

  function getRandomEventWeight(event, state) {
    const baseWeight = Math.max(0, Number(event.weight ?? 1));
    if (baseWeight <= 0) return 0;
    const tag = event.tag || '';
    const lastTagDay = tag ? (state.eventTagLastDays || {})[tag] : 0;
    const tagCooldown = GAME.RANDOM_EVENT_TAG_COOLDOWN_DAYS || 0;
    const tagPenalty = tag && lastTagDay && state.day - lastTagDay < tagCooldown ? 0.35 : 1;
    return baseWeight * tagPenalty;
  }

  function weightedPickEvent(events, state) {
    const weighted = (events || [])
      .map((event) => ({ event, weight: getRandomEventWeight(event, state) }))
      .filter((item) => item.weight > 0);
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const item of weighted) {
      roll -= item.weight;
      if (roll <= 0) return item.event;
    }
    return weighted[weighted.length - 1]?.event || null;
  }

  function isRandomEventEligible(event, state) {
    if (!isRandomEvent(event)) return false;
    if (!satisfyEventBaseConditions(event, state)) return false;
    if (!isEventPhaseUnlocked(event, state)) return false;
    if (state.day <= (GAME.EARLY_EVENT_UNTIL_DAY || 0)) {
      const earlyIds = GAME.EARLY_EVENT_IDS || [];
      if (earlyIds.length > 0 && !earlyIds.includes(event.id)) return false;
    }
    return true;
  }

  function selectRandomEvent(state) {
    const interval = GAME.RANDOM_EVENT_INTERVAL_DAYS || GAME.EVENT_INTERVAL_DAYS || 7;
    const pity = GAME.RANDOM_EVENT_PITY_DAYS || interval * 2;
    const lastDay = Math.max(state.lastRandomEventDay || 0, state.lastChainEventDay || 0);
    const daysSince = lastDay ? state.day - lastDay : state.day;
    if (daysSince < interval) return null;
    const available = (EVENTS || []).filter((event) => isRandomEventEligible(event, state));
    if (available.length === 0) return null;
    if (daysSince >= pity) return weightedPickEvent(available, state);
    return weightedPickEvent(available, state);
  }

  function openScheduledEvent(state, event, source) {
    const cooldownDays = event.cooldown || randInt(25, 35);
    let s = {
      ...state,
      eventCooldowns: {
        ...(state.eventCooldowns || {}),
        [event.id]: (state.day || 1) + cooldownDays,
      },
      activeEvent: event,
      paused: true,
    };
    if (source === 'chain') {
      s.lastChainEventDay = state.day;
      s = pushLog(s, `剧情事件出现: ${event.title}`, 'event');
    } else {
      s.lastRandomEventDay = state.day;
      if (event.tag) {
        s.eventTagLastDays = { ...(state.eventTagLastDays || {}), [event.tag]: state.day };
      }
      s = pushLog(s, `随机事件出现: ${event.title}`, 'event');
    }
    return s;
  }

  function endOfDay(state) {
    let s = { ...state, hour: 0, day: state.day + 1 };
    let dailyCost = 0;
    let monthlyDriverData = { ...(s.monthlyDriverData || {}) };
    s.drivers.forEach((d) => {
      const dailySalary = Math.round(d.salary / 30);
      dailyCost += dailySalary;
      const dmd = monthlyDriverData[d.id] || { name: d.name, bgName: d.bgName, salary: d.salary, salaryPaid: 0, completed: 0, earnedNet: 0, leftDay: null };
      monthlyDriverData[d.id] = {
        ...dmd,
        name: d.name,
        bgName: d.bgName,
        salary: d.salary,
        salaryPaid: (dmd.salaryPaid || 0) + dailySalary,
      };
    });
    // V14.41: 工资改为月结。日结只累计应付工资,不立即扣现金。
    s.monthlySalary = (s.monthlySalary || 0) + dailyCost;
    s.monthlyDriverData = monthlyDriverData;
    s = pushLog(
      s,
      `第 ${state.day} 日结算: 流水 ¥${s.todayEarned}, 应付工资 ¥${dailyCost}, 完成 ${s.todayCompleted} 单`,
      'event'
    );
    // 司机休息
    s.drivers = s.drivers.map((d) => ({
      ...d,
      status: d.status === 'driving' ? d.status : 'idle',
    }));
    const quitting = [];
    for (const d of s.drivers) {
      const risk = getDriverQuitRisk(d);
      if (risk <= 0) continue;
      // V15.16 audit fix:删除「至少留 1 个司机」的 guard,允许全员离队 → 触发新失败结局
      if (Math.random() < risk) quitting.push(d);
    }
    if (quitting.length > 0) {
      const quitterIds = new Set(quitting.map((d) => d.id));
      s.drivers = s.drivers.filter((d) => !quitterIds.has(d.id));
      quitting.forEach((d) => {
        if (s.monthlyDriverData && s.monthlyDriverData[d.id]) {
          s.monthlyDriverData = { ...s.monthlyDriverData, [d.id]: { ...s.monthlyDriverData[d.id], leftDay: s.day } };
        }
      });
      const names = quitting.map((d) => d.name).join('、');
      const moraleLoss = Math.min(10, quitting.reduce((sum, d) =>
        sum + (getRarityLoyaltyRule(d.rarity).moralePenalty || 4), 0
      ));
      if (moraleLoss > 0 && s.drivers.length > 0) {
        s.drivers = s.drivers.map((d) => applyDriverLoyaltyDelta(d, -moraleLoss));
      }
      s = pushLog(s, `${names} 因忠诚过低离开车队,其他司机忠诚 -${moraleLoss}`, 'warn');
      // V15.16 audit fix:文案修正「士气」→「全员忠诚」(语义和 effect 字段对齐)
      s = pushNotif(s, `${names} 离队,全员忠诚 -${moraleLoss}`, 'warn');
      // V15.16 audit fix:全员离队 → 公司无人运营,直接 game over(crew_collapsed 新结局)
      if (s.drivers.length === 0) {
        s.gameOver = {
          type: 'lose',
          reason: '全员离队,公司无人运营,经营宣告失败。',
          deathCause: 'crew_collapsed',
          stats: snapshotStats(s),
        };
        s = pushLog(s, `【全员离队】最后 ${quitting.length} 名司机离开,公司清算`, 'warn');
      }
    }
    s.todayCompleted = 0;
    s.todayEarned = 0;
    s.todayGood = 0;
    s.todayBad = 0;
    s.todayLost = 0;
    s.todayRepLoss = 0;

    // V10.10: 只维护资金失败计数,减少玩家需要盯住的隐藏失败条件。
    s.negFundsDays = s.funds < GAME.DEATH_FUNDS_THRESHOLD ? (s.negFundsDays || 0) + 1 : 0;
    // 旧存档兼容:资金回正时清 gameOverPending 标记,避免下次再死时仍归因 kicked_out
    if (s.funds >= 0 && s.gameOverPending === 'kicked_out') {
      s.gameOverPending = null;
    }

    // V14: 借贷改为一次性还款,扣款逻辑挪到上面破产检查附近。这里不再有分期扣款。

    // V5: 资金负 1 天就触发投资人压力事件(只触发一次,直到资金回正再重置)
    if (s.funds < 0 && !s.investorPressureFired && !s.activeEvent) {
      s.activeEvent = INVESTOR_PRESSURE;
      s.investorPressureFired = true;
      s.paused = true;
      return s;
    }
    if (s.funds >= 0) s.investorPressureFired = false;

    s = triggerSnowRescueEvent(s);
    if (s.activeEvent) return s;

    // V15: 政策事件按游戏绝对时间触发,优先于随机事件。
    // 触发后会 set s.activeEvent = activePolicyEvent,后续随机事件分支自动跳过。
    s = policyEventTick(s);

    // V15.26: 投资人 early review 使用最早触发窗口,与政策事件互斥。
    // policyEventTick 已经判定了 s.activeEvent,所以两者不会同日双弹。
    s = investorReviewTick(s);
    if (s.activeEvent) return s;
    if (s.activeEvent || s.gameOver) {
      s = openDueMonthlyReport(s);
      return s;
    }

    // V15.24:事件调度拆分。链式剧情看 chainProgress + delayAfter,随机事件看经营阶段池。
    const chainEvent = selectDueChainEvent(s);
    if (chainEvent) return openScheduledEvent(s, chainEvent, 'chain');

    const randomEvent = selectRandomEvent(s);
    if (randomEvent) return openScheduledEvent(s, randomEvent, 'random');

    s = openDueMonthlyReport(s);

    return s;
  }

  // === V15: 政策事件框架(按游戏绝对时间触发的链式黑天鹅事件) ===
  // 设计抽象为可扩展结构,V1 只填监管整改一个事件。
  // 详见「监管整改机制设计-V1.md」。

  function getPolicyDef(eventId) {
    return (POLICY_EVENTS || []).find((e) => e.id === eventId);
  }

  // 把 'gov_ban' 转 'govBan' 用于 policyState 取值
  function policyStateKey(eventId) {
    return eventId.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
  }

  // 决策点用的"基准月营收 R₀":取上个完整月净营收(若不足 1 月则按当月线性外推)
  function estimateMonthlyRevenue(s) {
    const grossNet = (s.monthlyEarnedGross || 0) - (s.monthlyCommission || 0);
    const dayInMonth = ((s.day - 1) % 30) + 1;
    const projected = grossNet / Math.max(1, dayInMonth) * 30;
    return Math.max(1, Math.round(projected));
  }

  // 主调度:按游戏绝对天数触发各政策事件的各阶段
  function policyEventTick(state) {
    let s = state;
    if (s.activeEvent || s.activePolicyDecision || s.gameOver) return s;
    for (const eventDef of (POLICY_EVENTS || [])) {
      const psKey = policyStateKey(eventDef.id);
      const ps = s.policyState && s.policyState[psKey];
      if (!ps) continue;
      for (const item of eventDef.schedule) {
        if (s.day !== item.atDay) continue;
        // 防重触发(用 stage-specific 标志)
        if (eventDef.id === 'gov_ban') {
          if (item.stage === 'notice_1' && ps.notice1Fired) continue;
          if (item.stage === 'decision' && ps.decisionFired) continue;
          if (item.stage === 'verdict' && ps.verdictFired) continue;
          if (item.stage === 'resume' && ps.banLifted) continue;
          // 只有 B 玩家整改后才需要 resume,A 玩家直接跳过
          if (item.stage === 'resume' && ps.verdictResult !== 'ban') continue;
        }
        if (item.type === 'notice') {
          s = triggerPolicyNotice(s, eventDef, item.stage);
        } else if (item.type === 'decision') {
          s = triggerPolicyDecision(s, eventDef, item.stage);
        } else if (item.type === 'verdict') {
          s = triggerPolicyVerdict(s, eventDef);
        } else if (item.type === 'resume') {
          s = triggerPolicyResume(s, eventDef);
        }
        if (s.activeEvent || s.activePolicyDecision) return s;
      }
    }
    return s;
  }

  // ============================================================
  // V15.29: 投资人 early review — 早期防挂机,Day 30 看 3 车组,Day 60 看 5 车组
  // 详见 GAME_DESIGN.md 第七章「投资人 early review」
  // ============================================================

  // 计算可运营车组数 = min(已配车司机数, 拥有的车辆数中已被司机绑定的)
  function countOperatingCrews(s) {
    return (s.drivers || []).filter((d) => d.vehicleId).length;
  }

  function getInvestorReviewTargetCrews() {
    return INVESTOR_REVIEW?.targetCrews || INVESTOR_REVIEW?.kpi?.targetCrews || 3;
  }

  function getInvestorReviewStageTargetCrews(stage) {
    const item = (INVESTOR_REVIEW.schedule || []).find((x) => x.stage === stage);
    return item?.targetCrews || getInvestorReviewTargetCrews();
  }

  function getInvestorReviewFinalDeadlineDays() {
    return Math.max(1, INVESTOR_REVIEW?.finalDeadlineDays || 10);
  }

  function hasPassedInvestorReview(s) {
    return countOperatingCrews(s) >= getInvestorReviewTargetCrews();
  }

  function markInvestorReviewDone(state, reason) {
    let s = { ...state, investorReviewDone: true, investorReviewDeadlineDay: null, lastReviewDay: state.day };
    if (reason === 'expanded') {
      s = pushLog(s, `【投资人 review】车队运力补起来了,投资人暂时放下这件事`, 'success');
    }
    return s;
  }

  function failInvestorReviewDeadline(state) {
    let s = { ...state };
    const targetCrews = getInvestorReviewTargetCrews();
    const currentCrews = countOperatingCrews(s);
    const reason = `投资人撤资:最后期限仍只有 ${currentCrews}/${targetCrews} 个可运营车组,公司失去启动资金支持。`;
    s.gameOver = { type: 'lose', reason, deathCause: 'kicked_out', stats: snapshotStats(s) };
    s.gameOverPending = 'kicked_out';
    s.investorReviewDone = true;
    s = pushLog(s, `【投资人撤资】${reason}`, 'warn');
    return s;
  }

  function hasInvestorReviewStageFired(s, stage) {
    return !!((s.investorReviewStages || {})[stage]);
  }

  function getNextInvestorReviewItem(s) {
    const currentCrews = countOperatingCrews(s);
    return (INVESTOR_REVIEW.schedule || []).find((item) => {
      const stageTarget = item.targetCrews || getInvestorReviewTargetCrews();
      return item.atDay <= s.day
        && !hasInvestorReviewStageFired(s, item.stage)
        && currentCrews < stageTarget;
    });
  }

  function getInvestorReviewFee(s, stage) {
    const conf = INVESTOR_REVIEW.punishment?.[stage] || {};
    const rawFee = conf.fee || 0;
    const minRemaining = conf.minRemainingFunds || 0;
    const safeFee = Math.min(rawFee, Math.max(0, (s.funds || 0) - minRemaining));
    return { fee: safeFee, rawFee, label: conf.label || '' };
  }

  // 投资人 review 主 tick — atDay 是最早窗口,当前有弹窗/月报时顺延。
  function investorReviewTick(state) {
    let s = state;
    if (s.activeEvent || s.activePolicyDecision || s.gameOver) return s;
    if (s.showMonthlyReport || isMonthlyReportDue(s)) return s;
    if (s.lastReviewDay === s.day) return s;  // 防同日重复触发
    if (s.investorReviewDone) return s;
    if (hasPassedInvestorReview(s)) return markInvestorReviewDone(s, 'expanded');
    if (s.investorReviewDeadlineDay && s.day >= s.investorReviewDeadlineDay) {
      return failInvestorReviewDeadline(s);
    }
    const item = getNextInvestorReviewItem(s);
    if (!item) return s;
    return openInvestorReviewEvent(s, item.stage, getInvestorReviewFee(s, item.stage));
  }

  // 装载 activeEvent — 按 stage 取对应文案 + 选项。
  function openInvestorReviewEvent(state, stage, ctx) {
    const stageData = INVESTOR_REVIEW.stages[stage];
    if (!stageData) return state;
    let s = { ...state };
    let desc = stageData.desc;
    const targetCrews = getInvestorReviewStageTargetCrews(stage);
    const currentCrews = countOperatingCrews(s);
    const deadlineDays = getInvestorReviewFinalDeadlineDays();
    const deadlineDay = s.day + deadlineDays;
    desc = desc
      .replace(/\{targetCrews\}/g, targetCrews)
      .replace(/\{currentCrews\}/g, currentCrews)
      .replace(/\{N\}/g, (ctx.rawFee || ctx.fee || 0).toLocaleString())
      .replace(/\{D\}/g, deadlineDays)
      .replace(/\{deadlineDay\}/g, deadlineDay);
    const optionDetail = (stageData.buttonDetail || '')
      .replace(/\{targetCrews\}/g, targetCrews)
      .replace(/\{currentCrews\}/g, currentCrews)
      .replace(/\{D\}/g, deadlineDays)
      .replace(/\{deadlineDay\}/g, deadlineDay);
    const options = [
      {
        label: stageData.buttonLabel || '知道了',
        detail: optionDetail,
        apply: () => (ctx.fee > 0 ? { funds: -ctx.fee } : {}),
      },
    ];
    s.activeEvent = {
      id: `investor_review_${stage}`,
      title: stageData.title,
      tag: stageData.tag,
      desc,
      isInvestorReview: true,
      investorReviewStage: stage,
      investorReviewTargetCrews: targetCrews,
      investorReviewFee: ctx.fee || 0,
      investorReviewFeeLabel: ctx.label || '',
      skipScale: true,  // 不走 scaleEventEffect 缩放
      options,
    };
    s.paused = true;  // V15.17:investor review 弹出强制暂停
    s = pushLog(s, `【投资人 review】${stageData.title}`, 'event');
    return s;
  }

  // 解析投资人 review 事件玩家选项 — 由 resolveEvent 检测 isInvestorReview 后调用
  function resolveInvestorReviewEvent(state, optionIdx) {
    const ev = state.activeEvent;
    if (!ev || !ev.isInvestorReview) return state;
    const stage = ev.investorReviewStage;
    const fee = ev.investorReviewFee || 0;
    const feeLabel = ev.investorReviewFeeLabel || '';
    let s = { ...state, activeEvent: null, paused: false };
    s.investorReviewStages = { ...(s.investorReviewStages || {}), [stage]: true };
    s.lastReviewDay = s.day;
    s.reviewCounter = (s.reviewCounter || 0) + 1;

    if (stage === 'early_warning') {
      s.investorMissCount = Math.max(s.investorMissCount || 0, 1);
      s = pushLog(s, `【投资人 review】首次提醒:请尽快补齐第三个可运营车组`, 'warn');
    } else if (stage === 'early_final') {
      s.funds -= fee;
      s.investorMissCount = Math.max(s.investorMissCount || 0, 2);
      s.investorReviewDeadlineDay = s.day + getInvestorReviewFinalDeadlineDays();
      if (fee > 0) {
        s = recordMonthlyEventImpact(s, -fee, { title: '投资人 early review', label: feeLabel || '闲置资源占用费', detail: '第二个月复盘后扣回资源占用费' });
      }
      s = pushLog(s, `【投资人 review】二次提醒:扣款 ¥${fee.toLocaleString()}(${feeLabel || '闲置资源占用费'}),Day ${s.investorReviewDeadlineDay} 前未扩到 ${getInvestorReviewTargetCrews()} 个车组将撤资`, 'warn');
    }
    return openDueMonthlyReport(s);
  }

  // ============================================================
  // V15.26 投资人 early review 结束
  // ============================================================

  function triggerPolicyNotice(state, eventDef, stage) {
    const stageData = eventDef.stages[stage];
    let s = { ...state };
    if (eventDef.id === 'gov_ban' && stage === 'notice_1') {
      s.policyState = {
        ...s.policyState,
        govBan: { ...s.policyState.govBan, notice1Fired: true },
      };
    }
    s.activeEvent = {
      id: `policy_${eventDef.id}_${stage}`,
      title: stageData.title,
      tag: stageData.tag,
      desc: stageData.desc,
      isPolicyEvent: true,
      policyEventId: eventDef.id,
      policyStage: stage,
      policyEffectPreview: [],
      policyFooterNote: '',
      options: [
        { label: stageData.buttonLabel || '知道了', detail: '', apply: () => ({}) },
      ],
    };
    s.paused = true;
    s = pushLog(s, `【政策事件】${stageData.title}`, 'event');
    return s;
  }

  function triggerPolicyDecision(state, eventDef, stage) {
    const stageData = eventDef.stages[stage];
    let s = { ...state };
    if (eventDef.id === 'gov_ban') {
      const r0 = estimateMonthlyRevenue(s);
      s.policyState = {
        ...s.policyState,
        govBan: {
          ...s.policyState.govBan,
          decisionFired: true,
          refMonthlyRevenue: r0,
        },
      };
    }
    s.activePolicyDecision = {
      eventId: eventDef.id,
      stage,
      title: stageData.title,
      tag: stageData.tag,
      desc: stageData.desc,
      options: stageData.options,
      refMonthlyRevenue: s.policyState[policyStateKey(eventDef.id)].refMonthlyRevenue,
      params: eventDef.params,
    };
    s.paused = true;
    s = pushLog(s, `【政策决策】${stageData.title}`, 'event');
    return s;
  }

  function triggerPolicyVerdict(state, eventDef) {
    let s = { ...state };
    if (eventDef.id !== 'gov_ban') return s;
    const ps = s.policyState.govBan;
    if (!ps.decisionFired || !ps.decision) return s;
    const params = eventDef.params;
    const r0 = ps.refMonthlyRevenue || 1;
    const complianceSchedule = params.COMPLIANCE_SCHEDULE_PCT || [0.25, 0.20, 0.15, 0.10];
    const complianceFirstPct = Math.round((complianceSchedule[0] || 0.25) * 100);
    const complianceFloorPct = Math.round((complianceSchedule[complianceSchedule.length - 1] || 0.10) * 100);
    let stageKey;
    if (ps.decision === 'A') {
      stageKey = Math.random() < params.A_VERDICT_GOOD_PCT ? 'verdict_pass' : 'verdict_fine';
    } else {
      stageKey = 'verdict_ban';
    }
    const stageData = eventDef.stages[stageKey];
    const verdictResult = stageKey === 'verdict_pass' ? 'pass' : (stageKey === 'verdict_fine' ? 'fine' : 'ban');

    // V15: 政策结果按钮的"具体处罚项"预览,UI 端 PolicyNoticeModal 渲染
    let policyEffectPreview = [];
    if (stageKey === 'verdict_fine') {
      policyEffectPreview = [
        { label: '象征性罚款', value: `-¥${Math.round(r0 * params.A_VERDICT_FINE_PCT).toLocaleString()}`, tone: 'negative' },
      ];
    } else if (stageKey === 'verdict_ban') {
      policyEffectPreview = [
        { label: '立即罚款', value: `-¥${Math.round(r0 * params.B_FINE_PCT).toLocaleString()}`, tone: 'negative' },
        { label: '60 天禁运 · 订单量', value: `降至 ${Math.round(params.B_BAN_ORDER_BOOST * 100)}%(60 天)`, tone: 'negative' },
        { label: '强制启动月合规成本', value: `按每月净流水滚动扣:首月 ${complianceFirstPct}% → 稳定后 ${complianceFloorPct}%`, tone: 'negative' },
      ];
    }
    // verdict_pass / notice / resume 默认空数组(无副作用)

    s.policyState = {
      ...s.policyState,
      govBan: {
        ...ps,
        verdictFired: true,
        verdictResult,
      },
    };
    s.activeEvent = {
      id: `policy_${eventDef.id}_${stageKey}`,
      title: stageData.title,
      tag: stageData.tag,
      desc: stageData.desc,
      isPolicyEvent: true,
      policyEventId: eventDef.id,
      policyStage: stageKey,
      policyEffectPreview,
      policyFooterNote: stageKey === 'verdict_ban' ? '整改期间运营成本需照常承担。如需止损,可在车队管理界面卖车或裁员。' : '',
      options: [{ label: stageData.buttonLabel || '接受', detail: '', apply: () => ({}) }],
    };
    s.paused = true;
    s = pushLog(s, `【监管结果】${stageData.title}`, stageKey === 'verdict_ban' ? 'warn' : 'info');
    return s;
  }

  function triggerPolicyResume(state, eventDef) {
    let s = { ...state };
    if (eventDef.id !== 'gov_ban') return s;
    const ps = s.policyState.govBan;
    s.policyState = {
      ...s.policyState,
      govBan: { ...ps, banLifted: true },
    };
    const stageData = eventDef.stages.resume;
    s.activeEvent = {
      id: `policy_${eventDef.id}_resume`,
      title: stageData.title,
      tag: stageData.tag,
      desc: stageData.desc,
      isPolicyEvent: true,
      policyEventId: eventDef.id,
      policyStage: 'resume',
      policyEffectPreview: [
        { label: '禁运解除 · 订单量', value: '恢复至 100%', tone: 'positive' },
      ],
      policyFooterNote: '',
      options: [{ label: stageData.buttonLabel || '继续', detail: '', apply: () => ({}) }],
    };
    s.paused = true;
    s = pushLog(s, `【监管反馈】${stageData.title}`, 'success');
    return s;
  }

  // 玩家在决策点选完 A/B 之后调用
  function resolvePolicyDecision(state, choiceId, extraToggles) {
    const apd = state.activePolicyDecision;
    if (!apd) return state;
    const eventDef = getPolicyDef(apd.eventId);
    if (!eventDef) return state;

    let s = { ...state, activePolicyDecision: null, paused: false };
    if (eventDef.id !== 'gov_ban') return s;
    const params = eventDef.params;
    const r0 = apd.refMonthlyRevenue || 1;
    const fundsBefore = s.funds;

    if (choiceId === 'A') {
      const startupFee = Math.round(r0 * params.A_STARTUP_FEE_PCT);
      s.funds -= startupFee;
      s.policyState = {
        ...s.policyState,
        govBan: {
          ...s.policyState.govBan,
          decision: 'A',
          complianceStartDay: 90,
          cooldownUntilDay: 90,
        },
      };
      s.policyOngoingEffects = {
        ...s.policyOngoingEffects,
        recruitCooldownDays: params.A_COOLDOWN_DAYS,
        vehicleCooldownDays: params.A_COOLDOWN_DAYS,
      };
      s = recordMonthlyEventImpact(s, -startupFee, {
        title: '监管整改',
        label: '启动合规专项',
        detail: `一次性合规启动费 ¥${startupFee.toLocaleString()}`,
      });
      s = pushLog(s, `选择启动合规专项,扣款 ¥${startupFee.toLocaleString()}`, 'event');
      s = pushNotif(s, `合规专项启动 · 司机/车辆 ${params.A_COOLDOWN_DAYS} 天冷却(至 Day 90)`, 'warn');
    } else {
      // B 选项:30 天 buff(订单 +25% × 单均利润 +15% ≈ ×1.4375 净营收倍率)
      s.policyState = {
        ...s.policyState,
        govBan: {
          ...s.policyState.govBan,
          decision: 'B',
          loanTaken: !!(extraToggles && extraToggles.loan),
        },
      };
      const buffMul = (1 + params.B_BUFF_ORDER_PCT) * (1 + params.B_BUFF_PROFIT_PCT);
      s.boostUntilDay = s.day + 30;
      s.boostMul = buffMul;
      s = pushLog(s, `选择聚焦扩张窗口期 · 30 天 fare ×${buffMul.toFixed(2)}`, 'event');
      s = pushNotif(s, `扩张 buff 30 天 · 订单 +25% · 单均利润 +15%`, 'success');

      if (extraToggles && extraToggles.loan) {
        const loanAmount = Math.round(r0 * params.B_LOAN_PCT);
        const interest = Math.round(loanAmount * params.B_LOAN_RATE * (params.B_LOAN_DUE_DAYS / 365));
        const repayTotal = loanAmount + interest;
        s.funds += loanAmount;
        s.policyState = {
          ...s.policyState,
          govBan: {
            ...s.policyState.govBan,
            loanAmount,
          },
        };
        s = addDebt(s, {
          type: 'expansion_loan',
          label: '扩张贷款',
          source: '监管扩张窗口',
          principal: loanAmount,
          repay: repayTotal,
          dueDay: s.day + params.B_LOAN_DUE_DAYS,
          interestRate: params.B_LOAN_RATE || 0,
        });
        s = pushLog(s, `借入扩张贷款 ¥${loanAmount.toLocaleString()},${params.B_LOAN_DUE_DAYS} 天后还本付息 ¥${repayTotal.toLocaleString()}`, 'warn');
        s = pushNotif(s, `+¥${loanAmount.toLocaleString()} 贷款 · 90 天后到期 ¥${repayTotal.toLocaleString()}`, 'warn');
      }
    }

    // 累计资金变化到月报(便于追溯)
    const delta = s.funds - fundsBefore;
    if (delta !== 0 && choiceId === 'B' && extraToggles && extraToggles.loan) {
      // 贷款是 +funds,已记录在 log,不再重复累计到 monthlyEventImpact(避免月报误读为"经营事件收入")
    }
    return s;
  }

  // 关闭政策提示/结果弹窗时执行实际副作用(罚款扣款、禁运启动、解禁等)
  function applyPolicyEventClose(state, ev) {
    if (!ev || !ev.isPolicyEvent) return state;
    let s = { ...state };
    const eventDef = getPolicyDef(ev.policyEventId);
    if (!eventDef) return s;

    if (ev.policyEventId === 'gov_ban') {
      const ps = s.policyState.govBan;
      const params = eventDef.params;
      const r0 = ps.refMonthlyRevenue || 1;

      if (ev.policyStage === 'verdict_fine') {
        const fine = Math.round(r0 * params.A_VERDICT_FINE_PCT);
        s.funds -= fine;
        s.policyState = {
          ...s.policyState,
          govBan: { ...ps, stats: { ...ps.stats, fine: ps.stats.fine + fine } },
        };
        s = recordMonthlyEventImpact(s, -fine, {
          title: '监管整改',
          label: '检查发现细节问题',
          detail: `象征性罚款 ¥${fine.toLocaleString()}`,
        });
        s = pushLog(s, `监管轻罚扣款 ¥${fine.toLocaleString()}`, 'warn');
      } else if (ev.policyStage === 'verdict_ban') {
        const fine = Math.round(r0 * params.B_FINE_PCT);
        s.funds -= fine;
        s.policyOngoingEffects = {
          ...s.policyOngoingEffects,
          orderMultiplier: params.B_BAN_ORDER_BOOST,
        };
        s.policyState = {
          ...s.policyState,
          govBan: {
            ...ps,
            banUntilDay: s.day + params.B_BAN_DAYS,
            complianceStartDay: s.day,
            stats: { ...ps.stats, fine: ps.stats.fine + fine },
          },
        };
        s = recordMonthlyEventImpact(s, -fine, {
          title: '监管整改',
          label: '平台监管整改',
          detail: `立即罚款 ¥${fine.toLocaleString()}`,
        });
        s = pushLog(s, `平台监管整改:罚款 ¥${fine.toLocaleString()},60 天禁运启动 · 订单量降至 ${Math.round(params.B_BAN_ORDER_BOOST * 100)}%(平台只放出原来的 ${Math.round(params.B_BAN_ORDER_BOOST * 100)}% 订单给你接)`, 'warn');
        s = pushNotif(s, `平台被整改 · 订单暴跌至 ${Math.round(params.B_BAN_ORDER_BOOST * 100)}% · 60 天解禁`, 'warn');
      } else if (ev.policyStage === 'resume') {
        s.policyOngoingEffects = {
          ...s.policyOngoingEffects,
          orderMultiplier: 1,
        };
        s = pushLog(s, `60 天禁运期解除,平台恢复正常运营`, 'success');
        s = pushNotif(s, `禁运解除 · 平台恢复运营`, 'success');
      }
      // verdict_pass / notice_1 无副作用,关闭即可
    }
    return s;
  }

  // 月结时按合规衰减曲线扣款(A/B 玩家共用)
  function applyPolicyMonthlyCompliance(state) {
    let s = state;
    const ps = s.policyState && s.policyState.govBan;
    if (!ps || !ps.complianceStartDay || s.day < ps.complianceStartDay) return s;
    const eventDef = getPolicyDef('gov_ban');
    if (!eventDef) return s;
    const params = eventDef.params;
    const schedule = params.COMPLIANCE_SCHEDULE_PCT || [0.10];
    // 计算"自合规起始日起的月序号"(1-indexed)
    const monthsSinceStart = Math.floor((s.day - ps.complianceStartDay) / 30) + 1;
    const idx = Math.min(monthsSinceStart - 1, schedule.length - 1);
    const pct = schedule[idx];
    const rollingBase = Math.max(0, (s.monthlyEarnedGross || 0) - (s.monthlyCommission || 0));
    const cost = Math.round(rollingBase * pct);
    if (cost <= 0) return s;
    s = { ...s, funds: s.funds - cost };
    s = {
      ...s,
      policyState: {
        ...s.policyState,
        govBan: {
          ...ps,
          stats: { ...ps.stats, compliancePaid: ps.stats.compliancePaid + cost },
        },
      },
    };
    s = recordMonthlyEventImpact(s, -cost, {
      title: '监管整改',
      label: `合规月支出(第 ${monthsSinceStart} 个月,${Math.round(pct * 100)}%)`,
      detail: `按本月净流水 ¥${rollingBase.toLocaleString()} 扣款 ¥${cost.toLocaleString()}`,
    });
    s = pushLog(s, `合规月支出 ¥${cost.toLocaleString()}(本月净流水 ¥${rollingBase.toLocaleString()} × ${Math.round(pct * 100)}%)`, 'event');
    return s;
  }

  // === V15 政策事件框架结束 ===

  function isMonthlyReportDue(s) {
    const nextReportDay = (s.monthCounter || 1) * 30 + 1;
    return s.day >= nextReportDay
      && !s.showMonthlyReport
      && !s.activeEvent
      && !s.activeStory
      && !s.gameOver;
  }

  // V14: 月度结算弹窗 — 每 30 天触发一次。
  // 决策 C: 进入第 31/61/91 天时触发,展示"过去 30 天总结"。
  // V14.90: 月报触发改成可重试。若月结当天先弹随机事件/投资人事件,
  // 玩家处理事件后会补弹月报,避免第 91 天这类 7 天事件与月报重合时永久漏结。
  function openDueMonthlyReport(state) {
    if (!isMonthlyReportDue(state)) return state;
    let s = { ...state };
    const salaryDue = s.monthlySalary || 0;
    if (salaryDue > 0) {
      s.funds -= salaryDue;
      s = pushLog(s, `月结发薪: 支付司机工资 ¥${salaryDue}`, 'event');
      if (s.funds < GAME.DEATH_FUNDS_THRESHOLD) {
        s.negFundsDays = Math.max(1, s.negFundsDays || 0);
      }
    }
    // V15: 月结时扣合规支出(衰减曲线 25/20/15/10%)
    s = applyPolicyMonthlyCompliance(s);
    if (s.funds < GAME.DEATH_FUNDS_THRESHOLD) {
      s.negFundsDays = Math.max(1, s.negFundsDays || 0);
    }
    s.showMonthlyReport = makeMonthlyReport(s);
    s.paused = true;
    return s;
  }

  // V14: 生成月报快照,供弹窗渲染。CLOSE_MONTHLY_REPORT 时清空累计字段。
  function makeMonthlyReport(s) {
    const earnedNet = (s.monthlyEarnedGross || 0) - (s.monthlyCommission || 0);
    const netProfit = earnedNet - (s.monthlySalary || 0) - (s.monthlyDebtPaid || 0) - (s.monthlySeverance || 0) + (s.monthlyEventImpact || 0);
    // V14.9: 取司机最新 salary(如果月内涨薪过用最新值,否则 fallback 到首次入档的快照)
    const drivers = Object.keys(s.monthlyDriverData || {})
      .map((id) => {
        const d = s.monthlyDriverData[id];
        const liveDriver = (s.drivers || []).find((x) => String(x.id) === String(id));
        const salary = liveDriver?.salary ?? d.salary;
        const salaryPaid = d.salaryPaid ?? salary;
        return {
          id,
          name: d.name,
          bgName: d.bgName,
          salary,
          salaryPaid,
          completed: d.completed,
          earnedNet: d.earnedNet,
          // 净贡献 = 该司机本月净营收 - 本月实际应付工资
          contribution: d.earnedNet - salaryPaid,
          leftDay: d.leftDay,
        };
      })
      .sort((a, b) => b.contribution - a.contribution);
    const crews = (s.drivers || []).filter((d) => d.vehicleId).length;
    return {
      monthCounter: s.monthCounter || 1,
      day: s.day,
      earnedGross: s.monthlyEarnedGross || 0,
      commission: s.monthlyCommission || 0,
      earnedNet,
      salary: s.monthlySalary || 0,
      debtPaid: s.monthlyDebtPaid || 0,
      severance: s.monthlySeverance || 0,
      eventImpact: s.monthlyEventImpact || 0,
      eventItems: s.monthlyEventItems || [],
      netProfit,
      drivers,
      funds: s.funds,
      reputation: s.reputation,
      crews,
    };
  }

  function recordMonthlyEventImpact(state, amount, item) {
    if (!amount) return state;
    return {
      ...state,
      monthlyEventImpact: (state.monthlyEventImpact || 0) + amount,
      monthlyEventItems: [
        ...(state.monthlyEventItems || []),
        {
          day: state.day,
          title: item?.title || '经营事件',
          label: item?.label || '',
          detail: item?.detail || '',
          amount,
        },
      ],
    };
  }

  function snapshotStats(s) {
    const vehicleIds = new Set((s.vehicles || []).map((v) => v.id));
    return {
      funds: s.funds,
      reputation: s.reputation,
      totalCompleted: s.totalCompleted,
      totalEarned: s.totalEarned,
      days: s.day - 1,
      drivers: s.drivers.length,
      vehicles: s.vehicles.length,
      crews: (s.drivers || []).filter((d) => d.vehicleId && vehicleIds.has(d.vehicleId)).length,
    };
  }

  function getTrainingCost(training, currentValue = 0) {
    const tiers = Array.isArray(training?.costTiers) ? training.costTiers : [];
    const tier = tiers.find((x) => currentValue <= x.max);
    return tier ? tier.cost : (training?.cost || 0);
  }

  function doTrain(state, driverId, trainingId) {
    const t = TRAININGS.find((x) => x.id === trainingId);
    if (!t) return state;
    const targetDriver = state.drivers.find((x) => x.id === driverId);
    if (!targetDriver) return state;
    const targetCaps = targetDriver.statCaps || computeStatCaps(targetDriver);
    if (targetDriver.stats[t.stat] >= (targetCaps[t.stat] || GAME.STAT_CAP)) {
      return pushNotif(state, `${targetDriver.name} 的${statName(t.stat)}已到上限`, 'warn');
    }
    const trainCost = getTrainingCost(t, targetDriver.stats[t.stat] || 0);
    if (state.funds < trainCost) return pushNotif(state, `资金不足!需要 ¥${trainCost.toLocaleString()}`, 'warn');
    let s = {
      ...state,
      funds: state.funds - trainCost,
      totalTrainings: (state.totalTrainings || 0) + 1,
      trainingCounts: {
        ...(state.trainingCounts || {}),
        [t.stat]: ((state.trainingCounts && state.trainingCounts[t.stat]) || 0) + 1,
      },
    };
    // V7 fix: 先 map 计算新 drivers,再赋值给 s.drivers。
    // 不要在 map callback 内重绑 s(否则 LHS base 是旧 s,被 pushLog 替换的 s 拿不到新 drivers,导致训练静默无效)
    let pendingLog = null;
    const nextDrivers = s.drivers.map((d) => {
      if (d.id !== driverId) return d;
      const gain = randInt(t.gainMin, t.gainMax);
      const caps = d.statCaps || computeStatCaps(d);
      const limit = caps[t.stat] || GAME.STAT_CAP;
      const newVal = Math.min(limit, d.stats[t.stat] + gain);
      const realGain = Math.max(0, newVal - d.stats[t.stat]);
      pendingLog = realGain > 0
        ? `${d.name} 完成 ${t.name},花费 ¥${trainCost.toLocaleString()},${statName(t.stat)} +${realGain} / 上限 ${limit}`
        : `${d.name} 的${statName(t.stat)}已经达到${D.RARITY_META[d.rarity]?.name || ''}上限 ${limit}`;
      return { ...d, stats: { ...d.stats, [t.stat]: newVal } };
    });
    s = { ...s, drivers: nextDrivers };
    if (pendingLog) s = pushLog(s, pendingLog, 'success');
    s = checkMission(s);
    return s;
  }

  function statName(key) {
    return { driving: '车技', service: '服务' }[key];
  }

  function roundInvestorMoney(raw) {
    const value = Math.max(0, Math.ceil(raw || 0));
    const step = value <= 20000 ? 1000 : value <= 100000 ? 5000 : 10000;
    return Math.max(step, Math.ceil(value / step) * step);
  }

  function getInvestorPressurePlan(s) {
    const drivers = [...(s.drivers || [])];
    const vehicles = [...(s.vehicles || [])];
    const crewCount = drivers.filter((d) => d.vehicleId).length;
    const fleetScale = Math.max(crewCount, drivers.length, vehicles.length);
    const deficit = Math.max(0, -(s.funds || 0));
    const ratio = fleetScale <= 4 ? 0.25 : fleetScale <= 8 ? 0.30 : 0.35;
    const fireCount = drivers.length > 1
      ? Math.min(drivers.length - 1, Math.max(1, Math.round(drivers.length * ratio)))
      : 0;
    const sellCount = vehicles.length > 1
      ? Math.min(vehicles.length - 1, Math.max(1, Math.round(vehicles.length * ratio)))
      : 0;
    const fireDrivers = drivers
      .sort((a, b) => (b.salary || 0) - (a.salary || 0))
      .slice(0, fireCount);
    const sellVehicles = vehicles
      .sort((a, b) => (getVehicleData(b)?.price || 0) - (getVehicleData(a)?.price || 0))
      .slice(0, sellCount);
    const monthlySavings = fireDrivers.reduce((sum, d) => sum + (d.salary || 0), 0);
    const sellRefund = sellVehicles.reduce((sum, v) => sum + Math.round((getVehicleData(v)?.price || 0) * 0.6), 0);
    const monthlyPayroll = drivers.reduce((sum, d) => sum + (d.salary || 0), 0);
    const debtMultiplier = deficit >= 150000 ? 3 : fleetScale <= 4 ? 2.1 : fleetScale <= 8 ? 2.4 : 2.8;
    const minDebt = fleetScale <= 4 ? 10000 : fleetScale <= 8 ? 30000 : 60000;
    const debtPrincipal = roundInvestorMoney(Math.max(
      minDebt,
      deficit * debtMultiplier,
      monthlyPayroll * 0.35
    ));
    const debtInterestRate = debtPrincipal <= 20000 ? 0.20
      : debtPrincipal <= 50000 ? 0.35
      : debtPrincipal <= 120000 ? 0.55
      : 0.80;
    const debtRepay = roundInvestorMoney(debtPrincipal * (1 + debtInterestRate));
    const debtPeriodDays = debtPrincipal <= 50000 ? 30 : debtPrincipal <= 120000 ? 26 : 22;
    return {
      deficit,
      fleetScale,
      fireCount,
      fireDrivers,
      fireGraceDays: fireCount > 0 ? Math.min(45, 8 + fireCount * 4) : 0,
      monthlySavings,
      sellCount,
      sellVehicles,
      sellRefund,
      debtPrincipal,
      debtRepay,
      debtInterestRate,
      debtPeriodDays,
    };
  }

  // V14.78: 投资人压力事件多选解决器。
  // choices = { fire: bool, sell: bool, debt: bool, holdOn: bool }
  // - fire/sell: 按当前车队规模生成一揽子瘦身方案
  // - debt: 按当前负债缺口生成本金,本金约为缺口的 2-3 倍,金额越大利息越高
  // - holdOn: 互斥兜底,什么都不做
  function resolveInvestorPressure(state, choices) {
    if (!state.activeEvent || state.activeEvent.id !== 'investor_pressure') return state;
    const fundsBefore = state.funds;
    let s = { ...state, activeEvent: null, paused: false };
    const c = choices || {};
    const took = [];
    const plan = getInvestorPressurePlan(s);

    if (c.holdOn) {
      s = pushLog(s, '投资人压力: 不采取措施,赌接下来靠订单流水回正', 'warn');
      // V14.67: 显示与 InvestorPressureModal 一致,把 bankruptcyGraceBonus 算进破产倒计时。
      const daysLeft = Math.max(0, GAME.DEATH_FUNDS_DAYS + (s.bankruptcyGraceBonus || 0) - (s.negFundsDays || 0));
      s = pushNotif(s, `${daysLeft} 天内资金未回正就会破产`, 'warn');
      return openDueMonthlyReport(s);
    }

    if (c.fire) {
      if (plan.fireDrivers.length) {
        const fireIds = new Set(plan.fireDrivers.map((d) => d.id));
        plan.fireDrivers.forEach((target) => {
          const live = s.drivers.find((d) => d.id === target.id);
          if (live?.status === 'driving' && live.currentOrder) {
            s = pushLog(s, `${live.name} 跑单中途被裁,订单 ${live.currentOrder.orderName} 中断`, 'warn');
          }
          if (s.monthlyDriverData && s.monthlyDriverData[target.id]) {
            s.monthlyDriverData = { ...s.monthlyDriverData, [target.id]: { ...s.monthlyDriverData[target.id], leftDay: s.day } };
          }
        });
        s.drivers = s.drivers.filter((d) => !fireIds.has(d.id));
        s.bankruptcyGraceBonus = (s.bankruptcyGraceBonus || 0) + plan.fireGraceDays;
        took.push(`裁员 ${plan.fireDrivers.length} 人(月省 ¥${plan.monthlySavings.toLocaleString()})`);
        s = pushLog(s, `裁员止血: ${plan.fireDrivers.map((d) => d.name).join('、')} 离开车队,投资人宽容期 +${plan.fireGraceDays} 天`, 'warn');
      } else {
        s = pushLog(s, '只剩 1 名司机,无法裁员', 'warn');
      }
    }

    if (c.sell) {
      if (plan.sellVehicles.length) {
        const sellIds = new Set(plan.sellVehicles.map((v) => v.id));
        const soldNames = plan.sellVehicles.map((v) => getVehicleData(v)?.name || v.name).join('、');
        s.vehicles = s.vehicles.filter((v) => !sellIds.has(v.id));
        s.drivers = s.drivers.map((d) => {
          if (!sellIds.has(d.vehicleId)) return d;
          if (d.status === 'driving' && d.currentOrder) {
            s = pushLog(s, `${d.name} 跑单中途车被卖出,订单 ${d.currentOrder.orderName} 中断`, 'warn');
            return { ...d, vehicleId: null, status: 'idle', currentOrder: null };
          }
          return { ...d, vehicleId: null };
        });
        s.funds += plan.sellRefund;
        took.push(`卖车 ${plan.sellVehicles.length} 辆(回血 ¥${plan.sellRefund.toLocaleString()})`);
        s = pushLog(s, `资产止血: 卖出 ${soldNames},回收 ¥${plan.sellRefund.toLocaleString()}`, 'warn');
      } else {
        s = pushLog(s, '只剩 1 辆车,无法卖', 'warn');
      }
    }

    if (c.debt) {
      const dueDay = s.day + plan.debtPeriodDays;
      s.funds += plan.debtPrincipal;
      s = addDebt(s, {
        type: 'high_interest',
        label: '高利贷',
        source: '投资人压力',
        principal: plan.debtPrincipal,
        repay: plan.debtRepay,
        dueDay,
        interestRate: plan.debtInterestRate,
      });
      took.push(`借高利贷 ¥${plan.debtPrincipal.toLocaleString()}`);
      s = pushLog(s, `借入高利贷 +¥${plan.debtPrincipal.toLocaleString()},${plan.debtPeriodDays} 天后需还 ¥${plan.debtRepay.toLocaleString()}(利息约 ${Math.round(plan.debtInterestRate * 100)}%)`, 'warn');
    }

    if (took.length === 0) {
      s = pushLog(s, '投资人压力: 未选择任何方案,等同硬扛', 'warn');
    } else {
      s = pushNotif(s, `已提交方案: ${took.join(' + ')}`, 'success');
    }
    // V14.75: 月报保留事件来源,避免月底只看到一个无法解释的合计金额。
    s = recordMonthlyEventImpact(s, s.funds - fundsBefore, {
      title: '投资人压力',
      label: took.length ? took.join(' + ') : '硬扛',
      detail: '卖车回血 / 借款等现金变动',
    });
    return openDueMonthlyReport(s);
  }

  function resolveEvent(state, optionIdx) {
    const ev = state.activeEvent;
    if (!ev) return state;
    // V15: 政策事件走专属处理(notice / verdict / resume),不进入通用 effect 计算
    if (ev.isPolicyEvent) {
      let s = { ...state, activeEvent: null, paused: false };
      s = applyPolicyEventClose(s, ev);
      return openDueMonthlyReport(s);
    }
    // V15.16: 投资人 review 事件走专属处理
    if (ev.isInvestorReview) {
      return resolveInvestorReviewEvent(state, optionIdx);
    }
    const opt = ev.options[optionIdx];
    if (opt?.requireFunds !== undefined && state.funds < opt.requireFunds) {
      return pushNotif(state, `资金不足!需要 ¥${opt.requireFunds.toLocaleString()}`, 'warn');
    }
    let eff = {};
    try {
      const raw = opt.apply(state) || {};
      // V15.x: 政策事件 / 标了 skipScale 的事件不走规模缩放(避免 platform_pressure
      // 的 -¥180k 自营成本被放大成 -¥1M+,破坏"固定门槛长线攒钱"设计)
      eff = (ev.skipScale || raw.skipScale) ? raw : scaleEventEffect(raw, state);
    } catch (err) {
      let failed = { ...state, activeEvent: null, paused: false };
      failed = pushLog(failed, `事件「${ev.title}」选项异常: ${opt?.label || '未知选项'}`, 'warn');
      failed = pushNotif(failed, '事件结算异常,已跳过该选项', 'warn');
      return failed;
    }
    const fundsBefore = state.funds;
    let s = { ...state, activeEvent: null, paused: false };
    let eventDetail = '';
    if (eff.funds !== undefined) s.funds += eff.funds;
    if (eff.reputation !== undefined) s.reputation = Math.max(0, s.reputation + eff.reputation);
    if (eff.commissionRate !== undefined) s.commissionRate = eff.commissionRate;
    // V15.x: 钥匙司机忠诚衰减永久减半 — 仅在负向 delta 时生效
    function applyAllLoyaltyWithKeyHalf(drivers, delta, opts) {
      const keySet = new Set(s.keyDriverIds || []);
      return (drivers || []).map((d) => {
        const isKey = keySet.has(d.id);
        const finalDelta = (isKey && delta < 0) ? Math.ceil(delta / 2) : delta;  // 减半向 0 取整
        return applyDriverLoyaltyDelta(d, finalDelta, opts || {});
      });
    }
    if (eff.allLoyalty !== undefined) {
      s.drivers = applyAllLoyaltyWithKeyHalf(s.drivers, eff.allLoyalty);
    }
    if (eff.trustLoyalty !== undefined) {
      s.drivers = applyAllLoyaltyWithKeyHalf(s.drivers, eff.trustLoyalty, { trustBreakthrough: true });
    }
    if (eff.orderBoost && eff.boostDuration) {
      s.boostUntilDay = s.day + eff.boostDuration;
      s.boostMul = eff.orderBoost;
    } else if (eff.orderBoost) {
      s.boostUntilDay = s.day + 1;
      s.boostMul = eff.orderBoost;
    }
    if (eff.clearBankruptcyCountdown) {
      s.negFundsDays = 0;
      s.investorPressureFired = false;
      if (s.gameOverPending !== 'kicked_out') s.gameOverPending = null;
      eventDetail = '现金流回正';
      s = pushLog(s, '现金流回正: 公司暂时回到安全区', 'success');
    }
    if (eff.certifyFleet) {
      s.vehicles = s.vehicles.map((v) => ({ ...v, policyCertified: true }));
      s = pushLog(s, `合规更新: ${s.vehicles.length} 辆车完成新政备案`, 'success');
    }
    if (eff.accidentRisk) {
      const risk = eff.accidentRisk;
      if (Math.random() < risk.chance) {
        if (risk.funds !== undefined) s.funds += risk.funds;
        if (risk.reputation !== undefined) s.reputation = Math.max(0, s.reputation + risk.reputation);
        if (risk.allLoyalty !== undefined) {
          s.drivers = s.drivers.map((d) => applyDriverLoyaltyDelta(d, risk.allLoyalty));
        }
        if (risk.trustLoyalty !== undefined) {
          s.drivers = s.drivers.map((d) => applyDriverLoyaltyDelta(d, risk.trustLoyalty, { trustBreakthrough: true }));
        }
        eventDetail = risk.log || '风险兑现: 车队发生事故损失';
        s = pushLog(s, eventDetail, 'warn');
      } else {
        eventDetail = `风险未触发: ${Math.round((risk.chance || 0) * 100)}% 事故风险这次没有兑现`;
        s = pushLog(s, eventDetail, 'info');
      }
    }
    // V15.x: 钥匙司机挖走免疫 — keepBest/loseBest 优先排除钥匙司机
    // 只有当所有非钥匙司机都没了的极端情况才会动钥匙司机
    function pickBestExcludingKey(drivers, keyIds) {
      const keySet = new Set(keyIds || []);
      const candidates = (drivers || []).filter((d) => !keySet.has(d.id));
      const pool = candidates.length > 0 ? candidates : (drivers || []);
      return [...pool].sort((a, b) => sumStats(b.stats) - sumStats(a.stats))[0];
    }
    function pickLoseBestTarget(drivers, keyIds, effect) {
      const keySet = new Set(keyIds || []);
      const named = effect?.loseDriverName
        ? (drivers || []).find((d) => d.name === effect.loseDriverName && !keySet.has(d.id))
        : null;
      return named || pickBestExcludingKey(drivers, keyIds);
    }
    if (eff.salaryRaise && eff.keepBest) {
      const best = pickBestExcludingKey(s.drivers, s.keyDriverIds);
      if (best) {
        const nextSalary = best.salary + eff.salaryRaise;
        const isMarkKey = !!eff.markKeyDriver;
        s.drivers = s.drivers.map((d) =>
          d.id === best.id
            ? { ...applyDriverLoyaltyDelta(d, 30), salary: nextSalary }
            : d
        );
        if (isMarkKey && !(s.keyDriverIds || []).includes(best.id)) {
          s.keyDriverIds = [...(s.keyDriverIds || []), best.id];
          s = pushLog(s, `${best.name} 成为钥匙司机 — 后续忠诚衰减永久减半,且不会被竞品挖走`, 'success');
        }
        s = pushLog(s, `加薪挽留: ${best.name} 月薪 ¥${best.salary} → ¥${nextSalary},忠诚 +30`, 'success');
        s = pushNotif(s, `${best.name} 留队,月薪 +¥${eff.salaryRaise}`, 'success');
      }
    }
    if (eff.loseBest) {
      const best = pickLoseBestTarget(s.drivers, s.keyDriverIds, eff);
      if (best && s.drivers.length > 1) {
        s.drivers = s.drivers.filter((d) => d.id !== best.id);
        s = pushLog(s, eff.loseBestLabel || `${best.name} 被竞品挖走了!`, 'warn');
      }
    }
    // V15.x: rival_friends_join_success 钥匙事件奖励 — 给玩家送 N 个司机 + N 辆车
    if (eff.addDrivers || eff.addVehicles) {
      const count = eff.addDrivers || eff.addVehicles || 0;
      const vehicleType = eff.vehicleType || 'camry';
      const vTpl = VEHICLES.find((v) => v.id === vehicleType);
      for (let i = 0; i < count; i++) {
        const newVehicle = vTpl ? genVehicle(vTpl) : null;
        if (newVehicle) s.vehicles = [...s.vehicles, newVehicle];
        const newDriver = genDriver({ background: BACKGROUNDS[0] });
        if (newVehicle) newDriver.vehicleId = newVehicle.id;
        s.drivers = [...s.drivers, newDriver];
      }
      const vtName = vTpl ? vTpl.name : vehicleType;
      s = pushLog(s, `朋友车队加入:${count} 名专车司机 + ${count} 辆${vtName}入队`, 'success');
      s = pushNotif(s, `+${count} 司机 / +${count} ${vtName}`, 'success');
    }
    // V15.x: platform_pressure 选自营 — 永久标记完结
    if (eff.platformDone) {
      s.platformChoseSelfop = true;
      s = pushLog(s, '自营小程序上线,平台抽成压力事件永久解除', 'success');
    }
    // V14.67: 删除 promoteBest / fireMostExpensive / sellMostExpensive 三个 effect 处理分支。
    //         投资人压力的裁员/卖车走 resolveInvestorPressure,events 数据已无任何选项使用这些字段。
    // 事件型贷款也进入债务明细,避免和扩张贷款/高利贷混成一个不可解释的大数。
    if (eff.debtAmount && eff.debtPeriodDays) {
      const dueDay = s.day + eff.debtPeriodDays;
      s = addDebt(s, {
        type: 'event_loan',
        label: eff.debtLabel || '事件贷款',
        source: ev.title || '事件选择',
        principal: eff.debtPrincipal || eff.debtAmount,
        repay: eff.debtAmount,
        dueDay,
        interestRate: eff.debtInterestRate ?? null,
      });
      s = pushLog(s, `借入${eff.debtLabel || '事件贷款'},${eff.debtPeriodDays} 天后(第 ${dueDay} 日)需还 ¥${eff.debtAmount}`, 'warn');
    }
    s = pushLog(s, `事件「${ev.title}」: ${opt.label}`, 'event');
    // V7: 链式事件触发计数累加 — 让下次触发同一 chain 时进入下一 stage
    // V15.x: 真分支链式 — 把玩家的 choiceKey 写入 chainChoices,后续段过滤用
    if (ev.chain && opt.choiceKey !== undefined) {
      s.chainChoices = { ...(s.chainChoices || {}), [ev.chain]: opt.choiceKey };
    }
    if (isChainEvent(ev)) {
      const chainId = getEventChainId(ev);
      if (chainId) {
        const prev = (s.chainProgress || {})[chainId] || {};
        const completedIds = new Set(prev.completedEventIds || []);
        completedIds.add(ev.id);
        s.chainProgress = {
          ...(s.chainProgress || {}),
          [chainId]: {
            ...prev,
            stage: Math.max(prev.stage || 0, ev.stage || 1),
            lastDay: s.day,
            lastEventId: ev.id,
            completedEventIds: [...completedIds],
          },
        };
      }
    }
    // V14.75: 累加事件资金影响并记录来源,月报展示可追溯明细。
    s = recordMonthlyEventImpact(s, s.funds - fundsBefore, {
      title: ev.title,
      label: opt.label,
      detail: eventDetail || `事件已弹出并处理: ${opt.label}`,
    });
    if (ev.id === SNOW_RESCUE_EVENT_ID) {
      s = policyEventTick(s);
      if (!s.activeEvent && !s.activePolicyDecision) s = investorReviewTick(s);
      if (s.activeEvent || s.activePolicyDecision) return s;
    }
    return openDueMonthlyReport(s);
  }

  function buyVehicle(state, templateId) {
    const t = VEHICLES.find((x) => x.id === templateId);
    if (state.funds < t.price) return pushNotif(state, `资金不足!`, 'warn');
    if (state.reputation < t.unlock) return pushNotif(state, `口碑不足 ${t.unlock}`, 'warn');
    // V15: A 选项合规期购车冷却(Day 60-90 期间,每次购车后 5 天才能再购)
    const ps = state.policyState && state.policyState.govBan;
    if (ps && ps.decision === 'A' && state.day < ps.cooldownUntilDay) {
      const lastDay = state.lastVehicleBuyDay || 0;
      const cd = state.policyOngoingEffects?.vehicleCooldownDays || 0;
      if (cd > 0 && lastDay > 0 && state.day - lastDay < cd) {
        return pushNotif(state, `合规审查期购车冷却中 · 还剩 ${cd - (state.day - lastDay)} 天`, 'warn');
      }
    }
    let s = { ...state, funds: state.funds - t.price, lastVehicleBuyDay: state.day };
    const newVehicle = genVehicle(t);
    const unassignedDriver = s.drivers.find((d) => !d.vehicleId);
    s.vehicles = [...s.vehicles, newVehicle];
    if (unassignedDriver) {
      s.drivers = s.drivers.map((d) => d.id === unassignedDriver.id ? { ...d, vehicleId: newVehicle.id } : d);
    }
    s = pushLog(s, `购入 ${t.name},花费 ¥${t.price}`, 'event');
    if (unassignedDriver) {
      s = pushLog(s, `自动配车: ${unassignedDriver.name} 开上 ${t.name}`, 'success');
    }
    s = checkMission(s);
    return s;
  }

  function findEmptyVehicle(drivers, vehicles) {
    const usedVehicleIds = new Set(drivers.map((d) => d.vehicleId).filter(Boolean));
    return vehicles.find((v) => !usedVehicleIds.has(v.id));
  }

  // V14.3: 换车改为"交换"语义 — 点别人正在开的车,两人的车互换;
  // 跑单中也能换,订单中断(和解雇/卖车保持一致的"任何时候都能操作"原则)。
  function assignVehicle(state, driverId, vehicleId) {
    const driver = state.drivers.find((d) => d.id === driverId);
    const vehicle = state.vehicles.find((v) => v.id === vehicleId);
    if (!driver || !vehicle) return state;
    if (driver.vehicleId === vehicleId) return state;  // 已经是这辆车,无操作

    const vd = getVehicleData(vehicle);
    const occupied = state.drivers.find((d) => d.vehicleId === vehicleId && d.id !== driverId);
    const prevDriverVehicleId = driver.vehicleId;

    let s = { ...state };

    s.drivers = s.drivers.map((d) => {
      if (d.id === driverId) {
        const reset = d.status === 'driving' && d.currentOrder ? { status: 'idle', currentOrder: null } : {};
        return { ...d, vehicleId, ...reset };
      }
      if (occupied && d.id === occupied.id) {
        // 占了目标车的人 → 拿到当前司机原来的车(可能是 null = 一起没车)
        const reset = d.status === 'driving' && d.currentOrder ? { status: 'idle', currentOrder: null } : {};
        return { ...d, vehicleId: prevDriverVehicleId, ...reset };
      }
      return d;
    });

    // 跑单中断日志
    if (driver.status === 'driving' && driver.currentOrder) {
      s = pushLog(s, `${driver.name} 跑单中途换车,订单 ${driver.currentOrder.orderName} 中断`, 'warn');
    }
    if (occupied && occupied.status === 'driving' && occupied.currentOrder) {
      s = pushLog(s, `${occupied.name} 跑单中途被换车,订单 ${occupied.currentOrder.orderName} 中断`, 'warn');
    }

    if (occupied) {
      const occupiedNewVdName = prevDriverVehicleId
        ? getVehicleData(state.vehicles.find((v) => v.id === prevDriverVehicleId))?.name || '另一辆车'
        : '无车';
      s = pushLog(s, `${driver.name} 与 ${occupied.name} 交换车辆: ${vd.name} ↔ ${occupiedNewVdName}`, 'event');
      s = pushNotif(s, `${driver.name} ↔ ${occupied.name} 互换车辆`, 'success');
    } else {
      s = pushLog(s, `${driver.name} 换上 ${vd.name}`, 'event');
      s = pushNotif(s, `${driver.name} 已换上 ${vd.name}`, 'success');
    }
    return s;
  }

  // V14.67: hireDriver 删除 — V11 起被 GACHA_PICK 全面替代,无 dispatch 入口。

  function fireDriver(state, driverId) {
    let s = { ...state };
    const d = s.drivers.find((x) => x.id === driverId);
    if (!d) return s;
    const severance = d.salary * 2;
    if (s.funds < severance) {
      return pushNotif(s, `解雇 ${d.name} 需要补偿 ¥${severance.toLocaleString()}`, 'warn');
    }
    s.funds -= severance;
    s.monthlySeverance = (s.monthlySeverance || 0) + severance;
    // V14: 跑单中也允许解雇,订单中断,车空下来等待新司机配车
    if (d.status === 'driving' && d.currentOrder) {
      s = pushLog(s, `${d.name} 跑单中途被解雇,订单 ${d.currentOrder.orderName} 中断`, 'warn');
    }
    s.drivers = s.drivers.filter((x) => x.id !== driverId);
    // V14: 标记本月离队日,月报里灰显该司机
    if (s.monthlyDriverData && s.monthlyDriverData[driverId]) {
      s.monthlyDriverData = { ...s.monthlyDriverData, [driverId]: { ...s.monthlyDriverData[driverId], leftDay: s.day } };
    }
    s = pushLog(s, `解雇 ${d.name},支付 2 个月补偿 ¥${severance}`, 'warn');
    return s;
  }

  // V14: 玩家主动卖车 — 残值 60%,跑单中也能卖,订单中断,司机空下来
  function sellVehicle(state, vehicleId) {
    let s = { ...state };
    const v = s.vehicles.find((x) => x.id === vehicleId);
    if (!v) return s;
    if (s.vehicles.length <= 1) {
      return pushNotif(state, '只剩 1 辆车,无法卖!', 'warn');
    }
    const td = getVehicleData(v);
    const refund = Math.round(td.price * 0.6);
    s.vehicles = s.vehicles.filter((x) => x.id !== vehicleId);
    // 解绑驾驶员 + 清当前订单
    s.drivers = s.drivers.map((d) => {
      if (d.vehicleId !== vehicleId) return d;
      if (d.status === 'driving' && d.currentOrder) {
        s = pushLog(s, `${d.name} 跑单中途车被卖出,订单 ${d.currentOrder.orderName} 中断`, 'warn');
        return { ...d, vehicleId: null, status: 'idle', currentOrder: null };
      }
      return { ...d, vehicleId: null };
    });
    s.funds += refund;
    s = pushLog(s, `卖出 ${td.name},回收 ¥${refund}`, 'warn');
    s = pushNotif(s, `已卖出 ${td.name},回血 ¥${refund}`, 'success');
    return s;
  }

  function resolveDebtCrisis(state, choice) {
    if (!state.debtCrisis) return state;
    const debts = normalizeDebts(state);
    const crisis = state.debtCrisis;
    if (choice === 'bankrupt') {
      // V15.16 fix:若已被投资人撤资标记 kicked_out,应保留撤资归因(防 race condition)
      const isKickedOut = state.gameOverPending === 'kicked_out';
      const next = {
        ...state,
        debtCrisis: null,
        gameOver: {
          type: 'lose',
          reason: isKickedOut
            ? '投资人撤资 + 债务到期连环爆雷,公司清算'
            : `债务到期还不上 ¥${(crisis.totalDue || 0).toLocaleString()},放弃经营并破产结算`,
          // V15.16:debt_default 合并到 bankruptcy(都是「钱归零」死法,reason 文案区分触发路径)
          deathCause: isKickedOut ? 'kicked_out' : 'bankruptcy',
          stats: snapshotStats(state),
        },
      };
      return pushActionHistory(next, {
        category: 'player',
        type: 'DEBT_CRISIS_BANKRUPT',
        label: '玩家在债务危机中选择破产结算',
        before: state,
        details: { totalDue: crisis.totalDue || 0, shortfall: crisis.shortfall || 0 },
      });
    }

    if (choice !== 'restructure' || debts.length === 0) return state;
    // V15.16 audit fix:已经全部是重组债务时拒绝再次重组(防 UI 绕过 + 无限延期滚雪球)
    if (debts.every((d) => d.type === 'restructure')) return state;
    const totalRepay = debts.reduce((sum, debt) => sum + debt.repay, 0);
    const remainingDaysSum = debts.reduce((sum, debt) => sum + Math.max(0, (debt.dueDay || state.day) - state.day), 0);
    const newPeriodDays = cap(remainingDaysSum, DEBT_RESTRUCTURE_MIN_DAYS, DEBT_RESTRUCTURE_MAX_DAYS);
    const newRepay = roundInvestorMoney(totalRepay * (1 + DEBT_RESTRUCTURE_FEE_RATE));
    const nextDebt = {
      id: makeDebtId(state, 'restructured'),
      type: 'restructured',
      label: '重组债务',
      source: '债务危机',
      principal: totalRepay,
      repay: newRepay,
      dueDay: state.day + newPeriodDays,
      createdDay: state.day,
      interestRate: DEBT_RESTRUCTURE_FEE_RATE,
    };
    let next = syncDebtLegacyFields({
      ...state,
      debtCrisis: null,
      paused: false,
      debtRestructureCount: (state.debtRestructureCount || 0) + 1,
      debts: [nextDebt],
    });
    next = pushLog(next, `债务重组: ${debts.length} 笔债务合并为 ¥${newRepay.toLocaleString()},${newPeriodDays} 天后到期`, 'warn');
    next = pushNotif(next, `债务已重组 · +5% 后待还 ¥${newRepay.toLocaleString()}`, 'warn');
    return pushActionHistory(next, {
      category: 'player',
      type: 'DEBT_RESTRUCTURE',
      label: '玩家选择债务重组',
      before: state,
      details: {
        debtCount: debts.length,
        oldTotal: totalRepay,
        newTotal: newRepay,
        newPeriodDays,
      },
    });
  }

  function gameReducer(state, action) {
    state = stampRealTime(state, action?.type);
    switch (action.type) {
      case 'TICK': return tick(state);
      case 'TOGGLE_PAUSE': {
        const next = { ...state, paused: !state.paused };
        return pushActionHistory(next, {
          category: 'player',
          type: 'TOGGLE_PAUSE',
          label: next.paused ? '玩家暂停运营' : `玩家继续运营(${next.speed || 1}倍速)`,
          before: state,
          details: { speed: next.speed || 1 },
        });
      }
      case 'SET_SPEED': {
        const speed = action.speed || 1;
        const next = { ...state, speed, paused: false, hasStarted: true };
        return pushActionHistory(next, {
          category: 'player',
          type: 'SET_SPEED',
          label: state.hasStarted ? `玩家切换到 ${speed} 倍速` : `玩家开始运营(${speed}倍速)`,
          before: state,
          details: { speed },
        });
      }
      case 'CLOSE_TUTORIAL': {
        const next = { ...state, showTutorial: false };
        return pushActionHistory(next, {
          category: 'player',
          type: 'CLOSE_TUTORIAL',
          label: '玩家关闭新手引导',
          before: state,
        });
      }
      case 'OPEN_TUTORIAL': {
        const next = { ...state, showTutorial: true };
        return pushActionHistory(next, {
          category: 'player',
          type: 'OPEN_TUTORIAL',
          label: '玩家打开帮助引导',
          before: state,
        });
      }
      case 'CLOSE_EVENT': {
        const next = { ...state, activeEvent: null, paused: false };
        const logged = pushActionHistory(next, {
          category: 'player',
          type: 'CLOSE_EVENT',
          label: `玩家关闭事件弹窗: ${state.activeEvent?.title || '未知事件'}`,
          level: 'warn',
          before: state,
        });
        return openDueMonthlyReport(logged);
      }
      case 'TRAIN': return doTrain(state, action.driverId, action.trainingId);
      case 'RESOLVE_EVENT': return resolveEvent(state, action.optionIdx);
      case 'RESOLVE_INVESTOR': return resolveInvestorPressure(state, action.choices);
      // V15: 政策决策点(A/B + 子勾选如贷款)
      case 'RESOLVE_POLICY_DECISION': return resolvePolicyDecision(state, action.choiceId, action.extraToggles);
      case 'BUY_VEHICLE': return buyVehicle(state, action.templateId);
      case 'ASSIGN_VEHICLE': return assignVehicle(state, action.driverId, action.vehicleId);
      case 'FIRE_DRIVER': return fireDriver(state, action.driverId);
      case 'SELL_VEHICLE': return sellVehicle(state, action.vehicleId);
      case 'RESOLVE_DEBT_CRISIS': return resolveDebtCrisis(state, action.choice);
      case 'RESET': return makeInitialState();
      case 'CLEAR_FLOAT_GAIN': return { ...state, floatGains: state.floatGains.filter((g) => g.id !== action.id) };
      case 'CLEAR_NOTIF': return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) };
      case 'CLEAR_MISSION_COMPLETE': return { ...state, newMissionComplete: null };
      // V15.17:关闭解锁 splash 后,扫一次 gate 看有没有排队的下一个解锁
      // 修订:关闭后自动续跑(paused=false),否则玩家以为游戏在跑但实际暂停,
      //      等不到事件触发,误以为「事件不弹」
      case 'CLOSE_UNLOCK_SPLASH': {
        let s = { ...state, activeUnlockSplash: null, paused: false };
        s = scanUIGates(s);
        // 若扫到下一个 gate 解锁,paused 会被 unlockUIGate 重新设回 true
        return s;
      }
      // V15.17:跳过教学 — 老玩家可以一次性解锁所有 UI gate(localStorage 触发)
      case 'UNLOCK_ALL_GATES': {
        const allIds = (UI_GATES || []).map((g) => g.id);
        return { ...state, unlockedUIGates: allIds, activeUnlockSplash: null, spotlight: null };
      }
      // V15.17:玩家点击新解锁的入口 → 立刻清除 spotlight(看过即消)
      case 'ACK_SPOTLIGHT': {
        if (!state.spotlight || state.spotlight.gateId !== action.gateId) return state;
        return { ...state, spotlight: null };
      }
      case 'CLEAR_NEW_ENDING': return { ...state, newEndingUnlocked: null };
      // V14: 关闭月报弹窗 → 清零月度累计 + 月份计数 +1。
      // V14.67: 月结工资打负不再立即触发投资人事件,留 1 天缓冲让玩家先跑单挽救;
      //         若挽救失败,次日日结时(endOfDay 里的常规判定)才触发投资人压力。
      case 'CLOSE_MONTHLY_REPORT': {
        const next = {
          ...state,
          showMonthlyReport: null,
          paused: false,
          monthCounter: (state.monthCounter || 1) + 1,
          monthlyEarnedGross: 0,
          monthlyCommission: 0,
          monthlySalary: 0,
          monthlyDebtPaid: 0,
          monthlySeverance: 0,
          monthlyEventImpact: 0,
          monthlyEventItems: [],
          monthlyDriverData: {},
        };
        return pushActionHistory(next, {
          category: 'player',
          type: 'CLOSE_MONTHLY_REPORT',
          label: `玩家关闭第 ${state.showMonthlyReport?.monthCounter || state.monthCounter || 1} 月经营报告`,
          before: state,
          details: {
            netProfit: state.showMonthlyReport?.netProfit ?? null,
            funds: state.funds,
            reputation: state.reputation,
          },
        });
      }
      // V7: 故事弹窗确认 — 发奖励 + 写 seenStories + 解除暂停
      case 'STORY_SHOWN': {
        if (!state.activeStory) return state;
        const story = state.activeStory;
        let s = applyStoryReward(state, story);
        // 切片故事才记忆;灵魂故事每周目都触发,不写记忆
        if (story.sliceIndex >= 0) {
          const seen = { ...(s.seenStories || {}) };
          const arr = seen[story.bgId] ? [...seen[story.bgId]] : [];
          if (!arr.includes(story.sliceIndex)) arr.push(story.sliceIndex);
          seen[story.bgId] = arr;
          s.seenStories = seen;
          saveSeenStories(seen);
        }
        s.activeStory = null;
        s.paused = false;
        return pushActionHistory(s, {
          category: 'player',
          type: 'STORY_SHOWN',
          label: `玩家看完司机故事: ${story.driverName}「${story.title}」`,
          before: state,
          details: { driverId: story.driverId, milestone: story.milestone },
        });
      }
      case 'CLAIM_ENDING': {
        const ending = ENDINGS.find((e) => e.tier === state.unlockedEndingTier);
        if (!ending) return state;
        const next = { ...state, gameOver: { type: 'win', endingId: ending.id, endingName: ending.name, endingDesc: ending.desc, stats: snapshotStats(state) } };
        return pushActionHistory(next, {
          category: 'player',
          type: 'CLAIM_ENDING',
          label: `玩家领取结局: ${ending.name}`,
          before: state,
          details: { endingId: ending.id, tier: ending.tier },
        });
      }
      // V6: 玩家主动"结束运营",拿当前最高已解锁结局
      case 'CONCEDE': {
        if (state.unlockedEndingTier === 0) {
          return pushNotif(state, '还未达成任何结局,继续运营吧', 'warn');
        }
        const ending = ENDINGS.find((e) => e.tier === state.unlockedEndingTier);
        const next = { ...state, gameOver: { type: 'win', endingId: ending.id, endingName: ending.name, endingDesc: ending.desc, stats: snapshotStats(state) } };
        return pushActionHistory(next, {
          category: 'player',
          type: 'CONCEDE',
          label: `玩家主动结束运营: ${ending.name}`,
          before: state,
          details: { endingId: ending.id, tier: ending.tier },
        });
      }
      // V6: 抽卡
      case 'GACHA_START': return startGacha(state, action.ticketId);
      case 'GACHA_REROLL': return rerollGacha(state);
      case 'GACHA_PICK': return pickGachaCard(state, action.cardId);
      case 'GACHA_CANCEL': {
        const next = cancelGacha(state);
        return pushActionHistory(next, {
          category: 'player',
          type: 'GACHA_CANCEL',
          label: '玩家关闭招募抽卡弹窗',
          before: state,
        });
      }
      // V15.16:司机调薪 — 月薪永久上调,按 pct 1-3 侮辱(忠诚减),4 中性,5-49 线性加,50 拉满
      case 'RAISE_DRIVER_SALARY': {
        const { driverId, pct } = action;
        const effect = getSalaryRaiseLoyaltyEffect(pct);
        if (!effect) return state;
        const driver = state.drivers.find((d) => d.id === driverId);
        if (!driver) return state;
        const oldSalary = driver.salary;
        const newSalary = Math.round(oldSalary * (1 + pct / 100));
        const updatedDrivers = state.drivers.map((d) => {
          if (d.id !== driverId) return d;
          let next = { ...d, salary: newSalary };
          // V15.16:调薪带来的忠诚提升可突破 normalCap 直达 100(钱是真金白银,司机感受不被稀有度封顶)
          // 侮辱性扣忠诚(delta<0)不需要 trustBreakthrough,因为减不受 cap 限制
          if (effect.fillMax) {
            next.loyalty = getDriverLoyaltyCap(d, true);
          } else if (effect.delta !== 0) {
            next = applyDriverLoyaltyDelta(next, effect.delta, { trustBreakthrough: effect.delta > 0 });
          }
          return next;
        });
        const updatedDriver = updatedDrivers.find((d) => d.id === driverId);
        const loyaltyText = effect.fillMax
          ? `拉满 ${updatedDriver.loyalty}`
          : `${effect.delta >= 0 ? '+' : ''}${effect.delta} → ${updatedDriver.loyalty}`;
        let s = { ...state, drivers: updatedDrivers };
        s = pushLog(s, `给 ${driver.name} 调薪 +${pct}%(¥${oldSalary.toLocaleString()} → ¥${newSalary.toLocaleString()},忠诚 ${loyaltyText})`, effect.delta < 0 ? 'warn' : 'event');
        return pushActionHistory(s, {
          category: 'player',
          type: 'RAISE_DRIVER_SALARY',
          label: `调薪 ${driver.name} +${pct}%`,
          before: state,
          details: { driverId, pct, oldSalary, newSalary, loyaltyDelta: effect.delta, fillMax: effect.fillMax },
        });
      }
      default: return state;
    }
  }

  window.WYCWY_ENGINE = {
    rand, randInt, pick, cap, sumStats, statName,
    genName, genDriver, genVehicle,
    getVehicleData, computeStatCaps, canTakeOrder, inHourWindow,
    isZoneUnlocked, getZoneUnlockText,
    getRarityLoyaltyRule, getDriverLoyaltyCap, getDriverQuitLine, getSalaryRaiseLoyaltyEffect,
    getInvestorPressurePlan, getDebtSummary,
    getEventBusinessScale, scaleEventEffect,
    getOperatingCrewCount, getCurrentEventPhase, selectDueChainEvent, selectRandomEvent,
    computeFare, rollGoodReview, getDriverGoodReviewRate, getDriverLoyaltyMultiplier, getDriverQuitRisk,
    getDriverTryRateBreakdown, hasLowLoyaltyDriver,
    isUIGateUnlocked, UI_GATES,
    getTrainingCost,
    buildHourlySupply,
    gameReducer, makeInitialState,
  };
})();
