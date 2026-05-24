# 网约车物语 — 项目开发约定

> 这份文档给 Codex 在迭代本项目时使用。包含项目结构、迭代规则、关键陷阱、视觉资产替换流程。

---

## 项目定位

**网页端模拟经营游戏**,致敬开罗(Kairosoft)系列。
- 线上是 HTTP 静态网页游戏;源码拆为 `src/`,入口加载 `dist/` 预构建资源
- 数据/引擎拆为独立 JS,便于调参
- 作为**作品 + 噱头**,不商用,不发布

---

## 文件结构(V15.42 engine/styles 结构拆分后,与 CLAUDE.md 一致)

```
网约车物语/
├── 网约车物语-V3.html           主入口薄壳(只引用 dist/、vendor/、data/engine)
├── wycwy-data.js                游戏配置(司机/车辆/订单/任务/结局/事件)
├── wycwy-engine.js              游戏引擎构建产物(由 src/engine 生成,入口仍直接加载它)
├── ark-pixel-16px.woff2         字体存档(已决策不启用,见 PRODUCT.md)
├── zcool-qingke-huangyou.ttf    字体存档(同上)
├── admin.html                   数值调参后台(独立工具页)
├── GAME_DESIGN.md               游戏机制文档(每次改动同步更新)
├── PRODUCT.md / DESIGN.md       品牌定位与设计系统
├── CLAUDE.md / AGENTS.md        协作约定文档
├── dist/                        线上入口构建产物(CSS bundle + React app bundle)
├── vendor/                      线上本地化 React production UMD
├── src/
│   ├── engine/                  游戏引擎源分片(8 个文件,构建回 wycwy-engine.js)
│   │   ├── 00-preamble.js       (IIFE 壳 / 数据引用 / 全局计数器 / 常量)
│   │   ├── 10-core-systems.js   (实时计时 / 债务 / 忠诚 / 片区 / 事件缩放)
│   │   ├── 20-story-fleet-orders.js (故事持久化 / 司机车辆生成 / 订单供给)
│   │   ├── 30-state-gates-history.js (初始状态 / 任务 / UI gate / 历史记录)
│   │   ├── 40-actions-tick-events.js (招募 / tick / 日结 / 事件调度)
│   │   ├── 50-policy-investor.js (政策事件 / 投资人 early review)
│   │   ├── 60-monthly-operations.js (月报 / 训练 / 买车换车 / 卖车 / 债务危机)
│   │   └── 70-reducer-export.js  (gameReducer / WYCWY_ENGINE 导出)
│   ├── styles/                  CSS 拆分(21 个文件,文件名 0-99 数字前缀决定加载顺序)
│   │   ├── 00-tokens.css        (CSS 变量 / 字体)
│   │   ├── 10-base.css          (reset / 占位元素)
│   │   ├── 20-topbar.css        (顶栏 + KPI)
│   │   ├── 30-modals.css        (基础弹窗)
│   │   ├── 32-shop-coach-notifications.css (商店 / 引导 / 通知 / 弹窗响应式)
│   │   ├── 40-tasks-list.css    (任务条 + 三栏 + 列表)
│   │   ├── 50-feedback.css      (统一游戏反馈层)
│   │   ├── 60-inspector.css     (常驻调度台)
│   │   ├── 62-inspector-zones.css (空车 / 片区 inspector)
│   │   ├── 64-inspector-crew-training.css (车组详情 / 能力训练)
│   │   ├── 70-pixel-flytext.css (像素游戏化 + 飘字)
│   │   ├── 80-map-hud.css       (顶栏 HUD / 底部 HUD / 城市地图)
│   │   ├── 82-roadmap-history.css (目标路线 / 成就墙 / 运营记录)
│   │   ├── 84-fleet-cards.css   (车队列表 / 车组卡片)
│   │   ├── 86-monthly-investor.css (月报 / 投资人压力弹窗)
│   │   ├── 90-toggles-recruit.css (CRT 滤镜 + 招募券)
│   │   ├── 99-00-overrides-base.css (基础硬边覆盖)
│   │   ├── 99-10-compact-layout.css (紧凑布局覆盖)
│   │   ├── 99-20-interactions-modals.css (按钮 / 弹窗 / 反馈覆盖)
│   │   └── 99-30-policy-overrides.css (政策弹窗覆盖)
│   └── app/                     React 组件拆分(17 个文件,最终构建进 dist bundle)
│       ├── 00-runtime.jsx       (helpers / hooks / 常量)
│       ├── 10-icons.jsx         (DriverAvatar/VehicleIcon/OrderIcon/StatIcon/CityMap)
│       ├── 18-run-records.jsx   (run history / autosave / AI 复盘 payload)
│       ├── 20-topbar.jsx        (TopBar + KPI + SpeedControl + BottomHUD)
│       ├── 30-fleet.jsx         (CrewCompact + FleetPanel)
│       ├── 38-driver-diagnostics.jsx (司机诊断与训练提示)
│       ├── 40-inspector.jsx     (CrewInspector + ZoneInspector)
│       ├── 45-tutorial.jsx      (新手引导)
│       ├── 50-modals.jsx        (事件 / 政策 / 债务 / 通用弹窗)
│       ├── 52-recruit-shop-roadmap.jsx (招募 / 商店 / 目标路线辅助)
│       ├── 55-player-stories.jsx (主线玩家故事)
│       ├── 56-feedback-monthly-story.jsx (反馈卡 / 月报 / 司机故事)
│       ├── 60-roadmap.jsx       (UnlockRoadmap/EndingAchievement/RunHistory)
│       ├── 70-endings.jsx       (EndingModal/EndingUnlock/MissionToast/ConfirmModal)
│       ├── 75-ai-review.jsx     (结局 AI 复盘)
│       ├── 80-pause-menu.jsx    (暂停菜单)
│       └── 90-app.jsx           (App + ReactDOM.createRoot)
├── scripts/
│   ├── build-engine.mjs          (把 src/engine 构建成 wycwy-engine.js)
│   ├── build-entry-assets.mjs    (把 src/styles + src/app 构建成 dist 入口资源)
│   ├── generate-pixel-assets.mjs (像素资产生成)
│   ├── smoke-server.mjs          (本地服务/API/榜单写入冒烟验证)
│   └── sim-strategies.js         (策略模拟)
├── assets/                      像素图素材(司机头像 / 车辆图 / 改装件 / NPC 立绘)
└── archive/                     历史版本(v1 / v2,V14.93 拆分前快照)
```

