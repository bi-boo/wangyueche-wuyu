  // === reducer ===
  function makeInitialState() {
    const now = Date.now();
    driverIdCounter = 100;
    vehicleIdCounter = 100;
    orderOfferIdCounter = 0;
    logIdCounter = 0;
    actionHistoryIdCounter = 0;
    decisionHistoryIdCounter = 0;
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
      decisionHistory: [],
      activeEvent: null,
      activePlayerStory: clonePlayerStory('opening_layoff'),
      showTutorial: false,
      gameOver: null,
      todayCompleted: 0,
      todayEarned: 0,
      todayGood: 0,
      todayBad: 0,
      reviewBank: 0,                // 每 3 个好评沉淀为 1 点城市口碑,避免开局口碑暴涨
      reputationDropStreak: {
        last: GAME.STARTING_REPUTATION,
        anchor: GAME.STARTING_REPUTATION,
        drop: 0,
        direction: 'flat',
      },
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
      salaryReserveNoticeFired: false, // V15.40g:第 25 天提醒第 31 天月结发薪
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
    let s = updateReputationDropStreak(state);
    if (s.newMissionComplete) return s;

    // V15.16:乱序检查 — 找未完成且 check pass 的任务,支持 hidden 任务并行完成
    // hidden 任务静默 toast,非 hidden 任务弹 MissionToast(单弹窗,等用户清后下次再触发)
    let changed = true;
    while (changed) {
      changed = false;
      const completedSet = new Set(s.completedMissionIds || []);
      for (const mission of MISSIONS) {
        if (completedSet.has(mission.id)) continue;
        if (!isMissionAvailable(s, mission)) continue;
        if (!mission.check(s)) continue;

        const reward = mission.reward || {};
        s = { ...s };
        if (reward.funds) s.funds += reward.funds;
        s.completedMissionIds = [...s.completedMissionIds, mission.id];

        // currentMissionIdx 重新指向第一个未完成的非 hidden 任务(MissionBar 显示用)
        const newCompleted = new Set(s.completedMissionIds);
        const firstActiveIdx = MISSIONS.findIndex((m) => !newCompleted.has(m.id) && !m.hidden && isMissionAvailable(s, m));
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
    if (type === 'reputation_drop') return hasReputationDropStreak(state, value);
    return false;
  }

  function updateReputationDropStreak(state) {
    const current = Math.max(0, Math.round(state?.reputation ?? GAME.STARTING_REPUTATION));
    const prev = state?.reputationDropStreak || {};
    const last = Number.isFinite(prev.last) ? prev.last : current;
    let anchor = Number.isFinite(prev.anchor) ? prev.anchor : last;
    let direction = prev.direction || 'flat';

    if (current < last) {
      if (direction !== 'down') anchor = last;
      direction = 'down';
    } else if (current > last) {
      anchor = current;
      direction = 'up';
    }

    const drop = direction === 'down' ? Math.max(0, anchor - current) : 0;
    const next = { last: current, anchor, drop, direction };
    if (prev.last === next.last && prev.anchor === next.anchor && prev.drop === next.drop && prev.direction === next.direction) {
      return state;
    }
    return { ...state, reputationDropStreak: next };
  }

  function hasReputationDropStreak(state, value = 10) {
    return (state?.reputationDropStreak?.drop || 0) > value;
  }

  function isMissionAvailable(state, mission) {
    if (!mission) return false;
    if (mission.requiresGate) return isUIGateUnlocked(state, mission.requiresGate);
    if (mission.requiresReputationDrop) return hasReputationDropStreak(state, mission.requiresReputationDrop);
    return true;
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
    let s = updateReputationDropStreak(state);
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

  function addDecisionTag(tags, key, delta = 1) {
    if (!key || !delta) return tags;
    tags[key] = (tags[key] || 0) + delta;
    return tags;
  }

  function cleanDecisionTags(tags) {
    return Object.keys(tags || {}).reduce((acc, key) => {
      const value = Number(tags[key] || 0);
      if (value !== 0) acc[key] = cap(Math.round(value * 10) / 10, -5, 5);
      return acc;
    }, {});
  }

  function serializableDetail(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (e) {
      return {};
    }
  }

  function pushDecisionHistory(state, decision) {
    if (!state || !decision) return state;
    const before = decision.before || null;
    const entry = {
      id: ++decisionHistoryIdCounter,
      time: `${state.day}日${state.hour}:00`,
      day: state.day,
      hour: state.hour,
      category: decision.category || 'operation',
      type: decision.type || 'DECISION',
      label: decision.label || '',
      tags: cleanDecisionTags(decision.tags || {}),
      details: serializableDetail(decision.details || {}),
      before: before ? snapshotActionMetrics(before) : null,
      after: snapshotActionMetrics(state),
      diff: before ? diffActionMetrics(before, state) : {},
      realTimestamp: state.realTime?.lastUpdatedAt ? new Date(state.realTime.lastUpdatedAt).toISOString() : new Date().toISOString(),
    };
    return {
      ...state,
      decisionHistory: [entry, ...(state.decisionHistory || [])].slice(0, 400),
    };
  }

  function inferEventDecisionTags(event, option, effect, eventDetail = '') {
    const tags = { ...(option?.analysisTags || option?.decisionTags || {}) };
    const eff = effect || {};
    const text = `${event?.title || ''} ${event?.tag || ''} ${event?.desc || ''} ${option?.label || ''} ${option?.detail || ''} ${eventDetail || ''}`;

    if (eff.funds > 0) addDecisionTag(tags, 'profit', 2);
    if (eff.funds < 0) addDecisionTag(tags, 'profit', -1);
    if (eff.reputation > 0) addDecisionTag(tags, 'reputationFirst', 2);
    if (eff.reputation < 0) addDecisionTag(tags, 'reputationFirst', -1);
    if (eff.allLoyalty > 0) addDecisionTag(tags, 'driverCare', 2);
    if (eff.allLoyalty < 0) addDecisionTag(tags, 'driverCare', -2);
    if (eff.trustLoyalty > 0) {
      addDecisionTag(tags, 'driverCare', 1);
      addDecisionTag(tags, 'trustBuilding', 2);
    }
    if (eff.trustLoyalty < 0) {
      addDecisionTag(tags, 'driverCare', -1);
      addDecisionTag(tags, 'trustBuilding', -2);
    }
    if (eff.orderBoost > 1) addDecisionTag(tags, 'growth', 1);
    if (eff.orderBoost > 1 && (eff.allLoyalty || 0) < 0) addDecisionTag(tags, 'riskTaking', 1);
    if (eff.commissionRate !== undefined) addDecisionTag(tags, 'costControl', eff.commissionRate <= 0 ? 2 : -1);
    if (eff.keepBest || eff.salaryRaise) {
      addDecisionTag(tags, 'driverCare', 2);
      addDecisionTag(tags, 'trustBuilding', 1);
      addDecisionTag(tags, 'profit', -1);
    }
    if (eff.loseBest) {
      addDecisionTag(tags, 'driverCare', -2);
      addDecisionTag(tags, 'growth', -1);
      addDecisionTag(tags, 'costControl', 1);
    }
    if (eff.addDrivers || eff.addVehicles) addDecisionTag(tags, 'growth', 2);
    if (eff.debtAmount || eff.debtPrincipal) addDecisionTag(tags, 'riskTaking', 2);
    if (eff.accidentRisk) addDecisionTag(tags, 'riskTaking', 2);

    if (/合规|培训|备案|报警|记录|拒绝|不许|严令|澄清|保密|公开/.test(text)) addDecisionTag(tags, 'compliance', 1);
    if (/刷单|虚开|灰|违规|压下去|默许|别的号|走灰/.test(text)) {
      addDecisionTag(tags, 'compliance', -2);
      addDecisionTag(tags, 'riskTaking', 2);
      addDecisionTag(tags, 'shortTermism', 1);
    }
    if (/借给|补偿|全薪|慰问|公司全付|全担|担下来|包下|加薪|挽留/.test(text)) {
      addDecisionTag(tags, 'driverCare', 1);
      addDecisionTag(tags, 'trustBuilding', 1);
    }
    if (/钱保住|自付|劝退|不准假|装作没|不管|放走|硬扛/.test(text)) {
      addDecisionTag(tags, 'profit', 1);
      addDecisionTag(tags, 'driverCare', -1);
      addDecisionTag(tags, 'shortTermism', 1);
    }
    if (/贷款|高利贷|赌|窗口期|豪赌|抢单|冲一下/.test(text)) addDecisionTag(tags, 'riskTaking', 1);

    return cleanDecisionTags(tags);
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
