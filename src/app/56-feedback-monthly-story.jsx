function GameFeedbackCard({
  tone = 'accent',
  tag,
  title,
  message,
  reward,
  iconLabel = '提示',
  asset,
  media,
  actionLabel,
  onClose,
  modal = false,
  children,
  className = '',
}) {
  const feedbackAssetMap = {
    achievement: 'feedback-achievement',
    mission: 'feedback-mission',
    reward: 'feedback-reward',
    story: 'feedback-story',
    warning: 'feedback-warning',
  };
  const iconAsset = feedbackAssetMap[asset] || asset || (tone === 'gold' ? 'feedback-reward' : 'feedback-mission');
  return (
    <div className={`game-feedback-card tone-${tone} ${modal ? 'modal-card' : ''} ${className}`} onClick={(e) => modal && e.stopPropagation()}>
      <div className="game-feedback-media">
        {media || (
          <div className="game-feedback-icon" data-asset={iconAsset}>
            <img src={`assets/pixel/icons/${iconAsset}.png`} alt={iconLabel} draggable="false" />
          </div>
        )}
      </div>
      <div className="game-feedback-main">
        <div className="game-feedback-tag">{tag}</div>
        <div className="game-feedback-title">{title}</div>
        {message && <div className="game-feedback-message">{message}</div>}
        {reward && (
          typeof reward === 'object' ? (
            <div className="game-feedback-reward">
              <span className="game-feedback-reward-label">{reward.label}</span>
              <strong className="game-feedback-reward-value">{reward.value}</strong>
            </div>
          ) : (
            <div className="game-feedback-reward">{reward}</div>
          )
        )}
        {children}
        {actionLabel && (
          <button className="btn btn-primary btn-block game-feedback-action" onClick={onClose}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// V14: 月度结算弹窗 — 每 30 天暂停游戏,展示收入构成 / 支出构成 / 司机贡献排行 / 期末状态
function MonthlyReportModal({ report, onClose }) {
  if (!report) return null;
  const fmt = (n) => `¥${Math.round(n).toLocaleString()}`;
  const sign = (n) => (n >= 0 ? `+${fmt(n)}` : `−${fmt(-n)}`);
  const commissionPct = Math.round((GAME.COMMISSION || 0) * 100);
  const eventItems = report.eventItems && report.eventItems.length
    ? report.eventItems
    : (report.eventImpact ? [{ day: report.day - 1, title: '本月事件合计', label: '历史版本未记录明细', amount: report.eventImpact }] : []);
  return (
    <div className="modal-overlay">
      <div className="modal monthly-report-modal">
        <div className="modal-tag">月度结算</div>
        <div className="modal-title">
          第 {report.monthCounter} 月经营报告
          <span className="monthly-day-tag">第 {report.day - 1} 日发薪</span>
        </div>

        <div className="monthly-section">
          <div className="monthly-section-title">收入构成</div>
          <div className="monthly-row">
            <span>总流水(乘客付的)</span>
            <strong>{fmt(report.earnedGross)}</strong>
          </div>
          <div className="monthly-row danger">
            <span>− 平台抽成 ({commissionPct}%)</span>
            <strong>−{fmt(report.commission)}</strong>
          </div>
          <div className="monthly-row monthly-subtotal">
            <span>净流水</span>
            <strong>{fmt(report.earnedNet)}</strong>
          </div>
        </div>

        {/* V15.16 audit:支出按"已扣 vs 今日扣"分组 */}
        {/* 第 1 组:本月日常变动 — 过去 30 天逐日已扣(事件 / 债务到期 / 解雇补偿) */}
        {(report.eventImpact !== 0 || report.debtPaid > 0 || report.severance > 0) && (
          <div className="monthly-section">
            <div className="monthly-section-title">本月日常变动 <em className="monthly-section-hint">(过去 30 天逐日已扣)</em></div>
            {report.eventImpact !== 0 && (
              <>
                <div className={`monthly-row ${report.eventImpact < 0 ? 'danger' : 'positive'}`}>
                  <span>事件合计</span>
                  <strong>{sign(report.eventImpact)}</strong>
                </div>
                {eventItems.length > 0 && (
                  <div className="monthly-event-list">
                    {eventItems.map((item, idx) => (
                      <div key={`${item.day}-${item.title}-${idx}`} className={`monthly-event-item ${item.amount < 0 ? 'danger' : 'positive'}`}>
                        <div className="monthly-event-copy">
                          <strong>第 {item.day} 日 · {item.title}</strong>
                          <span>{item.label || '事件现金变动'}</span>
                          {item.detail && <span className="monthly-event-detail">{item.detail}</span>}
                        </div>
                        <em>{sign(item.amount)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {report.debtPaid > 0 && (
              <div className="monthly-row danger">
                <span>债务到期扣款</span>
                <strong>−{fmt(report.debtPaid)}</strong>
              </div>
            )}
            {report.severance > 0 && (
              <div className="monthly-row danger">
                <span>解雇补偿</span>
                <strong>−{fmt(report.severance)}</strong>
              </div>
            )}
          </div>
        )}

        {/* 第 2 组:本次月结新扣 — 月底统一结算的薪酬 */}
        <div className="monthly-section">
          <div className="monthly-section-title">本次月结新扣 <em className="monthly-section-hint">(今日结算)</em></div>
          {report.salary > 0 ? (
            <div className="monthly-row danger">
              <span>司机工资 ({report.drivers.length} 人)</span>
              <strong>−{fmt(report.salary)}</strong>
            </div>
          ) : (
            <div className="monthly-empty-row">本月无司机,无工资支出</div>
          )}
        </div>

        <div className={`monthly-net-profit ${report.netProfit >= 0 ? 'positive' : 'danger'}`}>
          <span>当月净利润</span>
          <strong>{sign(report.netProfit)}</strong>
        </div>

        {report.drivers.length > 0 && (
          <div className="monthly-section">
            <div className="monthly-section-title">司机贡献排行</div>
            <div className="monthly-driver-list">
              {report.drivers.map((d, i) => (
                <div key={d.id}
                  className={`monthly-driver-row ${d.leftDay ? 'left-team' : ''} ${d.contribution < 0 ? 'negative' : ''}`}>
                  <span className="monthly-driver-rank">{i + 1}</span>
                  <div className="monthly-driver-body">
                    <div className="monthly-driver-name">
                      {d.name} <em>{d.bgName}</em>
                      {d.leftDay && <span className="monthly-left-tag">已离队 (第 {d.leftDay} 日)</span>}
                    </div>
                    <div className="monthly-driver-stats">
                      完单 {d.completed} · 月薪 ¥{d.salary.toLocaleString()} · 本月工资 {fmt(d.salaryPaid || d.salary)} · 净赚 {fmt(d.earnedNet)}
                    </div>
                  </div>
                  <strong className={`monthly-driver-contrib ${d.contribution < 0 ? 'danger' : 'positive'}`}>
                    {sign(d.contribution)}
                    {d.contribution < 0 && <span className="monthly-warn-tag">⚠ 负贡献</span>}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="monthly-section monthly-final-state">
          <div className="monthly-section-title">期末状态</div>
          <div className="monthly-final-grid">
            <div><span>资金</span><strong>{fmt(report.funds)}</strong></div>
            <div><span>口碑</span><strong>{report.reputation}</strong></div>
            <div><span>车组</span><strong>{report.crews}</strong></div>
          </div>
        </div>

        <button className="btn btn-primary monthly-continue" onClick={onClose}>继续运营</button>
      </div>
    </div>
  );
}

// V7: 司机故事线里程碑(使用统一游戏反馈强提醒)
function StoryModal({ story, drivers, onClose }) {
  if (!story) return null;
  const driver = drivers.find((d) => d.id === story.driverId);
  const milestoneTag = story.milestone === 100 ? '初次相识'
    : story.milestone === 500 ? '一路同行'
    : story.milestone === 1000 ? '故友重逢'
    : '';
  const r = story.reward || {};
  const rewardLines = [];
  if (r.funds) rewardLines.push(`资金 +¥${r.funds}`);
  if (r.reputation) rewardLines.push(`口碑 +${r.reputation}`);
  if (r.loyalty) rewardLines.push(`忠诚 +${r.loyalty}`);
  if (r.badge) rewardLines.push(`称号「${r.badge}」`);
  return (
    <div className="modal-overlay game-feedback-overlay">
      <GameFeedbackCard
        tone="gold"
        tag={`${milestoneTag} · 司机里程碑`}
        title={story.title}
        message={`${story.driverName} 完成 ${story.milestone} 单`}
        media={driver && <DriverAvatar avatar={driver.avatar} size={72} name={driver.name} />}
        actionLabel="继续运营"
        onClose={onClose}
        modal
        className="story-feedback"
      >
        <div className="story-text">{formatNarrativeText(story.text, 42)}</div>
        {rewardLines.length > 0 && (
          <div className="story-rewards">
            {rewardLines.map((line, i) => (
              <div key={i} className="story-reward-row">{line}</div>
            ))}
          </div>
        )}
      </GameFeedbackCard>
    </div>
  );
}
