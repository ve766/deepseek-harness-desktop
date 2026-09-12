# B · AI Command Center — Mini Plan

> **性质**：**仅设计方案，不编码。** 本文是 Phase 1 顺序中 **E（已交付 `1c4dc14`）→ C（已交付 `d5901cc`）→ B** 的 B 步 mini plan，供审查。
> **目标**：把"上下文控制中心"演进为 **AI Employee OS 上下文 Command Surface**——**不是 sidebar**，而是「macOS Inspector（结构化检视）+ Raycast Command Surface（行动前置）+ visionOS Floating Panel（玻璃景深）」的混合体，作为 **A（首页 Presence）的上下文控制支点**，先于 A 构建。
> **范围边界**：B **只产出组件 + 陈列验收面**；**不接入真实 Shell**（不替换 `.insight`、不动 grid 列、不接 TopBar/路由），**不进入 Window Manager**，**不改数据层**。**不提前侵入任何产品页面**。
> **前置**：E0 视觉地基已落地（`--aios-*` token 全系可用，reduced-motion / `@supports` 降级 / dark-light 对齐已就绪）；C1 员工身份件 `EmployeeCard` 已就位并验收。
> **顺序纪律**：严格保持 **E → C → B → A**；B 完成后停验收节点，**不自动进入 A**。

---

## 0. 当前代码现状审计（B 必须基于的事实）

| 项 | 现状 | 对 B 的含义 |
|---|---|---|
| `src/components/AgentAvatar.tsx` + `.insight`（右列） | `.insight` 是**内容型侧栏**：洞察文本 + 建议按钮 + 记忆列表 + Provider 状态，本质是"信息流"，非检视器；缺 Inspector 三特征（分节/label-value/随上下文变化） | B **不修改 `.insight`**（属完整 Shell 集成，本轮不做）；B 是独立 Command Surface 组件 + 陈列 |
| `src/components/EmployeeCard.tsx` + `.css`（C1 交付） | 导出 `EmployeeIcon` / `EmployeeIdentity` / `EmployeeCard`；`variant="card"` 已含 Avatar/Name/Role/Status/状态短语/等级环/能力 pill | **B 直接复用**作 Presence 区，不重新设计员工身份 |
| `src/components/P3Showcase.tsx` | 组件陈列 harness（`p3DemoEntry.tsx` 挂载），用 `<section className="p3-region">` 陈列各组件；C1 已加 Employee Card 专区 | B **唯一**验收面落点：新增「AI Command Center」专区，**不侵入产品页面** |
| `src/i18n/zh-CN.ts` / `en-US.ts` | 已有 `sidebar.settings`/`sidebar.memory`、`action.summary`/`action.task`/`action.memory`、`agent.nox.*`、`kind.project/memory/task`、`status.task.*`、`status.employee.*` 等 | B 复用上述键；仅补极少量 `cc.*` 命名空间键（section 标题 / 系统入口 / 动作标签），**zh/en 严格 1:1** |
| `src/styles/app.css`（E0 token） | `--aios-glass-bg`(含 dark 覆盖 rgba(40,40,44,.62)) / `--aios-glass-bg-strong/intense` / `--aios-glass-border` / `--aios-glass-border-outer` / `--aios-glass-saturate`(180%) / `--aios-glass-shadow`；`--aios-blur-sm12/md20/lg40` + `--aios-blur-saturate`; `--aios-depth-1..4`; `--aios-layer-background0/workspace10/panel100/floating200/command300/overlay1000`; `--aios-radius-sm8/md12/lg16/xl22/2xl28/full/icon22%`; `--aios-motion-*` | B **只消费已有 E0 token**，零新增 |
| 现有基础件 | `DisclosureRow`（可折叠分节）、`Pill`、`Button`、`Modal`、`Toast`、`EmployeeStatusIcon` 均在 ui-primitives / 本包可用 | B 复用，不重造 |
| `scripts/capture-showcase.cjs` | 含 `employee` surface（zh×en × light×dark+reduced 矩阵 + 几何断言） | B 同法新增 `command-center` surface |

