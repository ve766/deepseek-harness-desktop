# DESIGN SYSTEM · AI Employee OS

> 阶段：产品设计（纯规范，无代码、未改仓库、未改 m3e-canvas）。
> 适用范围：AI Employee OS Desktop PC 客户端全部界面（含 Knowledge OS、员工交互、Desktop 壳）。
> 风格基线：Apple macOS / visionOS 的克制高级感 + Linear 的精准 + Arc 的轻量探索感。
> 目标：建立一套**长期可商业化**、普通用户可理解、不露开发者工具痕迹的设计语言。

---

## 0. 设计哲学（十条）

1. **克制的色彩** —— 以中性灰为底，单一品牌色点睛，语义色仅用于"状态/类型"，不滥用。
2. **层级靠明度与模糊，不靠重阴影** —— 用 vibrancy（毛玻璃）与 1px 描边表达层级，而非堆叠投影。
3. **圆角是友好，不是玩具** —— 统一半径阶梯，大圆角卡片但边角干净利落。
4. **字重于色** —— 信息靠字号/字重/明度分级，而非颜色轰炸。
5. **动效服务于理解** —— 位移用弹簧（有重量），出现/消失用标准缓动；AI 动作必须"可见可解释"。
6. **毛玻璃有度** —— 仅标题栏/侧栏/浮层用 blur，内容区保持不透明以保证可读。
7. **普通用户语言** —— 主文案白话；技术词（向量/余弦/embedding）只在可折叠"技术细节"出现。
8. **状态即反馈** —— 每个交互都有 idle / hover / active / loading / done / error 六态，且视觉一致。
9. **可主题化** —— 全部走语义 token，Light / Dark 共用一套命名，切换只换值不换结构。
10. **IP 一致性** —— 吉祥物（田园犬/布偶猫/黑猫/边牧）为唯一视觉家族，组件只裁切/展示，不重绘。

---

## 1. 视觉规范（Visual Foundations）

### 1.1 色彩系统（Color）

**原则**：语义 token 为唯一入口，组件禁止写死 hex（除吉祥物品牌色）。下表 Light 为默认，Dark 为自动派生值。

#### 1.1.1 基础中性（Neutral / Surfaces）

| Token | 用途 | Light | Dark |
|---|---|---|---|
| `--dsw-bg-base` | 应用最底层背景 | `#F5F5F7` | `#1E1E20` |
| `--dsw-bg-layer-1` | 侧栏/标题栏底 | `#FFFFFF` (blur) | `#2A2A2C` (blur) |
| `--dsw-bg-layer-2` | 卡片/面板 | `#FFFFFF` | `#323234` |
| `--dsw-bg-layer-3` | 浮层/弹窗/选中底 | `#FBFBFD` | `#3A3A3C` |
| `--dsw-border-l1` | 主描边/分隔 | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` |
| `--dsw-border-l2` | 弱描边/次级分隔 | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.06)` |

#### 1.1.2 文字（Label）

| Token | 用途 | Light | Dark |
|---|---|---|---|
| `--dsw-label-primary` | 主标题/正文 | `#1D1D1F` | `#F5F5F7` |
| `--dsw-label-secondary` | 副信息 | `#515154` | `#C7C7CC` |
| `--dsw-label-tertiary` | 辅助说明 | `#86868B` | `#8E8E93` |
| `--dsw-label-caption` | 极小标注 | `#A1A1A6` | `#6E6E73` |

#### 1.1.3 品牌与语义（Brand / State）

| Token | 用途 | 值（两模式共用） |
|---|---|---|
| `--dsw-brand-primary` | 主操作/选中/链接 | `#4C6EF5`（知性靛蓝） |
| `--dsw-brand-hover` | 主操作 hover | `#3B5BDB` |
| `--dsw-state-success` | 成功/在线/已连接 | `#34C759` |
| `--dsw-state-warning` | 警告/谨慎 | `#FF9F0A` |
| `--dsw-state-error` | 错误/离线/失败 | `#FF3B30` |
| `--dsw-state-info` | 提示/进行中 | `#0A84FF` |
| `--dsw-interactive-bg-hover` | 行/卡片 hover 底 | `rgba(0,0,0,0.04)` / Dark `rgba(255,255,255,0.06)` |
| `--dsw-interactive-bg-active` | 行/卡片按下 | `rgba(0,0,0,0.08)` / Dark `rgba(255,255,255,0.10)` |

