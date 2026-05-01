# 网约车物语 — 核心素材清单与 AI 生图提示词（V1）

> 范围:本文件覆盖项目「必须级别」(★★★)的全部 32 张图片素材。
> 用法:每张素材都附一段可直接复制粘贴的英文提示词,推荐用 Midjourney / Recraft / Nano Banana / DALL·E / Stable Diffusion(配 Pixel Art LoRA)生成。生成完导出 PNG,按本文件命名规则放入项目根目录即可。

---

## 一、生图前必读

### 1. 工具推荐

| 工具 | 像素风表现 | 备注 |
|---|---|---|
| **Recraft** | ★★★★★ | 直接选 Pixel Art 风格,效果最稳 |
| **Midjourney v6** | ★★★★ | 加 `--style raw` 更克制 |
| **Nano Banana / Gemini Image** | ★★★★ | 中文提示词也能用,适合批量 |
| **Stable Diffusion + Pixel Art XL LoRA** | ★★★★★ | 本地批量,可控性最强 |
| **DALL·E 3** | ★★★ | 容易被它"画好看",需强调 flat/no-gradient |

### 2. 通用规则(所有提示词通用)

- **生成尺寸**:统一让 AI 生成 **1024×1024**(图标方形)或 **1024×512**(车辆横向),用户后续用 nearest-neighbor 缩到目标尺寸。
- **背景**:全部要求 **transparent background**(透明 PNG)。如果工具不支持透明,要求 **pure white #FFFFFF background**,后续抠图。
- **风格基调**:开罗(Kairosoft)系列像素游戏 — `Game Dev Story` / `Pocket Harvest` / `Hot Springs Story` 美术风格。
- **配色统一约束**:暖色 + 限色板;描边统一 **1px 深棕 #2A2320**;严禁渐变、模糊、抗锯齿、3D。
- **构图统一**:头像正面半身、车辆正侧视、图标方形居中。

### 3. 通用提示词模板(可复用)

> 下面所有具体素材的提示词,都已经把这段通用部分嵌进去了,直接复制即可用。

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story / Pocket Harvest aesthetic, warm cute cartoon, flat colors, limited palette, 1px dark brown #2A2320 outline on every shape, hard 2px offset shadow with no blur, sharp pixels, no anti-aliasing, no gradient, no realistic shading, no 3D render, no photorealism, transparent background, single subject centered, [SUBJECT_HERE], 1:1 square composition, 1024x1024.
```

负面提示词(Negative prompt,SD/部分工具用):

```
photorealistic, 3d render, blurry, soft shadow, gradient, anti-aliasing, smooth edges, realistic, painterly, watercolor, sketch, multiple subjects, text, watermark, signature
```

---

## 二、文件命名与放置位置

```
网约车物语/
├── assets/                          ← 新建
│   ├── avatars/                     ← 10 张司机头像
│   ├── vehicles/                    ← 5 张车辆
│   ├── parts/                       ← 6 张改装件
│   ├── orders/                      ← 7 张订单图标
│   └── stats/                       ← 4 张属性图标
```

命名规范见每个分类的表格。

---

## 三、司机头像(10 张)— 优先级 ★★★

**统一规格**:

| 项 | 值 |
|---|---|
| 输出尺寸 | 48×48 px(让 AI 生 1024×1024,后用 nearest-neighbor 缩放) |
| 比例 | 1:1 正方形 |
| 视角 | 正面半身,肩膀以上,直视镜头 |
| 背景 | 透明 |
| 数量 | 10 张 |
| 路径 | `assets/avatars/` |

### 1. `avatar-cap-army.png` — 退伍军人(N 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese male taxi driver in his 40s, half-body shoulders up, front view, looking forward. Wearing an army green camouflage cap, buzz cut visible under cap, tan skin tone, stoic expression, plain dark green collar shirt. Color palette: olive green #3F5A3A, warm skin #E0AF85. 1:1 square composition, 1024x1024.
```

