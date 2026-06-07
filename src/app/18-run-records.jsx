const APP_VERSION = 'V15.42d';
const RUN_HISTORY_KEY = 'wycwy-run-history-v1';
const CURRENT_RUN_KEY = 'wycwy-current-run-v1';
const AUTOSAVE_KEY = 'wycwy-autosave-v1';
const RUN_HISTORY_LIMIT = 20;
const DECISION_TAG_META = {
  profit: { label: '利润优先', polarity: 'business' },
  driverCare: { label: '照顾司机', polarity: 'people' },
  trustBuilding: { label: '长期忠诚', polarity: 'people' },
  compliance: { label: '合规底线', polarity: 'risk' },
  riskTaking: { label: '冒险扩张', polarity: 'risk' },
  growth: { label: '扩张投入', polarity: 'business' },
  reputationFirst: { label: '口碑优先', polarity: 'public' },
  costControl: { label: '成本控制', polarity: 'business' },
  shortTermism: { label: '短期止血', polarity: 'risk' },
  riskControl: { label: '风险控制', polarity: 'risk' },
  operations: { label: '运营调度', polarity: 'business' },
  ambition: { label: '终局野心', polarity: 'business' },
};

function isoOrNull(ms) {
  return ms ? new Date(ms).toISOString() : null;
}

function computeGameHoursElapsedForState(state) {
  return Math.max(0, ((state.day || 1) - 1) * 24 + ((state.hour || 6) - 6));
}

function isRealTimeRunningForState(state) {
  return !!state.hasStarted
    && !state.paused
    && !state.activeEvent
    && !state.activePlayerStory
    && !state.activeStory
    && !state.showTutorial
    && !state.showMonthlyReport
    && !state.debtCrisis
    && !state.gameOver;
}

function buildRealTimePayload(state, exportedAtMs) {
  const rt = state.realTime || {};
  const startedAt = rt.startedAt || null;
  const lastUpdatedAt = rt.lastUpdatedAt || exportedAtMs;
  const liveDelta = startedAt ? Math.max(0, exportedAtMs - lastUpdatedAt) : 0;
  const totalElapsedMs = (rt.totalElapsedMs || 0) + liveDelta;
  const activeElapsedMs = (rt.activeElapsedMs || 0) + (isRealTimeRunningForState(state) ? liveDelta : 0);
  const inactiveElapsedMs = Math.max(0, totalElapsedMs - activeElapsedMs);
  const gameHoursElapsed = computeGameHoursElapsedForState(state);
  const tickMs = GAME.TICK_MS || 2000;
  return {
    createdAt: isoOrNull(rt.createdAt),
    startedAt: isoOrNull(startedAt),
    lastUpdatedAt: isoOrNull(lastUpdatedAt),
    exportedAt: isoOrNull(exportedAtMs),
    totalElapsedMs: Math.round(totalElapsedMs),
    activeElapsedMs: Math.round(activeElapsedMs),
    inactiveElapsedMs: Math.round(inactiveElapsedMs),
    gameHoursElapsed,
    gameDaysElapsed: Number((gameHoursElapsed / 24).toFixed(2)),
    averageEffectiveSpeed: activeElapsedMs > 0
      ? Number(((gameHoursElapsed * tickMs) / activeElapsedMs).toFixed(2))
      : 0,
  };
}

function normalizeDecisionHistoryForAnalysis(history = []) {
  return [...(history || [])]
    .sort((a, b) => (a.day - b.day) || (a.hour - b.hour) || (a.id - b.id));
}

