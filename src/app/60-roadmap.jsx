function ConditionRow({ status, onAction }) {
  return (
    <div className="roadmap-cond-row">
      <span className={`roadmap-cond-icon ${status.ok ? 'ok' : 'miss'}`}>{status.ok ? '✓' : '✗'}</span>
      <div className="roadmap-cond-body">
        <span className="roadmap-cond-label">{status.label}</span>
        {status.missing && <div className="roadmap-cond-missing">还差:{status.missing}{status.actionable === 'shop' && (
          <button className="roadmap-cond-action" onClick={onAction}>去买车</button>
        )}</div>}
      </div>
    </div>
  );
}

function MissionRouteRow({ row, expanded, onOpenShop }) {
  const { mission, idx, orderStatus, stateClass, stateLabel } = row;
  return (
    <div className={`mission-route-row ${stateClass}`}>
      <div className="mission-route-index">{idx + 1}</div>
      <div className="mission-route-body">
        <div className="mission-route-head">
          <strong>{mission.title}</strong>
          <span className="mission-route-state">{stateLabel}</span>
        </div>
        {orderStatus && (
          <div className="mission-order-link">
            <OrderIcon orderId={orderStatus.order.id} color="currentColor" size={14} />
            <span>{orderStatus.order.name}</span>
            <strong>¥{orderStatus.order.fare}/单</strong>
            <em>{orderStatus.unlocked ? '可接' : '未开放'}</em>
          </div>
        )}
        {expanded && orderStatus && (
          <div className="mission-order-conditions">
            <ConditionRow status={orderStatus.zone} />
            <ConditionRow status={orderStatus.stat} />
            <ConditionRow status={orderStatus.vehicle} onAction={onOpenShop} />
          </div>
        )}
      </div>
    </div>
  );
}

function getMissionActionText(mission) {
  if (!mission) return '可以继续运营,也可以在游戏目标里选择结束本局。';
  return mission.hint || mission.desc;
}

function MissionRoutePanel({ state, orderStatusById, onOpenShop }) {
  // V15.16:乱序完成 — 找第一个未完成且非 hidden 的任务作为"当前任务"
  const completedSet = new Set(state.completedMissionIds || []);
  const currentMission = MISSIONS.find((m) => !completedSet.has(m.id) && !m.hidden);
  const visibleMissions = MISSIONS.filter((m) => !m.hidden);
  const visibleDoneCount = visibleMissions.filter((m) => completedSet.has(m.id)).length;
  const rows = getMissionRouteRows(state, orderStatusById);
  const currentOrderId = currentMission ? MISSION_ORDER_TARGETS[currentMission.id] : null;
  const currentOrderStatus = currentOrderId ? orderStatusById[currentOrderId] : null;
  return (
    <>
      <div className="mission-route-focus">
        <div className="mission-route-focus-top">
          <div>
            <div className="roadmap-focus-tag">{currentMission ? '当前任务' : '主线完成'}</div>
            <div className="roadmap-focus-title">{currentMission ? currentMission.title : '主线任务已完成'}</div>
          </div>
          <span className="mission-route-progress">{visibleDoneCount} / {visibleMissions.length}</span>
        </div>
        <div className="mission-route-next">
          <span>下一步</span>
          <strong>{getMissionActionText(currentMission)}</strong>
        </div>
        {currentOrderStatus && (
          <div className="mission-route-order-focus">
            <div className="mission-order-link strong">
              <OrderIcon orderId={currentOrderStatus.order.id} color="currentColor" size={14} />
              <span>目标订单:{currentOrderStatus.order.name}</span>
              <strong>¥{currentOrderStatus.order.fare}/单</strong>
              <em>{currentOrderStatus.unlocked ? '可接' : '未开放'}</em>
            </div>
            <ConditionRow status={currentOrderStatus.zone} />
            <ConditionRow status={currentOrderStatus.stat} />
            <ConditionRow status={currentOrderStatus.vehicle} onAction={onOpenShop} />
          </div>
        )}
      </div>

      <div className="roadmap-section-title">主线任务路线</div>
      <div className="mission-route-list">
        {rows.map((row) => (
          <MissionRouteRow
            key={row.mission.id}
            row={row}
            expanded={currentMission?.id === row.mission.id && !!row.orderStatus}
            onOpenShop={onOpenShop}
          />
        ))}
      </div>
    </>
  );
}

