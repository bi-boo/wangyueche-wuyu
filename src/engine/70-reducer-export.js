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
      case 'PLAYER_STORY_SHOWN': {
        if (!state.activePlayerStory) return state;
        const story = state.activePlayerStory;
        const showTutorialNext = story.id === 'opening_layoff' && !action.skipTutorial;
        const allGateIds = (UI_GATES || []).map((g) => g.id);
        const next = {
          ...state,
          activePlayerStory: null,
          showTutorial: showTutorialNext,
          paused: true,
          unlockedUIGates: action.skipTutorial ? allGateIds : state.unlockedUIGates,
          activeUnlockSplash: action.skipTutorial ? null : state.activeUnlockSplash,
          spotlight: action.skipTutorial ? null : state.spotlight,
        };
        return pushActionHistory(next, {
          category: 'player',
          type: 'PLAYER_STORY_SHOWN',
          label: `玩家看完主线故事: ${story.title}`,
          before: state,
          details: { storyId: story.id, showTutorial: showTutorialNext },
        });
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
        let next = { ...state, gameOver: { type: 'win', endingId: ending.id, endingName: ending.name, endingDesc: ending.desc, stats: snapshotStats(state) } };
        next = pushDecisionHistory(next, {
          category: 'ending',
          type: 'CLAIM_ENDING',
          label: `领取结局: ${ending.name}`,
          before: state,
          tags: { riskControl: 1 },
          details: { endingId: ending.id, tier: ending.tier },
        });
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
        let next = { ...state, gameOver: { type: 'win', endingId: ending.id, endingName: ending.name, endingDesc: ending.desc, stats: snapshotStats(state) } };
        next = pushDecisionHistory(next, {
          category: 'ending',
          type: 'CONCEDE',
          label: `主动结束运营: ${ending.name}`,
          before: state,
          tags: { riskControl: 1, ambition: ending.forceEnd ? 2 : -0.5 },
          details: { endingId: ending.id, tier: ending.tier },
        });
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
        s = pushDecisionHistory(s, {
          category: 'operation',
          type: 'RAISE_DRIVER_SALARY',
          label: `调薪司机: ${driver.name} +${pct}%`,
          before: state,
          tags: {
            driverCare: effect.delta < 0 ? -1 : pct >= 50 ? 3 : 2,
            trustBuilding: effect.delta > 0 || effect.fillMax ? 1 : 0,
            profit: -1,
          },
          details: { driverId, driverName: driver.name, pct, oldSalary, newSalary, loyaltyDelta: effect.delta, fillMax: effect.fillMax },
        });
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
    isMissionAvailable, hasReputationDropStreak,
    getTrainingCost,
    buildHourlySupply,
    gameReducer, makeInitialState,
  };
})();