### 2. `avatar-cap-flat.png` — 北漂青年(N 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese young man in his 20s, half-body shoulders up, front view, looking forward. Wearing a bright orange flat cap (newsboy style), short black hair peeking out, light skin, slightly tired hopeful expression, blue and white striped shirt. Color palette: orange #C14A1D, light skin #F0C795, white shirt. 1:1 square composition, 1024x1024.
```

### 3. `avatar-glasses.png` — 二胎奶爸(N 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese middle-aged man around 35-40, half-body shoulders up, front view. Wearing dark thick-framed square glasses, short tidy black hair, slightly chubby friendly face with a soft warm smile, wearing a blue plaid checkered shirt. Color palette: dark frame #2A2320, warm skin #E8B788, blue plaid shirt with white. 1:1 square composition, 1024x1024.
```

### 4. `avatar-bald.png` — 下岗大叔(N 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese older man in his 50s, half-body shoulders up, front view. Mostly bald with a thin ring of grey hair on the sides, weathered face with subtle wrinkle lines, plain expression, wearing a worn grey-brown windbreaker jacket. Color palette: grey hair #6D635A, tan weathered skin #D9A878, muted brown jacket. 1:1 square composition, 1024x1024.
```

### 5. `avatar-headset-r.png` — 网红司机(R 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese trendy young man in his late 20s, half-body shoulders up, front view, confident smile showing teeth. Wearing a bright orange streamer headset with a small mic, stylish black sunglasses, dyed light hair, vibrant orange collar of a varsity jacket. Slightly flashy and energetic vibe. Color palette: hot orange #FF6B35, fair skin #F5D0AB, black sunglasses. Subtle yellow rarity glow behind shoulders. 1:1 square composition, 1024x1024.
```

### 6. `avatar-cap-flat-r.png` — 出租老司机(R 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese veteran taxi driver, around 50, half-body shoulders up, front view, calm seasoned squint. Wearing a faded brown flat cap (old worn), grey-streaked sideburns visible, weathered tan face, fingerless yellowed driving gloves visible at shoulder, dark brown old leather-look jacket. Color palette: faded brown cap #8B5A2B, weathered skin #C9A07A. Subtle yellow rarity glow behind shoulders. 1:1 square composition, 1024x1024.
```

### 7. `avatar-glasses-sr.png` — 滴答前金牌(SR 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese professional ride-hail driver in his 30s, half-body shoulders up, front view, polite confident smile. Wearing thin gold-rimmed glasses, neat side-parted black hair, clean tan skin, navy blue suit jacket with white shirt collar, a small golden champion badge pinned on the chest. Color palette: gold rim #FFD93D, navy #1F3A5C. Strong yellow-gold rarity glow halo behind shoulders. 1:1 square composition, 1024x1024.
```

### 8. `avatar-glasses-sr2.png` — 国企转岗经理(SR 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese former state-owned-enterprise manager in his 40s, half-body shoulders up, front view, composed steady expression. Wearing rectangle dark-rim glasses, neatly combed black hair with a hint of grey, formal dark blue state-enterprise suit, a black briefcase strap visible at shoulder, small red lapel pin. Reliable, dignified vibe. Color palette: state blue #4A90E2 jacket, deep skin #D9A878. Yellow-gold rarity glow behind shoulders. 1:1 square composition, 1024x1024.
```

### 9. `avatar-headset-ssr.png` — 舒马赫亲传弟子(SSR 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese race-car-driver-turned-cabbie in his 30s, half-body shoulders up, front view, sharp serious gaze. Holding a red-and-black F1-style racing helmet under his arm at shoulder level, wearing a red and black racing suit with sponsor patches, racing gloves visible. Determined ace-driver vibe. Color palette: racing red #E84545, deep black, light skin #F5D0AB. Strong rainbow / prismatic SSR aura behind shoulders. 1:1 square composition, 1024x1024.
```