#### 1.1.4 知识节点类型色（Knowledge Node Accents）

> 用于节点左侧色条 / 图标 chip 背景，**低饱和、可区分、不刺眼**。

| 类型 | Accent | 浅底 chip | 含义 |
|---|---|---|---|
| Document 文档 | `#3B82F6` | `rgba(59,130,246,0.12)` | 蓝 |
| Video 视频 | `#A855F7` | `rgba(168,85,247,0.12)` | 紫 |
| Conversation 对话 | `#22C55E` | `rgba(34,197,94,0.12)` | 绿 |
| Project 项目（容器） | `#F0A23B` | `rgba(240,162,59,0.14)` | 琥珀 |

#### 1.1.5 吉祥物角色色（Mascot Accents，IP 固定，来自 Mascot 视觉系统 v1.0）

| 员工 | 角色 | Ring / 强调色 | 母版色 |
|---|---|---|---|
| 🐕 中华田园犬 | 默认助手 Assistant (P1) | `#F5A623` | 黄夹克 + 工牌 |
| 🐱 布偶猫 | Knowledge Manager (P3) | `#A8C8EC` | 蓝眼镜 + 书本 |
| 🐈‍⬛ 黑猫 Nox | Research Agent (P2) | `#1A1A1A`（Dark 下用 `#48484A` 描边） | 侦探帽 + 风衣 + 放大镜 |
| 🐕 边牧 | Coding Agent (P4) | `#6B7280` | 黑白 + 工程师外套 + 耳机 |

---

### 1.2 背景与层级（Background & Layering）

- **应用根背景**：`--dsw-bg-base`，纯色不透明（保证长文可读）。
- **标题栏 / 侧栏 / 浮层**：`--dsw-bg-layer-1` + `backdrop-filter: blur(24px) saturate(180%)`，透明度 ~0.72，叠在内容之上产生 vibrancy。
- **卡片 / 面板**：`--dsw-bg-layer-2`，不透明。
- **层级口诀**："内容实、框架透"——只有框架层毛玻璃，内容区永远实底。
- **画布背景**（Knowledge Space）：`--dsw-bg-base` + 极淡点阵网格（点 `#000` @ 4% 透明度，间距 32px），提供空间参照但不喧宾夺主。

---

### 1.3 卡片（Card）

统一卡片规范：

| 属性 | 值 |
|---|---|
| 圆角 | `--radius-lg` 16px（小卡 12px） |
| 背景 | `--dsw-bg-layer-2` |
| 描边 | 1px `--dsw-border-l1` |
| 内边距 | 16–20px |
| 阴影（默认） | `--elev-1` |
| hover | 上浮 `translateY(-2px)` + 阴影升至 `--elev-2` + 描边微亮 |
| 选中 | 2px `--dsw-brand-primary` 描边，`outline-offset: 3px` |
| 圆角过渡 | 标准缓动 200ms |

---

### 1.4 毛玻璃（Glassmorphism）

| 层级 | blur | 透明度 | 描边 |
|---|---|---|---|
| 标题栏 / 侧栏 | 24px | 0.72 | `--dsw-border-l1` |
| 浮层 / Sheet 遮罩 | 40px（仅遮罩） | 0.40 黑 | — |
| 右键菜单 / Popover | 20px | 0.85 | `--dsw-border-l1` |
| Insight Panel（右） | 24px | 0.78 | 左 1px `--dsw-border-l1` |

> 规则：毛玻璃层**不叠加**第二层 blur；浮层 menu 直接实底+轻 blur，避免"玻璃叠玻璃"的廉价感。

---

### 1.5 阴影（Elevation Scale）

