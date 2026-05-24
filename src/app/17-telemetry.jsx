const TELEMETRY_SCHEMA_VERSION = 'wycwy-telemetry-v1';
const TELEMETRY_CLIENT_KEY = 'wycwy-telemetry-client-id-v1';
const TELEMETRY_SESSION_KEY = 'wycwy-telemetry-session-id-v1';
const TELEMETRY_PENDING_KEY = 'wycwy-telemetry-pending-v1';
const TELEMETRY_BATCH_ENDPOINT_KEY = 'wycwy-telemetry-batch-endpoint';
const TELEMETRY_SESSION_ENDPOINT_KEY = 'wycwy-telemetry-session-endpoint';
const TELEMETRY_DEFAULT_BATCH_ENDPOINT = 'api/telemetry/batch';
const TELEMETRY_DEFAULT_SESSION_ENDPOINT = 'api/telemetry/session-end';
const TELEMETRY_BATCH_SIZE = 30;
const TELEMETRY_PENDING_LIMIT = 180;
const TELEMETRY_SNAPSHOT_INTERVAL_MS = 30000;
let __telemetryEventCounter = 0;
let __telemetryFlushPromise = Promise.resolve();

function makeTelemetryId(prefix) {
  try {
    if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  } catch (e) {}
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readTelemetryStorage(key, fallback = '') {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}

function writeTelemetryStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {}
}

function getTelemetryClientId() {
  const saved = readTelemetryStorage(TELEMETRY_CLIENT_KEY);
  if (saved) return saved;
  const next = makeTelemetryId('client');
  writeTelemetryStorage(TELEMETRY_CLIENT_KEY, next);
  return next;
}

function getTelemetrySessionId() {
  try {
    const saved = sessionStorage.getItem(TELEMETRY_SESSION_KEY);
    if (saved) return saved;
    const next = makeTelemetryId('session');
    sessionStorage.setItem(TELEMETRY_SESSION_KEY, next);
    return next;
  } catch (e) {
    return makeTelemetryId('session');
  }
}

function getTelemetryBatchEndpoint() {
  return window.WYCWY_TELEMETRY_BATCH_ENDPOINT
    || readTelemetryStorage(TELEMETRY_BATCH_ENDPOINT_KEY)
    || TELEMETRY_DEFAULT_BATCH_ENDPOINT;
}

function getTelemetrySessionEndpoint() {
  return window.WYCWY_TELEMETRY_SESSION_ENDPOINT
    || readTelemetryStorage(TELEMETRY_SESSION_ENDPOINT_KEY)
    || TELEMETRY_DEFAULT_SESSION_ENDPOINT;
}

function shouldSendTelemetry() {
  return location.protocol !== 'file:';
}

function getTelemetryRunId(state) {
  const createdAt = state?.realTime?.createdAt || state?.actionHistory?.[0]?.realTimestamp || Date.now();
  return `run-${createdAt}`;
}

function compactTelemetryValue(value, depth = 0) {
  if (depth >= 7) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === 'string') return value.slice(0, 2400);
  if (type === 'number') return Number.isFinite(value) ? value : null;
  if (type === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, 240).map((item) => compactTelemetryValue(item, depth + 1));
  }
  if (type === 'object') {
    const entries = Object.entries(value).slice(0, 120);
    return entries.reduce((acc, [key, item]) => {
      acc[String(key).slice(0, 80)] = compactTelemetryValue(item, depth + 1);
      return acc;
    }, {});
  }
  return String(value).slice(0, 2400);
}

function buildTelemetryGameState(state) {
  const mission = MISSIONS[state?.currentMissionIdx || 0] || null;
  return {
    day: state?.day || 1,
    hour: state?.hour || 6,
    hasStarted: !!state?.hasStarted,
    paused: !!state?.paused,
    speed: state?.speed || 1,
    funds: state?.funds || 0,
    reputation: state?.reputation || 0,
    drivers: state?.drivers?.length || 0,
    vehicles: state?.vehicles?.length || 0,
    crews: (state?.drivers || []).filter((d) => d.vehicleId).length,
    totalCompleted: state?.totalCompleted || 0,
    totalEarned: state?.totalEarned || 0,
    todayLost: state?.todayLost || 0,
    todayRepLoss: state?.todayRepLoss || 0,
    currentMissionIdx: state?.currentMissionIdx || 0,
    currentMissionId: mission?.id || null,
    currentMissionTitle: mission?.title || null,
    completedMissionIds: state?.completedMissionIds || [],
    unlockedEndingTier: state?.unlockedEndingTier || 0,
    activeModal: getTelemetryActiveModal(state),
    gameOver: state?.gameOver || null,
    realTime: state?.realTime || null,
  };
}