**关键变化**:V14.93 之前 `网约车物语-V3.html` 是 2700+ 行内嵌组件的单文件;V14.93 反向拆分后所有 React/CSS 移到 `src/` 下。V15.41 起线上入口不再加载 Babel,而是加载 `dist/wycwy-styles.bundle.css` + `dist/wycwy-app.bundle.js`。V15.42 起 `wycwy-engine.js` 也成为构建产物,维护入口是 `src/engine/*.js`;修改 engine 后必须运行 `node scripts/build-engine.mjs`。

---

## 线上部署记录

详见 `DEPLOYMENT.md`。当前 canonical 线上地址:

```text
https://yuanfengai.cn/didichuxing/baozheng/wycwy/
```

服务器 SSH 别名 `nextype`,nginx 目录:

```text
/var/www/nextype-website/didichuxing/baozheng/wycwy
```

换电脑部署前,先按 `DEPLOYMENT.md` 的「避免重复部署」命令在 `yuanfengai.cn` 上搜索 `网约车物语` / `WYCWY_DATA` / `wycwy-data.js` / `wycwy-engine.js`,避免重复占目录。

---

## 三个核心约定

### 约定 1:任何 gameplay 改动同步更新 `GAME_DESIGN.md`

每次改 `wycwy-data.js` / `src/engine/*.js` 涉及机制变化时:
1. **先**在 `GAME_DESIGN.md` 对应章节改文字描述
2. **再**改代码
3. **同时**在 `GAME_DESIGN.md` 文件头记录版本号 + 日期

