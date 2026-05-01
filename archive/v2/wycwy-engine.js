/* 网约车物语 V2 - 游戏引擎 (reducer + 工具) */
(function () {
  const D = window.WYCWY_DATA;
  const { GAME, BACKGROUNDS, VEHICLES, ORDERS, PARTS, TRAININGS, RANKS, EVENTS, FIRST_NAMES, LAST_NAMES_M, ACHIEVEMENTS } = D;

  let driverIdCounter = 100;
  let vehicleIdCounter = 100;
  let logIdCounter = 0;

  // 工具
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const cap = (v, min, max) => Math.max(min, Math.min(max, v));
  const sumStats = (s) => s.driving + s.service + s.road + s.mind;

  function genName() { return pick(FIRST_NAMES) + pick(LAST_NAMES_M); }

  function genDriver(opts = {}) {
    const bg = opts.background || pick(BACKGROUNDS);
    const name = opts.name || genName();
    const baseSpread = randInt(-3, 5);
    return {
      id: ++driverIdCounter,
      name,
      bg: bg.id,
      bgName: bg.name,
      bgDesc: bg.desc,
      avatar: bg.avatar,
      stats: {
        driving: cap(bg.boosts.driving + baseSpread, 1, 99),
        service: cap(bg.boosts.service + baseSpread, 1, 99),
        road: cap(bg.boosts.road + baseSpread, 1, 99),
        mind: cap(bg.boosts.mind + baseSpread, 1, 99),
      },
      salary: bg.salary,
      loyalty: bg.loyalty,
      fatigue: 0,
      exp: 0,
      completedOrders: 0,
      totalEarned: 0,
      vehicleId: null,
      status: 'idle',
      currentOrder: null,
      rankId: 'rookie',
      orderRateBonus: bg.orderRateBonus || 1.0,
      constraint: bg.constraint || null,
      todayHistory: new Array(24).fill(null), // 24h 时间轴
    };
  }

  function genVehicle(template) {
    return {
      id: ++vehicleIdCounter,
      templateId: template.id,
      name: template.name,
      parts: [],
    };
  }

  function getVehicleData(v) {
    return VEHICLES.find((t) => t.id === v.templateId);
  }

  function computeRank(driver) {
    let best = RANKS[0];
    for (const r of RANKS) {
      let ok = true;
      for (const k in r.need) if (driver.stats[k] < r.need[k]) { ok = false; break; }
      if (ok) best = r;
    }
    return best;
  }

  function canTakeOrder(order, driver, vehicle) {
    for (const k in order.req) if (driver.stats[k] < order.req[k]) return false;
    if (order.partReq && !vehicle.parts.includes(order.partReq)) return false;
    const vd = getVehicleData(vehicle);
    if (!vd.eligible.includes(order.id)) return false;
    return true;
  }

  function inHourWindow(window, hour) {
    if (!window) return true;
    const [s, e] = window;
    if (s < e) return hour >= s && hour < e;
    return hour >= s || hour < e;
  }

  function computeFare(order, driver, vehicle) {
    const rank = computeRank(driver);
    const vd = getVehicleData(vehicle);
    let fare = order.fare * rank.fareMul;
    fare *= 1 + vd.srvBonus / 100;
    if (order.id === 'business' && vehicle.parts.includes('fridge')) fare *= 1.2;
    if (order.id === 'night' && driver.stats.mind >= 60) fare *= 1.2;
    fare *= rand(0.95, 1.1);
    return Math.round(fare);
  }

  function rollGoodReview(driver, vehicle) {
    const base = 0.5 + driver.stats.service * 0.005;
    const aromaBonus = vehicle.parts.includes('aroma') ? 0.15 : 0;
    return Math.random() < base + aromaBonus;
  }

  // === reducer ===
  function makeInitialState() {
    driverIdCounter = 100;
    vehicleIdCounter = 100;
    logIdCounter = 0;
    const d1 = genDriver({ background: BACKGROUNDS[0], name: '张建国' });
    const d2 = genDriver({ background: BACKGROUNDS[3], name: '李大伟' });
    const v1 = genVehicle(VEHICLES[0]);
    const v2 = genVehicle(VEHICLES[0]);
    d1.vehicleId = v1.id;
    d2.vehicleId = v2.id;
    return {
      funds: GAME.STARTING_FUNDS,
      reputation: GAME.STARTING_REPUTATION,
      day: 1,
      hour: 6,
      speed: 1,
      paused: true,
      drivers: [d1, d2],
      vehicles: [v1, v2],
      log: [
        { id: ++logIdCounter, time: '6:00', text: '车队成立! 初始资金 ¥10,000', level: 'event' },
      ],
      activeEvent: null,
      showTutorial: true,
      gameOver: null,
      todayCompleted: 0,
      todayEarned: 0,
      todayGood: 0,
      todayBad: 0,
      yesterdayEarned: 0,
      yesterdayCompleted: 0,
      totalEarned: 0,
      totalCompleted: 0,
      commissionRate: GAME.COMMISSION,
      triggeredEvents: [],
      floatGains: [],
      boostUntilDay: 0,
      boostMul: 1,
      notifications: [],
      kpiHistory: { earned: [], completed: [], reputation: [GAME.STARTING_REPUTATION] },
      achievements: [],
      newAchievement: null,
      zoneHeat: { cbd: 0.5, airport: 0.5, station: 0.5, residential: 0.5, downtown: 0.5 },
    };
  }

  function pushLog(state, text, level = 'info') {
    const time = `${state.day}日${state.hour}:00`;
    return {
      ...state,
      log: [{ id: ++logIdCounter, time, text, level }, ...state.log].slice(0, 80),
    };
  }

  function pushNotif(state, text, level = 'info') {
    return {
      ...state,
      notifications: [...state.notifications, { id: Date.now() + Math.random(), text, level }],
    };
  }

  function checkAchievements(state) {
    let s = state;
    for (const a of ACHIEVEMENTS) {
      if (s.achievements.includes(a.id)) continue;
      if (a.check(s)) {
        s = {
          ...s,
          achievements: [...s.achievements, a.id],
          newAchievement: a,
        };
        s = pushNotif(s, `成就解锁: ${a.name}`, 'achievement');
      }
    }
    return s;
  }

  function updateZoneHeat(state) {
    // 根据时段调整各区域热度
    const h = state.hour;
    const heat = { ...state.zoneHeat };
    // CBD 商务时段(7-21)高
    heat.cbd = h >= 7 && h <= 21 ? 0.7 + Math.random() * 0.3 : 0.2;
    // 机场全天稳定
    heat.airport = 0.5 + Math.random() * 0.4;
    // 火车站早晚高峰
    heat.station = (h >= 6 && h <= 10) || (h >= 17 && h <= 22) ? 0.8 + Math.random() * 0.2 : 0.3;
    // 住宅区早晚通勤
    heat.residential = (h >= 7 && h <= 9) || (h >= 18 && h <= 22) ? 0.7 + Math.random() * 0.3 : 0.4;
    // 老城区夜里高
    heat.downtown = h >= 19 || h < 3 ? 0.8 + Math.random() * 0.2 : 0.5;
    return heat;
  }

  function tick(state) {
    if (state.gameOver || state.activeEvent || state.showTutorial) return state;
    let s = { ...state };
    let drivers = [...s.drivers];
    let vehicles = [...s.vehicles];

    s.hour += 1;
    if (s.hour >= 24) {
      s = endOfDay(s);
      drivers = s.drivers;
      vehicles = s.vehicles;
    }

    // 更新区域热度
    s.zoneHeat = updateZoneHeat(s);

    // 跑单中的司机推进
    drivers = drivers.map((d) => {
      if (d.status !== 'driving' || !d.currentOrder) return d;
      const newRemain = d.currentOrder.remainHours - 1;
      // 记录时间轴
      const newHistory = [...d.todayHistory];
      newHistory[s.hour > 0 ? s.hour - 1 : 23] = { type: 'driving', orderId: d.currentOrder.orderId };
      if (newRemain > 0) {
        return { ...d, currentOrder: { ...d.currentOrder, remainHours: newRemain }, todayHistory: newHistory };
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
      const goodReview = rollGoodReview(d, v);
      if (goodReview) {
        s.reputation += 1;
        s.todayGood += 1;
      } else if (Math.random() < 0.1 && !v.parts.includes('recorder')) {
        s.reputation = Math.max(0, s.reputation - 2);
        s.todayBad += 1;
      }
      s.floatGains = [...s.floatGains, { id: Date.now() + Math.random(), driverId: d.id, amount: net }];
      s = pushLog(s, `${d.name} 完成 ${d.currentOrder.orderName} 收入 ¥${net}${goodReview ? ' (好评)' : ''}`, goodReview ? 'success' : 'info');

      const orderId = d.currentOrder.orderId;
      const distance = d.currentOrder.distance;
      return {
        ...d,
        status: 'idle',
        currentOrder: null,
        fatigue: Math.min(100, d.fatigue + (distance > 30 ? 18 : 7)),
        exp: d.exp + 1,
        completedOrders: d.completedOrders + 1,
        totalEarned: d.totalEarned + net,
        stats: levelUpStats(d.stats, orderId),
        todayHistory: newHistory,
      };
    });

    // 派单
    for (let i = 0; i < drivers.length; i++) {
      const d = drivers[i];
      if (d.status !== 'idle') continue;
      if (!d.vehicleId) continue;
      if (d.fatigue >= 80) {
        const newHistory = [...d.todayHistory];
        newHistory[s.hour > 0 ? s.hour - 1 : 23] = { type: 'rest' };
        drivers[i] = { ...d, todayHistory: newHistory };
        continue;
      }
      if (d.constraint === '工作时间 8-18' && (s.hour < 8 || s.hour >= 18)) continue;

      const v = vehicles.find((x) => x.id === d.vehicleId);
      if (!v) continue;

      const eligible = ORDERS.filter((o) => canTakeOrder(o, d, v) && inHourWindow(o.hours_window, s.hour));
      if (eligible.length === 0) continue;

      const repMul = 0.5 + s.reputation / 150;
      const speedMul = getVehicleData(v).speed;
      const tryRate = Math.min(0.95, 0.55 * repMul * speedMul * d.orderRateBonus);
      if (Math.random() > tryRate) {
        const newHistory = [...d.todayHistory];
        newHistory[s.hour > 0 ? s.hour - 1 : 23] = { type: 'idle' };
        drivers[i] = { ...d, todayHistory: newHistory };
        continue;
      }

      // 加权选订单
      const totalWeight = eligible.reduce((sum, o) => sum + o.rate, 0);
      let r = Math.random() * totalWeight;
      let chosen = eligible[0];
      for (const o of eligible) {
        r -= o.rate;
        if (r <= 0) { chosen = o; break; }
      }

      const fare = computeFare(chosen, d, v);
      const boostMul = s.day <= s.boostUntilDay ? s.boostMul : 1;
      const finalFare = Math.round(fare * boostMul);

      const newHistory = [...d.todayHistory];
      newHistory[s.hour > 0 ? s.hour - 1 : 23] = { type: 'driving', orderId: chosen.id };

      drivers[i] = {
        ...d,
        status: 'driving',
        todayHistory: newHistory,
        currentOrder: {
          orderId: chosen.id,
          orderName: chosen.name,
          fare: finalFare,
          distance: chosen.km,
          totalHours: chosen.hours,
          remainHours: chosen.hours,
          startedAt: s.hour,
          color: chosen.color,
          zone: chosen.zone,
        },
      };
      s = pushLog(s, `${d.name} 接单: ${chosen.name} (¥${finalFare}, ${chosen.hours}h)`, 'info');
    }

    // 检查胜利/失败
    if (s.funds >= GAME.WIN_FUNDS) {
      s.gameOver = { type: 'win', reason: '资金达成', stats: snapshotStats(s) };
    } else if (s.day > GAME.DAYS_PER_GAME) {
      s.gameOver = { type: 'end', reason: '一周目结束', stats: snapshotStats(s) };
    } else if (s.funds < -3000) {
      s.gameOver = { type: 'lose', reason: '资金枯竭破产', stats: snapshotStats(s) };
    }

    s.drivers = drivers;
    s.vehicles = vehicles;
    s = checkAchievements(s);
    return s;
  }

  function endOfDay(state) {
    let s = { ...state, hour: 0, day: state.day + 1 };
    let dailyCost = 0;
    s.drivers.forEach((d) => {
      const rank = computeRank(d);
      dailyCost += Math.round((d.salary * rank.salaryMul) / 30);
    });
    s.vehicles.forEach((v) => {
      dailyCost += getVehicleData(v).maint;
    });
    s.funds -= dailyCost;
    s = pushLog(
      s,
      `第 ${state.day} 日结算: 流水 ¥${s.todayEarned}, 工资+维护 ¥${dailyCost}, 完成 ${s.todayCompleted} 单`,
      'event'
    );
    // 历史
    s.kpiHistory = {
      earned: [...s.kpiHistory.earned, s.todayEarned].slice(-GAME.SPARKLINE_LEN),
      completed: [...s.kpiHistory.completed, s.todayCompleted].slice(-GAME.SPARKLINE_LEN),
      reputation: [...s.kpiHistory.reputation, s.reputation].slice(-GAME.SPARKLINE_LEN),
    };
    s.yesterdayEarned = s.todayEarned;
    s.yesterdayCompleted = s.todayCompleted;
    // 司机休息
    s.drivers = s.drivers.map((d) => ({
      ...d,
      fatigue: Math.max(0, d.fatigue - 60),
      status: d.status === 'driving' ? d.status : 'idle',
      todayHistory: new Array(24).fill(null),
    }));
    s.todayCompleted = 0;
    s.todayEarned = 0;
    s.todayGood = 0;
    s.todayBad = 0;

    // 触发事件 (每 4 天)
    if (s.day > 1 && s.day % 4 === 0 && !s.activeEvent) {
      const remaining = EVENTS.filter((e) => !s.triggeredEvents.includes(e.id));
      if (remaining.length > 0) {
        const ev = pick(remaining);
        s.triggeredEvents = [...s.triggeredEvents, ev.id];
        s.activeEvent = ev;
        s.paused = true;
      }
    }
    return s;
  }

  function snapshotStats(s) {
    return {
      funds: s.funds,
      reputation: s.reputation,
      totalCompleted: s.totalCompleted,
      totalEarned: s.totalEarned,
      days: s.day - 1,
      drivers: s.drivers.length,
      vehicles: s.vehicles.length,
      achievements: s.achievements.length,
    };
  }

  function levelUpStats(stats, orderId) {
    const map = {
      short: ['driving', 'service'],
      business: ['service', 'mind'],
      airport: ['driving', 'road'],
      night: ['mind', 'driving'],
      long: ['road', 'mind'],
      luxury: ['service', 'mind'],
      eco: ['driving', 'service'],
    };
    const targets = map[orderId] || ['driving'];
    const newStats = { ...stats };
    for (const k of targets) {
      if (Math.random() < 0.3) {
        newStats[k] = Math.min(99, newStats[k] + 1);
      }
    }
    return newStats;
  }

  function doTrain(state, driverId, trainingId) {
    const t = TRAININGS.find((x) => x.id === trainingId);
    if (state.funds < t.cost) return pushNotif(state, `资金不足!需要 ¥${t.cost}`, 'warn');
    let s = { ...state, funds: state.funds - t.cost };
    s.drivers = s.drivers.map((d) => {
      if (d.id !== driverId) return d;
      const gain = randInt(t.gainMin, t.gainMax);
      const newVal = Math.min(99, d.stats[t.stat] + gain);
      s = pushLog(s, `${d.name} 完成 ${t.name},${statName(t.stat)} +${gain}`, 'success');
      return { ...d, stats: { ...d.stats, [t.stat]: newVal } };
    });
    return checkAchievements(s);
  }

  function statName(key) {
    return { driving: '驾驶', service: '服务', road: '路感', mind: '心力' }[key];
  }

  function resolveEvent(state, optionIdx) {
    const ev = state.activeEvent;
    if (!ev) return state;
    const opt = ev.options[optionIdx];
    const eff = opt.apply(state) || {};
    let s = { ...state, activeEvent: null, paused: false };
    if (eff.funds !== undefined) s.funds += eff.funds;
    if (eff.reputation !== undefined) s.reputation = Math.max(0, s.reputation + eff.reputation);
    if (eff.commissionRate !== undefined) s.commissionRate = eff.commissionRate;
    if (eff.allLoyalty !== undefined) {
      s.drivers = s.drivers.map((d) => ({ ...d, loyalty: cap(d.loyalty + eff.allLoyalty, 0, 100) }));
    }
    if (eff.orderBoost && eff.boostDuration) {
      s.boostUntilDay = s.day + eff.boostDuration;
      s.boostMul = eff.orderBoost;
    } else if (eff.orderBoost) {
      s.boostUntilDay = s.day + 1;
      s.boostMul = eff.orderBoost;
    }
    if (eff.salaryRaise && eff.keepBest) {
      const best = [...s.drivers].sort((a, b) => sumStats(b.stats) - sumStats(a.stats))[0];
      if (best) {
        s.drivers = s.drivers.map((d) =>
          d.id === best.id
            ? { ...d, salary: d.salary + eff.salaryRaise, loyalty: cap(d.loyalty + 30, 0, 100) }
            : d
        );
      }
    }
    if (eff.loseBest) {
      const best = [...s.drivers].sort((a, b) => sumStats(b.stats) - sumStats(a.stats))[0];
      if (best && s.drivers.length > 1) {
        s.drivers = s.drivers.filter((d) => d.id !== best.id);
        s = pushLog(s, `${best.name} 被竞品挖走了!`, 'warn');
      }
    }
    if (eff.promoteBest) {
      const best = [...s.drivers].sort((a, b) => sumStats(b.stats) - sumStats(a.stats))[0];
      if (best) {
        const newDriver = genDriver();
        newDriver.stats = {
          driving: Math.round(best.stats.driving * 0.3),
          service: Math.round(best.stats.service * 0.3),
          road: Math.round(best.stats.road * 0.3),
          mind: Math.round(best.stats.mind * 0.3),
        };
        s.drivers = [...s.drivers.filter((d) => d.id !== best.id), newDriver];
        s = pushLog(s, `${best.name} 升任组长,新司机 ${newDriver.name} 加入车队`, 'event');
      }
    }
    s = pushLog(s, `事件「${ev.title}」: ${opt.label}`, 'event');
    return s;
  }

  function buyVehicle(state, templateId) {
    const t = VEHICLES.find((x) => x.id === templateId);
    if (state.funds < t.price) return pushNotif(state, `资金不足!`, 'warn');
    if (state.reputation < t.unlock) return pushNotif(state, `口碑不足 ${t.unlock}`, 'warn');
    let s = { ...state, funds: state.funds - t.price };
    s.vehicles = [...s.vehicles, genVehicle(t)];
    s = pushLog(s, `购入 ${t.name},花费 ¥${t.price}`, 'event');
    return s;
  }

  function buyPart(state, vehicleId, partId) {
    const p = PARTS.find((x) => x.id === partId);
    if (state.funds < p.price) return pushNotif(state, `资金不足!`, 'warn');
    let s = { ...state, funds: state.funds - p.price };
    s.vehicles = s.vehicles.map((v) => {
      if (v.id !== vehicleId) return v;
      if (v.parts.includes(partId)) return v;
      return { ...v, parts: [...v.parts, partId] };
    });
    s = pushLog(s, `安装 ${p.name},花费 ¥${p.price}`, 'success');
    return s;
  }

  function assignVehicle(state, driverId, vehicleId) {
    let s = { ...state };
    s.drivers = s.drivers.map((d) => {
      if (d.vehicleId === vehicleId && d.id !== driverId) return { ...d, vehicleId: null };
      if (d.id === driverId) return { ...d, vehicleId };
      return d;
    });
    return s;
  }

  function hireDriver(state, bgId) {
    const bg = BACKGROUNDS.find((x) => x.id === bgId);
    const fee = 500;
    if (state.funds < fee) return pushNotif(state, `招聘费 ¥${fee} 不足`, 'warn');
    let s = { ...state, funds: state.funds - fee };
    const newDriver = genDriver({ background: bg });
    s.drivers = [...s.drivers, newDriver];
    s = pushLog(s, `招募 ${newDriver.name} (${bg.name}) 入队`, 'event');
    return s;
  }

  function fireDriver(state, driverId) {
    let s = { ...state };
    const d = s.drivers.find((x) => x.id === driverId);
    if (!d) return s;
    s.drivers = s.drivers.filter((x) => x.id !== driverId);
    s = pushLog(s, `${d.name} 离开了车队`, 'warn');
    return s;
  }

  function gameReducer(state, action) {
    switch (action.type) {
      case 'TICK': return tick(state);
      case 'TOGGLE_PAUSE': return { ...state, paused: !state.paused };
      case 'SET_SPEED': return { ...state, speed: action.speed, paused: false };
      case 'CLOSE_TUTORIAL': return { ...state, showTutorial: false };
      case 'CLOSE_EVENT': return { ...state, activeEvent: null, paused: false };
      case 'TRAIN': return doTrain(state, action.driverId, action.trainingId);
      case 'RESOLVE_EVENT': return resolveEvent(state, action.optionIdx);
      case 'BUY_VEHICLE': return buyVehicle(state, action.templateId);
      case 'BUY_PART': return buyPart(state, action.vehicleId, action.partId);
      case 'ASSIGN_VEHICLE': return assignVehicle(state, action.driverId, action.vehicleId);
      case 'HIRE_DRIVER': return hireDriver(state, action.bgId);
      case 'FIRE_DRIVER': return fireDriver(state, action.driverId);
      case 'RESET': return makeInitialState();
      case 'CLEAR_FLOAT_GAIN': return { ...state, floatGains: state.floatGains.filter((g) => g.id !== action.id) };
      case 'CLEAR_NOTIF': return { ...state, notifications: state.notifications.filter((n) => n.id !== action.id) };
      case 'CLEAR_ACHIEVEMENT': return { ...state, newAchievement: null };
      default: return state;
    }
  }

  window.WYCWY_ENGINE = {
    rand, randInt, pick, cap, sumStats, statName,
    genName, genDriver, genVehicle,
    getVehicleData, computeRank, canTakeOrder, inHourWindow,
    computeFare, rollGoodReview,
    gameReducer, makeInitialState,
  };
})();
