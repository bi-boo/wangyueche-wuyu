# 网约车物语 — 项目开发约定

> 这份文档给 Claude Code 在迭代本项目时使用。包含项目结构、迭代规则、关键陷阱、视觉资产替换流程。

---

## 项目定位

**网页端模拟经营游戏**,致敬开罗(Kairosoft)系列。
- 单文件 HTML + 内联 React + Babel(`file://` 双击即玩)
- 数据/引擎拆为独立 JS,便于调参
- 作为**作品 + 噱头**,不商用,不发布

---

## 文件结构（V14.93 反向拆分后）

```
网约车物语/
├── 网约车物语-V3.html           主入口薄壳(106 行,只引用 src/ 和外部库)
├── wycwy-data.js                游戏配置(司机/车辆/订单/任务/结局/事件)
├── wycwy-engine.js              游戏引擎(reducer + tick + 死亡/结局检测)
├── ark-pixel-16px.woff2         字体存档(已决策不启用,见 PRODUCT.md)
├── zcool-qingke-huangyou.ttf    字体存档(同上)
├── admin.html                   数值调参后台(独立工具页)
├── GAME_DESIGN.md               游戏机制文档(每次改动同步更新)
├── PRODUCT.md / DESIGN.md       impeccable 设计上下文
├── CLAUDE.md                    本文件
├── src/
│   ├── styles/                  CSS 拆分(11 个文件,文件名 0-99 数字前缀决定加载顺序)
│   │   ├── 00-tokens.css        (CSS 变量 / 字体)
│   │   ├── 10-base.css          (reset / 占位元素)
│   │   ├── 20-topbar.css        (顶栏 + KPI)
│   │   ├── 30-modals.css        (基础弹窗)
│   │   ├── 40-tasks-list.css    (任务条 + 三栏 + 列表)
│   │   ├── 50-feedback.css      (统一游戏反馈层)
│   │   ├── 60-inspector.css     (常驻调度台)
│   │   ├── 70-pixel-flytext.css (像素游戏化 + 飘字)
│   │   ├── 80-map-hud.css       (地图 + HUD,本组最大 1740 行)
│   │   ├── 90-toggles-recruit.css (CRT 滤镜 + 招募券)
│   │   └── 99-overrides.css     (V10.3 像素硬边回调,最后覆盖层 1037 行)
│   └── app/                     React 组件拆分(9 个文件,Babel 多 script 共享作用域)
│       ├── 00-runtime.jsx       (helpers / hooks / 常量)
│       ├── 10-icons.jsx         (DriverAvatar/VehicleIcon/OrderIcon/StatIcon/CityMap)
│       ├── 20-topbar.jsx        (TopBar + KPI + MissionBar + SpeedControl + BottomHUD)
│       ├── 30-fleet.jsx         (CrewCompact + FleetPanel)
│       ├── 40-inspector.jsx     (CrewInspector + ZoneInspector + DriverAttributeRows)
│       ├── 50-modals.jsx        (Tutorial/Event/Recruit/Shop/Story/Monthly)
│       ├── 60-roadmap.jsx       (UnlockRoadmap/EndingAchievement/RunHistory)
│       ├── 70-endings.jsx       (EndingModal/EndingUnlock/MissionToast/ConfirmModal)
│       └── 90-app.jsx           (App + ReactDOM.createRoot)
├── scripts/
│   ├── generate-pixel-assets.mjs (像素资产生成)
│   └── sim-strategies.js         (策略模拟)
├── assets/                      像素图素材(司机头像 / 车辆图 / 改装件)
└── archive/                     历史版本(v1 / v2)
```

---

## 三个核心约定

### 约定 1:任何 gameplay 改动同步更新 `GAME_DESIGN.md`

每次改 `wycwy-data.js` / `wycwy-engine.js` 涉及机制变化时:
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

### 约定 2:按层修改对应文件(V14.93 反向拆分后)

- **纯数值调整**(单价、阈值、门槛、奖励金额)→ `wycwy-data.js`
- **逻辑变化**(派单算法、死亡判定、结局判定)→ `wycwy-engine.js`
- **UI/视觉**(布局、颜色、动画)→ `src/styles/*.css` 对应章节文件
- **React 组件**(组件逻辑)→ `src/app/*.jsx` 对应职责文件
- **HTML 主入口**(网约车物语-V3.html)是 106 行薄壳,只放 `<link>` 和 `<script>` 引用。**绝对不要再往这里塞内嵌 style 或 babel 代码**