### 10. `avatar-cap-army-ssr.png` — 服务大师傅金鹏(SSR 级)

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Game Dev Story aesthetic, warm cute cartoon character portrait, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a Chinese master-chef-styled taxi service legend in his 40s, half-body shoulders up, front view, big warm welcoming grin. Wearing a tall white chef hat, white double-breasted chef-style service uniform with golden buttons, a small golden phoenix embroidery on the chest, neat black hair beneath the hat. Top-tier hospitality vibe. Color palette: pure white #FFFFFF, golden #FFD93D buttons, fair skin #F0C795. Strong rainbow / prismatic SSR aura behind shoulders. 1:1 square composition, 1024x1024.
```

---

## 四、车辆图标(5 张)— 优先级 ★★★

**统一规格**:

| 项 | 值 |
|---|---|
| 输出尺寸 | 78×33 px(让 AI 生 1024×512,后用 nearest-neighbor 缩放) |
| 比例 | 约 2.36:1 横向 |
| 视角 | **严格正侧视图**,车头朝右,无透视 |
| 背景 | 透明 |
| 数量 | 5 张 |
| 路径 | `assets/vehicles/` |

### 1. `vehicle-santana.png` — 桑塔纳

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Pocket Harvest vehicle sprite aesthetic, flat colors, 1px dark brown #2A2320 outline on entire silhouette, hard pixels, no anti-aliasing, no gradient, no perspective, transparent background. Subject: a classic Volkswagen Santana sedan from the 1990s, strict side profile view, car facing right, boxy three-box silhouette with squared edges, simple round wheels, basic chrome bumpers, tiny side mirror, plain hubcaps. Boxy old-school taxi vibe. Color palette: silver white body #E5E5E5, black wheels, hint of warm chrome. 2.36:1 horizontal composition, 1024x512.
```

### 2. `vehicle-camry.png` — 凯美瑞

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Pocket Harvest vehicle sprite aesthetic, flat colors, 1px dark brown #2A2320 outline on entire silhouette, hard pixels, no anti-aliasing, no gradient, no perspective, transparent background. Subject: a modern Toyota Camry mid-size sedan, strict side profile view, car facing right, smooth flowing three-box silhouette, alloy wheels with simple spoke pattern, tinted windows, slim side mirror, sleek modern bumper. Color palette: pearl white body #FAFAF5, dark grey alloy wheels, subtle silver trim. 2.36:1 horizontal composition, 1024x512.
```

### 3. `vehicle-han_ev.png` — 比亚迪汉 EV

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Pocket Harvest vehicle sprite aesthetic, flat colors, 1px dark brown #2A2320 outline on entire silhouette, hard pixels, no anti-aliasing, no gradient, no perspective, transparent background. Subject: a BYD Han EV electric sports sedan, strict side profile view, car facing right, sporty fastback silhouette, closed front grille (no air intake), low aggressive stance, multi-spoke sport alloy wheels, slim LED headlight strip. Modern Chinese EV vibe. Color palette: matte deep blue body #2C4E80, dark wheels, subtle blue accent line along the side. 2.36:1 horizontal composition, 1024x512.
```

### 4. `vehicle-odyssey.png` — 奥德赛

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Pocket Harvest vehicle sprite aesthetic, flat colors, 1px dark brown #2A2320 outline on entire silhouette, hard pixels, no anti-aliasing, no gradient, no perspective, transparent background. Subject: a Honda Odyssey MPV minivan business shuttle, strict side profile view, car facing right, tall boxy MPV silhouette with sliding-door visible mid-section, three rows of windows visible, comfortable family-business look. Color palette: champagne gold body #D4B896, black wheels, dark window tint. 2.36:1 horizontal composition, 1024x512.
```

### 5. `vehicle-benz_e.png` — 奔驰 E

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft / Pocket Harvest vehicle sprite aesthetic, flat colors, 1px dark brown #2A2320 outline on entire silhouette, hard pixels, no anti-aliasing, no gradient, no perspective, transparent background. Subject: a Mercedes-Benz E-Class luxury executive sedan, strict side profile view, car facing right, long elegant three-box silhouette, classic chrome window trim line, signature multi-spoke alloy wheels, prominent three-pointed-star front emblem hint, refined upscale stance. Color palette: deep graphite black body #2A2A2E, silver chrome trim, dark wheels with silver spokes. 2.36:1 horizontal composition, 1024x512.
```

---

## 五、改装件图标(6 张)— 优先级 ★★★

**统一规格**:

