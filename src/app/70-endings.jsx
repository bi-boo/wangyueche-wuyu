function EndingStats({ stats }) {
  if (!stats) return null;
  return (
    <div className="ending-stats">
      <div className="ending-stat"><div className="ending-stat-label">营运天数</div><div className="ending-stat-value">{stats.days}</div></div>
      <div className="ending-stat"><div className="ending-stat-label">总流水</div><div className="ending-stat-value">¥{stats.totalEarned.toLocaleString()}</div></div>
      <div className="ending-stat"><div className="ending-stat-label">完成订单</div><div className="ending-stat-value">{stats.totalCompleted}</div></div>
      <div className="ending-stat"><div className="ending-stat-label">城市口碑</div><div className="ending-stat-value">{stats.reputation}</div></div>
      <div className="ending-stat"><div className="ending-stat-label">可运营车组</div><div className="ending-stat-value">{stats.crews ?? Math.min(stats.drivers, stats.vehicles)}</div></div>
    </div>
  );
}

function EndingModal({ ending, state, onReset }) {
  // V6 fix: 优先用 endingName/endingDesc(胜利);失败用 reason;deathCause 作为 fallback(codex review Medium)
  const isWin = ending.type === 'win';
  const isLose = ending.type === 'lose';
  const finaleStory = isWin && ending.endingId === 'ipo' ? PLAYER_STORIES?.finale_ipo_heir : null;
  if (finaleStory) {
    return (
      <PlayerStoryModal story={finaleStory} onButton={onReset} className="player-story-finale">
        <div className="player-story-ending-stats">
          <EndingStats stats={ending.stats} />
        </div>
        <RunAiReviewPanel state={state} />
      </PlayerStoryModal>
    );
  }
  const titleMap = { win: '恭喜! 车队跑出来了', end: '一周目结束', lose: '车队破产' };
  const headline = isWin && ending.endingName ? `《${ending.endingName}》` : titleMap[ending.type];
  const story = isWin && ending.endingDesc
    ? ending.endingDesc
    : ending.reason || '';
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="ending-card">
          <div className="ending-title">{headline}</div>
          {isWin && ending.endingName && (
            <div style={{color: 'var(--ink-3)', fontSize: 14, marginBottom: 10}}>{titleMap[ending.type]}</div>
          )}
          <div style={{color: 'var(--ink-2)', marginBottom: 8, lineHeight: 1.6}}>{story}</div>
          <EndingStats stats={ending.stats} />
          <RunAiReviewPanel state={state} />
          <button className="btn btn-primary btn-block" onClick={onReset} style={{padding: 12}}>再来一遍</button>
        </div>
      </div>
    </div>
  );
}

// V6: 达成新结局时弹窗 — 提供"领奖结束/继续冲击"
function EndingUnlockModal({ ending, onClaim, onContinue }) {
  return (
    <div className="modal-overlay" style={{zIndex: 110}}>
      <div className="modal" style={{maxWidth: 480, textAlign: 'center', borderColor: 'var(--gold)', borderWidth: 3, borderStyle: 'solid'}}>
        <div className="modal-tag" style={{background: 'var(--gold)', color: 'var(--ink)'}}>
          已解锁结局 · 阶段 {ending.tier}
        </div>
        <div className="modal-title" style={{fontSize: 24, marginTop: 8}}>{ending.name}</div>
        <div className="modal-desc" style={{margin: '14px 0', lineHeight: 1.7}}>{ending.desc}</div>
        <div className="ending-detail-line">{ending.detail}</div>
        <div className="modal-options" style={{marginTop: 20}}>
          <button className="btn btn-primary btn-block" style={{padding: 12, background: 'var(--gold)', color: 'var(--ink)'}} onClick={onClaim}>
            领奖结束(以《{ending.name}》收尾)
          </button>
          <button className="btn btn-ghost btn-block" style={{padding: 10}} onClick={onContinue}>
            继续运营 · 冲击更高结局
          </button>
        </div>
      </div>
    </div>
  );
}

function MissionToast({ mission, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, mission.reward?.isFinale ? 10000 : 8000);
    return () => clearTimeout(t);
  }, [mission]);
  const rewardAmount = mission.reward?.funds || 0;
  if (mission.reward?.isFinale) {
    return (
      <div className="modal-overlay game-feedback-overlay" onClick={onClose}>
        <GameFeedbackCard
          tone="gold"
          tag="通关达成"
          title={mission.title}
          message={mission.reward?.message}
          reward={mission.reward?.funds > 0 ? `奖励 +¥${mission.reward.funds}` : ''}
          iconLabel="通关"
          asset="achievement"
          actionLabel="继续运营"
          onClose={onClose}
          modal
        />
      </div>
    );
  }
  return (
    <GameFeedbackCard
      tone="accent"
      tag="任务完成"
      title={mission.title}
      message={mission.reward?.message}
      reward={rewardAmount > 0 ? { label: '奖励已到账', value: `+¥${rewardAmount}` } : ''}
      iconLabel="任务"
      asset="mission"
      actionLabel="知道了"
      onClose={onClose}
      className="mission-feedback"
    />
  );
}

/* ============== ConfirmModal:替代 native confirm(),保持开罗工坊视觉一致 ============== */

// V15.41q:渐进解锁 — 用“现在该做什么”引导,避免只告诉玩家有新入口。
function UnlockSplashModal({ gate, onClose }) {
  if (!gate) return null;
  return (
    <div className="modal-overlay unlock-splash-overlay" onClick={onClose}>
      <div className="modal unlock-splash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="unlock-splash-tag">{gate.kicker || '现在要做'}</div>
        <div className="unlock-splash-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36"
               fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
        </div>
        <h2 className="unlock-splash-title">{gate.title}</h2>
        <p className="unlock-splash-desc">{gate.desc}</p>
        <div className="unlock-splash-hint">
          <span className="unlock-splash-hint-label">操作位置</span>
          <span className="unlock-splash-hint-value">{gate.hint}</span>
        </div>
        <button className="btn btn-primary unlock-splash-confirm" onClick={onClose}>
          {gate.confirmLabel || '继续运营'}
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = '确定', cancelLabel = '取消', danger = false, tag, onConfirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <span className="modal-tag">
          {tag || (danger ? '风险确认' : '操作确认')}
        </span>
        <h2 className="modal-title">{title}</h2>
        {message && (
          <p className="modal-desc" style={{ whiteSpace: 'pre-line' }}>{message}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'ds-confirm-danger' : 'btn-primary'}`}
            onClick={() => { onConfirm(); onClose(); }}
            style={{ flex: 1 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============== App 主组件 ============== */
