# AI Employee OS — UI Design Review

> 文档性质：**设计决议（仅设计，不编码）**
> 阶段：P4-2 Showcase v0.1 验收通过（commit `66037e4`）之后、UI Evolution 实现之前
> 纪律：本文件为设计基线；确认后**才**进入 UI Evolution 编码；**本回合不进入 P4-3 编码**。
> 约束：不改架构 / 不新增组件体系 / 不实现 Liquid Glass / 不重做 Shell / 不进入 visionOS·spatial UI（仅制定规范）。

---

## 0. 评审基线（P4-2 Showcase v0.1 快照）

P4-2 已产出 **6 面 × 双语 × 三主题 = 28 张** `showcase-*` 截图（`outputs/` 目录），作为后续 Visual Evolution 的 **before 基准**。六面：

| 面 | 当前代码落点 | v0.1 状态 |
|---|---|---|
| S1 Welcome | `WelcomeDashboard.tsx` | hero + `wd-card`×3 + Demo 入口 |
| S2 Knowledge Space | `CanvasViewport` + `KnowledgeNode`/`EdgeLayer` | node–node 关系图 |
| S3 Growth Galaxy | `GalaxyCanvas` + `GalaxyNode`/`GalaxyEdgeLayer` | 星图 mock |
| S4 Nox Navigator | `AIInsightPanel` + `AssociationExplainer` | 关联解释面板（D1 已修复主题自适应） |
| S5 AI 状态 | `ThinkingRing` / `morphicons/*` | thinking ring + 状态组 |
| S6 多语言 | `LanguageSettings` + i18n | zh/en 1:1（308/308） |

> 基线质量定级（见 `P4-1_FINAL_AUDIT.md`）：可用、可演示、主题/双语/无障碍一致。本轮评审聚焦**结构性代差**（G1–G6），而非质量缺陷。

---

## 1. 待决议事项总览

Design Review 须产出决议的 8 项（5 项来自 P4-2 §10 + 3 项本轮新增）：

| # | 决议 | 类型 | 是否本轮新增 |
|---|---|---|---|
| R1 | Liquid Glass Design System | 材质规范 | 原 §10-1 |
| R2 | 首页视觉语言（AI Employee Home） | 视觉/文案 | 原 §10-2 |
| R3 | Employee Card 规范 | 组件规范 | 原 §10-3（本轮扩展为决议 B） |
| R4 | Spatial Shell 方向 | 架构/Shell | 原 §10-4 |
| R5 | Knowledge Space 视觉模型 | 视觉/交互 | 原 §10-5 |
| R6 | **全局 AI Command Center** | 新增设计方向 | ✅ 本轮新增 |
| R7 | **客户/用户任务输入层** | 商业化方向 | ✅ 本轮新增 |
| R8 | **Workspace Layout / Card / Spatial 三决议** | 设计决议 A/B/C | ✅ 本轮新增 |

---

## 2. 决议 A — Workspace Layout（主工作区结构）

**目标**：确立「主工作区 + 右侧 AI Command Center + Employee Presence + Context Actions」的全局布局骨架，取代「各页面堆叠独立按钮」的当前形态。

### 2.1 当前形态（问题）
- `CanvasRegion` 顶部有 `bg-toggle` + 2 个浮动按钮（绝对定位，覆盖画布）。
- `CanvasToolbar` 独立悬浮（zoom in/out/fit），与 `bg-toggle` 无统一归属。
- `AIInsightPanel` 内多 `.cta`（research/summary/task/memory/demo.exit/demo.growthCta）纵向堆叠，窄屏下易与画布/内容重叠。
- 缺乏统一的「当前任务 / 员工状态 / 系统入口」常驻区。

### 2.2 目标形态（规范，不实现）
```
┌───────────────────────────────────────────────┬──────────────────────┐
│  TopBar: 🐈‍⬛ Nox · Knowledge Employee    [≡] [搜索] │  AI Command Center  │
├───────────────────────────────────────────────┤  (右栏, 非 Sidebar)  │
│                                                 │  ── Employee Presence│
│                                                 │  🐈‍⬛ Nox  ●Online    │
│             主工作区 (Workspace)                 │  Level 3 · 知识整理中 │
│         Knowledge Space / Growth / …            │  ── Context Actions  │
│                                                 │  📂 导入文件          │
│                                                 │  ✨ 创建任务          │
│                                                 │  🔍 搜索              │
│                                                 │  🧠 Memory            │
│                                                 │  ⚙ Settings           │
│                                                 │  ── 当前任务          │
│                                                 │  …                   │
└───────────────────────────────────────────────┴──────────────────────┘
```

