/* 网约车物语 V10.14 - 配置数据(北京区片地图) */
(function () {
  const GAME = {
    STARTING_FUNDS: 10000,
    STARTING_REPUTATION: 50,
    // 节奏基准:1× 下 2.5 秒推进 1 游戏小时,主线目标约 25-35 分钟。
    TICK_MS: 2000,
    HOURS_PER_DAY: 24,
    // 不再有 30 天限时,玩家自行决定何时通关或继续
    COMMISSION: 0.20,
    STAT_CAP: 99,
    EVENT_INTERVAL_DAYS: 7,
    EARLY_EVENT_UNTIL_DAY: 10,
    CHAIN_EVENT_START_DAY: 21,
    // V15.x:开局前 10 天只抽 unlockMission=0 的事件白名单
    EARLY_EVENT_IDS: ['oil_price', 'back_pain', 'rain_base', 'newyear_base', 'borrow_seed'],
    FOCUSED_EVENT_CHOICES: true,
    // V14.67: FATIGUE_REST_THRESHOLD / FATIGUE_RECOVERY_PER_DAY 已删,疲劳机制整套移除。
    // 死亡阈值
    DEATH_FUNDS_THRESHOLD: 0,        // 资金 < 0 触发投资人压力
    DEATH_FUNDS_DAYS: 5,              // 资金负 5 天 = 破产
    // V12: 半订单池供需机制
    LOSS_REPUTATION_PENALTY: 1,       // 1 单流失 = 城市口碑 -1(温和惩罚,避免秒打到 0)
    MIN_ORDER_FARES: { short: 48, business: 88, airport: 220, luxury: 360 },
  };

  // V6: 终局阈值上调 — 真正的"结束游戏"难度,不再是放着自动达成
  // tier 1 是最低结局,tier 5 是终极
  // 玩家达成任一阶段时,弹窗提示"领奖结束 / 继续冲击"
  // 达成 tier 5 (IPO) → 强制结束(无更高目标)
  const operatingCrewCount = (s) => {
    const vehicleIds = new Set((s.vehicles || []).map((v) => v.id));
    return (s.drivers || []).filter((d) => d.vehicleId && vehicleIds.has(d.vehicleId)).length;
  };
  const orderReadyCrewCount = (s, orderId) => {
    const order = ORDERS.find((o) => o.id === orderId);
    if (!order) return 0;
    const vehicleIds = new Set((s.vehicles || []).map((v) => v.id));
    return (s.drivers || []).filter((d) => {
      if (!d.vehicleId || !vehicleIds.has(d.vehicleId)) return false;
      const vehicle = (s.vehicles || []).find((v) => v.id === d.vehicleId);
      const vd = VEHICLES.find((tpl) => tpl.id === vehicle?.templateId);
      if (!vd || !vd.eligible.includes(order.id)) return false;
      return Object.entries(order.req || {}).every(([key, val]) => (d.stats?.[key] || 0) >= val);
    }).length;
  };
  const hasCrewOrderReady = (s, orderId) => {
    return orderReadyCrewCount(s, orderId) > 0;
  };
  const ENDINGS = [
    {
      id: 'individual',
      name: '个体户',
      desc: '你和老张守着 3-4 辆车,小日子稳了。这是绝大多数下海老板能到的位置。',
      tier: 1,
      targets: { funds: 25000, reputation: 160, crews: 3 },
      check: (s) => s.funds >= 25000 && s.reputation >= 160 && operatingCrewCount(s) >= 3,
      detail: '资金 ≥ ¥25,000、口碑 ≥ 160、可运营车组 ≥ 3',
      forceEnd: false,
    },
    {
      id: 'regional_brand',
      name: '区域品牌',
      desc: '本地晚报报道了你的车队,街坊都打过你的车。需要至少 1 个能跑专车订单的车组。',
      tier: 2,
      targets: { funds: 80000, reputation: 400, crews: 5, requireOrderReady: 'airport' },
      check: (s) => s.funds >= 80000 && s.reputation >= 400 && operatingCrewCount(s) >= 5
        && hasCrewOrderReady(s, 'airport'),
      detail: '资金 ≥ ¥80,000、口碑 ≥ 400、可运营车组 ≥ 5、至少 1 个专车车组',
      forceEnd: false,
    },
    {
      id: 'top_3',
      name: '全市 Top 3',
      desc: '你的车队挤进全市高端订单榜前三,平台开始把核心商务单分给你。',
      tier: 3,
      targets: { funds: 200000, reputation: 600, crews: 7, requireOrderReady: 'luxury' },
      check: (s) => s.funds >= 200000 && s.reputation >= 600 && operatingCrewCount(s) >= 7
        && hasCrewOrderReady(s, 'luxury'),
      detail: '资金 ≥ ¥200,000、口碑 ≥ 600、可运营车组 ≥ 7、至少 1 个豪华车组',
      forceEnd: false,
    },
    {
      id: 'acquired',
      name: '被巨头收购',
      desc: '滴答出行看中的不是几辆车,而是你能稳定复制豪华车组和服务标准。',
      tier: 4,
      targets: { funds: 500000, reputation: 800, crews: 9, requireOrderReady: 'luxury', requireOrderReadyCount: 3 },
      check: (s) => s.funds >= 500000 && s.reputation >= 800 && operatingCrewCount(s) >= 9
        && orderReadyCrewCount(s, 'luxury') >= 3,
      detail: '资金 ≥ ¥500,000、口碑 ≥ 800、可运营车组 ≥ 9、至少 3 个豪华车组',
      forceEnd: false,
    },
    {
      id: 'ipo',
      name: 'IPO 上市',
      desc: '敲钟仪式那天,你给老张发了股票期权。小车队变成了真正的出行公司。',
      tier: 5,
      targets: { funds: 1000000, reputation: 1000, crews: 12 },
      check: (s) => s.funds >= 1000000 && s.reputation >= 1000 && operatingCrewCount(s) >= 12,
      detail: '资金 ≥ ¥1,000,000、口碑 ≥ 1000、可运营车组 ≥ 12',
      forceEnd: true,  // 顶级结局,达成强制结束
    },
  ];

  // 司机背景模板
  // V6: 10 种司机 + 4 档稀有度
  // N(普通) / R(稀有) / SR(史诗) / SSR(传说)
  const BACKGROUNDS = [
    // ===== N 普通 (4) =====
    {
      id: 'veteran', name: '退伍军人', desc: '纪律严明,夜班抗压',
      rarity: 'N',
      boosts: { driving: 18, service: 5 },
      salary: 4200, loyalty: 70,
      avatar: { asset: 'veteran', hat: 'cap-army', skin: '#E0AF85', hatColor: '#3F5A3A', accent: '#3F5A3A' },
      stories: {
        soul: {
          title: '老连长打到了车',
          text: '后排那位白发军人盯着工牌看了半天:"小张?八年前西藏服役那个?"是赵连长。一路没说几句话。下车时连长拍了拍他肩膀:"开得稳。"他打着双闪在路边停了五分钟才挂挡。',
          reward: { loyalty: 20, badge: '老兵' },
        },
        slices: [
          { title: '帮老兵代驾去医院',
            text: '一位坐轮椅的老兵打车去复查,两个保安抬不动。他自己下来,把人抱上副驾,轮椅折好放后备箱。一路上老人没说话,下车时摸出五十块钱要给他。他只收了车费。',
            reward: { reputation: 5 } },
          { title: '高速救援的那一夜',
            text: '凌晨三点,一辆小车在高速应急道熄火,带着孩子的母亲在哭。他停下,递了瓶水给孩子,陪着等到救援。回程绕了四十公里。那天他没接一单,但回来睡得很踏实。',
            reward: { funds: 1500, loyalty: 10 } },
          { title: '战友在朋友圈刷到他',
            text: '一个三年没联系的战友突然加他微信:"你现在开车?"他回了个"嗯"。对方发了一张当年班里的合照过来。他存进相册,没回话。' },
          { title: '接到当年新兵的家长',
            text: '后排那对夫妻在说儿子刚去当兵。他听了一路,在红绿灯口插了句:"前三个月最难,熬过去就好了。"对方愣了一下问他怎么知道。他没接话,只是把空调调高了两度。',
            reward: { reputation: 10, loyalty: 15 } },
          { title: '部队邀请做退役职工导师',
            text: '一封盖了红章的信寄到家里,问他能不能去给即将退伍的战友做就业指导。老婆把信摊在饭桌上,没催他做决定。他把信叠好,放进抽屉里跟那张老照片摆在一起。',
            reward: { funds: 4000, reputation: 10, badge: '兵哥导师' } },
        ],
      },
    },
    {
      id: 'beidrift', name: '北漂青年', desc: '吃苦耐劳,但常想家',
      rarity: 'N',
      boosts: { driving: 8, service: 14 },
      salary: 3600, loyalty: 50,
      avatar: { asset: 'beidrift', hat: 'cap-flat', skin: '#F0C795', hatColor: '#C14A1D', accent: '#C14A1D' },
      stories: {
        soul: {
          title: '第一次给老家寄钱',
          text: '跑完第 100 单回家,他在抽屉里翻出张邮政汇款单。来北京三年,这是他第一次寄钱回去。他寄了五千,留言只写了一行:"爸,新工作还行,别担心。"他没说"司机"两个字。',
          reward: { loyalty: 20, badge: '在北京站住脚的人' },
        },
        slices: [
          { title: '帮邻居修水管',
            text: '凌晨收车回出租屋,楼道里在漏水。他蹲下去拧了半小时,膝盖跪在脏水里。隔壁阿姨开门道谢,塞给他一个温热的包子。他接过来,没在楼道里吃,带回房间才咬了一口。' },
          { title: '女朋友坐他车来北京',
            text: '老家那班高铁到站,他在出站口接她。她拖着两个箱子,看到车顶的网约车标识愣了一下。他抢过箱子塞进后备箱,什么都没解释。一路上她没问,他也没说。',
            reward: { funds: 1500, loyalty: 15 } },
          { title: '跑车遇到中学同学不敢认',
            text: '后排那个穿西装打电话的男人是他高中同桌。当年班里成绩比他差。他全程低着头,把空调声调大了点。下车时同学塞给他一张名片说"哥们打车多关照",没认出来。' },
          { title: '春运返程跑了一夜',
            text: '除夕前一天他没买到回家的票,一直在跑活。凌晨四点路过北京西站,广场上黑压压都是人。他把车停在路边,啃完一个冷馒头,继续跑。手机里有八个未接来电,都是妈妈的。',
            reward: { funds: 2000, reputation: 5 } },
          { title: '在北京付了房子首付',
            text: '签合同那天他穿了件新衬衫。中介问他"要不要再考虑一下",他摇摇头。回家路上他给爸打电话:"爸,我在北京有房了。"对面沉默了很久,只说了一句:"啥时候让你妈来住几天。"',
            reward: { funds: 5000, reputation: 15, badge: '扎根的人' } },
        ],
      },
    },
    {
      id: 'dad', name: '二胎奶爸', desc: '服务好,熟悉路况',
      rarity: 'N',
      boosts: { driving: 6, service: 18 },
      salary: 3900, loyalty: 80,
      avatar: { asset: 'dad', hat: 'glasses', skin: '#E8B788', hatColor: '#2A2320', accent: '#6F8FFF' },
      stories: {
        soul: {
          title: '第一次没接女儿放学',
          text: '他答应女儿四点去校门口接,临出发被一单专车订单绊住。回来路上路过学校,操场已经空了。女儿一个人坐在台阶上,书包放在腿上。他停车跑过去,女儿抬头说:"爸,妈妈说你忙。"',
          reward: { loyalty: 20, badge: '父亲' },
        },
        slices: [
          { title: '二胎妈妈半夜打到他车',
            text: '凌晨两点,一对年轻夫妻拦车,女人捂着肚子。他踩油门往妇产医院冲,后排男的手在抖。下车时男的从钱包里抽了五百要给他,他摆摆手:"我老婆生二胎那会儿,也是个司机师傅送的。"',
            reward: { reputation: 8, loyalty: 10 } },
          { title: '碰到女儿同学家长',
            text: '后排那位妈妈是女儿班里学习委员的妈。他听她跟朋友说着孩子的奥数班、英语班、钢琴课。他握着方向盘,想起女儿前两天说想学画画,他说等过两个月。' },
          { title: '老婆发现他车里偷藏的零食',
            text: '老婆来给他送饭,顺手翻车里。副驾杂物箱里全是零食:辣条、薯片、士力架。她哭笑不得:"你血压都不能吃这些。"他嘿嘿笑:"备着孩子上车有得吃。"',
            reward: { loyalty: 10 } },
          { title: '大女儿小学家长会他穿了西装',
            text: '为了这场家长会他特意翻出结婚那年穿的西装。坐在小板凳上听班主任表扬女儿。散会时女儿跑过来牵他手,班主任看了他一眼:"您家爸爸真讲究。"他笑了一下,后背全是汗。',
            reward: { reputation: 8, loyalty: 15 } },
          { title: '二胎出生那夜他在跑专车订单',
            text: '老婆破水那晚他在跑专车订单,八十公里堵在五环上。他给丈母娘打电话让她送医院。落地后看到护士发来的视频,孩子在哭。他在停车场坐了二十分钟才发动车。',
            reward: { funds: 3000, reputation: 10, badge: '两个孩子的父亲' } },
        ],
      },
    },
    {
      id: 'unemployed', name: '下岗大叔', desc: '稳重平均,学得慢',
      rarity: 'N',
      boosts: { driving: 9, service: 9 },
      salary: 3200, loyalty: 60,
      avatar: { asset: 'unemployed', hat: 'bald', skin: '#D9A878', hatColor: '#6D635A', accent: '#6D635A' },
      stories: {
        soul: {
          title: '钢厂老同事打到了他车',
          text: '后排那个穿冲锋衣的男人盯着他后视镜看了半天。"老李,真是你?"他听出声音了,是当年钢厂三车间的老周。两人沉默地走完了二十公里。下车时老周说:"我在物流公司,有合适岗位给你打电话。"那张名片他在副驾驶放了三个月。',
          reward: { loyalty: 20, badge: '钢厂出来的人' },
        },
        slices: [
          { title: '接到了曾经的厂长',
            text: '他认出来的瞬间,手心出汗。当年裁员名单是这位签的字。厂长全程在打电话谈生意,没注意他。下车付车费,厂长抬头看了他一眼,愣了一秒:"老李?"他点点头,把发票递过去。厂长没说话,转身走了。' },
          { title: '路过原来的钢厂工地',
            text: '工地上正在拆原来的车间,塔吊把厂牌从大门上拽下来。他靠边停了一下,坐了五分钟。前排乘客问他怎么了,他说没事。继续开。',
            reward: { reputation: 5 } },
          { title: '还清下岗那年最后一笔欠款',
            text: '小舅子家借的两万,前后还了九年。最后这次他坚持要去还现金。小舅子说不用了。他把信封放在桌上,转身走出门。回家路上他破天荒抽了根烟,虽然医生说他不能抽。',
            reward: { funds: 2000, loyalty: 10 } },
          { title: '老婆把欠条烧了',
            text: '那天回家他没吭声把车停好。老婆在客厅烧着一沓东西。走近一看,是九年前下岗那阵借钱救命的欠条。"都还清了。"老婆没回头。他在门口站了很久,才走过去坐下。',
            reward: { funds: 3000, reputation: 10, badge: '翻身的人' } },
          { title: '同年下岗的工友约喝酒',
            text: '老周老周老周打电话来,说当年三车间的还在的几个想聚一聚。他纠结了三天,最后去了。饭桌上没人提当年的事,只聊孩子上学、老婆身体。他喝了三杯就脸红,但那天他笑得最多。',
            reward: { reputation: 8, loyalty: 15 } },
        ],
      },
    },
    // ===== R 稀有 (2) =====
    {
      id: 'influencer', name: '网红司机', desc: '自带流量,服务爆表,接单率 +30%',
      rarity: 'R',
      boosts: { driving: 28, service: 45 },
      salary: 6500, loyalty: 40, orderRateBonus: 1.3,
      avatar: { asset: 'influencer', hat: 'headset', skin: '#F5D0AB', hatColor: '#FF6B35', accent: '#FF6B35' },
      stories: {
        soul: {
          title: '第一次百万播放',
          text: '那条「网约车司机的二十四小时」凌晨破了一百万。评论里有人骂他装,有人说真情怀,还有人留言说自己也想去开车。他翻到深夜,关掉手机。第二天五点照常出门,没跟任何人说这事。',
          reward: { loyalty: 20, badge: '百万播放' },
        },
        slices: [
          { title: '粉丝送他一面锦旗',
            text: '一个二十出头的女孩约他单子,下车时从包里掏出一面卷起来的锦旗,上面绣着"哥真实"。他笑着收下,放在后备箱。回到出租屋打开看,锦旗上字是手缝的。他给老婆发了张照片。',
            reward: { reputation: 8, loyalty: 10 } },
          { title: '同行视频骂他蹭流量',
            text: '另一个司机博主发视频说他"把行业的辛苦做成了卖惨人设"。评论区刷得很难看。他没回复,只是把那条视频转给老婆看。老婆只回了一句:"做你的事。"' },
          { title: 'MCN 找上门',
            text: '一家公司的人在他家楼下等了一下午。说要给他做账号、出周边、签独家。合同摆在桌上,数字看得他心跳加速。他签字前问了句:"我还能继续开车吗?"对方愣了一下:"开啊,我们就要这个真实感。"',
            reward: { funds: 2000 } },
          { title: '出了周边手办',
            text: '一千个 Q 版手办堆在他出租屋里。他坐在床边数了一晚上,数到第三百个开始觉得这事荒唐。第二天他在直播里说"先送两百个粉丝",后来收到很多手写的感谢信。',
            reward: { funds: 1500, reputation: 8 } },
          { title: '签 MCN 但保留司机身份',
            text: '续约那天他坚持要在合同里加一条:"乙方有权继续从事网约车驾驶工作。"对方笑他傻。他没解释。回家路上他特意接了一单短途,送一个赶飞机的乘客。两百块的单,跑得比平时快了五分钟。',
            reward: { funds: 3000, reputation: 10, badge: '不下车的网红' } },
        ],
      },
    },
    {
      id: 'old_taxi', name: '出租老司机', desc: '20 年驾龄,所有路况都熟',
      rarity: 'R',
      boosts: { driving: 42, service: 28 },
      salary: 7200, loyalty: 75,
      avatar: { asset: 'old_taxi', hat: 'cap-flat', skin: '#C9A07A', hatColor: '#8B5A2B', accent: '#8B5A2B' },
      stories: {
        soul: {
          title: '给徒弟讲老规矩',
          text: '车队来了个二十多岁的小伙子,刚拿网约车证。他被安排带新人。他没讲怎么抢单,只讲了一件事:车上要常备一包餐巾纸。"乘客咳嗽、孩子流鼻涕、姑娘哭,都用得上。这是出租车那二十年传下来的。"小伙子一边记一边点头。',
          reward: { loyalty: 20, badge: '老师傅' },
        },
        slices: [
          { title: '二十年前接过的乘客又上车',
            text: '那是个上了年纪的女人,上车时盯着他后视镜。"师傅,你以前是不是开 6433 出租?"他点点头。她说她当年下班被他送回家,还的零钱忘记给孩子买奶粉了,他追到楼下塞给她。"我那会儿在月子里没记住您的样子。"',
            reward: { reputation: 8, loyalty: 10 } },
          { title: '接到跟他同年的乘客',
            text: '后排是个跟他差不多岁数的男人,在打电话谈裁员的事。挂了电话两人一路无话。下车时那人拍了拍他副驾椅背:"师傅,您这把岁数还在跑,佩服。"他笑了一下,没说自己当年也被裁过。' },
          { title: '遇到当年同事开网约车',
            text: '红绿灯口旁边那辆车的司机是老刘,二十年前的同事。两人摇下车窗对视了一眼,各自笑了笑。绿灯亮了,各自往前开。晚上他给老刘发了条短信:"老地方喝一杯?"',
            reward: { reputation: 5, loyalty: 10 } },
          { title: '教徒弟被乘客录视频',
            text: '徒弟刚上手不久,有次差点跟前车贴上。后排乘客录了视频发到网上,说"老司机带新司机危险驾驶"。他主动联系平台,承担了责任。徒弟红着眼问他为啥不澄清。他说:"以后你带人就懂了。"',
            reward: { loyalty: 15 } },
          { title: '写自传被出版社退稿',
            text: '他写了三年的自传寄给七家出版社,都被退了。最后一封退稿信说"市场对司机题材兴趣不大"。他把稿子叠起来塞回抽屉,跟当年开出租那本旧手册放在一起。第二天他又出车了,跟没事人一样。',
            reward: { funds: 4000, reputation: 8, badge: '没出版的作家' } },
        ],
      },
    },
    // ===== SR 史诗 (2) =====
    {
      id: 'ex_didi_gold', name: '平台金牌司机',
      desc: '前金牌司机,服务稳定,口碑增长快',
      rarity: 'SR',
      boosts: { driving: 60, service: 70 },
      salary: 11000, loyalty: 60,
      avatar: { asset: 'ex_didi_gold', hat: 'glasses', skin: '#E0AF85', hatColor: '#FFD93D', accent: '#FFD93D' },
      stories: {
        soul: {
          title: '老雇主想挖他回去',
          text: '滴答平台的运营经理深夜约他喝酒。"金哥,回来吧,工资翻倍。"他笑了笑,把酒杯里剩的半口喝完。"你们抽成多少?"对方没接话。他付了酒钱,握手告别。第二天他给现在的老板发了条短信:"明早六点出车。"',
          reward: { loyalty: 20, badge: '不回头' },
        },
        slices: [
          { title: '在平台年会上见到老同事',
            text: '行业沙龙上他遇到当年滴答金牌组的老同事。对方刚晋升运营总监,西装革履。两人寒暄了几句,对方说"咱们这一批就剩你还在开车了"。他笑笑,递过去一张名片。回家路上他又接了三单。',
            reward: { reputation: 5 } },
          { title: '接到曾经的金牌同期对手',
            text: '后排这位是当年抢他单抢得最凶的张师傅。张师傅没认出他,在电话里抱怨现在跑车不赚钱。他全程沉默,下车时张师傅看了他工牌一眼,愣住了。两人没说话,握了一下手。',
            reward: { reputation: 5, loyalty: 10 } },
          { title: '给新司机做培训分享',
            text: '车队让他给新人讲一节课。他没讲套路,只讲了一件事:第一次因为绕路被投诉那天,他在路边坐了一个小时,然后给自己定了三个规矩。新人以为他要展开讲,他摆摆手:"规矩不重要,重要的是你愿意定。"',
            reward: { funds: 2000, reputation: 8 } },
          { title: '老平台找他录"前金牌"广告',
            text: '滴答找他拍一支宣传片,词都写好了——"我曾是金牌,现在依然在路上"。他读了三遍剧本,把"曾是"两个字划掉,改成"是"。导演问他啥意思。他说:"金牌这事,不是平台发的,是自己定的。"',
            reward: { funds: 3000, reputation: 10 } },
          { title: '自己开了司机培训机构',
            text: '他把这几年攒的钱拿出来,租了间二十平米的小教室,招了两个学员。第一天上课他就讲了那个老规矩:"以后不管谁给你发金牌,记住自己心里的金牌长啥样。"两个学员认真做了笔记。',
            reward: { funds: 5000, reputation: 15, badge: '司机的师傅' } },
        ],
      },
    },
    {
      id: 'soe_manager', name: '管理型骨干',
      desc: '转行司机的前国企管理者,稳如老狗',
      rarity: 'SR',
      boosts: { driving: 50, service: 65 },
      salary: 12000, loyalty: 90,
      avatar: { asset: 'soe_manager', hat: 'glasses', skin: '#D9A878', hatColor: '#1F2937', accent: '#4A90E2' },
      stories: {
        soul: {
          title: '单位老下属上了他的车',
          text: '后排那个看手机的男人是他当年的下属小赵,现在已经是部门主任。小赵盯着他工牌看了半分钟,什么都没说。下车时小赵犹豫了一下,从钱包里抽出一张名片:"王哥,有需要随时找我。"他没接,说:"我现在挺好。"',
          reward: { loyalty: 20, badge: '不打名片的人' },
        },
        slices: [
          { title: '接到原单位的副总',
            text: '副总没认出他,只是在电话里跟人吐槽现在的下面人不行。"还是当年老王那批人懂事。"他握紧方向盘,听了一路。下车时副总把零钱凑给他:"师傅人挺稳的,有空来我们公司吧,缺这种司机。"他点点头,没说什么。' },
          { title: '路过原单位办公楼',
            text: '送一单去 CBD 路过那栋楼,玻璃幕墙上贴着他离职时还没立项的新标语。他把车窗摇下来透了一口气。后排乘客问他是不是迷路了。他笑笑:"知道路。"',
            reward: { reputation: 5 } },
          { title: '把儿子也送来开车',
            text: '儿子大学毕业找不到合适工作。他没逼,只是问:"想跟我一起跑吗?半年。"儿子答应了。第一天他没教任何东西,只让儿子坐副驾,自己跑了一天。回家路上儿子说:"爸,你以前给我讲管理时,我都没听进去。"',
            reward: { funds: 2000, loyalty: 15 } },
          { title: '在驾驶座写起了管理笔记',
            text: '副驾杂物箱里多了一个小本子。等单的间隙他在上面写字:车队怎么排班、怎么分单、怎么处理司机情绪。他自己笑自己——以前在写字楼里写报表是工作,现在在车里写本子是兴趣。',
            reward: { funds: 1500, reputation: 5 } },
          { title: '写了本「跑车手册」内部流通',
            text: '一本三万字的小册子在车队里流传开,封面手写「跑车手册——一个前国企经理的笔记」。有人复印,有人转发。他不收钱,只要求"看完了就传给下一个司机"。三个月后,手册传到了一千多人手里。',
            reward: { funds: 5000, reputation: 15, badge: '车队顾问' } },
        ],
      },
    },
    // ===== SSR 传说 (2) — 满级司机 =====
    {
      id: 'driving_master', name: '赛车系王牌',
      desc: '车技满级,起步即专车老炮,夜行神龙双修',
      rarity: 'SSR',
      boosts: { driving: 95, service: 80 },
      salary: 18000, loyalty: 50,
      avatar: { asset: 'driving_master', hat: 'headset', skin: '#E8B788', hatColor: '#E84545', accent: '#E84545' },
      stories: {
        soul: {
          title: '业余赛车圈认出了他',
          text: '后排那个戴鸭舌帽的男人盯着他握方向盘的姿势看了半天。"师傅,您是练过的?"他没回答。男人从手机里翻出一张照片——十年前国内某场拉力赛的领奖台。"这是您。"他踩刹车,在路边停了。"现在不练了。"',
          reward: { loyalty: 20, badge: '退役' },
        },
        slices: [
          { title: '老队友半夜打车找他',
            text: '凌晨三点叫到他车的是当年同队的小马,现在在做赛车学校教练。小马上车第一句话:"老子全网找你三年了。"他笑了笑没接。一路上小马说现在的车队、现在的学员,他只是嗯。下车时小马说:"想清楚了给我电话。"',
            reward: { loyalty: 10 } },
          { title: '经过当年训练的赛道',
            text: '送一单经过郊外,远远看到那条赛道的弯道。他在路边停了一下,摇下车窗。十年前他在那个弯道翻过一次车,出院后他就没再上过赛道。后排乘客没催他。三分钟后,他重新发动了车。',
            reward: { reputation: 5 } },
          { title: '一个汽车媒体来采访',
            text: '记者打了三次电话才约到他。他要求采访只在车里进行,不拍脸。记者问他为什么不回赛车圈。他想了一下:"赛车是赢别人的事。开网约车,是不输给自己。"记者把这句话写进了文章里。',
            reward: { funds: 2000, reputation: 10 } },
          { title: '业余拉力赛拿了名次',
            text: '车队报名一个城市业余拉力赛玩玩,他被推上了赛道。下场那天他穿着普通的工装,没穿赛服。最后拿了第三。颁奖台上他没多笑,握了一下奖杯就转身。回家路上又接了一单短途。',
            reward: { funds: 3000, reputation: 8 } },
          { title: '收了第一个徒弟',
            text: '一个二十岁的小伙子在车队里磨了他半年,要他教车技。他终于答应,只有一个条件:"先跑满五百单网约车,我再教你赛道。"小伙子点头。半年后小伙子完成了五百单,提着一袋水果来找他。他打开杂物箱,拿出一本笔记。',
            reward: { funds: 5000, reputation: 15, badge: '老师' } },
        ],
      },
    },
    {
      id: 'service_master', name: '五星服务车神',
      desc: '服务满级,客户回头率高,口碑增长快',
      rarity: 'SSR',
      boosts: { driving: 80, service: 99 },
      salary: 20000, loyalty: 60, orderRateBonus: 1.5,
      avatar: { asset: 'service_master', hat: 'cap-army', skin: '#F0C795', hatColor: '#FFD93D', accent: '#FFD93D' },
      stories: {
        soul: {
          title: '老顾客送来一袋自家包子',
          text: '一个常打他车的阿姨那天专门约了他的车,只是为了把一袋还热的包子塞给他。"我们家昨天蒸的,你天天跑车不能光吃外卖。"阿姨下车前还嘱咐:"凉了不好吃,赶紧吃。"他把包子搁在副驾,跑完那一上午,袋子里的热气一直没散。',
          reward: { loyalty: 20, badge: '人情味' },
        },
        slices: [
          { title: '街边摊老板娘记得他',
            text: '他每天早上六点会路过那个煎饼摊。老板娘后来认出他,每次他停车,煎饼已经在锅里了——加蛋、不要葱、多刷一层酱。两人没几次正经聊过,但他每次接过煎饼会鞠一下头。这事老板娘跟邻居说了好几次。' },
          { title: '一个美食号采访他',
            text: '一个本地美食公众号的记者上车,聊着聊着发现他是行家——哪条街的哪家店什么时候关门,他都门儿清。记者要求采访"司机师傅的私藏小店地图"。他想了一下,列了二十家。第二天那篇文章十万加。',
            reward: { funds: 2000, reputation: 10 } },
          { title: '老顾客生病住院打他车',
            text: '一位常打他车的退休老师约他送去医院。老人神色不好,他下车把人扶到病房门口才走。三个月后老人康复,专门约了他的车,送了一面手写的小锦旗:"接送两年,这次让我谢谢您。"',
            reward: { reputation: 8, loyalty: 15 } },
          { title: '教徒弟泡茶规矩',
            text: '车队里来了个想跟他学服务的年轻人。他没讲什么大道理,只教了一件事:"车里备热水壶,冬天给老人乘客倒一杯,夏天给醉客倒一杯醒酒水。茶叶不放,只用白水。"年轻人疑惑:"为啥不放茶?"他说:"放了,人家会觉得你想讨好。"',
            reward: { funds: 1500, loyalty: 10 } },
          { title: '出了「车上待客之道」小册子',
            text: '他把这十年攒的小细节整理成一本三十二页的小册子,印了两百本,给车队同事送。封面写着"车上待客之道"。最后一页是空白的,留给读者自己写。三年后,那本册子被一家出版社买走了版权。他坚持稿费一半捐给老年人助餐项目。',
            reward: { funds: 5000, reputation: 15, badge: '车上的待客之人' } },
        ],
      },
    },
  ];

  // V11: 招募概率简化为每档券一个固定 [N, R, SR, SSR] 表,不再按玩家阶段动态调整。
  // 界面文案不展示内部枚举,只展示「新手/熟手/骨干/王牌」。
  const RECRUIT_TICKETS = [
    {
      id: 'normal', name: '普通招募券', cost: 500,
      desc: '便宜补人,主要招到新手和熟手司机',
      probs: [0.70, 0.30, 0.00, 0.00],
    },
    {
      id: 'vip', name: 'VIP 招募券', cost: 2000,
      desc: '中期主力券,更容易招到熟手和骨干',
      probs: [0.30, 0.50, 0.20, 0.00],
    },
    {
      id: 'headhunter', name: '猎头券', cost: 10000,
      desc: '后期挖人用,有机会招到王牌司机',
      probs: [0.00, 0.30, 0.50, 0.20],
    },
  ];

  // 稀有度颜色 + 视觉
  const RARITY_META = {
    N:  { name: '新手', color: '#9A8C7E', bg: '#F4EFE5', stars: 1 },
    R:  { name: '熟手', color: '#4A90E2', bg: '#E0EAF8', stars: 2 },
    SR: { name: '骨干', color: '#8B5CF6', bg: '#EDE5F8', stars: 3 },
    SSR:{ name: '王牌', color: '#E84545', bg: '#FFE5E5', stars: 4 },
  };

  // V9: 稀有度决定培养天花板。普通司机可以变强,但不会被培训成 SSR。
  // V14: 属性砍到 driving + service 两项,删除 road / mind。
  const RARITY_STAT_CAPS = {
    N:   { driving: 65, service: 65 },
    R:   { driving: 78, service: 80 },
    SR:  { driving: 90, service: 92 },
    SSR: { driving: 99, service: 99 },
  };

  // V14.75: 忠诚规则。级别越高能力越强,但职业选择权也越高。
  // normalCap 是普通福利/补贴能达到的职业忠诚上限;信任突破事件和个人故事可到 100。
  const RARITY_LOYALTY_RULES = [
    { id: 'N', initialMin: 75, initialMax: 85, normalCap: 100, quitBelow: 25, moralePenalty: 4 },
    { id: 'R', initialMin: 60, initialMax: 75, normalCap: 95, quitBelow: 30, moralePenalty: 4 },
    { id: 'SR', initialMin: 50, initialMax: 65, normalCap: 90, quitBelow: 35, moralePenalty: 6 },
    { id: 'SSR', initialMin: 40, initialMax: 55, normalCap: 85, quitBelow: 40, moralePenalty: 8 },
  ];

  // 车型(图标 svgPath 是简化轮廓)
  // V13: 车型压缩到 3 档(经济/中端/高端),用真实中国网约车品牌。
  //   - 价格梯度:¥5k / ¥18k / ¥60k,档位差异明显
  //   - 快车由片区解锁,桑塔纳也能接;凯美瑞起能接专车,奔驰 E 能接豪华车
  //   - 删除汉 EV 和奥德赛(功能重复)
  const VEHICLES = [
    { id: 'santana', name: '桑塔纳', price: 5000,
      eligible: ['short', 'business'],
      color: '#C8B38C', shape: 'sedan' },
    { id: 'camry', name: '凯美瑞', price: 18000,
      eligible: ['short', 'business', 'airport'],
      color: '#2E7D6A', shape: 'sedan' },
    { id: 'benz_e', name: '奔驰 E', price: 60000,
      eligible: ['short', 'business', 'airport', 'luxury'],
      color: '#0F172A', shape: 'luxury' },
  ];

  // V13: 订单压缩到 4 种,删除时段限制(白天黑夜统一接单)。
  //   - short  特惠订单:无门槛,所有车型能接
  //   - business 快车订单:由片区解锁,无车型/司机属性门槛
  //   - airport  专车订单:车技 35,凯美瑞起
  //   - luxury   豪华车订单:车技 70,仅奔驰 E,且只在高端片区刷出
  //   zone 字段保留(配合 SVG 动画显示订单去向),但 buildHourlySupply 已改用 zone.orderMix 不依赖 zone。
  const ORDERS = [
    { id: 'short', name: '特惠订单', km: 4, fare: 48, hours: 1,
      req: {}, rate: 0.6,
      color: '#FF8A65', zone: 'downtown' },
    { id: 'business', name: '快车订单', km: 8, fare: 88, hours: 1,
      req: {}, rate: 0.3,
      color: '#0EA5E9', zone: 'cbd' },
    { id: 'airport', name: '专车订单', km: 20, fare: 220, hours: 2,
      req: { driving: 35 }, rate: 0.2,
      color: '#22C55E', zone: 'airport' },
    { id: 'luxury', name: '豪华车订单', km: 12, fare: 360, hours: 2,
      req: { driving: 70 }, rate: 0.1,
      color: '#EC4899', zone: 'cbd' },
  ];

  // 城市区域(V10.14: 北京区片模拟 + 非重叠多边形)
  // V12: 加 density 字段(每小时刷出多少个订单名额),驱动半订单池供需机制。
  const ZONES = [
    // V14.29: 每个片区都包含 4 种订单,orderMix 控制出现权重。
    // 初级片区基础订单占比高,高级片区高价订单占比高,让“解锁新片区 = 更高收入结构”更直观。
    // V14.7.2: shape 坐标按底图(city-map-clean-v1.png)重新对齐 — 5 个岛屿轮廓:
    //   西城(中心岛,被河流环绕,菱形)/ 海淀(左上椭圆岛)/ 朝阳(右上岛,上有港口凹角)
    //   大兴(左下岛,含机场跑道,长形)/ 丰台(右下岛,交通枢纽)
    {
      id: 'downtown', name: '西城区', x: 50, y: 49,
      orderMix: { short: 78, business: 16, airport: 5, luxury: 1 },
      color: '#FF8C42', desc: '核心城区,以特惠订单为主,口碑起来后扩张到这里。',
      unlock: { reputation: 90 }, density: 0.8,
      shape: [[42,38], [58,36], [65,46], [62,58], [50,62], [40,58], [36,48]],
    },
    {
      id: 'residential', name: '海淀区', x: 18, y: 21,
      orderMix: { short: 72, business: 20, airport: 6, luxury: 2 },
      color: '#5FAD41', desc: '高校和科技园密集,特惠订单稳定,适合开局运营。',
      unlock: { reputation: 0 }, density: 0.8,
      shape: [[7,12], [22,6], [32,12], [33,28], [25,36], [10,33], [4,22]],
    },
    {
      id: 'station', name: '丰台区', x: 75, y: 74,
      orderMix: { short: 35, business: 25, airport: 34, luxury: 6 },
      color: '#F59E0B', desc: '交通枢纽,专车订单为主,日常订单兜底。',
      unlock: { reputation: 180 }, density: 1.0,
      shape: [[55,58], [80,55], [97,62], [97,82], [85,93], [62,93], [52,82], [50,68]],
    },
    {
      id: 'cbd', name: '朝阳区', x: 75, y: 22,
      orderMix: { short: 18, business: 44, airport: 12, luxury: 26 },
      color: '#0EA5E9', desc: 'CBD 商务区,快车订单和豪华车订单主推,日常订单兜底。',
      unlock: { reputation: 520 }, density: 1.4,
      shape: [[55,10], [78,5], [95,15], [97,32], [88,40], [68,40], [55,32], [54,20]],
    },
    {
      id: 'airport', name: '大兴区', x: 24, y: 75,
      orderMix: { short: 24, business: 30, airport: 38, luxury: 8 },
      color: '#22C55E', desc: '机场片区,专车订单需求集中,快车和特惠订单兜底。',
      unlock: { reputation: 340 }, density: 1.4,
      shape: [[5,58], [42,55], [45,75], [38,90], [25,95], [10,90], [3,75]],
    },
  ];

  // 培训
  // V14.78: 训练价格按当前属性段位递增。cost 保留为中低段基准价,实际扣费优先读 costTiers。
  // V14.11: 属性 4→2。车技决定高端订单准入和收益,服务影响好评率与口碑增长。
  const TRAININGS = [
    { id: 'driving', name: '模拟驾驶舱', stat: 'driving', cost: 450, gainMin: 8, gainMax: 12, color: '#FF6B35',
      costTiers: [
        { max: 19, cost: 300 },
        { max: 34, cost: 450 },
        { max: 49, cost: 700 },
        { max: 69, cost: 1100 },
        { max: 84, cost: 1700 },
        { max: 999, cost: 2600 },
      ] },
    { id: 'service', name: '服务礼仪课', stat: 'service', cost: 500, gainMin: 8, gainMax: 12, color: '#0EA5E9',
      costTiers: [
        { max: 19, cost: 350 },
        { max: 34, cost: 500 },
        { max: 49, cost: 800 },
        { max: 69, cost: 1250 },
        { max: 84, cost: 1900 },
        { max: 999, cost: 2900 },
      ] },
  ];

  // 随机事件 V15.x — 重构后的事件池(去 chain 容器,加 unlockMission 阶段化,4 条真分支链式)
  // 详见根目录「事件设计大表.html」
  // 字段:
  //   - unlockMission:完成第 N 个任务后才进入抽签池(缺省 0 = 开局即可)
  //   - chain:分支链式标识符,用于 resolveEvent 写入 chainChoices
  //   - requireChainChoice:此事件必须满足的 chainChoices 前置条件
  //   - requireKeyDriverAlive:钥匙司机必须在编(true) / 已离队(false)
  //   - options[i].choiceKey:玩家选此项时写入 chainChoices[chain] 的值
  //   - options[i].apply 返回 effect 中可包含:markKeyDriver / platformDone / addDrivers / addVehicles
  const EVENTS = [
    // ============ V7 单段事件(unlockMission 阶段化) ============
    {
      id: 'oil_price', title: '油价又涨了', tag: '行业', emoji: 'biz', cooldown: 30,
      unlockMission: 0,
      desc: '92 号汽油又涨了 0.4 元/升。燃油司机的成本被压得越来越薄。',
      options: [
        { label: '车队补贴', detail: '−¥1,500,所有司机忠诚 +15', apply: () => ({ funds: -1500, allLoyalty: 15 }) },
        { label: '让司机自吞', detail: '钱保住,所有司机忠诚 −15', apply: () => ({ allLoyalty: -15 }) },
      ],
    },
    {
      id: 'back_pain', title: '小李的腰又犯了', tag: '人事', emoji: 'people', cooldown: 35,
      unlockMission: 0,
      desc: '小李这周连跑了 14 个夜班,腰椎间盘突出又犯了。今天发动车的时候,他从座椅上起不来。',
      options: [
        { label: '强制让他休息一周', detail: '车闲置 −¥800,所有司机忠诚 +25', apply: () => ({ funds: -800, allLoyalty: 25 }) },
        { label: '建议他考虑别的工作', detail: '钱保住,所有司机忠诚 −20,口碑 −5(兔死狐悲)', apply: () => ({ allLoyalty: -20, reputation: -5 }) },
      ],
    },
    {
      id: 'ride_cancel_chain', title: '司机被连续取消单罚款', tag: '行业', emoji: 'biz', cooldown: 30,
      unlockMission: 3,
      desc: '小张这周被乘客连续取消 5 单,平台扣了 ¥1,200。每单都是他到了乘客就取消,平台不分原因。',
      options: [
        { label: '车队全额承担罚款', detail: '−¥1,200,所有司机忠诚 +20', apply: () => ({ funds: -1200, allLoyalty: 20 }) },
        { label: '让小张自己背锅', detail: '钱保住,所有司机忠诚 −20', apply: () => ({ allLoyalty: -20 }) },
      ],
    },
    {
      id: 'complaint_harass', title: '司机被投诉骚扰女乘客', tag: '危机', emoji: 'people', cooldown: 35,
      unlockMission: 5,
      desc: '一位女乘客投诉小张言语骚扰。小张说自己只是问了路况,他坚决否认。平台让你拿决定。',
      options: [
        { label: '相信司机,让平台彻查', detail: '口碑 −8,全员信任 +25', apply: () => ({ reputation: -8, trustLoyalty: 25 }) },
        { label: '相信乘客,公开道歉 + 处罚司机', detail: '口碑 +5,所有司机忠诚 −20', apply: () => ({ reputation: 5, allLoyalty: -20 }) },
      ],
    },
    {
      id: 'aging_test', title: '网约车司机年龄新规', tag: '监管', emoji: 'gov', cooldown: 40,
      unlockMission: 6,
      desc: '当地新规:60 岁以上司机不得继续注册接单。车队里老王 58,老周 56,都快踩线。',
      options: [
        { label: '内部转岗做调度', detail: '−¥1,500(转岗培训),所有司机忠诚 +15', apply: () => ({ funds: -1500, allLoyalty: 15 }) },
        { label: '到时候直接劝退', detail: '钱保住,失去最强司机,所有司机忠诚 −15,口碑 −5', apply: () => ({ loseBest: true, allLoyalty: -15, reputation: -5 }) },
      ],
    },
    {
      id: 'account_freeze', title: '平台账号被冻结', tag: '监管', emoji: 'gov', cooldown: 35,
      unlockMission: 8,
      desc: '老张的平台账号被无故冻结,平台说要审查 7 天。他这一周没有收入。',
      options: [
        { label: '让他正常申诉等结果', detail: '−¥2,000(车闲置),所有司机忠诚 +15(讲规矩)', apply: () => ({ funds: -2000, allLoyalty: 15 }) },
        { label: '让他用别的号继续跑', detail: '钱保住,口碑 −10,所有司机忠诚 −10(违规风险)', apply: () => ({ reputation: -10, allLoyalty: -10 }) },
      ],
    },
    {
      id: 'social_lapse', title: '司机社保断缴了', tag: '人事', emoji: 'biz', cooldown: 35,
      unlockMission: 8,
      desc: '车队成立至今没给司机交社保,司机们最近开始议论。老周老婆怀孕了,他直接问你能不能帮缴。',
      options: [
        { label: '给全员补缴 + 以后正常缴', detail: '−¥3,500,所有司机忠诚 +30', apply: () => ({ funds: -3500, allLoyalty: 30 }) },
        { label: '装作没听见,继续跑车', detail: '钱保住,所有司机忠诚 −25,口碑 −3', apply: () => ({ allLoyalty: -25, reputation: -3 }) },
      ],
    },
    {
      id: 'cheating_data', title: '平台诱导刷单冲业绩', tag: '行业', emoji: 'biz', cooldown: 35,
      unlockMission: 9,
      desc: '滴答平台月底冲数,暗示愿意配合"循环跑"刷单的司机有额外补贴。这是违规但很普遍。',
      options: [
        { label: '配合冲一下业绩', detail: '+¥2,500,口碑 −10(被发现就完了)', apply: () => ({ funds: 2500, reputation: -10 }) },
        { label: '严令车队不许参与', detail: '钱不变,所有司机忠诚 +10,口碑 +10', apply: () => ({ allLoyalty: 10, reputation: 10 }) },
      ],
    },
    {
      id: 'rain_trapped', title: '暴雨夜被困一整夜', tag: '天气', emoji: 'rain', cooldown: 30,
      unlockMission: 11,
      desc: '红色暴雨预警 + 地铁停运 + 多条主干道积水,司机们困在路上。是让他们继续跑还是撤?',
      options: [
        { label: '全员撤回保安全', detail: '−¥1,500(损失订单),所有司机忠诚 +20', apply: () => ({ funds: -1500, allLoyalty: 20 }) },
        { label: '默许涨价 2 倍硬抢单', detail: '+¥3,000,口碑 −15(违规),所有司机忠诚 −20', apply: () => ({ funds: 3000, reputation: -15, allLoyalty: -20 }) },
      ],
    },
    {
      id: 'night_robbery', title: '司机半夜被抢', tag: '危机', emoji: 'crash', cooldown: 40,
      unlockMission: 11,
      desc: '凌晨两点,小李在城郊接了一单,被乘客持刀抢走当天现金。人没事,钱没了。',
      options: [
        { label: '报警 + 公司补偿损失', detail: '−¥1,000,全员信任 +25', apply: () => ({ funds: -1000, trustLoyalty: 25 }) },
        { label: '自认倒霉,劝他下次别接深夜', detail: '钱保住,所有司机忠诚 −25(寒心)', apply: () => ({ allLoyalty: -25 }) },
      ],
    },
    {
      id: 'family_emergency', title: '老周父亲住院', tag: '人事', emoji: 'people', cooldown: 35,
      unlockMission: 12,
      desc: '老周父亲深夜突发脑梗送医院。他来请假,说至少要七天陪护。',
      options: [
        { label: '全薪准假 + 慰问金', detail: '−¥2,000,全员信任 +30', apply: () => ({ funds: -2000, trustLoyalty: 30 }) },
        { label: '不准假', detail: '钱保住,所有司机忠诚 −25,口碑 −3', apply: () => ({ allLoyalty: -25, reputation: -3 }) },
      ],
    },
    {
      id: 'quit_temptation', title: '司机想转行送外卖', tag: '人事', emoji: 'people', cooldown: 30,
      unlockMission: 14,
      desc: '小张说送外卖比开网约车多挣两千,而且不用伺候人。他来跟你打招呼准备走。',
      options: [
        { label: '加薪挽留', detail: '月薪 +¥1,200,司机留下且忠诚 +30', apply: () => ({ keepBest: true, salaryRaise: 1200 }) },
        { label: '放他走', detail: '钱保住,失去最强司机,口碑 −3', apply: () => ({ loseBest: true, reputation: -3 }) },
      ],
    },

    // ============ rain chain 拆段(独立单段) ============
    {
      id: 'rain_base', title: '暴雨天来了', tag: '天气', emoji: 'rain', cooldown: 30,
      unlockMission: 0,
      desc: '今天下大雨,平台订单需求暴涨。要让司机出车吗?',
      options: [
        { label: '全员出车抢单', detail: '订单 +60%。30% 概率事故 → 修车 −¥1,500,全员忠诚 −20', apply: () => ({ orderBoost: 1.6, accidentRisk: { chance: 0.30, funds: -1500, allLoyalty: -20, log: '暴雨抢单发生剐蹭事故,司机受惊,车队垫付维修费' } }) },
        { label: '全员休息保人', detail: '今天放假,口碑 +5,所有司机忠诚 +10', apply: () => ({ reputation: 5, allLoyalty: 10 }) },
      ],
    },
    {
      id: 'rain_storm_metro', title: '暴雨夜地铁停运', tag: '天气', emoji: 'rain', cooldown: 30,
      unlockMission: 10,
      desc: '红色暴雨预警,地铁全线停运。打车需求是平时三倍,但路况危险,司机们也累。',
      options: [
        { label: '全员死撑抢单', detail: '订单 +80%,基础全员忠诚 −15。40% 概率事故 → 修车 −¥2,500,再扣全员忠诚 −30', apply: () => ({ orderBoost: 1.8, allLoyalty: -15, accidentRisk: { chance: 0.40, funds: -2500, allLoyalty: -30, log: '暴雨夜死撑抢单发生事故,司机受伤,车队垫付医药费,人心散了' } }) },
        { label: '车队组团送社区免费车', detail: '−¥1,500,口碑 +20,所有司机忠诚 +15', apply: () => ({ funds: -1500, reputation: 20, allLoyalty: 15 }) },
      ],
    },
    {
      id: 'rain_red_alert', title: '50 年一遇红色预警', tag: '天气', emoji: 'rain', cooldown: 30,
      unlockMission: 14,
      desc: '气象台发布 50 年一遇极端暴雨预警,部分路段已经积水到腰。这是该让车队完全停运的程度了。',
      options: [
        { label: '加入应急救援队送医送药', detail: '−¥2,000,口碑 +25,所有司机忠诚 +20', apply: () => ({ funds: -2000, reputation: 25, allLoyalty: 20 }) },
        { label: '闷声继续抢单', detail: '+¥4,000,口碑 −25。55% 概率严重事故 → 修车 −¥4,000,全员忠诚 −50', apply: () => ({ funds: 4000, reputation: -25, accidentRisk: { chance: 0.55, funds: -4000, allLoyalty: -50, log: '50 年一遇红色预警还硬抢,司机受伤,直接想离开车队' } }) },
      ],
    },

    // ============ celeb chain 拆段 ============
    {
      id: 'celeb_base', title: '明星打到你家车', tag: '运气', emoji: 'star', cooldown: 35,
      unlockMission: 3,
      desc: '一名歌手打到了你的车,司机服务很到位。',
      options: [
        { label: '配合宣传', detail: '+15 口碑,但司机被偷拍隐私', apply: () => ({ reputation: 15, allLoyalty: -10 }) },
        { label: '低调处理', detail: '+8 口碑,司机赞', apply: () => ({ reputation: 8, allLoyalty: 5 }) },
      ],
    },
    {
      id: 'celeb_pack', title: '明星经纪公司想包车', tag: '运气', emoji: 'star', cooldown: 35,
      unlockMission: 9,
      desc: '上次那位歌手的经纪公司打电话来,想长期签约车队做艺人接送。一个月 ¥15,000 包月,但要求 24 小时待命。',
      options: [
        { label: '签下来全力服务', detail: '+¥15,000 签约费,所有司机忠诚 −15(24h 待命强度大)', apply: () => ({ funds: 15000, allLoyalty: -15 }) },
        { label: '婉拒,保持普通业务', detail: '所有司机忠诚 +10,口碑 +5', apply: () => ({ allLoyalty: 10, reputation: 5 }) },
      ],
    },
    {
      id: 'celeb_paparazzi', title: '八卦记者跟拍司机', tag: '运气', emoji: 'star', cooldown: 35,
      unlockMission: 13,
      desc: '上次那位歌手的私生活被狗仔盯上,你的司机被多次跟拍。狗仔出价 ¥5,000 让司机透露行程。',
      options: [
        { label: '严令司机闭口 + 送签保密协议', detail: '−¥1,500,口碑 +15,所有司机忠诚 +10(讲规矩)', apply: () => ({ funds: -1500, reputation: 15, allLoyalty: 10 }) },
        { label: '默许司机收钱', detail: '+¥5,000(分成),口碑 −25(业内骂走灰)', apply: () => ({ funds: 5000, reputation: -25 }) },
      ],
    },

    // ============ newyear chain 拆段 ============
    {
      id: 'newyear_base', title: '春节将至', tag: '节日', emoji: 'festival', cooldown: 60,
      unlockMission: 0,
      desc: '春节快到了,司机们想回家。',
      options: [
        { label: '春节红包', detail: '−¥3,000,所有司机忠诚 +40', apply: () => ({ funds: -3000, allLoyalty: 40 }) },
        { label: '正常过节', detail: '钱保住,所有司机忠诚 −10', apply: () => ({ allLoyalty: -10 }) },
      ],
    },
    {
      id: 'newyear_spring_rush', title: '春运抢票热点', tag: '节日', emoji: 'festival', cooldown: 60,
      unlockMission: 6,
      desc: '今年春运抢票特别难。几个司机在车队群里说,如果回不去家就接着跑。',
      options: [
        { label: '车队帮买回家票', detail: '−¥4,000,所有司机忠诚 +35', apply: () => ({ funds: -4000, allLoyalty: 35 }) },
        { label: '让司机自己想办法', detail: '钱保住,所有司机忠诚 −15', apply: () => ({ allLoyalty: -15 }) },
      ],
    },
    {
      id: 'newyear_return_block', title: '突发返乡限制', tag: '节日', emoji: 'festival', cooldown: 60,
      unlockMission: 12,
      desc: '春节前一周,周边省份突然要求"红码不准下高速 + 隔离 14 天"。多个司机想提前撤回,但你订单正好接到爆。',
      options: [
        { label: '准司机们提前回家', detail: '−¥4,000(闲置 + 补贴),所有司机忠诚 +40', apply: () => ({ funds: -4000, allLoyalty: 40 }) },
        { label: '强制留人补一笔留岗费', detail: '−¥1,500,订单 +50%(7天),所有司机忠诚 −20', apply: () => ({ funds: -1500, orderBoost: 1.5, boostDuration: 7, allLoyalty: -20 }) },
      ],
    },

    // ============ borrow chain 真分支(关系信任轴) ============
    {
      id: 'borrow_seed', title: '老张找你借钱', tag: '人事', emoji: 'people', chain: 'borrow', cooldown: 999,
      unlockMission: 0,
      desc: '老张儿子要交学费,缺 ¥2,000,来找你借。',
      options: [
        { label: '借给他', detail: '−¥2,000,所有司机忠诚 +30', choiceKey: 'help', apply: () => ({ funds: -2000, allLoyalty: 30 }) },
        { label: '装作没看见', detail: '钱保住,所有司机忠诚 −20', choiceKey: 'refuse', apply: () => ({ allLoyalty: -20 }) },
      ],
    },
    {
      id: 'borrow_close', title: '老张儿子要结婚', tag: '人事', emoji: 'people', chain: 'borrow_close', cooldown: 999,
      unlockMission: 5,
      requireChainChoice: { borrow: 'help' },
      desc: '老张儿子终于要结婚了。婚礼办在老家,缺 ¥8,000 份子礼。老张抹不开面子,在车里吭哧了半天才开口。',
      options: [
        { label: '借给他', detail: '−¥8,000,所有司机忠诚 +25', choiceKey: 'help', apply: () => ({ funds: -8000, allLoyalty: 25 }) },
        { label: '婉拒,让他自己想办法', detail: '钱保住,所有司机忠诚 −15', choiceKey: 'refuse', apply: () => ({ allLoyalty: -15 }) },
      ],
    },
    {
      id: 'borrow_distance', title: '老张找别人借去了', tag: '人事', emoji: 'people', chain: 'borrow_distance', cooldown: 999,
      unlockMission: 5,
      requireChainChoice: { borrow: 'refuse' },
      desc: '听说老张前阵子找隔壁车队的老板借了钱。最近你想跟他多聊几句,他都低头不接话。司机群里气氛冷下来了。',
      options: [
        { label: '主动找老张谈,送一笔慰问', detail: '−¥3,000,关系修复,所有司机忠诚 +20', choiceKey: 'mend', apply: () => ({ funds: -3000, allLoyalty: 20 }) },
        { label: '不管,各自跑车', detail: '钱保住,失去老张(司机离队),所有司机忠诚 −15', choiceKey: 'ignore', apply: () => ({ loseBest: true, allLoyalty: -15 }) },
      ],
    },
    {
      id: 'borrow_intimate', title: '老张老家盖房', tag: '人事', emoji: 'people', chain: 'borrow_intimate', cooldown: 999,
      unlockMission: 11,
      requireChainChoice: { borrow_close: 'help' },
      desc: '老张老家批了宅基地,要盖房养老。缺 ¥20,000。这次他没张口,是他老婆在群里发来的语音。',
      options: [
        { label: '借给他,慢慢还', detail: '−¥20,000,全员信任 +30', apply: () => ({ funds: -20000, trustLoyalty: 30 }) },
        { label: '婉拒,介绍他银行信用贷', detail: '钱保住,所有司机忠诚 −10', apply: () => ({ allLoyalty: -10 }) },
      ],
    },
    {
      id: 'borrow_cooled', title: '老张主动提辞职', tag: '人事', emoji: 'people', chain: 'borrow_cooled', cooldown: 999,
      unlockMission: 11,
      requireChainChoice: { borrow_close: 'refuse' },
      desc: '老张说自己最近"想换种活法",其实你和他都明白——上次没借的那一万八,他到现在没解,所以决定走人。',
      options: [
        { label: '加薪挽留 + 私下补一笔', detail: '−¥4,000 + 月薪 +¥800,司机留下,全员信任 +15', apply: () => ({ funds: -4000, keepBest: true, salaryRaise: 800, trustLoyalty: 15 }) },
        { label: '同意离队', detail: '钱保住,失去老张,所有司机忠诚 −15', apply: () => ({ loseBest: true, allLoyalty: -15 }) },
      ],
    },

    // ============ platform_pressure 单事件重复触发(长线引导攒钱) ============
    {
      id: 'platform_pressure', title: '平台抽成又涨了', tag: '行业', emoji: 'biz', chain: 'platform', cooldown: 35,
      unlockMission: 8,
      skipScale: true,  // 自营 ¥180k 是固定门槛,不被规模缩放放大
      // 引擎层判断 platformChoseSelfop:已选自营则不再触发
      desc: '滴答出行又涨抽成了。法务说要么忍,要么自建小程序甩开它。但是自建成本不低。',
      options: [
        { label: '硬扛新抽成', detail: '抽成 +5%(封顶 40%)', choiceKey: 'fight', apply: (s) => ({ commissionRate: Math.min(0.40, ((s && s.commissionRate) || 0.20) + 0.05) }) },
        { label: '搞自营小程序 −¥180,000', detail: '资金 −¥180,000(资金不足时禁用),抽成永久 0%,事件不再触发', choiceKey: 'selfop', requireFunds: 180000, apply: () => ({ funds: -180000, commissionRate: 0, platformDone: true }) },
      ],
    },

    // ============ rival chain 钥匙司机机制 ============
    {
      id: 'rival_seed', title: '滴答挖你最强司机', tag: '竞争', emoji: 'rival', chain: 'rival', cooldown: 999,
      unlockMission: 13,
      desc: '隔壁滴答车队想用月薪 +¥1,500 挖你最强的司机。',
      options: [
        { label: '加薪挽留', detail: '月薪 +¥1,500,司机留下且忠诚 +30', choiceKey: 'keep', apply: () => ({ keepBest: true, salaryRaise: 1500 }) },
        { label: '放走', detail: '钱保住,失去最强司机,口碑 −10', choiceKey: 'release', apply: () => ({ loseBest: true, reputation: -10 }) },
      ],
    },
    {
      id: 'rival_pricing', title: '滴答出价更狠了', tag: '竞争', emoji: 'rival', chain: 'rival_pricing', cooldown: 999,
      unlockMission: 14,
      requireChainChoice: { rival: 'keep' },
      blindOptions: true,
      desc: '滴答这次出价翻倍 + ¥10,000 签约费。法务说"你给多少他才肯留"。这次给多少,你自己拿主意。',
      // 4 选项盲选(blindOptions=true):玩家选之前看不到具体后果,选完才揭晓
      options: [
        { label: '+¥1,000', detail: '试探性加价', choiceKey: 1000, apply: () => ({ loseBest: true, allLoyalty: -10 }) },
        { label: '+¥2,000', detail: '中规中矩加薪', choiceKey: 2000, apply: () => ({ loseBest: true, allLoyalty: -5 }) },
        { label: '+¥3,000', detail: '诚意加价', choiceKey: 3000, apply: () => ({ keepBest: true, salaryRaise: 3000, markKeyDriver: true }) },
        { label: '+¥4,000', detail: '豪赌加价', choiceKey: 4000, apply: () => ({ keepBest: true, salaryRaise: 4000, markKeyDriver: true }) },
      ],
    },
    {
      id: 'rival_friends_join_success', title: '老兄弟们想加入', tag: '竞争', emoji: 'rival', cooldown: 999,
      unlockMission: 15,
      requireChainChoice: { rival_pricing: [3000, 4000] },
      requireKeyDriverAlive: true,
      desc: '钥匙司机找上你:"我以前在滴答的老兄弟想跳槽,他们自带专车,问你这边靠不靠谱"',
      options: [
        { label: '欢迎加入', detail: '+¥3k 选项 → 0 成本获得 3 司机 + 3 凯美瑞;+¥4k 选项 → 5 司机 + 5 凯美瑞', apply: (s) => {
          const choice = (s && s.chainChoices && s.chainChoices.rival_pricing) || 3000;
          const count = choice === 4000 ? 5 : 3;
          return { addDrivers: count, addVehicles: count, vehicleType: 'camry' };
        } },
      ],
    },
    {
      id: 'rival_friends_join_lost', title: '错失老兄弟们', tag: '竞争', emoji: 'rival', cooldown: 999,
      unlockMission: 15,
      requireChainChoice: { rival_pricing: [3000, 4000] },
      requireKeyDriverAlive: false,
      desc: '听说滴答 3 个专车司机想跳槽,要找熟人引荐。可你这边没合适人脉——上次没留住他,这条路也断了。',
      options: [
        { label: '知道了', detail: '机会流失,无奖励', apply: () => ({}) },
      ],
    },

    // ============ accident chain 信任责任轴 ============
    {
      id: 'accident_seed', title: '小李剐蹭豪车', tag: '人事', emoji: 'crash', chain: 'accident', cooldown: 999,
      unlockMission: 5,
      desc: '小李剐蹭了一辆豪车,对方索赔 ¥3,000。',
      options: [
        { label: '公司全付', detail: '−¥3,000,所有司机忠诚 +20', choiceKey: 'cover', apply: () => ({ funds: -3000, allLoyalty: 20 }) },
        { label: '让司机自付', detail: '钱保住,所有司机忠诚 −30', choiceKey: 'shift', apply: () => ({ allLoyalty: -30 }) },
      ],
    },
    {
      id: 'accident_trust', title: '小李撞了行人', tag: '人事', emoji: 'crash', chain: 'accident_trust', cooldown: 999,
      unlockMission: 10,
      requireChainChoice: { accident: 'cover' },
      desc: '小李路口转弯撞了一位骑电瓶车的大妈。大妈腿骨折,要住院。这次不是剐蹭,是真事故。',
      options: [
        { label: '车队全担医疗费 + 误工费', detail: '−¥15,000,全员信任 +25,口碑 +10', choiceKey: 'cover', apply: () => ({ funds: -15000, trustLoyalty: 25, reputation: 10 }) },
        { label: '让司机一人负责到底', detail: '钱保住,所有司机忠诚 −35,口碑 −10', choiceKey: 'shift', apply: () => ({ allLoyalty: -35, reputation: -10 }) },
      ],
    },
    {
      id: 'accident_breach', title: '保险公司拒赔', tag: '人事', emoji: 'crash', chain: 'accident_breach', cooldown: 999,
      unlockMission: 10,
      requireChainChoice: { accident: 'shift' },
      desc: '上次让小李自付剐蹭费的事还没消化,这次他撞了行人保险又拒赔——保险公司说当时车队没担责导致维修流程不规范,赔不下来,¥15,000 全要车队出。',
      options: [
        { label: '公司咬牙担下来', detail: '−¥15,000,全员信任 +30', apply: () => ({ funds: -15000, trustLoyalty: 30 }) },
        { label: '让小李分期偿还', detail: '钱保住,所有司机忠诚 −25', apply: () => ({ allLoyalty: -25 }) },
      ],
    },
    {
      id: 'accident_loyalty', title: '小李主动提"我留下还您"', tag: '人事', emoji: 'people', cooldown: 999,
      unlockMission: 13,
      requireChainChoice: { accident_trust: 'cover' },
      desc: '上次撞行人那一万五,小李心里记着。今天他单独找你,说"老板,这辈子跟着您干,慢慢还"。',
      options: [
        { label: '加薪留下', detail: '月薪 +¥600,全员忠诚 +20', apply: () => ({ keepBest: true, salaryRaise: 600, allLoyalty: 20 }) },
        { label: '平淡处理', detail: '不变,司机继续跑', apply: () => ({}) },
      ],
    },
  ];

  const FIRST_NAMES = ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '林', '何', '高', '罗'];
  // V14.67: LAST_NAMES_M 删除 — engine 用自己内部的 GIVEN_NAMES_SHORT/LONG,本数组从未被引用。

  // 阶段任务链 - 16 步,用小目标牵引玩家理解车组、培训、口碑和订单解锁。
  const MISSIONS = [
    {
      id: 'm1_first_order',
      title: '完成第一单',
      desc: '点击底部开始运营,让司机自动接单',
      hint: '司机会从已解锁片区自动匹配可接订单',
      check: (s) => s.totalCompleted >= 1,
      reward: { funds: 100, message: '第一单跑起来了,车队开始营业。' },
    },
    {
      id: 'm2_first_day',
      title: '跑完第一个运营日',
      desc: '累计完成 12 单,并运营到第 2 天',
      hint: '第一单之后先让车队完整跑一天,观察地图小车、资金和口碑变化',
      check: (s) => s.totalCompleted >= 12 && s.day >= 2,
      reward: { funds: 500, message: '第一天跑稳了,可以开始扩车队。' },
    },
    {
      id: 'm3_buy_third_car',
      title: '购买第三辆车',
      desc: '购买 1 辆新车,让车队拥有 3 辆车',
      hint: '点左侧车队区域的“买车”,先买便宜车补运力',
      check: (s) => s.vehicles.length >= 3,
      reward: { funds: 600, message: '车辆到位,下一步招司机。' },
    },
    {
      id: 'm4_recruit_third_driver',
      title: '招募第三名司机',
      desc: '招募 1 名新司机,让车队拥有 3 名司机',
      hint: '点左侧车队区域的“招募”,选择招募券后挑一名司机',
      check: (s) => s.drivers.length >= 3,
      reward: { funds: 700, message: '新人入队,把他分配到空车上。' },
    },
    {
      id: 'm5_third_crew',
      title: '补齐第三个车组',
      desc: '拥有 3 个可运营车组',
      hint: '把新司机分配到空车上;有车有司机才算 1 个车组',
      check: (s) => operatingCrewCount(s) >= 3,
      reward: { funds: 1000, message: '第三个车组开始接单,车队产能提升。' },
    },
    {
      id: 'm6_service_training',
      title: '训练一次服务',
      desc: '完成 1 次服务训练',
      hint: '服务越高,好评率越高;每 3 个好评会沉淀为城市口碑 +1',
      check: (s) => ((s.trainingCounts && s.trainingCounts.service) || 0) >= 1,
      reward: { funds: 600, message: '服务训练完成,好评会更稳定。' },
    },
    {
      id: 'm7_reputation_90',
      title: '把口碑提升到 90',
      desc: '城市口碑达到 90,解锁西城区',
      hint: '提高服务、稳定完单、减少投诉和流失,口碑会逐步上涨',
      check: (s) => s.reputation >= 90,
      reward: { funds: 900, message: '西城区解锁,订单池开始变厚。' },
    },
    {
      id: 'm8_driving_35',
      title: '培养专车司机',
      desc: '把任意司机的车技训练到 35',
      hint: '专车订单需要车技 ≥35,点司机卡后在右侧训练“车技”',
      check: (s) => s.drivers.some((d) => d.stats.driving >= 35),
      reward: { funds: 1200, message: '车技到位,可以准备专车车型。' },
    },
    {
      id: 'm9_buy_camry',
      title: '购买第一辆凯美瑞',
      desc: '购买 1 辆凯美瑞,准备跑专车订单',
      hint: '凯美瑞可以接专车订单,但还需要口碑解锁对应片区',
      check: (s) => s.vehicles.some((v) => v.templateId === 'camry'),
      reward: { funds: 1500, message: '凯美瑞入队,专车车组快成型了。' },
    },
    {
      id: 'm10_reputation_180',
      title: '把口碑提升到 180',
      desc: '城市口碑达到 180,解锁丰台区',
      hint: '丰台区专车订单更多;服务训练和稳定完单会让口碑涨得更快',
      check: (s) => s.reputation >= 180,
      reward: { funds: 1800, message: '丰台区解锁,专车订单开始出现。' },
    },
    {
      id: 'm11_first_airport',
      title: '跑出第一单专车订单',
      desc: '凯美瑞/奔驰 E + 车技 ≥35,完成 1 单专车订单',
      hint: '把车技 35 的司机分配到凯美瑞或奔驰 E,系统会自动匹配专车订单',
      check: (s) => (s.orderCounts && s.orderCounts.airport >= 1) || false,
      reward: { funds: 2400, message: '专车订单跑通,收入台阶抬高了。' },
    },
    {
      id: 'm12_five_crews',
      title: '扩张到 5 个车组',
      desc: '拥有 5 个可运营车组',
      hint: '继续买车、招司机、分配车组;更多车组才能吃下更厚的订单池',
      check: (s) => operatingCrewCount(s) >= 5,
      reward: { funds: 3000, message: '车队规模起来了,可以冲击高端商务单。' },
    },
    {
      id: 'm13_buy_benz',
      title: '购买第一辆奔驰 E',
      desc: '购买 1 辆奔驰 E,准备跑豪华车订单',
      hint: '奔驰 E 是豪华车订单的车型门槛,价格高,先确保现金流健康',
      check: (s) => s.vehicles.some((v) => v.templateId === 'benz_e'),
      reward: { funds: 3500, message: '奔驰 E 入队,豪华车组开始成型。' },
    },
    {
      id: 'm14_driving_70',
      title: '培养豪华车司机',
      desc: '把任意司机的车技训练到 70',
      hint: '豪华车订单需要车技 ≥70,普通司机可能有属性上限,高稀有司机更适合后期培养',
      check: (s) => s.drivers.some((d) => d.stats.driving >= 70),
      reward: { funds: 4000, message: '豪华车司机准备好了,下一步冲高端片区。' },
    },
    {
      id: 'm15_reputation_520',
      title: '把口碑提升到 520',
      desc: '城市口碑达到 520,解锁朝阳区',
      hint: '朝阳区豪华车订单占比最高;继续用服务训练和高质量完单积累口碑',
      check: (s) => s.reputation >= 520,
      reward: { funds: 4500, message: '朝阳区解锁,豪华车订单会更稳定出现。' },
    },
    {
      id: 'm16_first_luxury',
      title: '跑出第一单豪华车订单',
      desc: '奔驰 E + 车技 ≥70,完成 1 单豪华车订单',
      hint: '豪华车订单主推朝阳区(口碑 520 解锁),需要高口碑、高车技和奔驰 E',
      check: (s) => (s.orderCounts && s.orderCounts.luxury >= 1) || false,
      reward: { funds: 5000, message: '豪华车订单跑通,本局主线目标完成。', isFinale: true },
    },
  ];

  // V14: 投资人压力事件 — 资金负时强制触发。
  // V14.79: choices 仍由 UI 传 bool,但具体裁几人/卖几车/借多少钱由 engine.getInvestorPressurePlan 按规模动态生成。
  // V14.9: 删除 choices/holdOn 数据字段 — UI(InvestorPressureModal)硬编码 fire/sell/debt 三个 checkbox + holdOn 兜底,
  //        因为每个选项的 label 需要拼接动态信息(司机名/车名/还款日期),不适合从 data 读。
  //        engine.js 的 resolveInvestorPressure 用 choices 对象 { fire, sell, debt, holdOn } bool 处理。
  const INVESTOR_PRESSURE = {
    id: 'investor_pressure',
    title: '投资人怒了',
    tag: '危机',
    desc: '账上余额负数,投资人发来警告:再不解决就撤资。给你 24 小时拿出方案。',
    multiChoice: true,
  };

  // V15: 政策事件框架(按游戏绝对时间触发的链式事件)
  // 与现有 EVENTS(按 7 天周期 + 抽签触发)完全独立。
  // 设计为可扩展结构,V1 只填监管整改一个事件,后续疫情/油价/限号等可复用。
  // 详见「监管整改机制设计-V1.md」。
  const POLICY_GOV_BAN = {
    id: 'gov_ban',
    title: '监管整改',
    // 时间表:游戏绝对天数触发
    schedule: [
      { atDay: 30,  stage: 'notice_1', type: 'notice' },
      { atDay: 60,  stage: 'decision', type: 'decision' },
      { atDay: 90,  stage: 'verdict',  type: 'verdict' },
      { atDay: 150, stage: 'resume',   type: 'resume' },
    ],
    // 数值参数(全部以 Day 60 当月营收 R₀ 为基准)
    params: {
      A_STARTUP_FEE_PCT: 0.40,
      COMPLIANCE_SCHEDULE_PCT: [0.25, 0.20, 0.15, 0.10], // 月衰减(第 1/2/3/4 月+)
      A_COOLDOWN_DAYS: 5,
      A_VERDICT_GOOD_PCT: 0.5,
      A_VERDICT_FINE_PCT: 0.10,
      B_BUFF_ORDER_PCT: 0.25,
      B_BUFF_PROFIT_PCT: 0.15,
      B_LOAN_PCT: 1.00,
      B_LOAN_RATE: 0.10,
      B_LOAN_DUE_DAYS: 90,
      B_FINE_PCT: 1.00,
      B_BAN_ORDER_BOOST: 0.20,
      B_BAN_DAYS: 60,
    },
    // 各阶段的弹窗文案与选项
    stages: {
      notice_1: {
        title: '行业协会发布合规倡议',
        tag: '行业新闻',
        desc: '互联网协会今天发了份《网约车行业自律公约》,倡议各家加强司机背调和数据保护。几家头部平台都跟着发声明响应了。\n\n业内说监管层在准备新一轮规范化。',
        buttonLabel: '知道了',
      },
      decision: {
        title: '监管部门约谈头部平台',
        tag: '重大事件',
        desc: '监管部门今天把头部平台都约谈了,要求加强合规建设、准备专项检查。法务总监把卷宗放你桌上,等你拍板。',
        options: [
          {
            id: 'A',
            label: 'A. 启动合规专项',
            detail: '砸钱把合规体系一次搭起来。后面每个月都得养着这套东西——头几个月最重,慢慢减下来。审查期间招募和买车都得排队。一签字就回不去了。',
          },
          {
            id: 'B',
            label: 'B. 聚焦扩张窗口期 ⭐ 法务建议',
            detail: '行业景气还没冷,合规先放放。接下来一个月订单和利润都往上走,正是抢规模的时候。',
            extraToggle: {
              id: 'loan',
              label: '同时申请扩张贷款',
              detail: '',
            },
          },
        ],
      },
      verdict_pass: {
        title: '专项检查通过',
        tag: '监管反馈',
        desc: '专项检查结束。贵平台合规建设到位、材料齐备,本轮检查通过。继续正常运营。',
        buttonLabel: '知道了',
      },
      verdict_fine: {
        title: '检查发现细节问题',
        tag: '监管反馈',
        desc: '专项检查发现合规体系仍有改进空间(部分司机背调记录不全),依规象征性处罚。建议持续完善。',
        buttonLabel: '接受处罚',
      },
      verdict_ban: {
        title: '⛔ 平台监管整改通知',
        tag: '监管整改',
        desc: '专项检查的结论下来了。你之前没做的那些合规建设,被一项一项点了名——司机背调不齐、车辆审查走过场、用户数据没看好。监管的处罚决定如下。',
        buttonLabel: '接受处罚',
      },
      resume: {
        title: '整改期解除',
        tag: '监管反馈',
        desc: '60 天整改期到了,合规体系也基本搭起来了。监管解除运营限制,平台可以正常接单了。',
        buttonLabel: '重新开始运营',
      },
    },
  };

  const POLICY_EVENTS = [POLICY_GOV_BAN];

  // V15.16: 投资人定期 review — 按绝对时间触发,惩罚 + 目标驱动双轨。
  // 与 INVESTOR_PRESSURE(资金负时触发的失败兜底)互补:
  //   - INVESTOR_PRESSURE:玩家亏损时触发,救场用
  //   - INVESTOR_REVIEW:玩家"看起来很稳"但成长停滞时触发,扩张激励用
  // 详见 GAME_DESIGN.md 第七章「投资人定期 review」小节。
  const INVESTOR_REVIEW = {
    id: 'investor_review',
    // 4 个评估点:Q1 / 半年 / Q3 / 年终。按游戏内 day 触发。
    schedule: [
      { atDay: 90,  stage: 'q1', type: 'warning' },
      { atDay: 180, stage: 'h1', type: 'punish' },
      { atDay: 270, stage: 'q3', type: 'branch' },
      { atDay: 360, stage: 'y1', type: 'vision' },
    ],
    // KPI 阈值。threshold: 'two_of_three' = 资金/口碑/车组三选二;'all' = 全部满足。
    // requireAirport / requireLuxury = 必须拥有对应订单类型的车组(airport=专车,luxury=豪华)。
    kpi: {
      q1: { funds: 25000,  reputation: 100, crews: 3, requireAirport: false, requireLuxury: false, threshold: 'two_of_three' },
      h1: { funds: 60000,  reputation: 280, crews: 5, requireAirport: false, requireLuxury: false, threshold: 'two_of_three' },
      q3: { funds: 150000, reputation: 480, crews: 7, requireAirport: true,  requireLuxury: false, threshold: 'all' },
      y1: null,  // 仪式感事件,无硬 KPI
    },
    // 扣款公式参数
    punishment: {
      // 半年扣款:按车组规模分档(crews <= maxCrews 时收 fee)
      h1: {
        tiers: [
          { maxCrews: 3,   fee: 15000, label: '小公司的咨询费' },
          { maxCrews: 6,   fee: 25000, label: '中型公司的咨询费' },
          { maxCrews: 999, fee: 40000, label: '大公司的咨询费' },
        ],
      },
      // Q3 不达标 + missCount<2 的中段扣款(同 h1 公式)
      q3_warn: {
        tiers: [
          { maxCrews: 3,   fee: 20000, label: '考核罚金(小车队)' },
          { maxCrews: 6,   fee: 35000, label: '考核罚金(中车队)' },
          { maxCrews: 999, fee: 55000, label: '考核罚金(大车队)' },
        ],
      },
      // Q3 撤资扣款:max(funds * 1.5, 100000)
      q3_fired: {
        multiplier: 1.5,
        minAmount: 100000,
      },
      // Q3 接受挑战的现金加注
      q3_boost: {
        bonus: 30000,
      },
    },
    // 各阶段事件文案。{N}/{remaining}/{startFunds} 等占位由 engine 渲染时替换。
    stages: {
      q1: {
        title: '老板有点意见',
        tag: '投资人',
        desc: '投资人微信你了。\n\n"最近忙吗?看你这几个月数据没什么变化。"\n\n半小时后又来一条:"当初让你接这个车队,是觉得你能搞出更大的局面。我们投了钱,是想看到回报。下季度希望能看到些动静。"',
        buttonLabel: '回复"好"',
      },
      h1: {
        title: '来开个会吧',
        tag: '投资人',
        desc: '周六中午被叫去公司。会议室里坐了三个 VP,桌上摆着你过去半年的报表。\n\n"我们觉得你最近的状态有点 plateau。"\n"给你三个月,再给你一次机会。"\n\n临走时人事丢下一句:"这次会议的咨询费 ¥{N},从你账上扣了。"\n你笑着点头,签了字。',
        buttonLabel: '签字',
      },
      q3_pass: {
        title: 'Q3 数据看完了',
        tag: '投资人',
        desc: '投资人这次没找麻烦。\n\n"数据看了,过去半年扩了不少。现在你这个体量,可以考虑下一步了。"\n\n"想没想过冲一下规上企业?做到 Tier 4 / Tier 5,我们投后再加一笔。"',
        options: [
          { id: 'accept',  label: '接受挑战 → 投后加注 ¥30,000', detail: '激活 Tier 4-5 强目标驱动,顶栏 KPI 切换为「距 IPO 还差 X」' },
          { id: 'decline', label: '稳着先 → 维持现状',           detail: '不再触发 review,以当前 Tier 收尾' },
        ],
      },
      q3_warn: {
        title: 'Q3 review 没过',
        tag: '投资人',
        desc: 'Q3 review 出来了。投资人没说很重的话,但话里有话。\n\n"这次先扣个考核罚金 ¥{N},下次再不达标——你懂的。"',
        buttonLabel: '签字',
      },
      q3_fired: {
        title: 'PIP 了',
        tag: '投资人',
        desc: 'HRBP 上午 9 点发邮件:"请于今日下午 3 点到 12 楼会议室,带上你的工牌。"\n\n投资人没来。只来了一封邮件:\n"感谢您过去一年的服务。鉴于您未能达成既定的业务目标,我们决定终止合作。撤回投资款 ¥{N} 已从公司账户划扣。祝您下一段职业旅程一切顺利。"\n\n当晚你打开账户,余额 −¥{remaining}。',
        buttonLabel: '默认接受',
      },
      y1: {
        title: '年终 review',
        tag: '年终',
        desc: '年会上,投资人当着所有人念你这一年的数据。\n\n"去年这个时候,账上 ¥{startFundsK} 万、车队 {startCrews} 辆。"\n"今年——账上 ¥{currentFundsK} 万,车队 {currentCrews} 辆。"\n\n"明年,IPO?"',
        options: [
          { id: 'continue', label: '继续运营冲 IPO',   detail: '继续运营,目标 Tier 5(¥1,000,000 / 12 车组)' },
          { id: 'settle',   label: '接受当前结局收尾', detail: '触发当前已解锁的最高 Tier 结算' },
        ],
      },
    },
    // 失败结局文案(deathCause = 'kicked_out')。被踢出局结局触发时由 engine 读取此文案。
    endings: {
      kicked_out: {
        title: '被踢出局',
        reason: '未能达成业务目标,投资人终止合作,公司无力继续运营。',
      },
    },
  };

  // V15.15: 链式事件 NPC 画像定位。internalRole / archetype 是策划内部字段,不要直接展示给玩家。
  const EVENT_NPCS = {
    borrow: {
      id: 'borrow',
      name: '老张',
      internalRole: '借钱与家庭压力线',
      archetype: '老实、要面子、长期跑车的中年司机。事件重点是信任关系和老板是否把司机当人看。',
      avatar: 'assets/npc/npc-laozhang-borrow.png',
      tone: 'warm',
    },
    platform: {
      id: 'platform',
      name: '平台经理',
      internalRole: '平台抽成与自营选择线',
      archetype: '穿西装、话术很稳的商务经理。事件重点是平台规则、抽成压力和是否转向自营。',
      avatar: 'assets/npc/npc-platform-manager.png',
      tone: 'blue',
    },
    rival: {
      id: 'rival',
      name: '滴答猎头',
      internalRole: '竞品挖人与钥匙司机线',
      archetype: '笑得很职业、手里拿报价单的竞品负责人。事件重点是人才争夺和高薪挽留。',
      avatar: 'assets/npc/npc-rival-hunter.png',
      tone: 'red',
    },
    accident: {
      id: 'accident',
      name: '小李',
      internalRole: '事故责任与信任线',
      archetype: '年轻司机,刚出事故后紧张又愧疚。事件重点是责任归属、保险和车队信任。',
      avatar: 'assets/npc/npc-xiaoli-accident.png',
      tone: 'blue',
    },
  };

  window.WYCWY_DATA = {
    GAME, BACKGROUNDS, VEHICLES, ORDERS, ZONES,
    TRAININGS, EVENTS, INVESTOR_PRESSURE, POLICY_EVENTS, INVESTOR_REVIEW,
    FIRST_NAMES, MISSIONS, ENDINGS,
    RECRUIT_TICKETS, RARITY_META, RARITY_STAT_CAPS, RARITY_LOYALTY_RULES,
    EVENT_NPCS,
  };
})();