| Token | 值（Light） | 用途 |
|---|---|---|
| `--elev-0` | 无（仅描边） | 静态卡片/分隔 |
| `--elev-1` | `0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)` | 默认卡片 |
| `--elev-2` | `0 4px 12px rgba(0,0,0,0.08)` | hover / 选中 |
| `--elev-3` | `0 12px 32px rgba(0,0,0,0.12)` | 拖拽中 / 浮起节点 |
| `--elev-4` | `0 24px 64px rgba(0,0,0,0.18)` | Sheet / Modal / 全局浮层 |

Dark 模式阴影整体减弱（opacity ×0.6）并加 1px 亮描边补轮廓。

---

### 1.6 圆角（Radius Scale）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-xs` | 6px | chip / tag / 小控件 |
| `--radius-sm` | 8px | 按钮 / 输入框 |
| `--radius-md` | 12px | 小卡 / 列表项 |
| `--radius-lg` | 16px | 卡片 / 面板 / 节点 |
| `--radius-xl` | 20px | 大卡 / 详情面板 |
| `--radius-pill` | 999px | 头像 / 状态点 / 胶囊按钮 |

---

### 1.7 字体层级（Typography）

字体栈：`-apple-system, "SF Pro Text", "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", system-ui, sans-serif`（中文优先 PingFang SC）。

| 层级 | 字号 / 行高 | 字重 | 字距 | 用途 |
|---|---|---|---|---|
| Display | 28 / 34 | 600 | -0.4 | 页面主标题 |
| Title 1 | 22 / 28 | 600 | -0.2 | 分区标题 |
| Title 2 | 20 / 25 | 600 | -0.1 | 卡片大标题 |
| Title 3 | 17 / 22 | 600 | 0 | 列表项标题 |
| Body | 15 / 22 | 400 | 0 | 正文（默认） |
| Callout | 14 / 20 | 400 | 0 | 说明文字 |
| Subhead | 13 / 18 | 500 | 0.1 | 小节标签 |
| Footnote | 12 / 16 | 400 | 0 | 辅助/来源 |
| Caption | 11 / 14 | 500 | 0.2 | 极小标注 / 计数 |

---

### 1.8 间距（Spacing，4/8 栅格）

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

| Token | 值 | 用途 |
|---|---|---|
| `--sp-1` | 4 | 图标与文字内距 |
| `--sp-2` | 8 | 控件内距 |
| `--sp-3` | 12 | 卡片内分组 |
| `--sp-4` | 16 | 卡片内边距 / 列表项距 |
| `--sp-5` | 20 | 面板内边距 |
| `--sp-6` | 24 | 分区间距 |
| `--sp-8` | 32 | 大区隔 |
| `--sp-10` | 40 | 页面边距 |
| `--sp-12` | 48 | 整页留白 |
| `--sp-16` | 64 | 首屏上下留白 |

---

## 2. 核心组件（Core Components）

> 以下组件均按"视觉 + 状态 + 行为"三要素定义。实现方式（React/SVG/CSS）留待实现文档，本规范不含代码。

### 2.1 KnowledgeNode（知识节点）

**定位**：Knowledge Space 画布上的基本单位。固定宽 **220px**，高自适应。

**结构**（自上而下）：
1. **顶栏**：左侧类型图标 chip（16px 圆角底 + 类型色）+ 类型标签（Caption，tertiary）；右侧"更多"⋯（hover 显）。
2. **标题**：Title 3，单行省略（…）；可选主图标（文档封面/视频缩略）。
3. **副信息**：Footnote，单行 —— 文档："12 段 · 来自 PDF"；视频："8 分 · 3 章"；对话："与 XX · 24 轮"；项目："包含 6 项"。
4. **底栏**（仅 hover/选中显）：关联数 chip「↔ 3」+「在 Explorer 查看」文字按钮。

**四类型差异**（仅图标 + 类型色条）：
| 类型 | 图标隐喻 | 左侧色条 |
|---|---|---|
| Document | 纸张 | `#3B82F6` |
| Video | 播放三角 | `#A855F7` |
| Conversation | 气泡 | `#22C55E` |
| Project（容器帧） | 文件夹 | `#F0A23B`，且节点为"容器"质感（虚线边、可容纳子节点） |

**状态**：

