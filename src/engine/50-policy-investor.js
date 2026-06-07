  // === V15: 政策事件框架(按游戏绝对时间触发的链式黑天鹅事件) ===
  // 设计抽象为可扩展结构,V1 只填监管整改一个事件。
  // 详见「docs/监管整改机制设计-V1.md」。

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
    s = pushDecisionHistory(s, {
      category: 'risk',
      type: 'INVESTOR_REVIEW_ACK',
      label: `投资人扩张提醒: ${ev.title}`,
      before: state,
      tags: stage === 'early_final'
        ? { growth: -1, riskControl: -1, shortTermism: 1 }
        : { riskControl: 0.5 },
      details: {
        stage,
        eventId: ev.id,
        fee,
        feeLabel,
        targetCrews: ev.investorReviewTargetCrews || INVESTOR_REVIEW?.targetCrews || 0,
        currentCrews: getOperatingCrewCount(s),
        deadlineDay: s.investorReviewDeadlineDay || null,
      },
    });
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
    s = pushDecisionHistory(s, {
      category: 'policy',
      type: 'POLICY_DECISION',
      label: choiceId === 'A' ? '监管决策: 先补齐车队材料' : '监管决策: 先抢扩张窗口期',
      before: state,
      tags: choiceId === 'A'
        ? { compliance: 3, riskControl: 2, profit: -1, growth: -0.5 }
        : { growth: 2, riskTaking: 2, compliance: -1, profit: extraToggles?.loan ? 1 : 0 },
      details: {
        eventId: apd.eventId,
        stage: apd.stage,
        choiceId,
        extraToggles: extraToggles || {},
        refMonthlyRevenue: r0,
        fundsDelta: delta,
        decision: s.policyState?.govBan?.decision || '',
        loanTaken: !!s.policyState?.govBan?.loanTaken,
        loanAmount: s.policyState?.govBan?.loanAmount || 0,
      },
    });
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