### 2.3 决议要点
- **AI Command Center 是右侧常驻功能区域，不是传统左侧 Sidebar**：承载项目切换 / 文件导入 / AI 员工状态 / 当前任务 / 常用操作 / 系统入口（详见 R6）。
- **Employee Presence**：常驻展示当前激活 AI Employee（Nox 首发）的状态/等级/在忙任务，与决议 B 的 Card 规范对齐。
- **Context Actions**：随当前工作区（Space/Growth/…）变化的上下文操作，统一收纳进 Command Center，不再散落为画布覆盖按钮。
- **TopBar**：极简，仅放品牌/员工标识 + 全局搜索 + Shell 入口（≡），不堆功能按钮。

---

## 3. 决议 B — AI Employee Card 规范（统一员工卡）

**目标**：定义可复用的 AI Employee Card 视觉与信息结构，首发卡为 Nox；未来支持多员工。

### 3.1 卡片信息架构（统一维度）
```
┌─────────────────────────────┐
│  [Avatar]  🐈‍⬛              │
│  Nox                       │
│  Knowledge Employee        │
│                             │
│  ● Online                  │  ← Status
│  Level 3 · 整理中           │  ← Level/Growth
│                             │
│  能力: 整理/理解/连接知识     │  ← Capability
│  记忆: 12 条上下文           │  ← Memory
│  成长: 本月 +3 连接          │  ← Growth
│  任务: 分析「客户资料」      │  ← Task (当前)
└─────────────────────────────┘
```

### 3.2 决议要点
- **统一结构**：Avatar + Identity + Status + Level/Growth + Capability + Memory + Task（七维）。
- **首发卡**：`🐈‍⬛ Nox — Knowledge Agent`，集成 Status/Capability/Memory/Growth（引用 `VISUAL_EVOLUTION.md` §1.4）。
- **多员工支持**：卡片为模板，后续 `🐱 布偶猫`(Knowledge)、`🐈‍⬛ 黑猫 Nox`(Research)、`🐕 边牧`(Coding) 复用同一结构（见 `MEMORY.md` 四角色设定）。
- **视觉参考**：Apple Widget + Character AI + macOS App Icon（引用 P4-2 §9 S4）。
- **状态语言**：Status 维度须与 S5 AI 状态反馈系统（ThinkingRing / morphicons / StateDot 五态薄层）一致，不单独演进。
- **落点**：未来 S4 Nox Navigator 从「单面板」升级为「员工卡体系」之一实例。

---

## 4. 决议 C — Spatial / Liquid Glass Evolution（材质与空间）

**目标**：制定 Liquid Glass / visionOS 风格的材质与空间层级规范，**当前阶段仅规范、不改代码**。

### 4.1 参考
- Apple Liquid Glass（macOS Tahoe / WWDC25）
- visionOS Spatial UI
- macOS App Shell

### 4.2 材质规范草案（token 方向，待 R1 细化）
| 属性 | 规范 |
|---|---|
| 半透明层叠 | 面板 `backdrop-filter: blur()` + 低不透明度填充，内容可穿透 |
| 柔和边缘高光 | 1px inner highlight（浅色主题更亮），圆角统一 `--radius-card` |
| 深浅一致 | 同套 token 在 dark/light 下均成立，不出现硬边 |
| 空间层级 | z 轴分层：底座画布 < 浮动面板 < Command Center < 模态；层级越高模糊越强 |
| 浮动窗口 | 面板非全屏锚定，可拖拽/收起（未来） |

### 4.3 决议要点
- **不立即开发**：R1 定义 Design System，R4 定义 Shell，C 定义材质落地参数；三者协同但**本阶段仅出规范文档**。
- 与 `VISUAL_EVOLUTION.md` §1.1 / §1.6 对齐，开源参考（liquid glass react ui / apple glassmorphism dashboard / react macos desktop / spatial ui react）在 Visual Evolution 立项时统一收集。