> ⚠️ 现有 `.insight` 在多处被产品页面引用（grid 第 3 列）。B **不迁移/不替换这些引用**（属 Shell 集成，归 A 或 Phase 2）。B 只在 P3Showcase 陈列 Command Surface 组件。

---

## 1. B 核心定位：上下文 Command Surface（≠ Sidebar）

**一句话定义**：Command Center 不做"导航侧栏"，而定义为 **AI Employee OS 上下文控制中心（Context Command Surface）**——它是围绕"当前情境"组织的**结构化检视 + 行动前置面板**，未来同时服务于两个面：

| 未来面 | 复用形态 |
|---|---|
| **B 本步（陈列）** | `variant="floating"` —— visionOS 式浮动玻璃面板，独立陈列 |
| **A（首页 Presence）** | `variant="docked"`（预留）—— 首页右侧上下文控制带，复用同一组件 |

**三参考方向（混合，非任一克隆）**：

| 参考 | 借什么 | 不借什么 |
|---|---|---|
| **macOS Inspector** | 可折叠分节、label→value 值展示、随工作区上下文变化的结构 | 不做逐像素系统检视器外观 |
| **Raycast Command Surface** | 命令/动作前置（action-forward）、键盘优先心智、密度高但安静 | 不做全深色单一主题、不绑具体快捷键集 |
| **visionOS Floating Panel** | 玻璃材质、景深（depth 阴影替代边框）、浮动层级、聚焦高光 | 不做 3D/空间窗口系统 |

**三支柱落地**（呼应 `UI_INSPIRATION_LOCK.md` §0）：Apple 克制（材质承担装饰，hairline 替代重边框）+ Spatial（玻璃景深/层级）+ Agent 前瞻（员工是主角，面板是其在场控制中枢）。

**明确避免（红线）**：
- ❌ **SaaS Dashboard 卡片堆叠**（KPI 数字 + 进度条 + 一堆小卡）
- ❌ **文件管理器**（目录树 / 文件路径 / 资源管理隐喻——AI Employee OS 无此需求）
- ❌ **Notion Sidebar 模式**（导航树 / 页面列表 / 折叠大纲）
- ❌ 普通「设置面板」堆控件

---

## 2. 目标信息层级 + Layout 草图

**优先级（自上而下，唯一主干，不铺平为网格）**：

```
当前项目 (Project Context)
    ↓
当前 AI Employee (Presence)
    ↓
当前任务状态 (Current Task)
    ↓
上下文操作 (Quick Actions)
    ↓
系统入口 (System Entry)
```

**Layout 草图（floating 变体，本步陈列用）**：

```
┌───────────────────────────┐  ← 玻璃面板：--aios-glass-bg + hairline + depth + radius-lg
│ ◤ Project Context         │  ← CCSection（可折叠，标题行带 value/徽标）
│   项目：AI 创业项目         │     label → value
│   阶段：知识整理 · 62%      │
│                            │
│ 🐈 Nox · Research Agent    │  ← CCPresenceHeader（复用 EmployeeCard card）
│   ● Thinking · Lv.3        │     当前员工 + 状态（5 态）+ 当前任务短语
│   「正在整理 3 份产品资料…」 │
│                            │
│ ▾ Current Task             │  ← CCSection（可折叠）
│   整理 Q3 产品规划.pdf      │     label → value + 进度弧
│   进度 ●●●○○ 62%           │
│                            │
│ ▾ Quick Actions            │  ← CCActionsSection（Raycast 命令行）
│   ⌕ 深入分析    ⌘↵         │     icon + 标签 + 快捷键暗示（mock）
│   ✦ 生成摘要                │
│   ＋ 派发新任务             │
│                            │
│ ─────────────────────────  │  ← hairline 分隔（--aios-glass-border）
│ ⚙ 设置   🧠 记忆   🏪 市场   │  ← CCSystemEntryRow（底部固定，与 TopBar 状态簇职责分离）
└───────────────────────────┘
   玻璃材质 · hairline · 无重边框 · 景深阴影
```

