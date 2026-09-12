# UI Inspiration Lock — 设计依据（7 源可迁移原则）

> **性质**：只读研究 + 设计迁移分析。**不复制任何代码**，只抽取可迁移的设计原则、参数区间与反模式。
> **目的**：为 `AI_EMPLOYEE_OS_VISUAL_EVOLUTION_PHASE1_PLAN.md` 补充「产品工艺层」的外部依据，并锁定**差异化边界**（目标不是 macOS clone，而是 AI Employee OS 自己的语言）。
> **前序**：`UI_RESEARCH_DESKTOP_OS_REFERENCES.md`（react-ui-os / macos-react / StreamDeck 三源，给出 OS Shell 范式：Dock / Inspector / App Icon / Glass）。
> **本篇**：在 OS Shell 范式之上，补入「产品工艺」来源——shadcn/ui、Magic UI、Aceternity UI（组件与动效工艺）、tldraw、React Flow（空间/节点范式）、Raycast、Linear（命令优先 + calm density）。
> **关联文档**：`AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`（方向基线）、`AI_EMPLOYEE_OS_UI_DESIGN_REVIEW.md`（R1–R8）。

---

## 0. 总纲：不是 macOS Clone，是 AI Employee OS 自有语言

三源 OS Shell 研究 + 本篇七源产品工艺，收敛为三根支柱。**目标是形成「Apple 克制 + Spatial 空间 + Agent 前瞻」的混合语言，而非像素级复刻 macOS。**

| 支柱 | 来源 | 在 AI Employee OS 的落点 |
|---|---|---|
| **Apple 克制 (Restraint)** | Apple HIG + shadcn/ui + react-ui-os + Linear | 深度靠玻璃/光/阴影，不靠边框；motion 短促物理不循环；密度高但安静 |
| **Spatial 空间 (Space)** | tldraw + React Flow | 知识与工作有空间深度（z 轴、相机、区域、流向），不是平面网格 |
| **Agent 前瞻 (Agent-forward)** | Raycast + 自身「员工」隐喻 | 系统是「与 AI 员工协作」而非「用软件」；员工是主角，Shell 是其舞台 |

**差异化红线（明确 NOT clone）**：
- ❌ 不抄 macOS 红绿灯窗口控件（除非 Phase 2 Window Manager 明确批准）。
- ❌ 不做「访达 / 文件管理器」式文件系统隐喻（AI Employee OS 无此需求）。
- ❌ 不逐像素复制 macOS 菜单栏（TopBar 仅借鉴其「左品牌 / 中当前员工 / 右状态簇」的**结构**）。
- ❌ 不把 Dock 做成系统级常驻（Phase 1 仅首页浮动；全局常驻留 Phase 2）。
- ✅ 借鉴的是「OS 级系统感 + 材质纪律 + 空间深度」，而非「macOS 皮肤」。
- ✅ **员工是中心，OS chrome 是配角**——这一点与 macOS 相反（macOS 里 app 是主角、Finder 是工具；我们里 AI 员工是主角、Shell 是其舞台）。

---

## 1. shadcn/ui — 代码所有权 + 语义化 token 纪律

**定位**：不是组件库，是「copy-paste 代码所有权」模式——基于 Radix UI primitives + Tailwind，主题完全由 CSS 变量（HSL）驱动，组件源码直接进你的项目，你拥有并修改它。

### 可迁移原则
- **「你拥有代码」哲学**：与本项目 **mascot 母版资产红线**一脉相承——资产/源码是自己的，不依赖外部黑盒。我们的 Glass token 也应是项目内可改的「源码级资产」，而非第三方库默认。
- **语义化 CSS 变量 theme 体系**：`--background / --foreground / --primary / --primary-foreground / --secondary / --muted / --muted-foreground / --accent / --accent-foreground / --destructive / --border / --input / --ring / --radius`。我们的 `--aios-*` 包应与之**同构**（语义命名、可被主题整体替换、HSL 或 rgba 统一），延续研究文档「差异属于 token，不写 `if(theme)`」的纪律。
- **无障碍原语模式**（来自 Radix）：focus management / ARIA / keyboard nav 是组件底层能力。我们的 Inspector / Command Center 交互应**借鉴其模式**（可折叠分节、焦点环、键盘可达），但不引入 Radix 依赖——仅借鉴交互协议。
- **复合优于配置**（composition over configuration）：组件通过 children / slot 组合，而非巨型 config 对象。映射：**Employee Card = App Icon 组件 + Character AI 层组件**的组合，而非一个含全字段的巨型卡片。