function buildDecisionValueProfile(history = []) {
  const totals = {};
  const counts = {};
  (history || []).forEach((entry) => {
    Object.keys(entry.tags || {}).forEach((key) => {
      const value = Number(entry.tags[key] || 0);
      if (!value) return;
      totals[key] = (totals[key] || 0) + value;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  const axes = Object.keys(totals)
    .map((key) => ({
      key,
      label: DECISION_TAG_META[key]?.label || key,
      score: Number(totals[key].toFixed(1)),
      count: counts[key] || 0,
      polarity: DECISION_TAG_META[key]?.polarity || 'other',
    }))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return {
    totalDecisions: history.length,
    axes,
    dominant: axes.slice(0, 5),
  };
}

function getDecisionImportance(entry) {
  const tagWeight = Object.values(entry.tags || {}).reduce((sum, val) => sum + Math.abs(Number(val || 0)), 0);
  const diff = entry.diff || {};
  const moneyWeight = diff.funds ? Math.min(4, Math.abs((diff.funds.after || 0) - (diff.funds.before || 0)) / 5000) : 0;
  const reputationWeight = diff.reputation ? Math.min(3, Math.abs((diff.reputation.after || 0) - (diff.reputation.before || 0)) / 10) : 0;
  const categoryWeight = ['risk', 'policy', 'ending'].includes(entry.category) ? 3 : entry.category === 'event' ? 2 : 0;
  return tagWeight + moneyWeight + reputationWeight + categoryWeight;
}

function compactDecisionEntry(entry) {
  return {
    id: entry.id,
    day: entry.day,
    hour: entry.hour,
    category: entry.category,
    type: entry.type,
    label: entry.label,
    tags: entry.tags || {},
    details: entry.details || {},
    before: entry.before,
    after: entry.after,
    diff: entry.diff || {},
  };
}

function pickKeyDecisionsForAnalysis(history = [], limit = 24) {
  return [...history]
    .map((entry) => ({ entry, score: getDecisionImportance(entry) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry)
    .sort((a, b) => (a.day - b.day) || (a.hour - b.hour) || (a.id - b.id))
    .map(compactDecisionEntry);
}

function buildGameDiagnosticsPayload(state, extra = {}) {
  const exportedAtMs = Date.now();
  const realTime = buildRealTimePayload(state, exportedAtMs);
  const decisionHistory = state.decisionHistory || [];
  const decisionValueProfile = buildDecisionValueProfile(decisionHistory);
  return {
    exportedAt: new Date(exportedAtMs).toISOString(),
    version: APP_VERSION,
    ...extra,
    summary: {
      day: state.day,
      hour: state.hour,
      paused: state.paused,
      funds: state.funds,
      reputation: state.reputation,
      hasStarted: state.hasStarted,
      drivers: state.drivers.length,
      vehicles: state.vehicles.length,
      crews: state.drivers.filter((d) => d.vehicleId).length,
      todayLost: state.todayLost,
      todayRepLoss: state.todayRepLoss,
      currentMissionIdx: state.currentMissionIdx,
      currentMission: MISSIONS[state.currentMissionIdx]?.title || null,
      completedMissionIds: state.completedMissionIds || [],
      unlockedEndingTier: state.unlockedEndingTier,
      gameOver: state.gameOver,
      debtAmount: E.getDebtSummary ? E.getDebtSummary(state).totalRepay : state.debtAmount,
      debtDueDay: E.getDebtSummary ? E.getDebtSummary(state).nextDueDay : state.debtDueDay,
      debts: E.getDebtSummary ? E.getDebtSummary(state).debts : (state.debts || []),
      debtCrisis: state.debtCrisis || null,
      negFundsDays: state.negFundsDays,
      bankruptcyGraceBonus: state.bankruptcyGraceBonus,
      totalCompleted: state.totalCompleted,
      totalEarned: state.totalEarned,
      realTime,
    },
    realTime,
    drivers: state.drivers.map((d) => ({
      id: d.id, name: d.name, bg: d.bg, bgName: d.bgName, rarity: d.rarity,
      stats: d.stats, statCaps: d.statCaps, salary: d.salary,
      loyalty: d.loyalty,
      vehicleId: d.vehicleId, completedOrders: d.completedOrders,
      goodReviews: d.goodReviews, badReviews: d.badReviews,
      rating: d.rating, totalEarned: d.totalEarned,
    })),
    vehicles: state.vehicles.map((v) => ({
      id: v.id, templateId: v.templateId,
    })),
    monthly: {
      monthCounter: state.monthCounter,
      earnedGross: state.monthlyEarnedGross || 0,
      commission: state.monthlyCommission || 0,
      salary: state.monthlySalary || 0,
      debtPaid: state.monthlyDebtPaid || 0,
      severance: state.monthlySeverance || 0,
      eventImpact: state.monthlyEventImpact || 0,
      eventItems: state.monthlyEventItems || [],
      driverData: state.monthlyDriverData || {},
      report: state.showMonthlyReport || null,
    },
    diagnosticsLatest: state.diagnostics || [],  // 最近 720 tick = 30 游戏日
    actionHistory: state.actionHistory || [],    // 结构化复盘日志:玩家操作 + 关键数值变化
    decisionHistory,
    decisionValueProfile,
    log: state.log || [],
    notifications: state.notifications || [],
  };
}

function buildRunAnalysisPayload(state) {
  const diagnostics = buildGameDiagnosticsPayload(state, { savedReason: state.gameOver ? 'game-over-ai-review' : 'current-ai-review' });
  const chronologicalDecisions = normalizeDecisionHistoryForAnalysis(diagnostics.decisionHistory || []);
  return {
    schemaVersion: 'wycwy-ai-review-v1',
    exportedAt: diagnostics.exportedAt,
    version: diagnostics.version,
    reviewLanguage: 'zh-CN',
    reviewTone: 'objective_sharp',
    gameResult: {
      type: state.gameOver?.type || 'in_progress',
      deathCause: state.gameOver?.deathCause || null,
      endingId: state.gameOver?.endingId || null,
      endingName: state.gameOver?.endingName || null,
      reason: state.gameOver?.reason || state.gameOver?.endingDesc || '',
    },
    summary: diagnostics.summary,
    valueProfile: diagnostics.decisionValueProfile,
    keyDecisions: pickKeyDecisionsForAnalysis(chronologicalDecisions),
    decisions: chronologicalDecisions.slice(-180).map(compactDecisionEntry),
    drivers: diagnostics.drivers,
    vehicles: diagnostics.vehicles,
    monthly: diagnostics.monthly,
    finalLog: (diagnostics.log || []).slice(0, 80).reverse(),
  };
}

// V12.2: 导出诊断数据 — 玩家卡住时点这个按钮下载 JSON,提交给开发者分析
function exportGameDiagnostics(state) {
  const payload = buildGameDiagnosticsPayload(state);
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `wycwy-diagnostics-day${state.day}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildRunRecord(state, { savedReason = 'game-over', idPrefix = 'run' } = {}) {
  const payload = buildGameDiagnosticsPayload(state, { savedReason });
  const isGameOver = !!state.gameOver;
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    exportedAt: payload.exportedAt,
    savedAt: payload.exportedAt,
    version: APP_VERSION,
    result: isGameOver ? (state.gameOver?.type || 'unknown') : 'in_progress',
    deathCause: state.gameOver?.deathCause || null,
    reason: state.gameOver?.reason || state.gameOver?.endingName || '当前运营中',
    summary: payload.summary,
    drivers: payload.drivers,
    vehicles: payload.vehicles,
    monthly: payload.monthly,
    realTime: payload.realTime,
    decisionValueProfile: payload.decisionValueProfile,
    decisionHistory: (payload.decisionHistory || []).slice(0, 300),
    diagnosticsLatest: (payload.diagnosticsLatest || []).slice(-240),
    actionHistory: (payload.actionHistory || []).slice(0, 300),
    log: (payload.log || []).slice(0, 120),
    notifications: payload.notifications || [],
  };
}

function getSavedRunHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RUN_HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function getSavedCurrentRun() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CURRENT_RUN_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch (e) {}
}

function clearCurrentRunRecord() {
  try {
    localStorage.removeItem(CURRENT_RUN_KEY);
  } catch (e) {}
}

function saveCurrentRunRecord(state) {
  if (!state || state.gameOver || !state.hasStarted) return null;
  const record = buildRunRecord(state, { savedReason: 'current-run', idPrefix: 'current-run' });
  try {
    localStorage.setItem(CURRENT_RUN_KEY, JSON.stringify(record));
    window.__WYCWY_CURRENT_RUN_RECORD = record;
    return record;
  } catch (e) {
    console.warn('[WYCWY] current run save failed', e);
    return null;
  }
}

function saveRunRecord(state) {
  if (!state?.gameOver) return null;
  const record = buildRunRecord(state);
  try {
    const history = getSavedRunHistory();
    const next = [record, ...history].slice(0, RUN_HISTORY_LIMIT);
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(next));
    clearAutosave();
    clearCurrentRunRecord();
    window.__WYCWY_LAST_RUN_RECORD = record;
    return record;
  } catch (e) {
    console.warn('[WYCWY] run history save failed', e);
    return null;
  }
}
