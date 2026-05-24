---
name: 网约车物语
description: 致敬开罗 Kairosoft 系列的网页像素风模拟经营游戏 portfolio 作品
colors:
  bg: "#F4E4BC"
  bg-deep: "#E5D29F"
  card: "#FFF8E7"
  sub: "#F0E2BC"
  ink: "#2A2320"
  ink-2: "#6D635A"
  ink-3: "#9A8C7E"
  accent: "#FF8C42"
  accent-soft: "#FFE0B8"
  accent-deep: "#D4621F"
  green: "#5FAD41"
  green-soft: "#D6EBC4"
  warn: "#E84545"
  blue: "#4A90E2"
  purple: "#8B5CF6"
  gold: "#FFD93D"
  border: "#2A2320"
  border-soft: "#2A23202E"
  hairline: "#2A23201A"
typography:
  display:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
rounded:
  hard: "2px"
  default: "3px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#FFF8E7"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.accent-deep}"
    textColor: "#FFF8E7"
  button-ghost:
    backgroundColor: "#FFF8E7"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    typography: "{typography.body}"
  button-ghost-hover:
    backgroundColor: "{colors.sub}"
    textColor: "{colors.ink}"
  modal:
    backgroundColor: "#FFF8E7"
    textColor: "{colors.ink}"
    rounded: "{rounded.hard}"
    padding: "24px"
  modal-tag:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-deep}"
    rounded: "{rounded.hard}"
    padding: "3px 9px"
  modal-option:
    backgroundColor: "{colors.sub}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "12px 14px"
  modal-option-hover:
    backgroundColor: "#FFF8E7"
    textColor: "{colors.ink}"
  topbar-stat:
    backgroundColor: "{colors.sub}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hard}"
    padding: "6px 9px"
---

# Design System: 网约车物语

## 1. Overview

**Creative North Star: "开罗工坊（The Kairo Workshop）"**

视觉系统的灵感来自 Kairosoft 像素经营游戏——但不是治愈的开罗，是"在滴滴做网约车经营惨剧"的版本。整个系统刻意保留手作的"棱角"：硬边框、硬阴影、低圆角、暖色调底子上的尖锐警告色，所有视觉决策都为传播力服务，不为通用产品的可读性妥协。

工坊感来自三件事：(1) 暖黄大地色 + 深棕油墨字的"档案/便签/账本"调色；(2) 2px 圆角 + 厚边框 + 无 blur 硬阴影的像素感物理；(3) 节制使用工坊橙（仅在动作按钮、标签、状态强提示）让暖色调底子不变成糖。

明确反对：滴滴官方 App 的品牌蓝/Material 控件、SaaS Dashboard 的 KPI 卡 + Inter + 渐变图、Web3/赛博朋克的暗色霓虹、微信小游戏的卡通糖果色、PPT 一样规整的对齐网格。

**Key Characteristics:**
- 暖黄大地底色（`#F4E4BC`），不用纯白也不用纯灰
- 深棕油墨文字（`#2A2320`）作为唯一文字基调，不用纯黑
- 硬阴影系统（2-3px 偏移、0 模糊），无 box-shadow blur radius
- 极小圆角（2-3px），保留像素方块感
- 14/18/24 三档字号阶梯（理想），实际有漂移待修正
- 一屏不滚动，主屏即玩

## 2. Colors: 工坊调色板

调色板分四个家族：暖黄大地（背景层）、深棕油墨（文字 + 边框）、工坊橙（动作 + 强提示）、功能色（收益绿、警告红、金币黄）。整体克制但不寡淡。

### Primary

- **工坊橙（Workshop Orange）** (`#FF8C42`)：唯一动作色——主按钮、激活态、状态徽章、modal 选项 hover 边框。永远不在大面积铺底使用。
- **油渍橙（Grease Orange）** (`#D4621F`)：工坊橙按下/hover 加深态、modal-tag 文字色。
- **晨光橙（Sunlight Orange）** (`#FFE0B8`)：橙色软底，仅用于标签底色（modal-tag 等）。

### Secondary

- **完单绿（Order Green）** (`#5FAD41`)：完单收益、正向数值、月报正数。
- **完单绿软底（Order Green Soft）** (`#D6EBC4`)：完单提示卡背景。
- **金币（Pixel Gold）** (`#FFD93D`)：金币图标、特殊高亮。

### Tertiary

- **警告红（Alert Red）** (`#E84545`)：投资人压力、破产倒计时、严重事件。
- **状态蓝（Status Blue）** (`#4A90E2`)：罕用，信息态。
- **故事紫（Story Purple）** (`#8B5CF6`)：罕用，司机故事/特殊事件。

### Neutral

