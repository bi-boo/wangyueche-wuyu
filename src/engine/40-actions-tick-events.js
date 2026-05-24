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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'GACHA_START',
      label: `购买招募券: ${ticket.name}`,
      before: state,
      tags: { growth: 1, profit: -1, riskTaking: ticket.id === 'normal' ? 0.5 : 1 },
      details: { ticketId, ticketName: ticket.name, cost: ticket.cost, cardCount: cards.length },
    });
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'GACHA_REROLL',
      label: `重新抽招募券: ${ticket.name}`,
      before: state,
      tags: { growth: 1, profit: -1, riskTaking: 1 },
      details: { ticketId: state.gachaTicketId, ticketName: ticket.name, cost: ticket.cost, cardCount: cards.length },
    });
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'RECRUIT_DRIVER',
      label: `招募司机: ${card.name}`,
      before: state,
      tags: { growth: 2, driverCare: 0.5 },
      details: {
        driverId: card.id,
        driverName: card.name,
        rarity: card.rarity,
        bgName: card.bgName,
        autoAssignedVehicleId: emptyVehicle?.id || null,
      },
    });
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
    if (state.gameOver || state.activeEvent || state.activePolicyDecision || state.activePlayerStory || state.showTutorial || state.activeStory || state.debtCrisis) return state;
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
    const canShowStory = !s.activePlayerStory && !s.activeStory && s.speed < 4 && (s.day - (s.lastStoryDay || -999)) >= 3;
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
    const hasOpenModal = s.activeEvent || s.activePolicyDecision || s.activePlayerStory || s.activeStory;
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

  function salaryReserveNoticeTick(state) {
    if (!state || state.salaryReserveNoticeFired || state.day < 25) return state;
    if (state.activeEvent || state.activePolicyDecision || state.showMonthlyReport || state.gameOver) return state;
    const salaryDue = state.monthlySalary || 0;
    const funds = state.funds || 0;
    const gap = Math.max(0, salaryDue - funds);
    const gapText = gap > 0
      ? `\n\n按现在账面看,还差 ¥${gap.toLocaleString()} 才能覆盖已累计工资。`
      : '';
    return {
      ...state,
      salaryReserveNoticeFired: true,
      paused: true,
      activeEvent: {
        id: 'salary_reserve_notice_day25',
        title: '月末发薪提醒',
        tag: '财务',
        eventType: 'scripted',
        scripted: true,
        skipScale: true,
        desc: `财务提醒:第 31 天会结算过去 30 天所有员工(司机)的工资。\n\n当前已累计应付工资约 ¥${salaryDue.toLocaleString()},账上现金 ¥${funds.toLocaleString()}。请提前预留好这笔资金,不要在月末前把现金全部拿去买车、招人或培训。${gapText}`,
        options: [
          { label: '知道了,预留工资', detail: '第 31 天月报会统一扣除员工工资', apply: () => ({}) },
        ],
      },
    };
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

    s = salaryReserveNoticeTick(s);
    if (s.activeEvent) return s;

    // V15.24:事件调度拆分。链式剧情看 chainProgress + delayAfter,随机事件看经营阶段池。
    const chainEvent = selectDueChainEvent(s);
    if (chainEvent) return openScheduledEvent(s, chainEvent, 'chain');

    const randomEvent = selectRandomEvent(s);
    if (randomEvent) return openScheduledEvent(s, randomEvent, 'random');

    s = openDueMonthlyReport(s);

    return s;
  }