function getEndingRoadmapStatus(ending, state) {
  const currentTier = state.unlockedEndingTier || 0;
  if (ending.tier <= currentTier) return { cls: 'done', label: '已达成' };
  if (ending.tier === currentTier + 1) return { cls: 'next', label: ending.forceEnd ? '最终目标' : '下一阶段' };
  if (ending.forceEnd) return { cls: 'final', label: '终局' };
  return { cls: 'locked', label: '未达成' };
}

function getTargetEndingRows(state) {
  const currentTier = state.unlockedEndingTier || 0;
  const revealTier = Math.min(ENDINGS.length, currentTier + 1);
  return ENDINGS.map((ending) => {
    const hidden = ending.tier > revealTier;
    const status = hidden ? { cls: 'hidden', label: '未揭晓' } : getEndingRoadmapStatus(ending, state);
    return { ending, hidden, status };
  });
}

// V14.90: 跨局成就聚合 — 历史里达到过该 tier 即视为已征服
function getEndingAchievements(state) {
  const history = getSavedRunHistory();
  const currentTier = state.unlockedEndingTier || 0;
  return ENDINGS.map((ending) => {
    const conqueredInHistory = history.some((h) => (h?.summary?.unlockedEndingTier || 0) >= ending.tier);
    const meetsNow = (() => {
      try { return ending.check(state); } catch (e) { return false; }
    })();
    // 已征服过的结局直接揭晓真名(成就感),否则按当前进度的 +1 揭晓规则
    const revealed = conqueredInHistory || ending.tier <= currentTier + 1;
    let badge;
    if (conqueredInHistory) badge = { cls: 'conquered', icon: '✓', label: '已征服' };
    else if (meetsNow) badge = { cls: 'reachable', icon: '✦', label: '可冲击' };
    else if (ending.tier <= currentTier) badge = { cls: 'progressing', icon: '→', label: '进行中' };
    else if (revealed) badge = { cls: 'pending', icon: '—', label: '未触及' };
    else badge = { cls: 'hidden', icon: '?', label: '未揭晓' };
    return { ending, badge, revealed };
  });
}

