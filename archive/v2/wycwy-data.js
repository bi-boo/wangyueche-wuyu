/* 网约车物语 V2 - 配置数据 */
(function () {
  const GAME = {
    STARTING_FUNDS: 10000,
    STARTING_REPUTATION: 50,
    TICK_MS: 1000,
    HOURS_PER_DAY: 24,
    DAYS_PER_GAME: 30,
    WIN_FUNDS: 30000,
    WIN_REPUTATION: 500,
    COMMISSION: 0.20,
    STAT_CAP: 99,
    SPARKLINE_LEN: 14,
  };

  // 司机背景模板
  const BACKGROUNDS = [
    {
      id: 'veteran', name: '退伍军人', desc: '纪律严明,夜班抗压,不畏长途',
      boosts: { driving: 18, service: 5, road: 8, mind: 15 },
      salary: 1500, loyalty: 70,
      avatar: { hat: 'cap-army', skin: '#E0AF85', hatColor: '#3F5A3A', accent: '#3F5A3A' },
    },
    {
      id: 'beidrift', name: '北漂青年', desc: '吃苦耐劳,但常想家',
      boosts: { driving: 8, service: 14, road: 6, mind: 4 },
      salary: 1100, loyalty: 50,
      avatar: { hat: 'cap-flat', skin: '#F0C795', hatColor: '#C14A1D', accent: '#C14A1D' },
    },
    {
      id: 'dad', name: '二胎奶爸', desc: '服务好,熟悉路况',
      boosts: { driving: 6, service: 18, road: 14, mind: 8 },
      salary: 1300, loyalty: 80,
      avatar: { hat: 'glasses', skin: '#E8B788', hatColor: '#2A2320', accent: '#6F8FFF' },
    },
    {
      id: 'unemployed', name: '下岗大叔', desc: '稳重平均,学得慢',
      boosts: { driving: 9, service: 9, road: 9, mind: 9 },
      salary: 900, loyalty: 60,
      avatar: { hat: 'bald', skin: '#D9A878', hatColor: '#6D635A', accent: '#6D635A' },
    },
    {
      id: 'influencer', name: '网红司机', desc: '自带流量,服务爆表',
      boosts: { driving: 5, service: 25, road: 6, mind: 4 },
      salary: 1800, loyalty: 40, orderRateBonus: 1.3,
      avatar: { hat: 'headset', skin: '#F5D0AB', hatColor: '#FF6B35', accent: '#FF6B35' },
    },
  ];

  // 车型(图标 svgPath 是简化轮廓)
  const VEHICLES = [
    { id: 'santana', name: '桑塔纳', price: 5000, maint: 20, speed: 1.0, srvBonus: 0,
      eligible: ['short', 'eco'], unlock: 0,
      color: '#9CA3AF', shape: 'sedan' },
    { id: 'camry', name: '凯美瑞', price: 15000, maint: 50, speed: 1.1, srvBonus: 5,
      eligible: ['short', 'business', 'eco'], unlock: 100,
      color: '#1F2937', shape: 'sedan' },
    { id: 'han_ev', name: '比亚迪汉 EV', price: 25000, maint: 30, speed: 1.15, srvBonus: 8,
      eligible: ['short', 'business', 'eco'], unlock: 250,
      color: '#3B82F6', shape: 'ev' },
    { id: 'odyssey', name: '奥德赛', price: 35000, maint: 80, speed: 1.0, srvBonus: 10,
      eligible: ['short', 'business', 'airport', 'long'], unlock: 500,
      color: '#475569', shape: 'mpv' },
    { id: 'benz_e', name: '奔驰 E', price: 80000, maint: 200, speed: 1.2, srvBonus: 20,
      eligible: ['business', 'airport', 'long', 'luxury'], unlock: 800,
      color: '#0F172A', shape: 'luxury' },
  ];

  // 订单类型(每种带颜色 + 图标 hint)
  const ORDERS = [
    { id: 'short', name: '市内短途', km: 3, fare: 28, hours: 1, req: {}, rate: 0.65,
      color: '#FF8A65', icon: 'short', zone: 'downtown' },
    { id: 'business', name: '商务接送', km: 8, fare: 75, hours: 1,
      req: { service: 30 }, rate: 0.30, hours_window: [7, 21],
      color: '#0EA5E9', icon: 'business', zone: 'cbd' },
    { id: 'airport', name: '机场专线', km: 25, fare: 180, hours: 2,
      req: { driving: 30 }, partReq: 'rack', rate: 0.20,
      color: '#22C55E', icon: 'airport', zone: 'airport' },
    { id: 'night', name: '深夜场', km: 6, fare: 110, hours: 1,
      req: { mind: 50 }, rate: 0.45, hours_window: [22, 5],
      color: '#8B5CF6', icon: 'night', zone: 'downtown' },
    { id: 'long', name: '城际长途', km: 80, fare: 480, hours: 4,
      req: { road: 60 }, partReq: 'etc', rate: 0.10,
      color: '#F59E0B', icon: 'long', zone: 'station' },
    { id: 'luxury', name: '高端商务', km: 12, fare: 280, hours: 2,
      req: { service: 70 }, rate: 0.15,
      color: '#EC4899', icon: 'luxury', zone: 'cbd' },
    { id: 'eco', name: '环保任务', km: 5, fare: 55, hours: 1, req: {}, rate: 0.20,
      color: '#10B981', icon: 'eco', zone: 'residential' },
  ];

  // 城市区域
  const ZONES = [
    { id: 'cbd', name: 'CBD 商务区', x: 60, y: 30, hot: ['business', 'luxury'] },
    { id: 'airport', name: '机场', x: 90, y: 70, hot: ['airport'] },
    { id: 'station', name: '火车站', x: 30, y: 50, hot: ['long', 'short'] },
    { id: 'residential', name: '住宅区', x: 20, y: 80, hot: ['short', 'eco'] },
    { id: 'downtown', name: '老城区', x: 50, y: 60, hot: ['short', 'night'] },
  ];

  // 改装件
  const PARTS = [
    { id: 'massage', name: '真皮按摩座椅', price: 2000, effect: '服务上限 +10', icon: 'seat' },
    { id: 'aroma', name: '车载香薰', price: 500, effect: '好评率 +15%', icon: 'aroma' },
    { id: 'recorder', name: '行车记录仪', price: 800, effect: '投诉率 -30%', icon: 'cam' },
    { id: 'etc', name: 'ETC 高速年卡', price: 1000, effect: '解锁城际单', icon: 'card' },
    { id: 'rack', name: '行李架', price: 600, effect: '解锁机场单', icon: 'rack' },
    { id: 'fridge', name: '后排小冰箱', price: 3000, effect: '商务单 +20% 单价', icon: 'fridge' },
  ];

  // 培训
  const TRAININGS = [
    { id: 'driving', name: '模拟驾驶舱', stat: 'driving', cost: 200, gainMin: 4, gainMax: 7, color: '#FF6B35' },
    { id: 'service', name: '服务礼仪课', stat: 'service', cost: 300, gainMin: 4, gainMax: 7, color: '#0EA5E9' },
    { id: 'road', name: '城市道路课', stat: 'road', cost: 250, gainMin: 4, gainMax: 7, color: '#10B981' },
    { id: 'mind', name: '心理咨询室', stat: 'mind', cost: 150, gainMin: 4, gainMax: 7, color: '#8B5CF6' },
  ];

  // 司机职业等级
  const RANKS = [
    { id: 'rookie', name: '新手司机', need: {}, salaryMul: 1.0, fareMul: 1.0, color: '#9CA3AF' },
    { id: 'skilled', name: '熟练司机', need: { driving: 30 }, salaryMul: 1.2, fareMul: 1.1, color: '#0EA5E9' },
    { id: 'gold', name: '金牌司机', need: { service: 50 }, salaryMul: 1.5, fareMul: 1.25, color: '#F59E0B' },
    { id: 'night', name: '夜行神龙', need: { mind: 60 }, salaryMul: 1.8, fareMul: 1.4, color: '#8B5CF6' },
    { id: 'master', name: '专车老炮', need: { driving: 80, service: 80, road: 80, mind: 80 }, salaryMul: 2.5, fareMul: 1.8, color: '#EC4899' },
  ];

  // 随机事件
  const EVENTS = [
    {
      id: 'rain', title: '暴雨天来了', tag: '天气', emoji: 'rain',
      desc: '今天下大雨,平台订单需求暴涨。要让司机出车吗?',
      options: [
        { label: '全员出车', detail: '订单 +60%,但事故风险上升', apply: () => ({ orderBoost: 1.6 }) },
        { label: '只出金牌', detail: '让金牌以上司机出车,稳健赚钱', apply: () => ({ orderBoost: 1.3 }) },
        { label: '全员休息', detail: '今天放假,口碑 +5', apply: () => ({ reputation: 5 }) },
      ],
    },
    {
      id: 'platform', title: '平台抽成调整', tag: '行业', emoji: 'biz',
      desc: '滴答出行宣布抽成从 20% 涨到 25%。你的应对策略?',
      options: [
        { label: '硬扛', detail: '继续合作,接受新抽成', apply: () => ({ commissionRate: 0.25 }) },
        { label: '签独家', detail: '答应独家协议,抽成回到 18%,但 -5 口碑', apply: () => ({ commissionRate: 0.18, reputation: -5 }) },
        { label: '搞自营小程序', detail: '花 ¥5,000 自建,从此抽成 0%', apply: () => ({ commissionRate: 0, funds: -5000 }) },
      ],
    },
    {
      id: 'borrow', title: '老张找你借钱', tag: '人事', emoji: 'people',
      desc: '老张儿子要交学费,缺 ¥2,000,来找你借。',
      options: [
        { label: '借给他', detail: '-¥2,000 资金,司机忠诚度 +30', apply: () => ({ funds: -2000, allLoyalty: 30 }) },
        { label: '当奖金发', detail: '-¥2,000 资金,所有司机忠诚度 +50', apply: () => ({ funds: -2000, allLoyalty: 50 }) },
        { label: '装作没看见', detail: '所有司机忠诚度 -20', apply: () => ({ allLoyalty: -20 }) },
      ],
    },
    {
      id: 'celeb', title: '明星打到你家车', tag: '运气', emoji: 'star',
      desc: '一名歌手打到了你的车,司机服务很到位。',
      options: [
        { label: '配合宣传', detail: '+15 口碑,但司机被偷拍隐私', apply: () => ({ reputation: 15, allLoyalty: -10 }) },
        { label: '低调处理', detail: '+8 口碑,司机赞', apply: () => ({ reputation: 8, allLoyalty: 5 }) },
      ],
    },
    {
      id: 'newpolicy', title: '网约车新政', tag: '监管', emoji: 'gov',
      desc: '当地颁布新政,3 年以上车龄车辆将被限制接单。',
      options: [
        { label: '主动更新车队', detail: '口碑 +10', apply: () => ({ reputation: 10 }) },
        { label: '观望', detail: '看后续政策,口碑 -3', apply: () => ({ reputation: -3 }) },
      ],
    },
    {
      id: 'newyear', title: '春节将至', tag: '节日', emoji: 'festival',
      desc: '春节快到了,司机们想回家。',
      options: [
        { label: '春节红包', detail: '-¥3,000,所有忠诚度 +40', apply: () => ({ funds: -3000, allLoyalty: 40 }) },
        { label: '加倍工资留人', detail: '-¥2,000,跑春运,订单 +50% 一周', apply: () => ({ funds: -2000, orderBoost: 1.5, boostDuration: 7 }) },
        { label: '正常过节', detail: '不加薪,部分司机心情低落', apply: () => ({ allLoyalty: -10 }) },
      ],
    },
    {
      id: 'rival', title: '竞品挖人', tag: '竞争', emoji: 'rival',
      desc: '隔壁滴答车队想用月薪 +¥500 挖你最强的司机。',
      options: [
        { label: '加薪挽留', detail: '-¥500/月,司机留下,忠诚度 +30', apply: () => ({ keepBest: true, salaryRaise: 500 }) },
        { label: '升职管理岗', detail: '司机变组长,新司机继承属性', apply: () => ({ promoteBest: true }) },
        { label: '放走', detail: '司机离职,-10 口碑', apply: () => ({ loseBest: true, reputation: -10 }) },
      ],
    },
    {
      id: 'accident', title: '小李出小事故', tag: '人事', emoji: 'crash',
      desc: '小李剐蹭了一辆豪车,对方索赔 ¥3,000。',
      options: [
        { label: '公司全付', detail: '-¥3,000,司机忠诚度 +20', apply: () => ({ funds: -3000, allLoyalty: 20 }) },
        { label: '走保险', detail: '-¥1,500,口碑 -5', apply: () => ({ funds: -1500, reputation: -5 }) },
        { label: '让司机自付', detail: '所有忠诚度 -30', apply: () => ({ allLoyalty: -30 }) },
      ],
    },
  ];

  const FIRST_NAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '何', '高', '罗'];
  const LAST_NAMES_M = ['伟', '勇', '军', '建国', '建军', '强', '磊', '涛', '明', '辉', '兵', '波', '华', '志强', '志刚', '海军', '小刚', '大伟', '永福'];

  const ACHIEVEMENTS = [
    { id: 'first_order', name: '第一笔生意', desc: '完成第一单', check: (s) => s.totalCompleted >= 1 },
    { id: 'orders_50', name: '小有规模', desc: '累积 50 单', check: (s) => s.totalCompleted >= 50 },
    { id: 'orders_200', name: '车队雏形', desc: '累积 200 单', check: (s) => s.totalCompleted >= 200 },
    { id: 'first_skilled', name: '第一名熟练司机', desc: '司机驾驶 ≥ 30', check: (s) => s.drivers.some(d => d.stats.driving >= 30) },
    { id: 'first_gold', name: '第一名金牌', desc: '司机服务 ≥ 50', check: (s) => s.drivers.some(d => d.stats.service >= 50) },
    { id: 'rep_200', name: '口碑突破 200', desc: '城市口碑 ≥ 200', check: (s) => s.reputation >= 200 },
    { id: 'funds_20k', name: '小金库', desc: '资金 ≥ ¥20,000', check: (s) => s.funds >= 20000 },
  ];

  window.WYCWY_DATA = {
    GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES,
    PARTS, TRAININGS, RANKS, EVENTS,
    FIRST_NAMES, LAST_NAMES_M, ACHIEVEMENTS,
  };
})();