function getTelemetryActiveModal(state) {
  if (!state) return null;
  if (state.gameOver) return 'game_over';
  if (state.debtCrisis) return 'debt_crisis';
  if (state.activePolicyDecision) return 'policy_decision';
  if (state.activeEvent) return 'event';
  if (state.activePlayerStory) return 'player_story';
  if (state.activeStory) return 'driver_story';
  if (state.showMonthlyReport) return 'monthly_report';
  if (state.showTutorial) return 'tutorial';
  if (state.newEndingUnlocked) return 'ending_unlock';
  if (state.activeUnlockSplash) return 'unlock_splash';
  if (state.gachaCards) return 'recruit';
  return null;
}

function buildTelemetryEvent(state, eventType, eventName, payload = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    eventId: `evt-${Date.now()}-${++__telemetryEventCounter}`,
    eventType,
    eventName,
    createdAt: now,
    clientId: getTelemetryClientId(),
    sessionId: getTelemetrySessionId(),
    runId: getTelemetryRunId(state),
    app: {
      version: typeof APP_VERSION === 'string' ? APP_VERSION : 'unknown',
    },
    page: {
      path: location.pathname,
      search: location.search,
      referrer: document.referrer || '',
      visibilityState: document.visibilityState || 'visible',
    },
    game: buildTelemetryGameState(state),
    payload: compactTelemetryValue(payload),
  };
}

function getPendingTelemetryEvents() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TELEMETRY_PENDING_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function setPendingTelemetryEvents(events) {
  try {
    localStorage.setItem(TELEMETRY_PENDING_KEY, JSON.stringify(events.slice(-TELEMETRY_PENDING_LIMIT)));
  } catch (e) {}
}

async function postTelemetryJson(endpoint, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json().catch(() => ({}));
}

function sendTelemetryBeacon(endpoint, body) {
  if (!navigator.sendBeacon) return false;
  try {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    return navigator.sendBeacon(endpoint, blob);
  } catch (e) {
    return false;
  }
}

async function runTelemetryFlush({ beacon = false } = {}) {
  if (!shouldSendTelemetry()) return { ok: false, skipped: true };
  const endpoint = getTelemetryBatchEndpoint();
  const pending = getPendingTelemetryEvents();
  if (!pending.length) return { ok: true, stored: 0 };
  const batch = pending.slice(0, TELEMETRY_BATCH_SIZE);
  const body = { schemaVersion: TELEMETRY_SCHEMA_VERSION, events: batch };
  if (beacon && sendTelemetryBeacon(endpoint, body)) {
    setPendingTelemetryEvents(pending.slice(batch.length));
    return { ok: true, beacon: true, stored: batch.length };
  }
  const result = await postTelemetryJson(endpoint, body);
  setPendingTelemetryEvents(pending.slice(batch.length));
  return result;
}

function flushTelemetryEvents(options = {}) {
  const run = __telemetryFlushPromise.then(() => runTelemetryFlush(options), () => runTelemetryFlush(options));
  __telemetryFlushPromise = run.catch(() => {});
  return run;
}

function enqueueTelemetryEvents(events, { flush = false, beacon = false } = {}) {
  const list = Array.isArray(events) ? events.filter(Boolean) : [events].filter(Boolean);
  if (!list.length) return;
  const pending = [...getPendingTelemetryEvents(), ...list].slice(-TELEMETRY_PENDING_LIMIT);
  setPendingTelemetryEvents(pending);
  if (flush) {
    flushTelemetryEvents({ beacon }).catch(() => {});
  }
}