### 不可迁移 / 反模式
- ❌ Tailwind 依赖（本项目已有自有 token 体系；且 StreamDeck 研究已证明工具类库与 `backdrop-filter` 精确控制打架）。
- ❌ 具体组件实现或 new-york/default 风格切换（不抄代码）。

### 对 AI Employee OS 的映射
token 命名纪律（语义化、可主题替换）；「own the code」与母版资产红线一致；组合式组件结构。

---

## 2. Magic UI — 进场动画词汇（克制地借）

**定位**：基于 Framer Motion + Tailwind 的动画/营销组件库（marquee、shimmer button、animated beam、bento grid、hero、terminal 等）。

### 可迁移原则
- **进场动画词汇**：fade+rise、entrance spring、shimmer——映射到我们的 motion token（进场用 `--aios-motion-base` 档，180ms ease-out）。
- **Bento Grid 布局概念**：分节卡片用 bento 网格组织（Inspector / Command Center 的分组）——但克制，不堆特效。
- **Shimmer 用于「生成中」态**：AI 员工「思考 / 整理中」的优雅表达，替代生硬 spinner（映射到 Nox 思考态、知识整理进度）。

### 不可迁移 / 反模式
- ❌ 大量 ambient / loop 动画（react-ui-os 明确禁止循环 idle）——与我们的 motion 硬规则冲突，仅 mascot 允许循环。
- ❌ 营销感过强（flashy），与 Apple 克制冲突。
- ❌ Framer Motion 依赖（D1 未批准）。

### 映射
进场动画的「克制版」词汇；shimmer 用于 AI thinking 态。

---

## 3. Aceternity UI — 轻 3D / 光斑（极度克制地借）

**定位**：Tailwind + Framer Motion 的「酷炫」组件（3D card tilt、spotlight、background beams、bento、cards）。

### 可迁移原则
- **轻微 3D / Tilt 用于 Employee Card**：仅 mascot 主体 hover 时极轻倾斜（≤6° / scale ≤1.06），**不是全卡 tilt**（否则成 gimmick）。与研究文档 §4.3「角色亲密感运动允许轻微过冲」一致。
- **Spotlight hover（卡片跟随光斑）**：映射到 Dock tile hover 的 accent 高光 / 员工卡选中态。
- **Bento Grid**：同 Magic UI，用于 Inspector 分组。
- **Background beams / 网格背景**：作为工作区背景的「空间感」暗示（克制，不干扰内容）。

### 不可迁移 / 反模式
- ❌ 重 3D tilt、background beams 过度（干扰内容，与克制冲突）。
- ❌ Tailwind / Framer Motion 依赖。

### 映射
Employee Card 轻微 3D；Dock 光斑；工作区背景空间暗示。

---

## 4. tldraw — 无限画布 / 空间深度（D 段权威参考）

**定位**：无限画布 SDK（everything is a shape；camera 模型 zoom/pan/rotate；store/persistence；UI 可定制隐藏）。

### 可迁移原则
- **这是 D 段（Spatial Knowledge）的权威参考**。无限画布的 **camera 模型 = 空间深度**：节点近大远小、远景深模糊（与 E 的 Blur token 同源）。
- **Camera / zoom / pan / selection 范式**：深度（z）由 zoom 表达；选中态 bbox + handle 指示。
- **「shape」模型**：节点 = shape，连线 = binding——映射现有 `.knode`/`.gnode` + `lptrack`。
- **UI 可定制**：默认 UI 可隐藏只留画布——D 段可只做画布空间化，不引入其 React 组件（纯视觉层）。

### 不可迁移 / 反模式
- ❌ 引入 tldraw 作依赖（重型，与项目架构冲突；D 段纯视觉层，复用现有 `GalaxyCanvas`）。
- ❌ 真正的 shape 编辑 / 持久化（Phase 1 不碰数据层）。

### 映射
D 段的 camera/zoom/depth/selection 范式；「纯画布」思路（Shell 不参与）。

---

## 5. React Flow（@xyflow/react）— 节点图渲染范式

**定位**：节点图编辑器库（nodes / edges / handles / minimap / controls / background）。

### 可迁移原则
- **节点图渲染范式**：现有 Space 已是节点图，可借鉴其 **edge 样式**（曲线 / 流动渐变描边）、**minimap**（知识空间全局导航）、**controls**（缩放按钮）。
- **Edge animation（流动虚线 / 渐变）**：映射 `lptrack`（Nox 工作轨迹光带）。
- **Handle / connection 视觉**：知识关系连线端点样式。

### 不可迁移 / 反模式
- ❌ 引入为依赖（同 tldraw，重型）。
- ❌ 变成「开发者工具感」（过度连线 / 网格）——我们的 Space 应「有生命」而非 dev-tool，克制使用。