| 状态 | 视觉 |
|---|---|
| idle | 默认卡片 `--elev-1`，1px border-l1 |
| hover | 上浮 2px、`--elev-2`、border 微亮、底栏淡入 |
| selected | 2px brand 描边 offset 3px，右检查器展开 |
| dragging | `scale .97`、光标 grabbing、`--elev-3` |
| inferred（AI 新建） | 顶部一条 2px 类型色虚线 + 入场 reveal 动画；hover 显"AI 推断"标 |
| error | 整卡红色 1px 描边 + 角标 ⚠，tooltip 说明（如嵌入失败） |

---

### 2.2 AgentAvatar（员工头像）

**定位**：代表四只吉祥物员工的头像，统一视觉家族。

**资源约定**（来自 Mascot 视觉系统 v1.0，铁律）：
- **直接使用已归档的母版 Avatar 资源**（透明 PNG，约 384×476，仅取上半角色区），**严禁 ImageGen 重新生成**（防视觉漂移）。
- 组件只负责：裁切圆角 / 阴影 / hover 动效 / 状态点 / 名字标，**不改图本身**。

**尺寸规范**：

| 场景 | 尺寸 | 说明 |
|---|---|---|
| Desktop 卡片大图 | 96px | 员工详情卡 |
| 顶栏 / 任务条 | 32px | 行内 |
| 对话气泡 | 40px | 气泡头像 |
| Marketplace 封面 | 512×768 | 商店 |

**角色环（Ring）**：头像外圈 2px 描边，颜色取角色色（§1.1.5）。
- 田园犬：`#F5A623`；布偶猫：`#A8C8EC`；黑猫：`#1A1A1A`（Dark 下 `#48484A`）；边牧：`#6B7280`。

**状态点（EmployeeStatusDot）**：在头像右下角叠加 12px 圆点，映射 5 态（用 `StateDot` 薄层，因原生仅 4 态）：
| 员工状态 | 点色 |
|---|---|
| 在线/待命 | success 绿 |
| 思考中/工作中 | info 蓝（同 ThinkingRing） |
| 忙碌/执行任务 | warning 琥珀 |
| 离线 | tertiary 灰 |
| 错误 | error 红 |

**名字标**：Desktop 卡片/列表场景下，头像下方跟 13px 员工名（如"田园犬 · 助手"）。

---

### 2.3 ThinkingRing（AI 思考环）

**定位**：表达"AI 正在推断/生成"，让 AI 动作可见、可信任。

**形态**：围绕目标元素（头像 / 节点 / 卡片）的**旋转 conic-gradient 环** + 轻 `blur`，不遮挡内容。

| 属性 | 值 |
|---|---|
| 环宽 | 2.5px |
| 渐变 | `conic-gradient(from 0deg, transparent 0%, var(--dsw-state-info) 70%, transparent 100%)` |
| 旋转 | 360° 线性，周期 **1.2s**，无限 |
| 外扩 | 距元素边缘 3px |
| 模糊 | `blur(0.5px)` 柔化起止 |
| 附加 | 元素轻微亮度提升（filter brightness 1.03） |

**停止**：推断完成立即移除（非淡出或 120ms 快速收束），交棒给 `AIConnection` reveal 或节点 `inferred` 态。

**降级**：`prefers-reduced-motion` 时改为静态 info 色描边环（不旋转）。

---

### 2.4 AIConnection（AI 自动关联连线）

**定位**：两条节点之间的"AI 发现关系"，是 Knowledge Space 的核心差异化元素。

**形态**：SVG `<path>`（贝塞尔，避免硬直角），锚定两节点边缘中点。

**两种线**：

| 类型 | 样式 | 出现动画 |
|---|---|---|
| 手动/已确认 | 1.5px 实线，`--dsw-border-l2` 灰 | 即时，无动画 |
| **AI 自动发现** | 1.5px **虚线**，类型中性灰；置信高则略亮 | `pathLength 0→1` 生长 + `opacity 0→1`，**900ms** reveal；随后 dash 流动（marching ants 0.6s 循环，缓慢） |