| 项 | 值 |
|---|---|
| 输出尺寸 | 24×24 px(让 AI 生 1024×1024,缩放) |
| 比例 | 1:1 正方形 |
| 视角 | 物体居中,正视或 3/4 像素风视角 |
| 背景 | 透明 |
| 数量 | 6 张 |
| 路径 | `assets/parts/` |

### 1. `part-massage.png` — 真皮按摩座椅

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a single luxurious leather car seat icon, side three-quarter view, dark brown leather material with visible quilted diamond stitching pattern, tiny wave/massage symbol lines on the backrest, headrest on top. Premium feel. Color palette: rich brown leather #5C3A28, light tan stitching #C9A07A. 1:1 square icon centered, 1024x1024.
```

### 2. `part-aroma.png` — 车载香薰

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a small car aroma diffuser bottle icon, front view, round-bottom glass bottle with golden cap, three curly aroma wisps rising above the cap. Pleasant fragrance vibe. Color palette: pale teal liquid #A8D8D0, gold cap #FFD93D, soft white aroma wisps. 1:1 square icon centered, 1024x1024.
```

### 3. `part-recorder.png` — 行车记录仪

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a small dashcam (car driving recorder) icon, front view, rectangular black device with a circular camera lens in the center, a tiny red recording dot on top corner, small mounting bracket visible. Color palette: matte black body #2A2320, glossy lens dark grey, red dot #E84545. 1:1 square icon centered, 1024x1024.
```

### 4. `part-etc.png` — ETC 高速年卡

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a highway ETC card icon, front view, slightly tilted rounded rectangle card, blue-and-white design with a small chip on the left and three signal arc waves emitting from the right side, plus a tiny highway "ETC" symbol in the middle. Color palette: ETC blue #2C6EBF, white, small gold chip #FFD93D. 1:1 square icon centered, 1024x1024.
```

### 5. `part-rack.png` — 行李架

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a roof luggage rack icon, side view, two parallel horizontal silver bars mounted on small black feet, with a stacked brown suitcase silhouette resting on top of the bars. Travel-ready vibe. Color palette: silver bars #BDBDBD, brown suitcase #8B5A2B, black feet. 1:1 square icon centered, 1024x1024.
```

### 6. `part-fridge.png` — 后排小冰箱

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a tiny portable car mini-fridge icon, three-quarter view, white cube with a small handle on the front door and a blue snowflake symbol in the center of the door, a small black cooling vent on the side. Color palette: white #FFFFFF body, ice blue #6FAEDB snowflake, black handle. 1:1 square icon centered, 1024x1024.
```

---

## 六、订单类型图标(7 张)— 优先级 ★★★

**统一规格**:

| 项 | 值 |
|---|---|
| 输出尺寸 | 16×16 px(让 AI 生 1024×1024,缩放) |
| 比例 | 1:1 正方形 |
| 形状 | 圆形彩色徽章,中心 1 个简笔图标 |
| 背景 | 透明 |
| 数量 | 7 张 |
| 路径 | `assets/orders/` |

### 1. `order-short.png` — 市内短途

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "short city ride", solid coral orange circle background #FF8A65 with a small white short arrow (or simple road-marker symbol) centered inside. Quick-trip vibe. Color palette: coral orange #FF8A65 background, pure white symbol. 1:1 square icon centered, 1024x1024.
```

### 2. `order-business.png` — 商务接送

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "business ride", solid sky blue circle background #0EA5E9 with a small white briefcase silhouette centered inside. Color palette: sky blue #0EA5E9 background, pure white briefcase. 1:1 square icon centered, 1024x1024.
```

### 3. `order-airport.png` — 机场专线

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "airport ride", solid green circle background #22C55E with a small white side-view airplane silhouette centered inside, slightly tilted upward. Color palette: green #22C55E background, pure white airplane. 1:1 square icon centered, 1024x1024.
```

### 4. `order-night.png` — 深夜场

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "late-night ride", solid violet purple circle background #8B5CF6 with a small white crescent moon centered inside, plus a tiny single star spark. Color palette: purple #8B5CF6 background, pure white moon and star. 1:1 square icon centered, 1024x1024.
```