**判断 React 组件归哪个文件**:
- 顶栏/KPI/速度控制/底部 HUD → `src/app/20-topbar.jsx`
- 左栏车队卡 → `src/app/30-fleet.jsx`
- 右栏 inspector(司机/车辆/区片详情) → `src/app/40-inspector.jsx`
- 弹窗(教程/事件/招募/月报/故事) → `src/app/50-modals.jsx`
- 路线图/成就墙/历史记录 → `src/app/60-roadmap.jsx`
- 结局相关弹窗 / Toast / Confirm → `src/app/70-endings.jsx`
- App 主组件 → `src/app/90-app.jsx`(只动这里加新 state / 新 modal 渲染)

**判断 CSS 归哪个文件**:看 `<link>` 加载顺序(后定义覆盖前定义),按章节归到 11 个文件之一。新组件优先放 `99-overrides.css`(末尾覆盖层),稳定后再视情况合并到主章节。

### 约定 3:数值后台 admin.html 与 data.js 数据结构同步

`admin.html` 是数值调参工具,通过侧边栏 + 表格的方式可视化所有数值。
- admin.html 读取 `wycwy-data.js` 的数据
- 编辑后导出新的 `wycwy-data.js`
- 用户复制覆盖

**改 data.js 数据结构时(加字段/加表)→ 同步改 admin.html 的对应表格 schema**。

---

## 关键陷阱(踩过)

### 陷阱 1:Babel `<script type="text/babel" src="...">` 在 file:// 下不工作 → V14.93 已不再适用

**历史**:Babel 用 fetch 加载 JSX 文件,Chrome 在 file:// 下禁止跨域 fetch,所以 V11-V14.92 期间 React 组件代码全部**内嵌**在 HTML 的单一 `<script type="text/babel">` 块里。

**V14.93 改造**:已经反向拆分到 `src/app/*.jsx` 9 个文件,HTML 只放 `<script type="text/babel" src="...">` 引用。**前提:必须用 http:// 协议访问**,不能直接双击 file:// 打开。

**本地测试方式**(替代双击 file://):
```bash
# 在项目根目录起一个 http server
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765/网约车物语-V3.html
```

**部署方式**:把整个项目目录(含 src/ wycwy-data.js wycwy-engine.js 字体 assets)上传到 Web server,玩家通过 https://yoursite.com/网约车物语-V3.html 访问。

**当前线上部署记录**:详见 `DEPLOYMENT.md`。当前 canonical 线上地址是 `https://yuanfengai.cn/didichuxing/baozheng/wycwy/`,服务器 SSH 别名 `nextype`,目录 `/var/www/nextype-website/didichuxing/baozheng/wycwy`。部署前先按 `DEPLOYMENT.md` 的「避免重复部署」命令排查旧目录。

**Babel 多 script 作用域 PoC 验证**(V14.93):多个 `<script type="text/babel" src=...>` **共享全局作用域**——`function Foo() {}` 和 `const x = ...` 跨文件可见,**不需要** `Object.assign(window, ...)` 显式导出。所以 src/app/*.jsx 各文件可以直接互相调用对方定义的组件,只需保证文件名 0-9 数字前缀的加载顺序。

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
cd /Users/baozheng/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill
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

## 给未来 Claude 的速查清单

接到本项目任务时,首先:

1. **读 `GAME_DESIGN.md`** 了解当前机制
2. **读 `wycwy-data.js`** 了解数值
3. **读本文件** 了解约定
4. 改动前判断:
   - 是数值调整?改 `wycwy-data.js`
   - 是逻辑变化?改 `wycwy-engine.js`
   - 是 UI?改 HTML 的 style + babel 块
   - 是组件结构?改 HTML babel 块(也可同步 wycwy-app.js)
5. 改完后:
   - 更新 `GAME_DESIGN.md`
   - Playwright 验证
   - Chrome 打开看实物
6. **每次重大改版**做新版本号(V4/V5/V6),旧版本归档到 `archive/`