- **大地黄（Earth Yellow）** (`#F4E4BC`)：游戏主背景。
- **深大地黄（Deep Earth）** (`#E5D29F`)：次级背景层。
- **奶卡白（Cream Card）** (`#FFF8E7`)：卡片底色，所有"白"用这个。
- **次背景（Sub Surface）** (`#F0E2BC`)：内嵌组件底色（topbar-stat、modal-option）。
- **油墨深棕（Ink Brown）** (`#2A2320`)：所有文字、所有硬边框，所有"黑"用这个。
- **油墨次棕（Ink Soft）** (`#6D635A`)：次级文字、说明文字。
- **油墨淡棕（Ink Faint）** (`#9A8C7E`)：三级文字、占位文字、ts-label。

### Named Rules

**The 暖黄即底 Rule.** 不允许使用 `#fff` 或 `#000` 作为大面积底色或文字色。所有"白"必须是 `#FFF8E7`（奶卡白），所有"黑"必须是 `#2A2320`（油墨深棕）。纯白 + 纯黑会让游戏立刻像 SaaS Dashboard。

**The 一橙独大 Rule.** 工坊橙 (`#FF8C42`) 在任意一屏的占用面积不超过 10%。它是动作色，不是装饰色。把它当成"按下去"的视觉标记。

**The 警告红独占严重态 Rule.** 警告红 (`#E84545`) 只用于真正严重的事件——投资人压力、破产倒计时、司机离职、事故。日常 UI 状态用次墨棕或硬边框承载。

## 3. Typography

**Body Font:** PingFang SC（Hiragino Sans GB / Microsoft YaHei 兜底）—— 系统中文黑体

**Character:** 刻意选择系统中文黑体而非像素字体——中文像素字体（如 Ark Pixel 16px）在 14px 主力字号下会子像素插值糊化，且中文笔画密度比日文/英文高得多，可读性差。复古像素美学的视觉锚点放在暖黄底色、像素 PNG 素材（地图/头像/车辆）、硬阴影、厚边框，而不是字面像素化字体。当前运行入口和 CSS 不加载像素字体文件;如本地目录保留历史字体文件,仅作旧版本回退资源，**不再启用**。

### Hierarchy

- **Display** (800-950, 24px, line-height 1-1.2)：modal 标题、关键弹窗主文字、教练标题、feedback 标题
- **Headline** (700, 18px, line-height 1.3)：分组小标题、重要状态值、KPI value
- **Body** (400-700, 14px, line-height 1.4-1.6)：正文、按钮、绝大多数 UI 元素
- **Label** (400-700, 11px)：ts-label、辅助文字、ts-sub、徽章、副信息

### Named Rules

**The 四档字号 Rule.** 字号严格收敛到 24 / 18 / 14 / 11 四档。**新组件只能从这四档里选**——11px 是 label/badge/meta 例外档，14px 是 body 主力，18px 是 headline，24px 是 display。漂移值（9/10/12/13/15/16/17/20/22）已在 V14.88 polish 中全部收敛，禁止重新引入。

## 4. Elevation

系统使用**硬阴影**（hard shadow）而非柔和模糊，呼应像素风的"无次像素"美学。深度感来自固定方向的实色偏移（深棕半透色 `2-3px 2-3px 0`），不来自 blur。任何独立 `box-shadow: 0 N M rgba(...)`（带 blur radius）都视为系统污染。

### Shadow Vocabulary

- **shadow-sm** (`box-shadow: 2px 2px 0 #2A23202E`)：topbar-stat、紧凑卡片、轻量元素
- **shadow-md** (`box-shadow: 3px 3px 0 #2A23202E, 0 8px 20px #2A23202F`)：modal、关键决策弹窗（此处刻意混入一层柔阴影做层次强化，是系统中**唯一**允许的混合）
- **shadow-hard** (`box-shadow: 3px 3px 0 #2A2320`)：实色硬阴影，强焦点元素、按下/激活态

### Named Rules

**The 无 Blur Rule.** 任何独立 box-shadow（不与硬偏移混用）都不允许出现 blur radius > 0。`.btn-primary` 现已统一为硬阴影 `2px 2px 0 rgba(42,35,32,0.65)`（line 4674）+ `:active` 按下态归零，是单一权威定义（V14.88 polish 完成 4 套层叠定义合并）。

**The 反 Glassmorphism Rule.** `backdrop-filter` 全局禁用。原 `.modal-overlay` 的 `backdrop-filter: blur(2px)` 已删除，半透深棕罩透明度同步从 0.4 提到 0.55 补偿焦点感。

## 5. Components

### Buttons
- **Shape**: 3px 圆角（默认）/ 2px（极小变体 btn-xs）
- **Padding**: 8px 14px（默认）/ 6px 10px（btn-sm）/ 4px 9px（btn-xs）
- **Typography**: 14px / 600 weight / `letter-spacing: 0`
- **Primary**: 工坊橙底 + 奶卡白字 + 硬阴影（待修复，当前用了柔阴影）
- **Primary Hover**: 油渍橙底
- **Ghost**: 奶卡白底 + 1px 油墨深棕边 + 油墨深棕字
- **Ghost Hover**: 次背景底（边色不变）
- **Transition**: `all 0.15s`