---

## 5. 新增方向 R6 — 全局 AI Command Center

> 见决议 A §2.2 右栏形态；此处独立成章明确其定位与承载。

### 5.1 定位
AI Employee OS 的**全局操作面板**，**不是传统 Sidebar**。

### 5.2 负责承载
- 项目切换（多 workspace / 知识库切换）
- 文件导入（拖拽 / 选择上传）
- AI 员工状态（Employee Presence，见 B）
- 当前任务（进行中任务 + 进度）
- 常用操作（导入 / 创建任务 / 搜索 / Memory / Settings）
- 系统入口（Shell 导航）

### 5.3 目标形态
```
Workspace              │  AI Command Center
(Knowledge Space)      │  🐈‍⬛ Nox
                       │  状态 ●Online
                       │  当前任务：整理知识
                       │
                       │  📂 导入文件
                       │  ✨ 创建任务
                       │  🔍 搜索
                       │  🧠 Memory
                       │  ⚙ Settings
```

### 5.4 设计规范
- 常驻右栏，宽度固定（如 320px），可折叠；与 TopBar / Workspace 形成三区结构（A）。
- 不与画布重叠——取代当前 `CanvasRegion` 的浮动按钮与 `CanvasToolbar` 散落态。
- 优先级：**只进入设计规范，不立即开发**（用户显式）。

---

## 6. 新增方向 R7 — 客户/用户任务输入层（未来商业化）

### 6.1 定位
**AI 员工任务控制台**，不是 ChatGPT 聊天窗口。统一的「上传文件 + 输入需求」入口，由 AI 管家调度员工执行。

### 6.2 交互流程
```
用户输入：
  [上传文件] + [输入需求：分析这个客户资料，生成销售方案]

AI 管家（调度）：
  客户资料
   ↓
  Nox 管家（理解需求）
   ↓
  分析员工（调起）
   ↓
  销售员工（生成）
   ↓
  输出方案
```

### 6.3 设计规范
- 入口形态：**任务控制台**（输入区 + 文件拖拽 + 执行/历史），而非对话流。
- 调度隐喻：AI 管家理解需求 → 调用对应 AI Employee → 执行 → 产出，属多员工协作的早期形态。
- 与 R6 Command Center 的「创建任务」动作衔接；与决议 B 的多员工卡体系互为支撑。
- 优先级：**未来商业化方向，仅记录，不实现**。

---

## 7. 决议 R1 — Liquid Glass Design System（汇总）

综合 C §4.2 与 `VISUAL_EVOLUTION.md` §1.1，Design System 须定义：
1. 材质层（glass / blur / fill / highlight）token 集。
2. 空间层级 z-index 与模糊强度映射。
3. 深浅主题一致规则（同一套 token 双主题成立）。
4. 圆角/间距/阴影收敛（继承 P4-1/5 token 收敛成果，`--radius-card`/`--shadow-soft`/`--space-*`）。
5. 动效语言（visionOS 式弹性/空间运动，reduced-motion 全量守卫，继承 P4-1/5）。

> 输出物：未来 Visual Evolution 阶段的 token 规范文档（不在本轮）。

---

## 8. 决议 R2 — 首页视觉语言（AI Employee Home）

引用 P4-2 §9 S1 / `VISUAL_EVOLUTION.md` §1.3：
- **单核心 AI Employee 入口**，Apple 官网式大留白，不堆 Dashboard 卡片。
- 文案草案：
  ```
  🐈‍⬛ Nox
  你的 AI 知识员工
  今日完成：整理 X 个知识资产 · 建立 X 个连接
  [进入工作]
  ```
- 与决议 B 的 Nox 首发卡视觉一致（Home 用「放大版核心卡」而非多卡矩阵）。

---

## 9. 决议 R4 — Spatial Shell 方向

引用 `VISUAL_EVOLUTION.md` §1.2：
```
Desktop
 ├── Employee Center   (首页/员工卡聚合，R2+R3)
 ├── Knowledge Space   (R5)
 ├── Memory
 ├── Marketplace
 └── Settings
```
- 不以传统 Dashboard 为中心；Desktop 为空间容器，Command Center（R6）为全局操作层。
- Shell 形态（浮动窗口 / 玻璃层叠 / 空间导航）由 R1 + C 共同支撑。

