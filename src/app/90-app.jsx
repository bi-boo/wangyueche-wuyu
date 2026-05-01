/* ============== App 主组件 ============== */

function App() {
  const [state, dispatch] = useReducer(E.gameReducer, null, E.makeInitialState);
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [mobileTab, setMobileTab] = useState('city');
  const [showRecruit, setShowRecruit] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [configUpdated, setConfigUpdated] = useState(false);

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
  const [flashKey, setFlashKey] = useState(0);
  // V7: 当前正在播放晋升闪光的司机 id 集合(0.6s 后自动移除)
  const [rankUpDriverIds, setRankUpDriverIds] = useState(new Set());

  // 上一次的关键状态 — 用于差分触发 sfx
  const prevRef = useRef({
    completedTotal: 0,
    trainings: 0,
    vehicles: state.vehicles.length,
    drivers: state.drivers.length,
  });

  useEffect(() => {
    if (state.paused || state.activeEvent || state.activeStory || state.showTutorial || state.gameOver) return;
    const interval = setInterval(() => dispatch({type: 'TICK'}), GAME.TICK_MS / state.speed);
    return () => clearInterval(interval);
  }, [state.paused, state.speed, state.activeEvent, state.activeStory, state.showTutorial, state.gameOver]);

  useEffect(() => {
    if (!selectedZoneId) return;
    if (!ZONES.some((z) => z.id === selectedZoneId)) setSelectedZoneId(null);
  }, [selectedZoneId]);

  useEffect(() => {
    state.floatGains.forEach((g) => {
      setTimeout(() => dispatch({type: 'CLEAR_FLOAT_GAIN', id: g.id}), 1700);
    });
  }, [state.floatGains.length]);

  useEffect(() => {
    state.notifications.forEach((n) => {
      setTimeout(() => dispatch({type: 'CLEAR_NOTIF', id: n.id}), 3000);
    });
  }, [state.notifications.length]);

  // CRT toggle
  useEffect(() => {
    document.body.classList.toggle('crt-on', crtOn);
    localStorage.setItem('wycwy-crt', crtOn ? '1' : '0');
  }, [crtOn]);

  // 音效触发(差分检测)
  useEffect(() => {
    const p = prevRef.current;
    if (state.totalCompleted > p.completedTotal) SFX.complete();
    if ((state.totalTrainings || 0) > p.trainings) SFX.train();
    if (state.vehicles.length > p.vehicles || state.drivers.length > p.drivers) SFX.buy();
    prevRef.current = {
      completedTotal: state.totalCompleted,
      trainings: state.totalTrainings || 0,
      vehicles: state.vehicles.length,
      drivers: state.drivers.length,
    };
  }, [state.totalCompleted, state.totalTrainings, state.vehicles, state.drivers]);

  // 任务完成 → 非阻塞提示 + 短闪光
  useEffect(() => {
    if (state.newMissionComplete) {
      SFX.mission();
      setFlashKey((k) => k + 1);
    }
  }, [state.newMissionComplete]);

  // V7: 司机晋升 — 升阶音 + 该司机卡片闪边 0.6s
  useEffect(() => {
    if (!state.rankUpEvent) return;
    SFX.rankUp();
    const did = state.rankUpEvent.driverId;
    setRankUpDriverIds((prev) => {
      const next = new Set(prev);
      next.add(did);
      return next;
    });
    const t = setTimeout(() => {
      setRankUpDriverIds((prev) => {
        const next = new Set(prev);
        next.delete(did);
        return next;
      });
    }, 600);
    // 立即清空 state.rankUpEvent,避免重复触发
    dispatch({ type: 'CLEAR_RANK_UP' });
    return () => clearTimeout(t);
  }, [state.rankUpEvent && state.rankUpEvent.ts]);

  // 通知警告音
  useEffect(() => {
    if (state.notifications.length > 0 && state.notifications.slice(-1)[0].level === 'warn') {
      SFX.warn();
    }
  }, [state.notifications.length]);

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
  const selectedZoneOffers = selectedZoneId ? state.dispatchOffers.filter((o) => o.zoneId === selectedZoneId) : [];
  const hasFinaleMissionNotice = !!state.newMissionComplete?.reward?.isFinale;
  const showFeedbackStack = !!state.newMissionComplete && !hasFinaleMissionNotice;

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
    setMobileTab('inspector');
  };

  return (
    <>
      <TopBar
        state={state}
        fundsDisplay={fundsDisplay}
        repDisplay={repDisplay}
        muted={muted} onToggleMute={toggleMute}
        crtOn={crtOn} onToggleCrt={toggleCrt}
      />
      {flashKey > 0 && <div key={flashKey} className="flash-overlay" />}

      <div className={`main-v3 mobile-${mobileTab}`}>
        <div className="col fleet-col">
          <FleetPanel
            state={state}
            selectedDriverId={selectedDriverId}
            selectedVehicleId={selectedVehicleId}
            selectedVehicle={selectedVehicle}
            selectedDriver={selectedDriver}
            rankUpDriverIds={rankUpDriverIds}
            onSelectDriver={(driverId) => { setSelectedZoneId(null); setSelectedVehicleId(null); setSelectedDriverId(driverId); setMobileTab('inspector'); }}
            onSelectVehicle={(vehicleId) => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(vehicleId); setMobileTab('inspector'); }}
            onClearSelection={() => { setSelectedZoneId(null); setSelectedDriverId(null); setSelectedVehicleId(null); }}
            onRecruit={() => setShowRecruit(true)}
            onShop={() => setShowShop(true)}
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
                zoneHeat={state.zoneHeat}
                drivers={state.drivers}
                hour={state.hour}
                state={state}
                selectedZoneId={selectedZoneId}
                onSelectZone={selectZone}
              />
              <CityOrderLayer
                offers={state.dispatchOffers}
                zones={ZONES}
                drivers={state.drivers}
              />
            </div>
          </div>

          {/* 事件 mini 横条 - 主屏只看最新一条,点开看全部 */}
          {state.log.length > 0 && (
            <div className="event-mini" onClick={() => setShowLog(true)}>
              <span className="event-mini-label">最新事件</span>
              <span className="event-mini-time">{state.log[0].time}</span>
              <span className={`event-mini-text ${state.log[0].level}`}>{state.log[0].text}</span>
              <button className="event-mini-btn" onClick={(e) => { e.stopPropagation(); setShowLog(true); }}>
                全部 {state.log.length} 条
              </button>
            </div>
          )}
        </div>

        <div className="col inspector-col">
          {selectedZone ? (
            <ZoneInspector
              zone={selectedZone}
              offers={selectedZoneOffers}
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
              onSelectVehicle={(vid) => { setSelectedDriverId(null); setSelectedVehicleId(vid); }}
              onSelectDriver={(did) => { setSelectedVehicleId(null); setSelectedDriverId(did); }}
            />
          ) : (
            <InspectorEmpty state={state} />
          )}
        </div>
      </div>

      <BottomHUD
        state={state}
        dispatch={dispatch}
        onOpenLog={() => setShowLog(true)}
      />

      <div className="mobile-tabs" role="tablist" aria-label="游戏主区域">
        <button className={mobileTab === 'fleet' ? 'active' : ''} onClick={() => setMobileTab('fleet')}>车队</button>
        <button className={mobileTab === 'city' ? 'active' : ''} onClick={() => setMobileTab('city')}>城市</button>
        <button className={mobileTab === 'inspector' ? 'active' : ''} onClick={() => setMobileTab('inspector')}>调度</button>
      </div>

      {state.showTutorial && <Tutorial onClose={() => dispatch({type: 'CLOSE_TUTORIAL'})} />}
      {state.activeEvent && <EventModal event={state.activeEvent} state={state} onResolve={(idx) => dispatch({type: 'RESOLVE_EVENT', optionIdx: idx})} />}
      {state.activeStory && <StoryModal story={state.activeStory} drivers={state.drivers} onClose={() => dispatch({type: 'STORY_SHOWN'})} />}
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
      {showLog && (
        <>
          <div className="drawer-overlay" onClick={() => setShowLog(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <div className="drawer-header-info">
                <div className="drawer-header-title">事件日志</div>
                <div className="drawer-header-sub">完整运营记录 · 最近 {state.log.length} 条</div>
              </div>
              <button className="drawer-close" onClick={() => setShowLog(false)}>×</button>
            </div>
            <div className="drawer-body">
              <div className="log-drawer-list">
                {state.log.map((l) => (
                  <div key={l.id} className={`log-row ${l.level}`}>
                    <span className="log-time">{l.time}</span>
                    <span className="log-text">{l.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {state.gameOver && <EndingModal ending={state.gameOver} onReset={() => dispatch({type: 'RESET'})} />}

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