function buildTelemetrySessionSummary(state, reason = 'session_end') {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    reason,
    createdAt: new Date().toISOString(),
    clientId: getTelemetryClientId(),
    sessionId: getTelemetrySessionId(),
    runId: getTelemetryRunId(state),
    app: {
      version: typeof APP_VERSION === 'string' ? APP_VERSION : 'unknown',
    },
    page: {
      path: location.pathname,
      search: location.search,
      visibilityState: document.visibilityState || 'visible',
    },
    game: buildTelemetryGameState(state),
    actionHistory: compactTelemetryValue((state?.actionHistory || []).slice(0, 600)),
    decisionHistory: compactTelemetryValue((state?.decisionHistory || []).slice(0, 400)),
    diagnosticsLatest: compactTelemetryValue((state?.diagnostics || []).slice(-240)),
    log: compactTelemetryValue((state?.log || []).slice(0, 160)),
  };
}

function sendTelemetrySessionEnd(state, reason = 'session_end', { beacon = false } = {}) {
  if (!shouldSendTelemetry()) return;
  const endpoint = getTelemetrySessionEndpoint();
  const body = { session: buildTelemetrySessionSummary(state, reason) };
  if (beacon && sendTelemetryBeacon(endpoint, body)) return;
  postTelemetryJson(endpoint, body).catch(() => {});
}

function usePlayerTelemetry(state) {
  const stateRef = useRef(state);
  const runIdRef = useRef(null);
  const lastActionIdRef = useRef(0);
  const lastDecisionIdRef = useRef(0);
  const endedRunIdsRef = useRef(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const runId = getTelemetryRunId(state);
    if (runIdRef.current !== runId) {
      runIdRef.current = runId;
      lastActionIdRef.current = 0;
      lastDecisionIdRef.current = 0;
      enqueueTelemetryEvents(buildTelemetryEvent(state, 'session', 'session_start', {
        source: 'new_run',
      }), { flush: true });
    }

    const nextEvents = [];
    const actions = [...(state.actionHistory || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
    actions.forEach((entry) => {
      if ((entry.id || 0) <= lastActionIdRef.current) return;
      nextEvents.push(buildTelemetryEvent(state, 'action', entry.type || 'UNKNOWN_ACTION', entry));
      lastActionIdRef.current = Math.max(lastActionIdRef.current, entry.id || 0);
    });

    const decisions = [...(state.decisionHistory || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
    decisions.forEach((entry) => {
      if ((entry.id || 0) <= lastDecisionIdRef.current) return;
      nextEvents.push(buildTelemetryEvent(state, 'decision', entry.type || 'UNKNOWN_DECISION', entry));
      lastDecisionIdRef.current = Math.max(lastDecisionIdRef.current, entry.id || 0);
    });

    if (nextEvents.length) enqueueTelemetryEvents(nextEvents, { flush: true });
  }, [state?.actionHistory, state?.decisionHistory, state?.realTime?.createdAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      enqueueTelemetryEvents(buildTelemetryEvent(current, 'snapshot', 'periodic_state', {
        snapshotReason: 'interval',
      }), { flush: true });
    }, TELEMETRY_SNAPSHOT_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePageEnd = () => {
      const current = stateRef.current;
      if (!current) return;
      enqueueTelemetryEvents(buildTelemetryEvent(current, 'session', 'page_end', {
        reason: document.visibilityState === 'hidden' ? 'visibility_hidden' : 'pagehide',
      }), { flush: true, beacon: true });
      sendTelemetrySessionEnd(current, 'page_end', { beacon: true });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') handlePageEnd();
    };
    window.addEventListener('pagehide', handlePageEnd);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!state?.gameOver) return;
    const runId = getTelemetryRunId(state);
    if (endedRunIdsRef.current.has(runId)) return;
    endedRunIdsRef.current.add(runId);
    enqueueTelemetryEvents(buildTelemetryEvent(state, 'session', 'game_over', {
      gameOver: state.gameOver,
    }), { flush: true });
    sendTelemetrySessionEnd(state, 'game_over');
  }, [state?.gameOver, state?.realTime?.createdAt]);

  const trackUiEvent = (eventName, payload = {}, { flush = false } = {}) => {
    const current = stateRef.current;
    if (!current) return;
    enqueueTelemetryEvents(buildTelemetryEvent(current, 'ui', eventName, payload), { flush });
  };

  return {
    trackUiEvent,
    flush: () => flushTelemetryEvents({ beacon: false }),
    sendSessionEnd: (reason = 'manual') => sendTelemetrySessionEnd(stateRef.current, reason),
  };
}