### Modal
- **Overlay**: `rgba(40,25,15,0.4)` 半透深棕罩 + 20px 内边距（待修复 backdrop-filter）
- **Container**: 奶卡白底 + 2px 圆角 + shadow-md + 24px 内边距 + max-width 520px
- **Title**: 24px / 800 weight / 6px 下边距
- **Description**: 14px / 油墨次棕 / line-height 1.6
- **Tag**: 晨光橙底 + 油渍橙字 + 14px / 700 weight + 3px 9px padding + 2px 圆角

### Modal-Option（事件选项卡）
- **Background**: 次背景 (`#F0E2BC`)
- **Border**: 1.5px 透明（hover 时变工坊橙）
- **Padding**: 12px 14px
- **Hover**: 边框变工坊橙 + 底色变奶卡白 + `transform: translateY(-1px)`
- **Label**: 14px / 700 weight
- **Effect 文字**: 14px / 油墨淡棕 / line-height 1.4

### TopBar
- **Height**: 70px 固定
- **Background**: 奶卡白
- **Border-bottom**: 1px 油墨深棕
- **Layout**: CSS Grid 三段——左侧 logo / 中部 KPI 区 / 右侧设置
- **Stats Item**: 次背景底 + border-soft 1px 边 + `1px 1px 0` 微硬阴影 + 6px 9px padding + 44px min-height

### TopBar-Stat（KPI 单元）
- **Layout**: Grid `auto / minmax(0,1fr)` 双列（label / value）
- **Label**: 14px / 油墨淡棕 / uppercase
- **Value**: 主色文字（资金=油墨深棕、KPI 突出态=工坊橙）

## 6. Do's and Don'ts

### Do
- **Do** 用暖黄大地色 (`#F4E4BC`) 作为游戏主背景，让 UI 浸在像便利贴/账本/油渍菜单的暖底里。
- **Do** 用深棕油墨色 (`#2A2320`) 作为唯一文字主色，不用纯黑。
- **Do** 用硬阴影（`Npx Npx 0 半透深棕`）传达深度，不用 blur radius。
- **Do** 严守 24/18/14/11 四档字号阶梯，新组件只能从这四档里选。
- **Do** 把工坊橙 (`#FF8C42`) 当稀缺动作色用，单屏占用 ≤10%。
- **Do** 把警告红 (`#E84545`) 留给真正严重的经营事件——投资人压力、破产、严重事故。
- **Do** 圆角控制在 2-3px，保留像素方块感。
- **Do** 复古像素美学锚定在暖黄底色 + 像素 PNG 素材（地图/头像/车辆）+ 硬阴影 + 厚边框——不依赖像素字体（中文像素可读性差）。

### Don't
- **Don't** 用 `#fff` 或 `#000`——所有"白"必须是奶卡白 `#FFF8E7`，所有"黑"必须是油墨深棕 `#2A2320`。V14.88 已批量修复 38 处 `#fff` 违规，新代码不得回潮。
- **Don't** 用 `backdrop-filter: blur()`——glassmorphism 直接踩中 PRODUCT.md 反例。
- **Don't** 用带 blur radius 的 box-shadow 作为独立阴影（如 `0 2px 6px rgba(...)`），违反像素硬阴影系统。
- **Don't** 引入字号 9/10/12/13/15/16/17/20/22——必须从 24/18/14/11 四档里选。V14.88 已收敛 64 处漂移，新代码不得回潮。
- **Don't** 创建第二处 `.btn-primary` 定义——V14.88 已合并 4 套层叠定义到单一权威 (line ~4674)，新增样式只改这一处。
- **Don't** 引入圆角 > 4px——会失去像素方块感。
- **Don't** 启用像素字体——已经决策放弃 Ark Pixel，中文场景下像素字体辨识度差，得不偿失。
- **Don't** 模仿滴滴官方 App 视觉语言（品牌蓝、Material/iOS 控件）——一旦像就丢失个人作品辨识度，被认成"内部产品 demo"。
- **Don't** 引入 SaaS Dashboard 视觉模板（KPI 大数字卡 + 渐变图表 + Inter 字体）——AI slop 重灾区，传不开。
- **Don't** 引入 Web3 / 赛博朋克 / 新拟态（neumorphism）——过度装饰且已过气。
- **Don't** 引入糖果色卡通风（圆滚滚拟人 + 高饱和糖色）——软化"经营惨烈"的黑色幽默。
- **Don't** 让 UI 看起来"像 PPT 一样规整"——刻意保留视觉棱角。