> 结构即论点：**单一上下文主轴（项目→员工→任务→操作→入口）**，不是多列卡片墙。这正是与 SaaS Dashboard / Notion Sidebar 的根本区别。

---

## 3. 组件拆分（组合优于配置，呼应 shadcn §1）

遵循 C1 的组合式纪律：**Command Surface = 玻璃外壳 + 若干可折叠分节 + 复用件**，非含全字段的巨型面板。

### 3.1 新组件（同一新文件 `CommandCenter.tsx` + 共置 `CommandCenter.css`）

| 组件 | 职责 | 数据来源 | 复用 |
|---|---|---|---|
| `CommandCenter` | 玻璃面板外壳（visionOS floating panel DNA）：玻璃面 + hairline 边框 + `backdrop-filter` 模糊 + depth 阴影 + radius；管理分节组合；`variant: 'floating' \| 'docked'(预留)`；消费 `context: CommandCenterContext` props | 纯 props（mock） | 无 |
| `CCPresenceHeader` | 顶部固定 Presence 区 = **复用 `EmployeeCard variant="card"`**，展示当前员工 + 状态（5 态）+ 当前任务短语 | `context.employee` | `EmployeeCard` |
| `CCSection` | Inspector 式可折叠分节：标题行（右对齐 value/徽标）+ 内容槽 | props | `DisclosureRow`（底层原语） |
| `CCContextSection` | 当前项目上下文：label→value 行（项目名 / 阶段 / 进度） | `context.project` | `CCSection` |
| `CCTaskSection` | 当前任务：任务文本 + 进度（label→value）+ 任务状态点 | `context.task` | `CCSection` + `EmployeeStatusIcon` |
| `CCActionsSection` | 快捷操作（Raycast 命令行）：图标 + 标签 + 可选快捷键暗示；action-forward；**mock 按钮无真实 handler** | `context.actions` | `CCSection` + `Pill`(快捷键暗示) |
| `CCSystemEntryRow` | 底部固定系统入口：设置/记忆/市场 图标行（与 TopBar 状态簇职责分离） | `context.systemEntries` | `CCSection` 外独立行 |

### 3.2 Mock context 类型（纯展示合约，**不进数据层**）

```ts
// 仅组件 props 合约，不写进 AgentProfile / mock / store
interface CommandCenterContext {
  project?: { name: string; phase: string; progress: number }      // 当前项目
  employee: {                                                       // 当前员工（复用 AgentProfile + 展示态）
    profile: AgentProfile
    status: EmployeeStatus                                         // 5 态之一
    statusPhrase?: LocText                                         // 拟人短语（mock）
    level?: number                                                 // 展示用，不进数据层
  }
  task?: { title: string; progress: number; status: TaskStatus }   // 当前任务
  actions: { id: string; label: LocText; icon: string; shortcut?: string }[]  // 快捷操作（mock）
  systemEntries: { id: 'settings'|'memory'|'market'; label: LocText }[]        // 系统入口
}
```

> **关键约束**：`CommandCenterContext` 只作为组件可选 props（展示层 mock），**不修改 `AgentProfile` 类型、不修改 `mock/agents.ts`、不改 i18n 结构（仅补 `cc.*` 键）**。未来 A 接入时再评审是否提升为数据字段。

---

## 4. 与 C1 的连接（不重新设计员工身份）

- B **不重新设计**员工身份；**复用** C1 `EmployeeCard` 作 `CCPresenceHeader`。
- B 在 Presence 区展示：**当前员工 + 状态（5 态）+ 当前任务短语**——全部来自 `context` mock，而非真实 Agent。
- 员工图标层级：`EmployeeIcon` 32–64px 档（B 面板内用 64px 头部 / 40px 行内）。

