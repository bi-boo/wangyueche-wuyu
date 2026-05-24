  function isMonthlyReportDue(s) {
    const nextReportDay = (s.monthCounter || 1) * 30 + 1;
    return s.day >= nextReportDay
      && !s.showMonthlyReport
      && !s.activeEvent
      && !s.activePlayerStory
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
        ? `${d.name} 完成${t.name},花费 ¥${trainCost.toLocaleString()},${statName(t.stat)} +${realGain} / 上限 ${limit}`
        : `${d.name} 的${statName(t.stat)}已经达到${D.RARITY_META[d.rarity]?.name || ''}上限 ${limit}`;
      return { ...d, stats: { ...d.stats, [t.stat]: newVal } };
    });
    s = { ...s, drivers: nextDrivers };
    if (pendingLog) s = pushLog(s, pendingLog, 'success');
    s = checkMission(s);
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'TRAIN_DRIVER',
      label: `提升司机能力: ${targetDriver.name} · ${t.name}`,
      before: state,
      tags: { growth: 2, driverCare: 0.5, profit: -1 },
      details: {
        driverId,
        driverName: targetDriver.name,
        trainingId,
        trainingName: t.name,
        stat: t.stat,
        cost: trainCost,
      },
    });
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
      s = pushDecisionHistory(s, {
        category: 'risk',
        type: 'INVESTOR_PRESSURE_HOLD_ON',
        label: '投资人压力: 选择硬扛',
        before: state,
        tags: { riskTaking: 2, shortTermism: 1, costControl: -1 },
        details: { choices: c, daysLeft, deficit: plan.deficit },
      });
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
    s = pushDecisionHistory(s, {
      category: 'risk',
      type: 'INVESTOR_PRESSURE_PLAN',
      label: `投资人压力: ${took.length ? took.join(' + ') : '未选择方案'}`,
      before: state,
      tags: {
        costControl: c.fire || c.sell ? 2 : 0,
        driverCare: c.fire ? -2 : 0,
        growth: c.sell ? -1 : 0,
        riskTaking: c.debt ? 2 : 0,
        shortTermism: c.debt || c.fire || c.sell ? 1 : 0,
      },
      details: {
        choices: c,
        took,
        deficit: plan.deficit,
        fireCount: c.fire ? plan.fireDrivers.length : 0,
        sellCount: c.sell ? plan.sellVehicles.length : 0,
        debtPrincipal: c.debt ? plan.debtPrincipal : 0,
        debtRepay: c.debt ? plan.debtRepay : 0,
      },
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
    s = pushDecisionHistory(s, {
      category: ev.eventType === 'scripted' || ev.scripted ? 'scripted-event' : 'event',
      type: 'EVENT_CHOICE',
      label: `事件「${ev.title}」: ${opt.label}`,
      before: state,
      tags: inferEventDecisionTags(ev, opt, eff, eventDetail),
      details: {
        eventId: ev.id,
        eventTitle: ev.title,
        eventTag: ev.tag || '',
        eventType: ev.eventType || '',
        chainId: getEventChainId(ev) || '',
        optionIdx,
        optionLabel: opt.label,
        optionDetail: opt.detail || '',
        choiceKey: opt.choiceKey ?? null,
        effect: eff,
        eventDetail,
      },
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'BUY_VEHICLE',
      label: `购车扩张: ${t.name}`,
      before: state,
      tags: { growth: 2, profit: -1 },
      details: {
        templateId,
        vehicleName: t.name,
        price: t.price,
        autoAssignedDriverId: unassignedDriver?.id || null,
        autoAssignedDriverName: unassignedDriver?.name || '',
      },
    });
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'ASSIGN_VEHICLE',
      label: occupied
        ? `车辆调度: ${driver.name} 与 ${occupied.name} 交换车辆`
        : `车辆调度: ${driver.name} 换上 ${vd.name}`,
      before: state,
      tags: { operations: 1, growth: driver.vehicleId ? 0 : 1 },
      details: {
        driverId,
        driverName: driver.name,
        vehicleId,
        vehicleName: vd.name,
        swappedDriverId: occupied?.id || null,
        swappedDriverName: occupied?.name || '',
      },
    });
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'FIRE_DRIVER',
      label: `解雇司机: ${d.name}`,
      before: state,
      tags: { costControl: 2, driverCare: -3, growth: -1, riskControl: 1 },
      details: {
        driverId,
        driverName: d.name,
        salary: d.salary,
        severance,
        interruptedOrder: d.status === 'driving' && d.currentOrder ? d.currentOrder.orderName : '',
      },
    });
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
    s = pushDecisionHistory(s, {
      category: 'operation',
      type: 'SELL_VEHICLE',
      label: `卖车回款: ${td.name}`,
      before: state,
      tags: { costControl: 2, profit: 1, growth: -1, riskControl: 1 },
      details: {
        vehicleId,
        vehicleName: td.name,
        refund,
      },
    });
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
      const withDecision = pushDecisionHistory(next, {
        category: 'risk',
        type: 'DEBT_CRISIS_BANKRUPT',
        label: '债务危机: 放弃经营并破产结算',
        before: state,
        tags: { riskControl: -2, shortTermism: 2, costControl: -1 },
        details: { totalDue: crisis.totalDue || 0, shortfall: crisis.shortfall || 0 },
      });
      return pushActionHistory(withDecision, {
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
    next = pushDecisionHistory(next, {
      category: 'risk',
      type: 'DEBT_RESTRUCTURE',
      label: '债务危机: 选择重组债务',
      before: state,
      tags: { riskTaking: 2, riskControl: 1, shortTermism: 1 },
      details: {
        debtCount: debts.length,
        oldTotal: totalRepay,
        newTotal: newRepay,
        newPeriodDays,
      },
    });
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
