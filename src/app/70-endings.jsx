function EndingModal({ ending, onReset }) {
  // V6 fix: 优先用 endingName/endingDesc(胜利);失败用 reason;deathCause 作为 fallback(codex review Medium)
  const isWin = ending.type === 'win';
  const isLose = ending.type === 'lose';
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
          <div className="ending-stats">
            <div className="ending-stat"><div className="ending-stat-label">营运天数</div><div className="ending-stat-value">{ending.stats.days}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">总流水</div><div className="ending-stat-value">¥{ending.stats.totalEarned.toLocaleString()}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">完成订单</div><div className="ending-stat-value">{ending.stats.totalCompleted}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">城市口碑</div><div className="ending-stat-value">{ending.stats.reputation}</div></div>
            <div className="ending-stat"><div className="ending-stat-label">可运营车组</div><div className="ending-stat-value">{ending.stats.crews ?? Math.min(ending.stats.drivers, ending.stats.vehicles)}</div></div>
          </div>
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
      reward={rewardAmount > 0 ? { label: '奖励', value: `+¥${rewardAmount}` } : ''}
      iconLabel="任务"
      asset="mission"
      actionLabel="领取奖励"
      onClose={onClose}
      className="mission-feedback"
    />
  );
}

/* ============== ConfirmModal:替代 native confirm(),保持开罗工坊视觉一致 ============== */

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