### 5. `order-long.png` — 城际长途

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "intercity long-distance ride", solid amber orange circle background #F59E0B with a small white mountain silhouette plus a long arrow extending across, centered inside. Long-haul vibe. Color palette: amber #F59E0B background, pure white mountain and arrow. 1:1 square icon centered, 1024x1024.
```

### 6. `order-luxury.png` — 高端商务

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "luxury VIP ride", solid hot pink circle background #EC4899 with a small white diamond gem (or tiny crown) shape centered inside, sparkle dot in one corner. Premium vibe. Color palette: pink #EC4899 background, pure white diamond. 1:1 square icon centered, 1024x1024.
```

### 7. `order-eco.png` — 环保任务

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a circular badge icon for "eco-friendly ride", solid emerald green circle background #10B981 with a small white leaf silhouette centered inside (slightly tilted). Color palette: emerald #10B981 background, pure white leaf. 1:1 square icon centered, 1024x1024.
```

---

## 七、属性图标(4 张)— 优先级 ★★★

**统一规格**:

| 项 | 值 |
|---|---|
| 输出尺寸 | 12×12 + 16×16 两套(让 AI 生 1024×1024,缩放) |
| 比例 | 1:1 正方形 |
| 形状 | 实心彩色简笔图标,无外圈 |
| 背景 | 透明 |
| 数量 | 4 张 |
| 路径 | `assets/stats/` |

### 1. `stat-driving.png` — 驾驶

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, ultra-minimal pictogram, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a tiny solid orange steering wheel icon, front view, simple circular wheel with a Y-shape spoke in the center, no extra detail. Color palette: pure single color #FF6B35 fill, dark brown outline. 1:1 square icon centered, 1024x1024.
```

### 2. `stat-service.png` — 服务

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, ultra-minimal pictogram, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a tiny solid sky-blue five-pointed star icon, front view, classic clean star shape, no extra detail. Color palette: pure single color #0EA5E9 fill, dark brown outline. 1:1 square icon centered, 1024x1024.
```

### 3. `stat-road.png` — 路感

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, ultra-minimal pictogram, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a tiny solid emerald-green map pin icon (location marker), front view, classic teardrop pin shape with a small inner circle. Color palette: pure single color #10B981 fill, dark brown outline, white inner dot. 1:1 square icon centered, 1024x1024.
```

### 4. `stat-mind.png` — 心力

```
Pixel art, 16-bit retro Japanese sim game style, Kairosoft icon aesthetic, ultra-minimal pictogram, flat colors, 1px dark brown #2A2320 outline, hard pixels, no anti-aliasing, no gradient, transparent background. Subject: a tiny solid violet-purple lightning bolt icon, front view, sharp zigzag bolt shape, no extra detail. Color palette: pure single color #8B5CF6 fill, dark brown outline. 1:1 square icon centered, 1024x1024.
```

---

## 八、生成后处理流程

1. **生成原图**:用上面的提示词生成 1024×1024(图标/头像)或 1024×512(车辆)。
2. **抠透明底**(若工具未生成透明):用 `remove.bg` / Photoshop 魔棒抠掉白底。
3. **下采样到目标尺寸**:必须用 **Nearest Neighbor**(最近邻)算法,不要用双线性。
   - Photoshop: 图像 → 图像大小 → 重新采样选「邻近(硬边缘)」
   - macOS Preview / 在线工具: 找支持 nearest-neighbor 的
4. **落入项目目录**:按本文件「文件命名与放置位置」段落归档。
5. **接入代码**:
   - 找 HTML 中 `ph-avatar / ph-vehicle / ph-order-dot / ph-part / ph-stat` 5 个 CSS 类
   - 把 `background: ...` 改成 `background-image: url('assets/.../xxx.png')`
   - 加 `background-size: contain; background-repeat: no-repeat; image-rendering: pixelated;`

---

## 九、版本与待办

- **V1**(2026-04-28):完成必须级 32 张图的提示词清单。
- **下一步可扩展**(强烈建议级,见前期需求表):
  - 8 张事件插图(120×80)
  - 18 枚成就/里程碑徽章(64×64)
  - 3 帧时钟昼夜(48×48)
- 后续若新增司机背景或订单类型,在对应章节补条即可。