**交互**：
- hover 线：加粗至 2px + 显示气泡「为什么相关：都提到 XX / 同属项目 Y」（白话原因，来自 `Edge.reason`）。
- 低置信（<0.5）：线更淡（opacity 0.5），气泡标注"AI 不太确定"。
- 删除：选中线 → 出现删除柄；删除走快照历史（可撤销）。

**原因标注层**：始终可读，满足"可解释"原则——绝不画一条无理由的线。

---

### 2.5 MemoryCard（记忆卡）

**定位**：AI Employee Memory 页与 Insight Panel 中的"AI 学到了什么"单元。

**结构**：
1. **头部**：scope 图标 chip（用户/项目/习惯/任务，各一色）+ scope 标签（Caption）。
2. **主体**：自然语言陈述（Body），如"你常用 qwen3:8b 做商业分析"。
3. **底部**：来源小字（Footnote："来自 Chat 记录 / 文档 XX / AI 推断"）+ 信任度微型条（5 段强度）+ 操作（赞同 ✓ / 纠正 ✎ / 隐藏 ⋯）。

**状态**：

| 状态 | 视觉 |
|---|---|
| new | 左侧 3px brand 亮条 + 入场轻微 pulse（1 次） |
| confirmed | 信任度条满，✓ 高亮 |
| corrected | 标题后挂"已纠正"标，来源显"用户修正" |
| hidden | 整卡降至 tertiary 透明度 0.5，可恢复 |

**信任度条**：5 段，仅示意强度（非精确分），普通用户友好；高级用户可 hover 看分。

---

### 2.6 ProviderStatusCard（Provider 状态卡）

**定位**：展示 Ollama（本地）/ Cloud（云端）Provider 的连接与模型可用性，呼应 LLM Provider Manager。

**结构**：
1. **头部**：Provider 图标/名（Ollama 🦙 / Cloud ☁️）+ **状态胶囊**（connected / connecting / offline / error，用 StateDot 同色系）。
2. **模型列表**：chip 行，每 chip = 模型友好名 + 可用状态点（绿=已装/可用，灰=未装，红=配置错误）。
3. **指标行**（Footnote）：最后检测时间 / 延迟 / 额度（Cloud）。
4. **操作**：连接 / 重试 / 配置（打开设置）。

**状态映射**：

| 状态 | 胶囊色 | 示例文案 |
|---|---|---|
| connected | success | "本地 Ollama 已连接 · 3 模型可用" |
| connecting | info + ThinkingRing 小环 | "正在连接…" |
| offline | tertiary | "未运行 / 未配置" |
| error | error | "API Key 无效"（对应 INVALID_CREDENTIAL，不自动 fallback） |

**与 Router 语义对齐**：error 态（如 AUTH/INVALID_CREDENTIAL）明确显示原因，**不**做自动切换，呼应 LLM Router "禁止隐藏用户配置错误"原则。

---

## 3. 动效规范（Motion）

> 参考 Apple Motion：位移用弹簧（重量感），出现/消失用标准缓动（清晰），AI 动作有专属可读动画。

### 3.1 动效 Token

**时长（Duration）**：

| Token | ms | 用途 |
|---|---|---|
| `--dur-micro` | 120 | 状态点、微交互 |
| `--dur-fast` | 200 | hover、页面切换、卡片缩放 |
| `--dur-base` | 300 | 节点出现、面板展开 |
| `--dur-slow` | 450 | 大面板 / Sheet |
| `--dur-reveal` | 900 | AI 关联 reveal、内容浮现 |

**缓动（Easing）**：

| Token | 曲线 | 用途 |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 出现/消失/缩放宽敞（Apple 标准） |
| `--ease-decel` | `cubic-bezier(0, 0, 0.2, 1)` | 进入（减速落定） |
| `--ease-accel` | `cubic-bezier(0.3, 0, 1, 1)` | 退出（加速离开） |
| `--ease-spring` | 弹簧（见下） | 位移/归位 |

**弹簧预设（Spring）**：