function EndingAchievementWall({ achievements }) {
  const total = achievements.length;
  const conquered = achievements.filter((a) => a.badge.cls === 'conquered').length;
  return (
    <div className="ending-wall">
      <div className="ending-wall-head">
        <span className="ending-wall-title">通关成就</span>
        <span className="ending-wall-count">{conquered} / {total} 征服</span>
      </div>
      <div className="ending-wall-grid">
        {achievements.map(({ ending, badge, revealed }) => (
          <div key={ending.id} className={`ending-wall-cell ending-wall-${badge.cls}`} title={revealed ? `${ending.name}：${badge.label}` : '未揭晓'}>
            <div className="ending-wall-tier">T{ending.tier}</div>
            <div className="ending-wall-icon">{badge.icon}</div>
            <div className="ending-wall-name">{revealed ? ending.name : '????'}</div>
            <div className="ending-wall-status">{badge.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EndingGoalSummary({ achievements }) {
  const total = achievements.length;
  const conquered = achievements.filter((a) => a.badge.cls === 'conquered').length;
  return (
    <div className="ending-goal-summary">
      <span>通关进度</span>
      <strong>{conquered} / {total}</strong>
    </div>
  );
}

function getEndingGoalRows(state) {
  const targetRows = getTargetEndingRows(state);
  const achievements = getEndingAchievements(state);
  return targetRows.map((row, idx) => {
    const achievement = achievements[idx];
    const revealed = achievement?.revealed || !row.hidden;
    const hidden = !revealed;
    let status = row.status;
    if (achievement?.badge?.cls === 'conquered') {
      status = { cls: 'done', label: '已征服' };
    } else if (achievement?.badge?.cls === 'reachable') {
      status = { cls: 'next', label: '可冲击' };
    } else if (row.status.cls === 'next') {
      status = { ...row.status, label: '下一目标' };
    }
    return { ending: row.ending, hidden, status };
  });
}

// V14.90: 运营记录列表 + 详情查看
function formatRunHistoryDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${hh}:${mm}`;
  } catch (e) { return ''; }
}

function RunHistoryPanel({ onSelect }) {
  const currentRun = getSavedCurrentRun();
  const history = getSavedRunHistory();
  if (!currentRun && !history.length) {
    return (
      <div className="run-history-empty">
        还没有运营记录。开始运营后会保存当前快照,通关或破产后会进入最近 20 局历史。
      </div>
    );
  }
  const records = currentRun
    ? [{ rec: currentRun, idx: 'current', isCurrent: true }, ...history.map((rec, idx) => ({ rec, idx, isCurrent: false }))]
    : history.map((rec, idx) => ({ rec, idx, isCurrent: false }));
  return (
    <div className="run-history-list">
      {records.map(({ rec, idx, isCurrent }) => {
        const summary = rec?.summary || {};
        const gameOver = summary.gameOver || {};
        const isWin = gameOver.type === 'win';
        const isLose = gameOver.type === 'lose';
        const cls = isCurrent ? 'outcome-current' : (isWin ? 'outcome-win' : (isLose ? 'outcome-lose' : 'outcome-end'));
        const tagText = isCurrent ? '当前快照' : (isWin ? (gameOver.endingName || '通关') : (isLose ? '破产' : '结束'));
        const titleText = isCurrent
          ? `自动记录 · 第 ${summary.day || '?'} 天 ${String(summary.hour || 0).padStart(2, '0')}:00`
          : isWin
          ? `《${gameOver.endingName || '已通关'}》`
          : (gameOver.reason || '本局结束');
        const savedAt = rec.exportedAt || rec.savedAt;
        const meta = `¥${(summary.funds || 0).toLocaleString()} · 口碑 ${summary.reputation || 0} · 完成 ${summary.totalCompleted || 0} 单 · ${formatRunHistoryDate(savedAt)}`;
        return (
          <button
            key={`${rec.exportedAt || rec.savedAt || idx}-${idx}`}
            className={`run-history-card ${cls}`}
            onClick={() => onSelect(rec)}
            type="button"
          >
            <span className="run-history-tag">{tagText}</span>
            <div className="run-history-main">
              <div className="run-history-title">{titleText}</div>
              <div className="run-history-meta">{meta}</div>
            </div>
            <span className="run-history-arrow">›</span>
          </button>
        );
      })}
    </div>
  );
}

function RunHistoryDetailModal({ record, onClose }) {
  const summary = record?.summary || {};
  const gameOver = summary.gameOver || {};
  const isCurrent = record?.result === 'in_progress' || !gameOver.type;
  const isWin = gameOver.type === 'win';
  const isLose = gameOver.type === 'lose';
  const tag = isCurrent ? '当前快照' : (isWin ? (gameOver.endingName || '通关') : (isLose ? '破产' : '本局结束'));
  const headline = isCurrent
    ? `自动记录 · 第 ${summary.day || '?'} 天 ${String(summary.hour || 0).padStart(2, '0')}:00`
    : isWin
    ? `《${gameOver.endingName || '已通关'}》`
    : (gameOver.reason || '本局结束');
  const story = isWin ? (gameOver.endingDesc || '') : '';
  const monthly = record?.monthly || {};
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <span className="modal-tag">{tag}</span>
        <h2 className="modal-title">{headline}</h2>
        {story && (<p className="modal-desc" style={{ whiteSpace: 'pre-line' }}>{story}</p>)}
        <div className="ending-stats" style={{ marginTop: 8 }}>
          <div className="ending-stat"><div className="ending-stat-label">营运天数</div><div className="ending-stat-value">{summary.day || 0}</div></div>
          <div className="ending-stat"><div className="ending-stat-label">总流水</div><div className="ending-stat-value">¥{(summary.totalEarned || 0).toLocaleString()}</div></div>
          <div className="ending-stat"><div className="ending-stat-label">完成订单</div><div className="ending-stat-value">{summary.totalCompleted || 0}</div></div>
          <div className="ending-stat"><div className="ending-stat-label">最终资金</div><div className="ending-stat-value">¥{(summary.funds || 0).toLocaleString()}</div></div>
          <div className="ending-stat"><div className="ending-stat-label">城市口碑</div><div className="ending-stat-value">{summary.reputation || 0}</div></div>
          <div className="ending-stat"><div className="ending-stat-label">车队规模</div><div className="ending-stat-value">{summary.crews || 0} 组</div></div>
        </div>
        <div style={{ marginTop: 12, display: 'grid', gap: 4, fontSize: 14, color: 'var(--ink-2)' }}>
          {summary.completedMissionIds?.length > 0 && (
            <div>已完成任务：{summary.completedMissionIds.length} 个</div>
          )}
          {summary.unlockedEndingTier > 0 && (
            <div>本局最高解锁结局：T{summary.unlockedEndingTier}</div>
          )}
          {monthly?.monthCounter > 0 && (
            <div>共结算 {monthly.monthCounter} 次月报</div>
          )}
          <div style={{ color: 'var(--ink-3)', marginTop: 4 }}>
            记录时间：{formatRunHistoryDate(record?.exportedAt || record?.savedAt)}
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={onClose} style={{ padding: 12, marginTop: 14 }}>关闭</button>
      </div>
    </div>
  );
}

function UnlockRoadmapModal({ state, onClose, onOpenShop, initialTab = 'missions' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [historyDetail, setHistoryDetail] = useState(null);
  const allStatus = ORDERS.map((o) => computeOrderUnlockStatus(o, state));
  const orderStatusById = Object.fromEntries(allStatus.map((s) => [s.order.id, s]));
  const achievements = getEndingAchievements(state);
  const endingRows = getEndingGoalRows(state);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{maxWidth: 640}}>
        <div className="modal-title">查看目标</div>
        <div className="modal-desc">按任务推进订单解锁,再冲击本局结局。</div>

        <div className="target-tabs" role="tablist" aria-label="目标类型">
          <button
            className={`target-tab ${activeTab === 'missions' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'missions'}
            onClick={() => setActiveTab('missions')}
          >
            任务路线
          </button>
          <button
            className={`target-tab ${activeTab === 'endings' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'endings'}
            onClick={() => setActiveTab('endings')}
          >
            游戏目标
          </button>
          <button
            className={`target-tab ${activeTab === 'history' ? 'active' : ''}`}
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            运营记录
          </button>
        </div>

        <div className="target-panel">
          {activeTab === 'missions' && (
            <MissionRoutePanel
              state={state}
              orderStatusById={orderStatusById}
              onOpenShop={() => { onClose(); onOpenShop && onOpenShop(); }}
            />
          )}
          {activeTab === 'endings' && (
            <>
              <EndingGoalSummary achievements={achievements} />
              <div className="roadmap-section-title">结局路线</div>
              <div className="ending-roadmap-list">
                {endingRows.map(({ ending, hidden, status }) => (
                  <div key={ending.id} className={`ending-roadmap-item ${status.cls}`}>
                    <div className="ending-roadmap-tier">T{ending.tier}</div>
                    <div className="ending-roadmap-main">
                      <div className="ending-roadmap-head">
                        <span className="ending-roadmap-name">{hidden ? '????' : ending.name}</span>
                      </div>
                      <div className="ending-roadmap-detail">{hidden ? '达成上一阶段后揭晓' : ending.detail}</div>
                    </div>
                    <span className="ending-roadmap-status">{status.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {activeTab === 'history' && (
            <RunHistoryPanel onSelect={(rec) => setHistoryDetail(rec)} />
          )}
        </div>

        <button className="btn btn-primary btn-block" onClick={onClose} style={{padding: 12, marginTop: 4}}>了解</button>
      </div>
      {historyDetail && (
        <RunHistoryDetailModal record={historyDetail} onClose={() => setHistoryDetail(null)} />
      )}
    </div>
  );
}