具体哪些章节:
| 改动 | 同步章节 |
|---|---|
| 加新订单 | 「四、订单系统」表格 + 数据 |
| 改任务 | 「五、阶段任务链」表格 |
| 加结局 | 「六、五种结局」表格 |
| 调死亡阈值 | 「七、残酷死亡条件」 |
| 加事件 | 「八、随机事件链」 |
| 改车型/改装件 | 「九、车辆与改装」 |
| 改司机背景 | 「十、司机背景」 |
| 视觉/字体改 | 「十二、UI/视觉规范」 |

### 约定 2:数值改在 `wycwy-data.js`,逻辑改在 `src/engine/*.js`

- **纯数值调整**(单价、阈值、门槛、奖励金额)→ `wycwy-data.js`
- **逻辑变化**(派单算法、死亡判定、结局判定)→ `src/engine/*.js`,再运行 `node scripts/build-engine.mjs`
- **UI/视觉**(布局、颜色、动画)→ `src/styles/*.css`,再运行 `node scripts/build-entry-assets.mjs`
- **React 组件**(组件逻辑)→ `src/app/*.jsx`,再运行 `node scripts/build-entry-assets.mjs`

**重要**:`网约车物语-V3.html` 仍是实际入口,但维护入口是 `src/engine/*.js` + `src/styles/*.css` + `src/app/*.jsx`。改完按影响范围运行:

```bash
cd "/Users/baozheng/代码文件/网约车物语"
node scripts/build-engine.mjs          # 改 src/engine 时运行
node scripts/build-entry-assets.mjs
```

`wycwy-engine.js` 和 `dist/` 都是构建产物,不要手改。线上 HTML 使用本地 `vendor/react-18.3.1.production.min.js`、`vendor/react-dom-18.3.1.production.min.js`、`wycwy-engine.js` 和 `dist/` bundle。

### 约定 3:数值后台 admin.html 与 data.js 数据结构同步

`admin.html` 是数值调参工具,通过侧边栏 + 表格的方式可视化所有数值。
- admin.html 读取 `wycwy-data.js` 的数据
- 编辑后导出新的 `wycwy-data.js`
- 用户复制覆盖

**改 data.js 数据结构时(加字段/加表)→ 同步改 admin.html 的对应表格 schema**。

---

## 关键陷阱(踩过)

### 陷阱 1:线上入口不再走 Babel,改 src 后必须重建 dist

**症状**:改了 `src/app/*.jsx`、`src/styles/*.css` 或 `src/engine/*.js`,本地源码看起来变了,但线上页面没变化。
**原因**:V15.41 起 `网约车物语-V3.html` 只加载 `dist/wycwy-app.bundle.js` 和 `dist/wycwy-styles.bundle.css`;V15.42 起 `wycwy-engine.js` 也由 `src/engine` 构建生成。
**对策**:维护 `src/` 下源文件,然后按影响范围运行:

```bash
cd "/Users/baozheng/代码文件/网约车物语"
node scripts/build-engine.mjs
node scripts/build-entry-assets.mjs
```

本地测试用 `python3 -m http.server 8765` 打开 `http://localhost:8765/网约车物语-V3.html`;不要再依赖 `file://` 双击。

### 陷阱 2:像素字体必须按"原生设计尺寸的整数倍"渲染

**Ark Pixel 16px** 设计原生 16px,所以:
- 16px ✅ 1× 完美
- 24px ⚠️ 1.5× 可接受
- 32px ✅ 2×
- 48px ✅ 3×
- **18/20/22/26 ❌ 子像素插值,糊**
- **12/14 ❌ 小于原生**

**全局字号阶梯严格遵守 14/18/24 三档**(虽然 14 略小于 16,但配合 `font-smoothing: none + image-rendering: pixelated` 仍清晰)。

加新字号时:
- 选 14/18/24 之一,不要新增其他尺寸
- 必须配 `image-rendering: pixelated; -webkit-font-smoothing: none;`

### 陷阱 3:游戏一屏化 — 禁止整页滚动

