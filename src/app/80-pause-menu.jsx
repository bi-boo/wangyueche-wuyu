function PauseMenu({
  state,
  muted,
  crtOn,
  skipOnboarding,
  onContinue,
  onNewGame,
  onToggleMute,
  onToggleCrt,
  onToggleSkipOnboarding,
  onShowTutorial,
  onExportDiagnostics,
}) {
  const continueLabel = state.hasStarted ? '继续游戏' : '返回游戏';
  return (
    <div className="modal-overlay pause-menu-overlay">
      <div className="pause-menu" role="dialog" aria-modal="true" aria-label="暂停菜单">
        <div className="pause-menu-titlebar">
          <span className="pause-menu-state">已暂停</span>
          <strong>网约车物语</strong>
        </div>

        <div className="pause-menu-grid">
          <div className="pause-menu-command-list">
            <button className="pause-command is-primary" onClick={onContinue}>
              <span className="pause-command-mark">续</span>
              <span><b>{continueLabel}</b></span>
            </button>
            <button className="pause-command is-danger" onClick={onNewGame}>
              <span className="pause-command-mark">新</span>
              <span><b>开始游戏</b></span>
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
          <button className={`pause-setting ${skipOnboarding ? 'on' : ''}`}
                  onClick={onToggleSkipOnboarding}
                  title="开启后:新游戏直接解锁全部功能,跳过引导 splash">
            跳过教学 {skipOnboarding ? '开' : '关'}
          </button>
          <button className="pause-setting" onClick={onShowTutorial}>新手指引</button>
          <button className="pause-setting" onClick={onExportDiagnostics}>诊断导出</button>
        </div>
      </div>
    </div>
  );
}