```
   EmployeeCard (C1, 已验收)
        │  复用 variant="card"
        ▼
   CCPresenceHeader (B)
   展示：当前员工 · 状态 · 当前任务短语
```

> 与 C1 同构：**一处定义、多面点亮**。C1 定义"员工是谁"，B 定义"员工此刻在做什么 / 我能在上下文里做什么"。

---

## 5. 数据边界（保持冻结）

| 项 | B 处理 | 红线 |
|---|---|---|
| `AgentProfile` 类型 | **不改** | ❌ 不扩字段 |
| Employee Registry | **不新建** | ❌ 不引入注册/管理逻辑 |
| Memory 系统 | **不接**（系统入口图标仅占位展示） | ❌ 不读/写记忆 |
| 真实 Task Engine | **不接**（任务来自 mock context） | ❌ 不接任务引擎 |
| mock / store / demo sequencer | **不改** | ❌ 不动数据层 |
| 真实 Agent 连接 | **不接**（全部 mock context） | ❌ 无真实 handler |

---

## 6. Token 使用表（全部来自 E0，零新增）

**允许使用的 E0 token（用户已确认清单 + 同族必要项）**：

| 用途 | Token | 值（light / dark 覆盖） |
|---|---|---|
| 面板玻璃面 | `--aios-glass-bg` | `rgba(255,255,255,.6)` / `rgba(40,40,44,.62)` |
| 玻璃配方（合成） | `backdrop-filter: saturate(var(--aios-glass-saturate)) blur(var(--aios-blur-md))` | saturate `180%` / blur `20px` |
| 玻璃外框 hairline | `--aios-glass-border` | `rgba(255,255,255,.22)` |
| 模糊档 | `--aios-blur-md`(默认性能档) / `--aios-blur-lg`(视觉档，仅当面板为唯一玻璃层时) | `20px` / `40px` |
| 景深阴影（替代边框分层） | `--aios-depth-2`(停靠) / `--aios-depth-3`(浮动) | 见 E0 |
| 圆角 | `--aios-radius-lg`(16) | 面板外壳 |
| z 标度 | `--aios-layer-floating`(200) / `--aios-layer-command`(300) | 浮动命令面 |
| 动效（仅过渡，不循环） | `--aios-motion-dur-fast`(160) / `--aios-motion-dur-base`(240) / `--aios-motion-ease` | 受 E0 reduced 块自动折叠 |

**明确禁止（违反即 fail）**：
- ❌ 新建任何玻璃/blur/shadow token（如 `--cc-glass-*` / `--cc-blur-*`）
- ❌ 每个组件自己定义 `blur(...) / box-shadow: ...` 字面量（必须走上面 token）
- ❌ 引入第二套视觉系统（如 Tailwind 类、独立 design token 集）

**玻璃预算（E0 §7.6 硬约束）**：同屏活跃 `backdrop-filter` 层 **≤3**。B 面板在 P3Showcase 陈列时为本面唯一玻璃层（≤1）；未来 A 集成时由 A 步复核整页预算。

**降级 / reduced**：
- `@supports not (backdrop-filter: blur(1px))` → 降级为 `--aios-glass-bg` 近实色 + hairline（沿用 E0 降级）。
- `prefers-reduced-motion` → 面板入场/变换过渡**经由 `--aios-motion-dur-*` token 自动折叠**（组件 CSS 不写字面 ms）；玻璃本身（非运动）可保留；captcha 断言 `motionOff=ok`。

---

