function Tutorial({ onClose }) {
  const [step, setStep] = React.useState(0);
  const [measuredSpot, setMeasuredSpot] = React.useState(null);
  const STEPS = [
    {
      tag: '开局',
      title: '把两辆出租车先跑起来',
      text: <>你现在有 <strong>¥10,000</strong>、<strong>2 名司机</strong> 和 <strong>2 辆出租车</strong>。第一局先别想复杂经营,目标就是让车队开始接单、赚钱、涨口碑。</>,
      bubble: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    },
    {
      spotSelector: '.topbar-kpis',
      tag: '状态',
      title: '先看钱和口碑',
      text: <>开局先看三件事:<strong>时间</strong>决定结算节奏,<strong>资金</strong>不能变负,<strong>口碑</strong>越高越容易解锁新片区。</>,
      bubble: { top: 96, left: '50%', transform: 'translateX(-50%)' },
    },
    {
      spot: { top: 88, left: 14, width: 300, height: 118 },
      tag: '任务',
      title: '照着任务推进',
      text: <>左上角会告诉你<strong>当前目标</strong>。看不懂为什么卡住时,点<strong>查看目标</strong>,里面会说明下一类订单需要什么车、什么司机。</>,
      bubble: { top: 100, left: 334 },
    },
    {
      spot: { top: 210, left: 14, width: 300, height: 276 },
      tag: '车队',
      title: '车组是核心对象',
      text: <>一名司机配一辆车才算一个<strong>车组</strong>。点左侧车组,右侧可以训练司机、换车或处理空车,这是后面解锁专车和豪华车的关键。</>,
      bubble: { top: 244, left: 334 },
    },
    {
      spot: { bottom: 20, left: 'calc(50% - 124px)', width: 248, height: 62 },
      tag: '开始',
      title: '现在点开始运营',
      text: <>司机会自动从已解锁片区接单。第一次只需要点<strong>开始运营</strong>;跑起来后再用 2×/4×/8× 压缩等待时间。</>,
      bubble: { bottom: 100, left: '50%', transform: 'translateX(-50%)' },
      isLast: true,
    },
  ];

  const cur = STEPS[step];
  React.useEffect(() => {
    if (!cur.spotSelector) {
      setMeasuredSpot(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector(cur.spotSelector);
      if (!el) {
        setMeasuredSpot(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      const pad = 5;
      setMeasuredSpot({
        top: Math.max(0, rect.top - pad),
        left: Math.max(0, rect.left - pad),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [step, cur.spotSelector]);

  const handleNext = () => {
    SFX.click && SFX.click();
    if (step >= STEPS.length - 1) onClose();
    else setStep(step + 1);
  };
  const handleSkip = () => { SFX.click && SFX.click(); onClose(); };

  return (
    <div className="coach-root">
      {(measuredSpot || cur.spot)
        ? <div className="coach-spot" style={measuredSpot || cur.spot} />
        : <div className="coach-mask-full" />}
      <div className="coach-bubble" style={cur.bubble}>
        <div className="coach-step-num">{cur.tag}</div>
        <div className="coach-title">{cur.title}</div>
        <div className="coach-text">{cur.text}</div>
        <div className="coach-actions">
          <div className="coach-progress" aria-label={`引导进度 ${step + 1}/${STEPS.length}`}>
            {STEPS.map((_, idx) => (
              <span key={idx} className={idx <= step ? 'active' : ''} />
            ))}
          </div>
          <button className="coach-skip" onClick={handleSkip}>跳过</button>
          <button className="coach-next" onClick={handleNext}>
            {cur.isLast ? '知道了' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}