---

## 10. 决议 R5 — Knowledge Space 视觉模型

引用 P4-2 §9 S2 / `VISUAL_EVOLUTION.md` §1.5：
- 从 node–node 关系图 → **知识生命系统**：
  ```
  资料
   ↓
  AI 理解
   ↓
  洞察
   ↓
  知识成长
  ```
- 视觉：以「流向/生命周期」取代纯拓扑；保留 S3 mock 逻辑不扩功能（P4-2 约束延续）。

---

## 11. P4-2 Hotfix 记录（按钮重叠）

> **✅ 已实现并收口（P4-2 Hotfix）。** 立项前 probe 实测证实：`.toolbar`（zh 416px / en 537px）与居中 `.modeswitch` 在 zh/en × 1280/1040/900 全组合重叠 204–338px；三个 `.bg-toggle`（`right:16 / right:124 / right:16`）互相重叠且压在 toolbar 之上。
> **修复（纯布局/间距/响应式，未动 R1–R8 / Liquid Glass / 架构）**：① 三系统按钮聚拢为右上 `.canvas-actions` 纵向 flex 栈（标签包 `span`，i18n 宽度自适应）；② `.toolbar` 迁至左下角，`.zoom-readout` 保持右下，四角分工；③ `.connect-hint` 上移避让 toolbar；④ `.cta`/`.cta__label` 加 `min-width:0` + `ellipsis`（超宽正确截断，按钮本体零溢出）；⑤ ≤1160px 紧凑带：按钮图标化（tooltip 保留）+ ModeSwitch 紧凑 + 隐藏 zoom-readout + toolbar 可换行。
> **回归**：Showcase 28 张 ALL_PASS（errors=0 / 404=0 / data-theme 首帧 / motionOff=ok / CJK=0），新增 `overlaps`/`ctaSpill` 断言 + 1040px 窄视口断言（zh/en × space/growth）全绿。

### 11.1 现象（待验证）
- `AIInsightPanel` 内多 `.cta` 纵向堆叠，窄视口/特定主题下可能与画布内容重叠。
- `CanvasRegion` 顶部 `bg-toggle` + 2 浮动按钮绝对定位，覆盖画布且易相互遮挡。
- `CanvasToolbar` 悬浮按钮与 `bg-toggle` 无统一归属。
- 部分主题/响应式断点下可能存在文本溢出或按钮挤压。

### 11.2 范围（红线）
- ✅ 修复布局 / 间距 / 响应式。
- ❌ **不进入 Liquid Glass 重构**（仅用现有 token 修排版）。
- ❌ 不新增组件/架构/依赖。
- 改动仅限本原型包 CSS/布局，不混入 harness 噪声 `M`。

### 11.3 验收标准
- Showcase 截图（28 张矩阵）重新通过，断言全绿。
- **无按钮重叠**（所有 surface 在 light/dark/reduced + 窄视口下按钮互不遮挡）。
- **无文本溢出**（按钮标签 / 面板文本在最小宽度下完整显示或被正确截断）。
- `errors=0` / `404=0` / `data-theme` 首帧 / `motionOff=ok` 维持。

---

## 12. 阶段门控与下一步

- **本文件为设计基线**：R1–R8 决议须在确认后由 Visual Evolution 阶段落地。
- **本回合停于确认节点**：不进入 P4-3 编码，不实现 R1–R8 与 Hotfix。
- **后续路径**：
  1. 用户确认本 Design Review 文档。
  2. （可选）对任一决议（A/B/C/R6/R7）补充细节或调整。
  3. 确认后单独立项 **Visual Evolution**（或 P4-2 Hotfix 先行），再进入编码。

---

## 附：与既有文档的关系
- `AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`：方向基线（R1/R2/R4/R5 的灵感来源）。
- `P4-2_SHOWCASE_MINI_PLAN.md` §9/§10：六面未来方向 + 本 Review 的来源指令。
- `P4-1_FINAL_AUDIT.md`：质量定级与代差清单（G1–G6）基础。
- `MEMORY.md`：四角色（Nox/布偶猫/黑猫/边牧）员工设定，支撑决议 B 多员工卡。