## 7. 文件产出（执行阶段，本轮仅文档）

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/components/CommandCenter.tsx` | **新建** | 导出 `CommandCenter` / `CCPresenceHeader` / `CCSection` / `CCContextSection` / `CCTaskSection` / `CCActionsSection` / `CCSystemEntryRow`；纯展示，无业务逻辑 |
| `src/components/CommandCenter.css` | **新建**（共置） | 玻璃面板 + 分节样式；遵循仓库新组件共置 `.css` 约定（同 C1） |
| `src/P3Showcase.tsx` | **编辑** | 新增 `<section className="p3-region">`：AI Command Center 专区（`floating` 变体 + 若干 mock context 样例：含当前项目/员工/任务/动作/系统入口；覆盖 light/dark/reduced 主题切换） |
| `scripts/capture-showcase.cjs` | **编辑** | 新增 `command-center` surface：载入 p3 陈列入口，对新区跨 zh×en × light×dark(+reduced) 截图（矩阵并入 §8 验收） |
| `src/i18n/zh-CN.ts` / `en-US.ts` | **编辑** | 补 `cc.*` 命名空间键（section 标题 + 系统入口 + 动作标签），**zh/en 严格 1:1** |
| （无） | — | 不碰 `AgentProfile` / `mock` / 数据层；不碰 `.insight` / TopBar / 路由；**不碰 `app.css` / E0 token**；不重新生成 mascot |

---

## 8. 验收标准（基于 Phase 1 §9，B 子集）

| # | 项 | 标准 |
|---|---|---|
| 1 | 回归不回退 | 现有 **28 张矩阵 + 窄视口断言全绿**（hotfix 断言：`overlaps=[]` / `ctaSpill=[]` / errors=0 / 404=0 / data-theme 首帧 / motionOff=ok / CJK=0） |
| 2 | 新 Command Center 矩阵 | 新增 `command-center` surface：zh×en × light×dark(+reduced)，几何断言同上 |
| 3 | 玻璃预算 | Command Center 面板自身活跃 `backdrop-filter` 层 ≤1（P3 陈列）；组合预算留 A 步复核 |
| 4 | reduced-motion | `motionOff=ok`；无 scale/tilt/视差（入场过渡经 `--aios-motion-dur-*` 折叠） |
| 5 | dark 对齐 | dark 下面板 `background` 计算值切到 `--aios-glass-bg` dark 覆盖 `rgba(40,40,44,.62)`（与 light 不同） |
| 6 | 母版资产 | `public/mascots/*.png` **byte-identical**，未被重生成；员工头像经 `EmployeeCard` 复用，未自绘 |
| 7 | i18n | 仅补 `cc.*` 键，且 zh/en **1:1**；不破坏现有 308 基线 |
| 8 | 依赖 | 未引入新依赖（纯 CSS，守 D1=纯 CSS） |
| 9 | 红线 | 未接入 Shell（未改 `.insight`/grid/TopBar/路由）；未改数据层；未进入 Window Manager；无 3D/WebGL；无 SaaS 卡片堆叠/文件管理器/Sidebar 模式 |
| 10 | 内容呈现 | mock context 全部呈现：project / employee(Presence) / task / actions / systemEntry 计数 > 0；`EmployeeCard` 复用验证（avatar/name/status 出现） |

---

## 9. 与未来 A（Home）的接口预留

- **`CommandCenter` 是 A 的上下文控制支点**：A 首页可直接 `<CommandCenter variant="docked" context={...} />` 渲染右侧上下文带，复用本步全部分节。
- **`variant` 预留**：`'floating'`（B 本步陈列，visionOS 浮动）/ `'docked'`（A 预留，停靠式）—— 本步只实现 `floating`，`docked` 仅留类型占位不实现 Shell 集成。
- **`CommandCenterContext` 是合约**：本步为 props mock；A 步由 store 供给（届时仍可能是 mock，或数据层扩展后真实供给）——组件无需改。
- **z 层预留**：`--aios-layer-command: 300` 专供命令面；A 集成时 Command Center 不得与 `.modeswitch`(90)/`.toolbar`(70)/`.canvas-actions`(75)/`.zoom-readout`(60) 同角共存（hotfix 几何断言自动捕获）。
- **动作前置接口**：`context.actions` 的 `id` 命名预留（`analyze`/`summary`/`dispatch`），未来 A 接真实 handler 时按 id 路由，组件层不变。

> 结论：B 是「**一处定义、A/B 点亮**」的支点。先做对 Command Surface 的语言，A 才不会再造一个"右侧栏"（避免 P4-1/5 的 token / 结构漂移重演）。

---

## 10. 明确非目标（Non-Goals，违反即 fail）

- ❌ **不是 sidebar / 导航树 / Notion 式页面列表**
- ❌ **不是 SaaS Dashboard 卡片堆叠**（KPI + 进度条墙）
- ❌ **不是文件管理器**（目录/路径/资源隐喻）
- ❌ **不是 Window Manager**（不可拖拽 / 最小化 / 成为浮动窗口系统）
- ❌ **不是完整 Shell 集成**（不替换 `.insight`、不动 grid 列、不接 TopBar/路由、不接真实页面）
- ❌ **不接真实 Agent**（全部 mock context）
- ❌ 不修改 `AgentProfile` / `mock` / i18n 结构（仅补 `cc.*` 1:1）
- ❌ 不新建 Registry / Memory / Task Engine
- ❌ 不新建玻璃/blur/shadow token；不引入第二套视觉系统
- ❌ 不重新生成 mascot；不引入 3D / WebGL；不引入新依赖

---

## 11. 待裁定（B 级小决策，建议值可 Override）

| ID | 问题 | 选项 | 建议 |
|---|---|---|---|
| **B-D1** | 组件 CSS 放置 | A. 共置 `CommandCenter.css`（隔离、易评审） / B. 追加到 `app.css` | **A**（与 C1 / FirstRunScreen / EmptyState 共置约定一致） |
| **B-D2** | 玻璃默认档 | A. `md` 20px（性能优先，B 陈列唯一玻璃层） / B. `lg` 40px（视觉档） | **A**（B 陈列唯一层，md 已足够；lg 留待 A 整页预算富余时） |
| **B-D3** | 面板宽度 | A. 320px（与现有右列一致） / B. 300px（Raycast 紧凑） | **A**（与 Phase 1 §4.3 右列 320/280 对齐，避免新断点） |
| **B-D4** | 系统入口图标集 | A. 复用 `sidebar.settings`/`sidebar.memory` + 新增 `cc.entry.market`（1:1） / B. 全用现有键 | **A**（market 无现成键，需补 `cc.entry.market` 等少量键） |
| **B-D5** | 快捷键暗示是否真实绑定 | A. 仅视觉暗示（mock，不绑真实快捷键） / B. 接真实快捷键系统 | **A**（B 不接键盘系统；暗示仅表达 Raycast 心智，归未来 Command 层） |
| **B-D6** | `docked` 变体是否本步实现 | A. 仅留类型占位，不实现 / B. 本步一并实现 | **A**（B 只做 floating 陈列；docked 集成属 A/Shell，避免范围蔓延） |

---

## 12. 与更大蓝图的衔接

- **A（首页 Presence）**：复用 `CommandCenter variant="docked"` 作右侧上下文控制带；与首页 Presence 主角（C1 `hero`）左右呼应。
- **C（Employee Card，已交付）**：提供 `EmployeeCard` 作 Presence 区，B 复用不重造。
- **D（Spatial Knowledge，Phase 2）**：B 的"当前任务/上下文"可由知识空间状态驱动，但属 Phase 2。
- **Registry（D2 预留）**：`CommandCenterContext.employee` 输入是 `AgentProfile`（一个对象）→ 未来 Employee Registry 只需扩展该对象，组件无需改（呼应 react-ui-os「apps are data，一处注册多处点亮」）。

> 结论：B 是「**上下文主轴 + 玻璃景深 + 行动前置**」的支点。先做对，A 才不会退化成"更好看的 Dashboard 右栏"。