游戏 = 固定 UI,**禁止页面级滚动**。规则:
- `html, body { height: 100vh; overflow: hidden; }`
- `#root { flex: 1; flex-direction: column; min-height: 0; }`
- `.main-v3 { flex: 1; min-height: 0; overflow: hidden; }`
- 内部子 panel 需要滚动时,在 panel 内部加 `overflow-y: auto`,不让外层滚动
- 大量内容(日志、商品列表)应该**抽屉/弹窗化**,不要塞在主屏

### 陷阱 4:中文文件名命令的 cd 问题

项目路径有中文字符。在 shell 中:
```bash
# OK - 加引号
cd "~/代码文件/网约车物语"

# 不 OK
cd ~/代码文件/网约车物语   # 大概率出问题
```

Playwright file:// URL 也需要 URL encode:
```js
const URL = 'file:///Users/.../%E7%BD%91%E7%BA%A6%E8%BD%A6%E7%89%A9%E8%AF%AD-V3.html';
```

### 陷阱 5:Playwright 跑测试要从 skill 目录

```bash
cd /Users/baozheng/.Codex/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill
node run.js /tmp/test.js
```

不要在项目目录跑(找不到 run.js)。

---

## 视觉资产替换流程(用户后期会做)

游戏现在用占位元素 + `data-asset="..."` 标记。替换图片时:

### 司机头像
搜 `data-asset="avatar-cap-army"` 等 5 种,改成 `<img src="...">` 或 CSS `background-image`:
- `avatar-cap-army` 退伍军人
- `avatar-cap-flat` 北漂
- `avatar-glasses` 二胎奶爸
- `avatar-bald` 下岗大叔
- `avatar-headset` 网红

### 车辆图标
搜 `data-asset="vehicle-santana"` 等 5 种:
- `vehicle-santana` `vehicle-camry` `vehicle-han_ev` `vehicle-odyssey` `vehicle-benz_e`

### 改装件 / 订单 / 时钟 / 成就
都是 `data-asset="..."` 标记。grep 一下能看到所有可替换位置。

替换时同步更新 `GAME_DESIGN.md` 的「十二、UI/视觉规范」章节。

---

## 数值后台 admin.html 使用方式

1. 双击打开 `admin.html`
2. 左侧选分类(司机背景/车型/订单/培训/任务/结局/事件)
3. 右侧表格内编辑数值(直接改单元格)
4. 点底部"导出 wycwy-data.js" → 浏览器下载新文件
5. 把下载的文件复制到项目目录覆盖原文件
6. 刷新游戏 HTML 查看效果

**重要**:admin.html 的 schema 与 data.js 的数据结构强耦合。改 data.js 字段时同步改 admin.html。

---

## 调试技巧

### 验证渲染
用 Playwright(`/tmp/playwright-test-*.js`)而不是手动 Chrome,因为:
- 自动等待字体加载
- 可批量多视口测试滚动情况
- 可截图核对

### 看 console error
```js
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[err] ' + msg.text()); });
```

### 多视口验证一屏化
```js
for (const vp of [{w:1280,h:720}, {w:1440,h:900}, {w:1920,h:1080}]) {
  // 截 viewport,看 body height 是否等于 viewport height
}
```

---

## 给未来 Codex 的速查清单

接到本项目任务时,首先:

1. **读 `GAME_DESIGN.md`** 了解当前机制
2. **读 `wycwy-data.js`** 了解数值
3. **读本文件** 了解约定
4. 改动前判断:
   - 是数值调整?改 `wycwy-data.js`
   - 是逻辑变化?改 `src/engine/*.js`,再运行 `node scripts/build-engine.mjs`
   - 是 UI?改 HTML 的 style + babel 块
   - 是组件结构?改 HTML babel 块(也可同步 wycwy-app.js)
5. 改完后:
   - 更新 `GAME_DESIGN.md`
   - Playwright 验证
   - Chrome 打开看实物
6. **每次重大改版**做新版本号(V4/V5/V6),旧版本归档到 `archive/`
