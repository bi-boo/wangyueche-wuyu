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
