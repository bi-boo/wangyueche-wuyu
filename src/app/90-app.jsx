function App() {
  const [state, dispatch] = useReducer(E.gameReducer, null, () => {
    const autosave = getSavedAutosave();
    return autosave?.state
      ? (E.hydrateAutosaveState(autosave.state) || E.makeInitialState())
      : E.makeInitialState();
  });
  const savedGameOverKeyRef = useRef(null);
  const lastCurrentRunSaveRef = useRef(0);
  const lastAutosaveRef = useRef(0);
  const latestStateRef = useRef(state);
  // V12.2: 暴露给测试脚本(Playwright)用,生产可见但只读取/写入,无 UI 影响
  // V14.89: 加 requestConfirm 暴露,方便 ConfirmModal 视觉验证
  window.__WYCWY_TEST = {
    dispatch,
    state,
    exportGameDiagnostics,
    getSavedRunHistory,
    getSavedCurrentRun,
    getSavedAutosave,
    saveRunRecord,
    saveCurrentRunRecord,
    saveAutosave,
    clearAutosave,
    clearCurrentRunRecord,
    get requestConfirm() { return requestConfirm; },
  };
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [mobileTab, setMobileTab] = useState('city');
  const [showRecruit, setShowRecruit] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('details');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState('missions');
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const [resumeAfterPauseMenu, setResumeAfterPauseMenu] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [configUpdated, setConfigUpdated] = useState(false);
  // V14.89: ConfirmModal 替代 native confirm()
  const [confirmOpts, setConfirmOpts] = useState(null);
  const requestConfirm = (opts) => setConfirmOpts(opts);

  // V5: 监听 admin 后台的配置变化(跨 tab 通讯)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const ch = new BroadcastChannel('wycwy-config');
    ch.onmessage = (ev) => {
      if (ev.data?.type === 'config-update') setConfigUpdated(true);
    };
    return () => ch.close();
  }, []);
  const [crtOn, setCrtOn] = useState(() => {
    if (localStorage.getItem('wycwy-visual-version') !== 'v10.3') {
      localStorage.setItem('wycwy-visual-version', 'v10.3');
      localStorage.setItem('wycwy-crt', '0');
      return false;
    }
    return localStorage.getItem('wycwy-crt') === '1';
  });
  // 上一次的关键状态 — 用于差分触发 sfx
  const prevRef = useRef({
    completedTotal: 0,
    trainings: 0,
    vehicles: state.vehicles.length,
    drivers: state.drivers.length,
  });

  useEffect(() => {
    if (!state.gameOver) return;
    const key = [
      state.gameOver.type,
      state.gameOver.deathCause || state.gameOver.endingId || state.gameOver.endingName || 'unknown',
      state.day,
      state.hour,
      state.funds,
      state.totalCompleted,
    ].join('|');
    if (savedGameOverKeyRef.current === key) return;
    savedGameOverKeyRef.current = key;
    saveRunRecord(state);
  }, [state.gameOver, state.day, state.hour, state.funds, state.totalCompleted]);

  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!state.hasStarted || state.gameOver) return;
    const now = Date.now();
    if (now - lastAutosaveRef.current < 2500) return;
    lastAutosaveRef.current = now;
    saveAutosave(state);
  }, [
    state.hasStarted,
    state.gameOver,
    state.day,
    state.hour,
    state.funds,
    state.reputation,
    state.totalCompleted,
    state.totalEarned,
    state.currentMissionIdx,
    state.drivers.length,
    state.vehicles.length,
    state.paused,
  ]);

  useEffect(() => {
    const saveLatest = () => saveAutosave(latestStateRef.current);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveLatest();
    };
    window.addEventListener('pagehide', saveLatest);
    window.addEventListener('beforeunload', saveLatest);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', saveLatest);
      window.removeEventListener('beforeunload', saveLatest);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!state.hasStarted || state.gameOver) return;
    const now = Date.now();
    if (now - lastCurrentRunSaveRef.current < 2500) return;
    lastCurrentRunSaveRef.current = now;
    saveCurrentRunRecord(state);
  }, [
    state.hasStarted,
    state.gameOver,
    state.day,
    state.hour,
    state.funds,
    state.reputation,
    state.totalCompleted,
    state.totalEarned,
    state.currentMissionIdx,
    state.drivers.length,
    state.vehicles.length,
  ]);

  // V15: 8× 自适应空白压缩 — 上一 tick 无完单/无日切/无剧情/口碑无变化时,下次间隔压到 50ms;
  // 有事则保持 250ms。其他档位维持固定间隔行为不变。
  const lastTickSnapshotRef = useRef(null);
  useEffect(() => {
    if (state.paused || state.activeEvent || state.activePolicyDecision || state.activeStory || state.showTutorial || state.gameOver) {
      lastTickSnapshotRef.current = null;
      return;
    }
    const prev = lastTickSnapshotRef.current;
    const eventful = !prev
      || prev.totalCompleted !== state.totalCompleted
      || prev.day !== state.day
      || prev.reputation !== state.reputation
      || prev.activeStory !== !!state.activeStory;
    lastTickSnapshotRef.current = {
      totalCompleted: state.totalCompleted,
      day: state.day,
      reputation: state.reputation,
      activeStory: !!state.activeStory,
    };
    const baseInterval = GAME.TICK_MS / state.speed;
    const interval = (state.speed === 8 && !eventful) ? 50 : baseInterval;
    const t = setTimeout(() => dispatch({type: 'TICK'}), interval);
    return () => clearTimeout(t);
  }, [state.paused, state.speed, state.activeEvent, state.activePolicyDecision, state.activeStory, state.showTutorial, state.gameOver, state.hour, state.day, state.totalCompleted, state.reputation]);

  useEffect(() => {
    if (!selectedZoneId) return;
    if (!ZONES.some((z) => z.id === selectedZoneId)) setSelectedZoneId(null);
  }, [selectedZoneId]);

  // V14.67: 用 ref 跟踪已经 schedule 过清理的 id,避免 length 不变时漏清理或重复 schedule。
  const scheduledFloatGainsRef = useRef(new Set());
  useEffect(() => {
    state.floatGains.forEach((g) => {
      if (scheduledFloatGainsRef.current.has(g.id)) return;
      scheduledFloatGainsRef.current.add(g.id);
      setTimeout(() => {
        scheduledFloatGainsRef.current.delete(g.id);
        dispatch({type: 'CLEAR_FLOAT_GAIN', id: g.id});
      }, 1700);
    });
  }, [state.floatGains]);

  const scheduledNotifsRef = useRef(new Set());
  useEffect(() => {
    state.notifications.forEach((n) => {
      if (scheduledNotifsRef.current.has(n.id)) return;
      scheduledNotifsRef.current.add(n.id);
      setTimeout(() => {
        scheduledNotifsRef.current.delete(n.id);
        dispatch({type: 'CLEAR_NOTIF', id: n.id});
      }, 3000);
    });
  }, [state.notifications]);

  // CRT toggle
  useEffect(() => {
    document.body.classList.toggle('crt-on', crtOn);
    localStorage.setItem('wycwy-crt', crtOn ? '1' : '0');
  }, [crtOn]);

  // 音效触发(差分检测)
  useEffect(() => {
    const p = prevRef.current;
    if (state.totalCompleted > p.completedTotal) SFX.complete({ speed: state.speed || 1 });
    if ((state.totalTrainings || 0) > p.trainings) SFX.train();
    if (state.vehicles.length > p.vehicles || state.drivers.length > p.drivers) SFX.buy();
    prevRef.current = {
      completedTotal: state.totalCompleted,
      trainings: state.totalTrainings || 0,
      vehicles: state.vehicles.length,
      drivers: state.drivers.length,
    };
  }, [state.totalCompleted, state.totalTrainings, state.vehicles.length, state.drivers.length, state.speed]);

  // 任务完成 → 非阻塞提示。V14.28 起取消全屏闪光,避免任务卡出现时整屏白闪。
  useEffect(() => {
    if (state.newMissionComplete) {
      SFX.mission();
    }
  }, [state.newMissionComplete]);

  // 通知警告音 — V14.67: 仅在出现新的 warn 通知时触发,避免清理通知导致 length 变化时误响。
  const lastWarnIdRef = useRef(null);
  useEffect(() => {
    const lastWarn = [...state.notifications].reverse().find((n) => n.level === 'warn');
    if (lastWarn && lastWarn.id !== lastWarnIdRef.current) {
      lastWarnIdRef.current = lastWarn.id;
      SFX.warn();
    }
  }, [state.notifications]);

  // 滚动数字
  const fundsDisplay = useCountUp(state.funds, 350);
  const repDisplay = useCountUp(state.reputation, 300);

  const selectedDriver = state.drivers.find((d) => d.id === selectedDriverId);
  const selectedVehicle = state.vehicles.find((v) => v.id === selectedVehicleId);
  const selectedVehicleDriver = selectedVehicle ? state.drivers.find((d) => d.vehicleId === selectedVehicle.id) : null;
  const selectedCrewDriver = selectedDriver || selectedVehicleDriver;
  const selectedCrewVehicle = selectedDriver
    ? state.vehicles.find((v) => v.id === selectedDriver.vehicleId)
    : selectedVehicle;
  const selectedZone = ZONES.find((z) => z.id === selectedZoneId);
  // V14.9: dispatchOffers 已删除,不再 derive selectedZoneOffers
  const hasFinaleMissionNotice = !!state.newMissionComplete?.reward?.isFinale;
  const showFeedbackStack = !!state.newMissionComplete && !hasFinaleMissionNotice;

  // V14.34: 右侧调度台默认落到可操作车组,避免长期显示"从左侧选择车组"空状态。
  useEffect(() => {
    if (selectedZoneId || inspectorTab === 'log') return;
    const driverStillExists = selectedDriverId && state.drivers.some((d) => d.id === selectedDriverId);
    const vehicleStillExists = selectedVehicleId && state.vehicles.some((v) => v.id === selectedVehicleId);
    if (driverStillExists || vehicleStillExists) return;

    const fallbackDriver = state.drivers.find((d) =>
      d.vehicleId && state.vehicles.some((v) => v.id === d.vehicleId)
    ) || state.drivers[0];
    if (fallbackDriver) {
      setSelectedVehicleId(null);
      setSelectedDriverId(fallbackDriver.id);
      return;
    }

    const fallbackVehicle = state.vehicles[0];
    if (fallbackVehicle) {
      setSelectedDriverId(null);
      setSelectedVehicleId(fallbackVehicle.id);
    }
  }, [selectedZoneId, inspectorTab, selectedDriverId, selectedVehicleId, state.drivers, state.vehicles]);

  const toggleMute = () => {
    const v = !muted;
    setMutedState(v);
    setMuted(v);
    if (!v) SFX.click();
  };
  const toggleCrt = () => {
    setCrtOn((v) => !v);
    SFX.click();
  };
  const selectZone = (zoneId) => {
    setSelectedZoneId(zoneId);
    setSelectedDriverId(null);
    setSelectedVehicleId(null);
    setInspectorTab('details');
    setMobileTab('inspector');
  };

  const resetUiSelection = () => {
    setSelectedDriverId(null);
    setSelectedVehicleId(null);
    setSelectedZoneId(null);
    setInspectorTab('details');
  };

  const openRoadmap = (tab = 'missions') => {
    setRoadmapInitialTab(tab);
    setShowRoadmap(true);
  };

  const closePauseMenu = ({ resume = null } = {}) => {
    setShowPauseMenu(false);
    const shouldResume = resume === null ? resumeAfterPauseMenu : resume;
    if (shouldResume && state.hasStarted && state.paused && !state.gameOver) {
      dispatch({ type: 'SET_SPEED', speed: state.speed || 1 });
    }
    setResumeAfterPauseMenu(false);
  };

  const openPauseMenu = () => {
    if (!state.paused && !state.gameOver) {
      dispatch({ type: 'TOGGLE_PAUSE' });
      setResumeAfterPauseMenu(true);
    } else {
      setResumeAfterPauseMenu(false);
    }
    setShowPauseMenu(true);
  };

  const loadAutosaveFromMenu = () => {
    const autosave = getSavedAutosave();
    if (!autosave?.state) return;
    const loadNow = () => {
      dispatch({ type: 'LOAD_AUTOSAVE', state: autosave.state });
      resetUiSelection();
      setShowPauseMenu(false);
      setResumeAfterPauseMenu(false);
    };
    const progressed = state.hasStarted || state.totalCompleted > 0 || state.totalEarned > 0 || state.day > 1 || state.hour !== 6;
    if (progressed) {
      setShowPauseMenu(false);
      setResumeAfterPauseMenu(false);
      requestConfirm({
        tag: '载入存档',
        title: '载入最近自动存档？',
        message: '当前画面中的进度会被最近自动存档替换。这个操作不会删除运营记录。',
        confirmLabel: '载入存档',
        onConfirm: loadNow,
      });
      return;
    }
    loadNow();
  };

  const startNewGameFromMenu = () => {
    setShowPauseMenu(false);
    setResumeAfterPauseMenu(false);
    requestConfirm({
      tag: '开始新游戏',
      title: '确认开始新游戏？',
      message: '当前可继续的自动存档会被清空,运营记录会保留。',
      confirmLabel: '开始新游戏',
      danger: true,
      onConfirm: () => {
        clearAutosave();
        clearCurrentRunRecord();
        resetUiSelection();
        setShowPauseMenu(false);
        setResumeAfterPauseMenu(false);
        dispatch({ type: 'RESET' });
      },
    });
  };

  useEffect(() => {
    const closeUtilityModal = () => {
      if (showShop) { setShowShop(false); return true; }
      if (showRoadmap) { setShowRoadmap(false); return true; }
      if (showRecruit || state.gachaCards) {
        setShowRecruit(false);
        if (state.gachaCards) dispatch({ type: 'GACHA_CANCEL' });
        return true;
      }
      if (state.showTutorial) {
        dispatch({ type: 'CLOSE_TUTORIAL' });
        return true;
      }
      return false;
    };
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      event.preventDefault();
      if (confirmOpts || state.activeEvent || state.activePolicyDecision || state.activeStory || state.showMonthlyReport || state.newEndingUnlocked || state.gameOver) return;
      if (showPauseMenu) {
        closePauseMenu({ resume: true });
        return;
      }
      if (closeUtilityModal()) return;
      openPauseMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    confirmOpts,
    showPauseMenu,
    resumeAfterPauseMenu,
    showShop,
    showRoadmap,
    showRecruit,
    state.gachaCards,
    state.showTutorial,
    state.activeEvent,
    state.activePolicyDecision,
    state.activeStory,
    state.showMonthlyReport,
    state.newEndingUnlocked,
    state.gameOver,
    state.paused,
    state.hasStarted,
    state.speed,
  ]);

  return (
    <>
      <TopBar
        state={state}
        fundsDisplay={fundsDisplay}
        repDisplay={repDisplay}
        onOpenPauseMenu={openPauseMenu}
      />
      <div className={`main-v3 mobile-${mobileTab}`}>
        <div className="col fleet-col">
          <FleetPanel
            state={state}
            selectedDriverId={selectedDriverId}
            selectedVehicleId={selectedVehicleId}
            selectedVehicle={selectedVehicle}
            selectedDriver={selectedDriver}
            onSelectDriver={(driverId) => { setSelectedZoneId(null); setSelectedVehicleId(null); setSelectedDriverId(driverId); setInspectorTab('details'); setMobileTab('inspector'); }}
            onSelectVehicle={(vehicleId) => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(vehicleId); setInspectorTab('details'); setMobileTab('inspector'); }}
            onClearSelection={() => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(null); }}
            onRecruit={() => setShowRecruit(true)}
            onShop={() => setShowShop(true)}
            onOpenRoadmap={() => openRoadmap('missions')}
          />
        </div>

        <div className="col ops-col">
          <div className="panel city-panel">
            <div className="panel-header">
              <span className="panel-title">城市订单地图</span>
              <span className="panel-sub">片区自动匹配 · 小车显示订单去向</span>
            </div>
            <div className="city-wrap">
              <CityMap
                zones={ZONES}
                drivers={state.drivers}
                hour={state.hour}
                state={state}
                selectedZoneId={selectedZoneId}
                onSelectZone={selectZone}
              />
              <RunControlsFloating state={state} dispatch={dispatch} requestConfirm={requestConfirm} />
            </div>
          </div>
        </div>

        <div className="col inspector-col">
          <div className="inspector-tab-shell">
            <InspectorTabs active={inspectorTab} onChange={setInspectorTab} />
            {inspectorTab === 'log' ? (
              <LogInspector state={state} />
            ) : selectedZone ? (
              <ZoneInspector
                zone={selectedZone}
                state={state}
                onClose={() => setSelectedZoneId(null)}
              />
            ) : (selectedCrewDriver || selectedCrewVehicle) ? (
              <CrewInspector
                driver={selectedCrewDriver}
                vehicle={selectedCrewVehicle}
                drivers={state.drivers}
                vehicles={state.vehicles}
                dispatch={dispatch}
                funds={state.funds}
                requestConfirm={requestConfirm}
                onSelectVehicle={(vid) => { setSelectedDriverId(null); setSelectedVehicleId(vid); setInspectorTab('details'); }}
                onSelectDriver={(did) => { setSelectedVehicleId(null); setSelectedDriverId(did); setInspectorTab('details'); }}
              />
            ) : (
              <InspectorEmpty state={state} />
            )}
          </div>
        </div>
      </div>

      <div className="mobile-tabs" role="tablist" aria-label="游戏主区域">
        <button className={mobileTab === 'fleet' ? 'active' : ''} onClick={() => setMobileTab('fleet')}>车队</button>
        <button className={mobileTab === 'city' ? 'active' : ''} onClick={() => setMobileTab('city')}>城市</button>
        <button className={mobileTab === 'inspector' ? 'active' : ''} onClick={() => setMobileTab('inspector')}>调度</button>
      </div>

      {state.showTutorial && <Tutorial onClose={() => dispatch({type: 'CLOSE_TUTORIAL'})} />}
      {state.activeEvent && <EventModal event={state.activeEvent} state={state}
        onResolve={(idx) => dispatch({type: 'RESOLVE_EVENT', optionIdx: idx})}
        onResolveInvestor={(choices) => dispatch({type: 'RESOLVE_INVESTOR', choices})} />}
      {state.activePolicyDecision && <PolicyDecisionModal decision={state.activePolicyDecision} state={state}
        onResolve={(choiceId, extraToggles) => dispatch({type: 'RESOLVE_POLICY_DECISION', choiceId, extraToggles})} />}
      {state.activeStory && <StoryModal story={state.activeStory} drivers={state.drivers} onClose={() => dispatch({type: 'STORY_SHOWN'})} />}
      {state.showMonthlyReport && <MonthlyReportModal report={state.showMonthlyReport} onClose={() => dispatch({type: 'CLOSE_MONTHLY_REPORT'})} />}
      {hasFinaleMissionNotice && (
        <MissionToast mission={state.newMissionComplete} onClose={() => dispatch({type: 'CLEAR_MISSION_COMPLETE'})} />
      )}
      {showFeedbackStack && (
        <div className="game-feedback-stack" aria-live="polite">
          {state.newMissionComplete && !hasFinaleMissionNotice && (
            <MissionToast mission={state.newMissionComplete} onClose={() => dispatch({type: 'CLEAR_MISSION_COMPLETE'})} />
          )}
        </div>
      )}
      {state.newEndingUnlocked && !state.gameOver && (
        <EndingUnlockModal
          ending={state.newEndingUnlocked}
          onClaim={() => dispatch({type: 'CLAIM_ENDING'})}
          onContinue={() => dispatch({type: 'CLEAR_NEW_ENDING'})}
        />
      )}
      {(showRecruit || state.gachaCards) && (
        <RecruitModal
          state={state}
          dispatch={dispatch}
          onClose={() => { setShowRecruit(false); dispatch({type: 'GACHA_CANCEL'}); }}
        />
      )}
      {showShop && <ShopModal state={state} onClose={() => setShowShop(false)} onBuyVehicle={(t) => { dispatch({type: 'BUY_VEHICLE', templateId: t}); setShowShop(false); }} />}
      {showRoadmap && <UnlockRoadmapModal state={state} initialTab={roadmapInitialTab} onClose={() => setShowRoadmap(false)} onOpenShop={() => setShowShop(true)} />}
      {state.gameOver && <EndingModal ending={state.gameOver} onReset={() => dispatch({type: 'RESET'})} />}
      {confirmOpts && (
        <ConfirmModal
          {...confirmOpts}
          onClose={() => setConfirmOpts(null)}
        />
      )}
      {showPauseMenu && !state.gameOver && (
        <PauseMenu
          state={state}
          autosave={getSavedAutosave()}
          muted={muted}
          crtOn={crtOn}
          onContinue={() => closePauseMenu({ resume: true })}
          onLoadAutosave={loadAutosaveFromMenu}
          onNewGame={startNewGameFromMenu}
          onToggleMute={toggleMute}
          onToggleCrt={toggleCrt}
          onShowTutorial={() => { closePauseMenu({ resume: false }); dispatch({type: 'OPEN_TUTORIAL'}); }}
          onExportDiagnostics={() => exportGameDiagnostics(state)}
        />
      )}

      {state.notifications.length > 0 && state.notifications.slice(-1).map((n) => (
        <div key={n.id} className={`notification notification-${n.level || 'info'}`}>{n.text}</div>
      ))}

      {configUpdated && (
        <div className="config-update-banner">
          <span>数值后台已更新配置</span>
          <button className="btn btn-primary btn-xs" onClick={() => location.reload()}>重启游戏应用</button>
          <button className="btn btn-ghost btn-xs" onClick={() => setConfigUpdated(false)}>稍后</button>
        </div>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