### 映射
edge 流动样式、minimap（D 段 Phase 2）、Nox 轨迹光带。

---

## 6. Raycast — 命令面板 / 行动前置（Command Center 核心参考）

**定位**：macOS launcher / 命令面板（command palette + 键盘优先 + 扩展 + AI + "root search"）。

### 可迁移原则
- **Command Center 的核心参考**：命令面板模式——一处输入，触达所有动作 / 员工 / 知识。
- **键盘优先**（唤起 + 导航）——我们的 Command Center 应支持键盘唤起与方向键导航。
- **密度 + 行动前置（action-forward）**：结果直接带可执行动作（「深入分析」/「生成摘要」），而非只读列表——映射 B 段「上下文动作」。
- **扩展 / AI 思想**：命令可扩展——映射 Employee Registry 的「动作随员工 / 上下文变化」。
- **视觉**：半透明面板 + 模糊 + 圆角 + 条目 hover 高亮（与我们的 Glass 一致；但 Raycast 偏深底，我们需双主题 token 化）。

### 不可迁移 / 反模式
- ❌ 全深色单一主题（我们 light/dark 双主题）。
- ❌ 具体键盘映射集合（按本产品定义）。

### 映射
Command Center = 命令面板 + Inspector 混合；键盘优先 + 行动前置。

---

## 7. Linear — calm density / 状态模型 / card 模式

**定位**：issue tracker（键盘优先、速度执念、calm design、issue/triage、「quality as a feature」）。

### 可迁移原则
- **「calm design」+ 高信息密度不拥挤**：Inspector / Command Center 应借鉴——信息密度高但视觉安静（克制配色、hairline 分隔、无重边框）。与研究文档「材质承担装饰，减少边框」一致。
- **状态 / 优先级模型**（status / priority labels）：映射 Employee 5 态、任务进度。
- **Issue card 模式**：映射 Employee Card / 任务项（标题 + 状态点 + 元信息 + 快捷键）。
- **键盘快捷键文化**：与 Raycast 一致。
- **速度感 / 即时反馈**：映射 AI 员工「在场感」（实时状态短语，无 loading 感）。

### 不可迁移 / 反模式
- ❌ 具体 issue 工作流（我们不是 issue tracker）。
- ❌ 偏冷色调品牌（我们按员工 accent）。

### 映射
calm density、status 模型、card 模式。

---

## 8. 七源 → AI Employee OS 落点汇总

| 源 | 主要贡献 | 落点 | 依赖风险 |
|---|---|---|---|
| shadcn/ui | 语义化 token 纪律、组合式组件、own-the-code | E token 包同构、C 组合式卡 | 仅借鉴，无依赖 |
| Magic UI | 进场动画词汇、bento、shimmer | E motion、`*__thinking` 态 | 无依赖（纯 CSS） |
| Aceternity UI | 轻 3D、spotlight、空间背景 | C hover 倾斜、Dock 光斑、工作区背景 | 无依赖（纯 CSS） |
| tldraw | 无限画布 / camera / depth | D Spatial Knowledge（Phase 2） | 不引入 |
| React Flow | 节点图 / edge 流动 / minimap | D Spatial（Phase 2）、`lptrack` | 不引入 |
| Raycast | 命令面板、键盘优先、行动前置 | B Command Center（命令面板 + Inspector 混合） | 无依赖 |
| Linear | calm density、status 模型、card | B 安静密度、C/E 状态模型 | 无依赖 |

---

## 9. 与三源 OS Shell 研究的合流

| 范式层 | 来源 | 结论 |
|---|---|---|
| **OS Shell 结构** | react-ui-os / macos-react / StreamDeck | Dock / Inspector / App Icon / Glass / Window Manager 形状 |
| **产品工艺** | shadcn / Magic / Aceternity / Raycast / Linear | token 纪律 / motion 词汇 / bento / 命令优先 / calm density |
| **空间范式** | tldraw / React Flow | camera / depth / edge 流动（D 段 Phase 2） |

三者合一 = **AI Employee OS Phase 1**（E→C→B→A，D 留 Phase 2），语言定位见 §0 三根支柱。

---

## 10. 边界（明确不做的）

- ❌ 不复制任何参考源码；所有配方以**原则与参数区间**形式记录。
- ❌ 不引入第三方库作为既定事实——Framer Motion / tldraw / React Flow / Radix 等列为**待决项**，需用户确认后才可评估。
- ❌ 不做像素级 macOS 复刻（见 §0 红线）。
- ❌ 不重新生成 mascot 图像（母版资产红线）。
