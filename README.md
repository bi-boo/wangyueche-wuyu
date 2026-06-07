# 网约车物语

《网约车物语》是一个网页端模拟经营游戏，致敬开罗（Kairosoft）系列。玩家从两辆出租车起步，在现金流、司机关系、车辆升级、口碑、监管事件和投资人压力之间做取舍，最终走向不同结局。

游戏采用固定一屏的经营界面：左侧管理车队，中间查看城市订单与运营记录，右侧处理司机、车辆、培训和低频经营动作。核心体验是用有限现金维持车队运转，同时决定是稳住司机、追求利润、扩大规模，还是在事件中承担更高风险。

## 玩法机制

游戏围绕几个经营维度展开：

- **现金流**：订单收入、车辆购买、培训支出、工资月结、罚款和债务会共同影响资金安全。
- **司机**：司机有车技、服务、忠诚、薪水和背景差异；能力影响能接什么单，忠诚影响离队风险。
- **车辆**：不同车型对应不同订单档位，从出租车到豪华车逐步升级。
- **订单与片区**：口碑和车队能力会推动新区解锁，片区订单密度和订单类型会影响收入结构。
- **口碑**：服务水平和经营选择会影响好评率与口碑，口碑又会影响订单机会和片区开放。
- **培训与扩张**：玩家需要在提升现有司机、买车、招募新司机之间分配资金。
- **随机事件**：行业事件、监管压力、司机故事和投资人要求会打断单纯扩张节奏，迫使玩家做取舍。
- **结局复盘**：通关或失败后会生成经营结果，并可进入榜单和 AI 运营复盘。

## 在线地址

```text
https://yuanfengai.cn/didichuxing/baozheng/wycwy/
```

线上入口实际加载的是：

- `网约车物语-V3.html`
- `wycwy-data.js`
- `wycwy-engine.js`
- `dist/wycwy-styles.bundle.css`
- `dist/wycwy-app.bundle.js`
- `vendor/` 下的本地 React production UMD

## 本地启动

最简单方式：

```bash
open ./启动游戏.command
```

也可以在项目根目录直接启动：

```bash
node scripts/ai-review-server.mjs
```

然后打开：

```text
http://localhost:8765/网约车物语-V3.html
```

`启动游戏.command` 会自动启动本地 HTTP 服务并打开浏览器。优先使用 Node 服务，因为它同时支持 AI 复盘、榜单和 telemetry API；如果没有 Node，会退回 Python 静态服务。

## 常用命令

修改 `src/engine/*.js` 后，重建引擎产物：

```bash
node scripts/build-engine.mjs
```

修改 `src/app/*.jsx` 或 `src/styles/*.css` 后，重建入口资源：

```bash
node scripts/build-entry-assets.mjs
```

部署或提交前做本地服务冒烟验证：

```bash
node scripts/smoke-server.mjs
```

## 目录结构

```text
网约车物语/
├── 网约车物语-V3.html          游戏主入口薄壳
├── wycwy-data.js               游戏数值与配置
├── wycwy-engine.js             游戏引擎构建产物
├── admin.html                  数值调参后台
├── leaderboard.html            独立榜单页
├── GAME_DESIGN.md              游戏机制文档
├── PRODUCT.md                  产品定位
├── DESIGN.md / DESIGN.json     视觉与设计系统
├── DEPLOYMENT.md               线上部署记录
├── CLAUDE.md / AGENTS.md       项目协作规则
├── src/                        源码维护入口
├── dist/                       线上入口构建产物
├── vendor/                     本地化 React 依赖
├── assets/                     像素图、地图、音效等素材
├── scripts/                    构建、服务、验证脚本
├── docs/                       辅助设计文档
├── tools/previews/             策划预览工具
└── 沉淀资产/                   AI 协同开发复用资产
```

## 维护入口

不要直接手改 `wycwy-engine.js` 和 `dist/` 里的 bundle，它们是构建产物。

按改动类型找源文件：

| 改动类型 | 维护文件 | 改完后运行 |
|---|---|---|
| 司机、车辆、订单、任务、事件、结局等数值 | `wycwy-data.js` | 视情况同步 `admin.html` |
| 派单、日结、事件调度、结局判定等逻辑 | `src/engine/*.js` | `node scripts/build-engine.mjs` |
| React 组件和交互 | `src/app/*.jsx` | `node scripts/build-entry-assets.mjs` |
| 样式、布局、动效 | `src/styles/*.css` | `node scripts/build-entry-assets.mjs` |
| 游戏机制说明 | `GAME_DESIGN.md` | 无构建命令 |

涉及 gameplay 的改动必须同步更新 `GAME_DESIGN.md`。如果 `wycwy-data.js` 的数据结构发生变化，也要同步更新 `admin.html` 的调参表格 schema。

## 后端与数据

本项目主体是静态网页游戏，但本地和线上 Node 服务提供几个 API：

- `POST /api/run-analysis`：结局 AI 运营复盘
- `POST /api/leaderboard/submit`：提交匿名经营榜单
- `GET /api/leaderboard`：读取榜单
- `POST /api/telemetry/batch`：批量写入玩家经营日志
- `POST /api/telemetry/session-end`：写入单局结束摘要

默认运行期数据写入：

```text
~/.local/share/wycwy/leaderboard.jsonl
~/.local/share/wycwy/telemetry-events.jsonl
~/.local/share/wycwy/telemetry-sessions.jsonl
```

线上部署和环境变量配置详见 `DEPLOYMENT.md`。

## 关键约定

- 本地和线上都用 HTTP 打开，不依赖 `file://`。
- 页面是固定一屏游戏 UI，禁止整页滚动；长内容放面板、抽屉或弹窗内滚动。
- 中文字体使用系统黑体，复古感靠像素素材、厚边框、硬阴影和暖黄底色实现，不重新引入中文像素字体。
- `网约车物语-V3.html` 虽然保留 V3 名称，但现在只是入口薄壳；真正维护入口在 `src/`。
- 提交或部署前优先跑 `node scripts/smoke-server.mjs`。

## 相关文档

- `GAME_DESIGN.md`：核心循环、数值机制、终局条件、版本变更。
- `CLAUDE.md`：项目开发约定和踩坑记录，`AGENTS.md` 是它的软链接。
- `DEPLOYMENT.md`：线上目录、部署命令、PM2 服务、API 验证命令。
- `PRODUCT.md`：玩法定位、体验目标和设计原则。
- `DESIGN.md`：视觉系统和界面风格规则。
- `沉淀资产/`：从本项目提炼出的 Agent、Skill、Prompt、方法论和验证清单。
