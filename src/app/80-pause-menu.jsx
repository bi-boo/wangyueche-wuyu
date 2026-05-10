function formatAutosaveTime(iso) {
  if (!iso) return '未知时间';
  try {
    const d = new Date(iso);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${m}/${day} ${hh}:${mm}`;
  } catch (e) {
    return '未知时间';
  }
}

function PauseMenu({
  state,
  autosave,
  muted,
  crtOn,
  onContinue,
  onLoadAutosave,
  onNewGame,
  onToggleMute,
  onToggleCrt,
  onShowTutorial,
  onExportDiagnostics,
}) {
  const summary = autosave?.summary || null;
  const hasAutosave = !!autosave;
  const saveStats = summary
    ? `${summary.day || '?'} 天 · ¥${(summary.totalEarned || 0).toLocaleString()}累计 · ${summary.drivers || 0}司机 · ${summary.vehicles || 0}车辆`
    : '开始运营后生成';
  const savedAtText = hasAutosave ? formatAutosaveTime(autosave.savedAt) : '未生成';
  const continueLabel = state.hasStarted ? '继续游戏' : '返回游戏';
  return (
    <div className="modal-overlay pause-menu-overlay">
      <div className="pause-menu" role="dialog" aria-modal="true" aria-label="暂停菜单">
        <div className="pause-menu-titlebar">
          <span className="pause-menu-state">已暂停</span>
          <strong>网约车物语</strong>
          <em>ESC</em>
        </div>

        <div className="pause-menu-grid">
          <div className="pause-menu-command-list">
            <button className="pause-command is-primary" onClick={onContinue}>
              <span className="pause-command-mark">续</span>
              <span><b>{continueLabel}</b><em>回到运营台</em></span>
            </button>
            <button className="pause-command is-danger" onClick={onNewGame}>
              <span className="pause-command-mark">新</span>
              <span><b>开始新游戏</b><em>清空可继续存档</em></span>
            </button>
            <button className="pause-command" onClick={onLoadAutosave} disabled={!hasAutosave}>
              <span className="pause-command-mark">载</span>
              <span>
                <b>载入上一次存档</b>
                <em>{saveStats}</em>
                <small>{savedAtText}</small>
              </span>
            </button>
          </div>
        </div>

        <div className="pause-menu-footer">
          <button className={`pause-setting ${muted ? '' : 'on'}`} onClick={onToggleMute}>
            音效 {muted ? '关' : '开'}
          </button>
          <button className={`pause-setting ${crtOn ? 'on' : ''}`} onClick={onToggleCrt}>
            复古滤镜 {crtOn ? '开' : '关'}
          </button>
          <button className="pause-setting" onClick={onShowTutorial}>新手指引</button>
          <button className="pause-setting" onClick={onExportDiagnostics}>诊断导出</button>
        </div>
      </div>
    </div>
  );
}