| 名称 | stiffness | damping | mass | 用途 |
|---|---|---|---|---|
| `spring-drag` | 620 | 38 | 0.7 | 拖拽中跟随（有重量） |
| `spring-settle` | 700 | 42 | 1 | 吸附/归位（利落） |
| `spring-gentle` | 400 | 30 | 1 | 面板展开（柔和） |
| `spring-snap` | 900 | 60 | 1.2 | 磁吸落定（明显回弹） |

### 3.2 具体动画规格

#### 3.2.1 节点出现（Node Appear）
- **触发**：AI 生成新节点 / 导入完成落入地图。
- **参数**：`scale 0.9→1` + `opacity 0→1` + `translateY 8px→0`，`--dur-base` `--ease-decel`。
- **细节**：AI 新建节点额外在顶部 reveal 类型色虚线（§2.1 inferred）。

#### 3.2.2 AI 思考（AI Thinking）
- **触发**：推断关联 / 生成中。
- **参数**：`ThinkingRing` 旋转 360° / 1.2s 线性无限；目标元素 `brightness 1.03`。
- **停止**：推断完成即时收束（120ms）或交棒 reveal。

#### 3.2.3 自动连线（Auto Connect）
- **触发**：AI 发现一条关系。
- **参数**：`pathLength 0→1` + `opacity 0→1`，`--dur-reveal` `--ease-standard`；完成后 dash 缓慢流动（marching ants 0.6s 循环，opacity 低）。
- **理由**：让"关系被建立"这一过程可被用户看见，建立信任。

#### 3.2.4 聚类（Clustering / Auto Tidy）
- **触发**：点「自动整理」。
- **参数**：节点向目标位 `spring-settle` 位移；多节点 `stagger 20ms`（从 hub 向外）；hub（项目节点）锚定不动。
- **约束**：容差 ≤6px 才微调，绝不"替用户做主"大挪移。

#### 3.2.5 页面切换（Page Transition）
- **触发**：侧栏切换 Knowledge / Memory / Import / Settings。
- **参数**：内容区 `opacity 0→1` + `translateY 8px→0`，`--dur-fast` `--ease-standard`；旧页 `--ease-accel` 退出。
- **侧栏选中指示**：选中图标底部 2px brand 短条，`spring-gentle` 滑动到目标（共享布局动画）。

#### 3.2.6 画布相机（Camera）
- **平移**：空格/中键/空白拖拽 → 相机 `spring-drag` 跟随（松手无惯性或极短惯性）。
- **缩放**：`⌘/Ctrl+滚轮` 以光标为锚 `scale`；钳制 `MIN_Z=0.25, MAX_Z=3`；`fit()` 留白 12% 包围盒。
- **尊重**：`prefers-reduced-motion` 时相机仍可用，但去弹簧改为线性插值。

### 3.3 可访问性（A11y）
- 所有动效遵循 `prefers-reduced-motion`：旋转/生长/弹簧降级为 `opacity` 淡入淡出（≤200ms），位移直接跳变。
- 状态不仅靠颜色：success/error/warning 均配图标或文字，避免色盲误读。
- 焦点环：`2px --dsw-brand-primary` + offset 2px，键盘可达。

---

## 4. 与既有系统的对齐（Consistency Notes）

- **Design Token 唯一来源**：本规范的 `--dsw-*` 即仓库 `--dsw-alias-*` 语义集（bg-base/layer-1~3、label-primary/secondary/tertiary/caption、border-l1/l2、brand-primary、state-success/error-primary、interactive-bg-hover/active、button-primary-fill/-hover）。组件实现必须消费这套 token，**不得自造新 token 名**。
- **Mascot IP 铁律**：吉祥物视觉只来自已归档母版资源，组件不重绘、ImageGen 不重新生成。
- **LLM Router 语义呼应**：ProviderStatusCard 的 error 态显式暴露配置错误且不自动 fallback，与 Router "禁止隐藏 AUTH/INVALID_CREDENTIAL" 决策一致。
- **插件化预留**：节点类型色、Provider、员工角色均通过注册表注入，组件按 type/role 查表渲染，零硬编码。

---

> 本文件为规范层，不含实现代码。具体组件实现（React/SVG/CSS）与 Knowledge Canvas 页面结构见 `UI-PROTOTYPE-KNOWLEDGE-CANVAS.md`。
