function PauseMenu({
  state,
  onContinue,
  onNewGame,
  onShowTutorial,
  onOpenLeaderboard,
  onExportDiagnostics,
}) {
  const continueLabel = state.hasStarted ? '继续游戏' : '返回游戏';
  const continueStatus = state.hasStarted ? '已暂停' : '菜单打开';
  return (
    <div className="modal-overlay pause-menu-overlay">
      <div className="pause-menu" role="dialog" aria-modal="true" aria-label="暂停菜单">
        <div className="pause-menu-titlebar">
          <strong>网约车物语</strong>
        </div>

        <div className="pause-menu-grid">
          <div className="pause-menu-command-list">
            <button className="pause-command is-primary" onClick={onContinue}>
              <span className="pause-command-mark">续</span>
              <span>
                <span className="pause-command-status">{continueStatus}</span>
                <b>{continueLabel}</b>
              </span>
            </button>
            <button className="pause-command is-danger" onClick={onNewGame}>
              <span className="pause-command-mark">新</span>
              <span><b>开始游戏</b></span>
            </button>
            <button className="pause-command" onClick={onOpenLeaderboard}>
              <span className="pause-command-mark">榜</span>
              <span><b>经营榜单</b></span>
            </button>
          </div>
        </div>

        <div className="pause-menu-footer">
          <button className="pause-setting" onClick={onShowTutorial}>新手指引</button>
          <button className="pause-setting" onClick={onExportDiagnostics}>诊断导出</button>
        </div>
      </div>
    </div>
  );
}
