# C1 · AI Employee Identity Unit — Mini Plan

> **性质**：**仅设计方案，不编码。** 本文是 Phase 1 顺序中 **E（已交付 `1c4dc14`）→ C** 的 C 步 mini plan，供审查。
> **目标**：把现有 `AgentAvatar.tsx`（平面圆形头像）演进为 **AI Employee Identity Unit**——**不是普通 profile card**，而是「系统级 App Icon + 人格 Identity + Agent 状态」的可组合单元，作为 **A（首页 Presence）与 B（Inspector Command Center）的共用基础件**，先于两者构建。
> **范围边界**：C1 **只产出组件 + 陈列验收面**；**不接入** Home / Inspector 页面（归 A1/B1）。**不提前侵入任何产品页面**。
> **前置**：E0 视觉地基已落地（`--aios-*` token 全系可用，reduced-motion / `@supports` 降级 / dark-light 对齐已就绪）。
> **顺序纪律**：严格保持 **E → C → B → A**；C1 完成后停验收节点，**不自动进入 B**。

---

## 0. 当前代码现状（C1 必须基于的事实）

| 项 | 现状 | 对 C1 的含义 |
|---|---|---|
| `src/components/AgentAvatar.tsx` | 平面**圆形**头像（`agent-avatar__circle`），可选状态徽标，可选 名称/角色 meta | C1 演进对象；不并行新建，避免出现两套头像 |
| `src/types.ts · AgentProfile` | `id, name, role, nameLoc?, roleLoc?, color, avatarUrl?` | **无** `level` / `capabilities` / `statusPhrase` / `growth` → C1 **不碰该类型**（数据层冻结） |
| `src/mock/agents.ts · AGENTS` | 4 员工：assistant(田园犬,`#F5A623`,有 PNG) / nox(黑猫,`#1A1A1A`,有 PNG) / knowledge(布偶猫,`#A8C8EC`,**无** avatarUrl) / task(边牧,`#6B7280`,**无** avatarUrl) | 2 有资产 / 2 走占位 → Identity Unit 必须**同时优雅处理资产与占位** |
| `public/mascots/*.png` | `assistant-dog-avatar.png`、`nox-cat-avatar.png` 已就位（裁切好的 avatar 区） | 母版资产 byte-identical 红线：**组件只裁切/圆角/阴影/玻璃/渐变/动效，绝不重生成** |
| `src/components/morphicons/EmployeeStatusIcon.tsx` + `states.ts` | 5 态员工语义 `idle/thinking/working/completed/blocked` → 7 内部态；i18n key `status.employee.*` 已存在 | **直接复用**为状态徽标层，不新建 |
| `src/components/P3Showcase.tsx` | 组件陈列 harness（`p3DemoEntry.tsx` 挂载），用 `<section className="p3-region">` 陈列各组件 | C1 **唯一**验收面落点：新增「AI Employee Identity Unit」专区，**不侵入产品页面** |

> ⚠️ 现有的 `AgentAvatar` 在多处被引用（如 sidebar、navitem）。C1 **不迁移这些引用**（属页面集成，归 A1/B1）。C1 只新增 Identity Unit 组件并在 P3Showcase 陈列。

---

## 1. 目标定位：AI Employee Identity Unit（非 profile card）

**一句话定义**：Employee Card 不做「普通 profile card」，而定义为 **AI Employee Identity Unit**——它是员工的**系统级身份单元**，未来同时服务于五个面：

| 未来面 | 复用形态 |
|---|---|
| **Home（Presence 首页）** | `variant="hero"` 主视觉 + `EmployeeIcon` 作 Dock tile |
| **Employee Center** | `variant="card"` 详细身份卡 |
| **Marketplace** | `variant="card"` 卡片陈列（员工作为「可雇佣能力」） |
| **Employee Switcher** | `EmployeeIcon` + 名称 的紧凑切换行 |
| **AI Agent Showcase** | `variant="hero"` 能力/状态演示 |

**三大组成（呼应总纲三支柱）**：

```
   Apple App Icon 层        Character Identity 层       Agent Status 层
   (系统级 squircle)        (人格，非装饰)             (统一状态语言)
   ┌──────────────┐        名称 + 角色(i18n)           ● idle
   │  accent 垂直渐变 │    ● 状态徽标(5态)             ● thinking
   │  mascot iconArt │    状态短语(拟人)              ● working
   │  + 状态点       │    等级环 / 能力 pill          ● completed
   └──────────────┘                                 ● offline
```

> **不做**：普通 profile card、员工管理表格、CRM 列表、Dashboard 员工卡。
> **做**：可组合身份单元（App Icon + Character + Agent Status），一处定义、五面点亮。

---

## 2. 设计原则：Apple 风格方向（含反模式）

**参考（正例）**：
- **Apple App Icon** —— squircle 几何、accent 垂直渐变、内容居中的「图标即身份」
- **Apple Contact Card** —— 克制的姓名/角色层级、状态点、单色 accent
- **Widget 卡片** —— 紧凑边界、玻璃面、信息密度低
- **Liquid Glass（后续视觉语言）** —— 玻璃材质、景深、光折射（C1 仅预埋 token 消费，不在 C1 实现玻璃概念页）

**避免（反模式，红线）**：
- ❌ SaaS 员工管理表格（行/列/勾选/批量操作）
- ❌ 数据 Dashboard 卡片（KPI 数字 + 进度条堆叠）
- ❌ CRM 风格员工列表（头像 + 一堆字段 + 操作按钮组）

**三支柱落地**（呼应 `UI_INSPIRATION_LOCK.md` §0）：Apple 克制（留白/单 accent/无冗余边框） + Spatial 空间感（玻璃景深/层级而非描边） + Agent 原生（状态语言/拟人短语/能力表达）。

---

## 3. 信息层级（3 级；C1 仅视觉展示，不接真实数据）

| 级 | 信息 | C1 处理 | 数据来源 |
|---|---|---|---|
| **L1 一级身份** | **Avatar / Name / Role / Status** | ✅ 完整视觉展示（核心） | 现有 `AgentProfile` + `EmployeeStatus` |
| **L2 二级能力** | **Capability / Level / Growth** | ✅ 视觉展示（样例值） | **仅展示层 mock props**（不入 `AgentProfile`） |
| **L3 三级扩展** | **Memory / Tasks / Activity** | 🔲 **仅预留占位结构**，C1 不实现 | 未来数据层；本轮不接 |

> **关键约束**：`level` / `capability` / `statusPhrase` / `growth` **只作为组件可选 props**（展示层 mock），**不修改 `AgentProfile` 类型、不修改 `mock/agents.ts`、不改 i18n 结构**。A1/B1 真实接入时再评审是否提升为数据字段（届时单独评审，属 D2 范畴）。

---

## 4. 状态语言统一（5 态复用，不新建）

**统一复用**现有 `EmployeeStatusIcon` + `EmployeeStatus`，**不创建新的 AI 状态体系**。

**C1 规范词汇（5 态）**：

| 状态 | 含义 | 视觉（复用 morphicon） |
|---|---|---|
| `idle` | 空闲待命 | 静息点 |
| `thinking` | 推理中 | 脉冲/旋转 |
| `working` | 执行任务 | 进度弧 |
| `completed` | 完成任务 | 勾选 |
| `offline` | 离线/未激活 | 灰显点 |

> ⚠️ **词汇对齐说明**：现有 `states.ts` 内部态含 `blocked`。C1 的**规范对外的 5 态**为 `idle/thinking/working/completed/offline`；`blocked` 作为内部态保留但**不纳入 C1 对外规范**，避免状态体系膨胀。若未来需要，再评审是否并入。

---

## 5. 组件设计：EmployeeCard 组合式（App Icon 层 + Character AI 层）

遵循 Inspiration Lock §1（shadcn「组合优于配置」）：**Unit = App Icon 层（系统级）+ Character AI 层（人格）的可组合单元**，非含全字段的巨型卡片。

**两个导出组件 + 一个便利包装**（同一新文件 `EmployeeCard.tsx`）：

### 5.1 `EmployeeIcon` — App Icon 层（系统级）
| 要素 | 规格（全 consume E0 token，无新 token） |
|---|---|
| 形状 | **squircle tile**：`border-radius: var(--aios-radius-tile)`（≈边长 22%）；**32px 档纯 iconArt，无 tile 渐变** |
| accent 渐变 | 员工主色 `agent.color` 从上（实）→ 下（低 alpha）垂直渐变，置于 tile 背景 |
| iconArt | `agent.avatarUrl` 居中、`object-fit: contain`、透明底；**仅裁切/圆角，绝不重生成** |
| 占位（无 avatarUrl）| `knowledge`/`task`：同 squircle tile + `agent.color` 渐变 + 首字/字母 monogram（**不生成 PNG**） |
| 状态点 | 可选 `EmployeeStatusIcon` 叠加右下角（复用现有 morphicon 5 态） |
| 档位 | `32 / 40 / 64 / 96 / 160` px（对应 TopBar·列表 / 气泡·任务行 / Dock·卡片头 / Employee Card·Dock大 / Home Presence 主视觉） |

### 5.2 `EmployeeIdentity` — Character AI 层（人格，非装饰）
| 要素 | 说明 | 数据来源 |
|---|---|---|
| 名称 + 角色 | `resolveEntity(agent.name, agent.nameLoc, lang)` / `agent.role` | 现有 `AgentProfile` |
| 状态徽标 | `EmployeeStatusIcon status`（§4 五态之一） | 现有 `EmployeeStatus` |
| 状态短语 | *可选 prop* `statusPhrase?: LocText`（拟人，如「正在整理 3 份产品资料…」），**C1 仅陈列样例值** | 不入 `AgentProfile` |
| 等级环 | *可选 prop* `level?: number`（0..1）驱动 accent 描边环 | 不入数据层，C1 用样例值 |
| 能力 pill | *可选 prop* `capabilities?: string[]`（Research/Knowledge/Coding…） | 不入数据层，C1 用样例值 |
| 微动效 | 仅 mascot 图像层允许呼吸/眨眼循环（角色资产特性）；系统控件禁循环（E0 硬规则） | — |

- `variant` 控制布局密度：`'compact'`（icon + 名称行，用于列表/TopBar 旁/Switcher）/`'card'`（icon 上置 + meta + pills，用于 Inspector/B 段/Marketplace）/`'hero'`（大 icon + 短语 + 等级环，用于 A 段首页/Showcase）。
- 便利包装 `EmployeeCard` = `<EmployeeIdentity variant={variant} .../>`，便于 A/B 直接 `<EmployeeCard variant="hero" agent={nox} status="working" />`。

> **D2 守纪说明**：`level` / `capabilities` / `statusPhrase` 仅作为**组件可选 props**（展示层），不修改 `AgentProfile` 类型、不修改 `mock/agents.ts`、不改 i18n 结构。A1/B1 后续接入真实数据时再决定是否需要提升为数据字段（届时单独评审）。

---

## 6. Token 消费清单（全部来自 E0，零新增）

| 目的 | Token |
|---|---|
| 玻璃 tile / 卡片面 | `--aios-glass-fill` / `--aios-glass-strong` / `--aios-glass-hairline`(0.5px) / `--aios-glass-hairline-w` |
| 模糊 | `--aios-blur-soft`(性能档) / `--aios-blur-regular`(视觉档)；默认档见 §8 C-D5 |
| 阴影分层（替代边框） | `--aios-depth-1`(休憩面板) / `--aios-depth-2`(浮动) |
| 圆角 | `--aios-radius-tile`(squircle) / `--aios-radius-panel`(14) / `--aios-radius-window`(16) |
| z 标度（仅新元素用，不碰 hotfix 旧字面量） | `--aios-layer-panel`(100) / `--aios-layer-floating`(200)；**不得与 `.modeswitch`(90)/`.canvas-actions`(75)/`.toolbar`(70)/`.zoom-readout`(60) 同角共存** |
| 动效 | `--aios-motion-fast`(140ms hover) / `--aios-motion-base`(180ms 开合) / `--aios-motion-overshoot`(仅 mascot，scale≤1.06) |
| 降级 / reduced | 沿用 E0 `@supports not (backdrop-filter)` 降级 + `prefers-reduced-motion` 块**（新增 Identity Unit 的 transform 过渡类须纳入该 reduced 守卫，禁用 scale/tilt）** |

**玻璃预算**：同屏活跃 `backdrop-filter` 层 **≤3**（E0 §7.6 硬约束）。Identity Unit 自身 tile 至多 1 层；当被 A/B 页面组合时，需在 A1/B1 阶段复核整页预算。

---

## 7. 文件产出（执行阶段，本轮仅文档）

| 文件 | 动作 | 说明 |
|---|---|---|
| `src/components/EmployeeCard.tsx` | **新建** | 导出 `EmployeeIcon` / `EmployeeIdentity` / `EmployeeCard`；纯展示，无业务逻辑 |
| `src/components/EmployeeCard.css` | **新建**（共置） | Identity Unit 样式；遵循仓库新组件共置 `.css` 约定（见 §8 C-D1） |
| `src/components/P3Showcase.tsx` | **编辑** | 新增 `<section className="p3-region">`：AI Employee Identity Unit 专区（4 员工 × 5 档位 × 5 状态 + 若干 card/hero 组合样例） |
| `scripts/capture-showcase.cjs` | **编辑** | 新增 `employee` surface：载入 p3 陈列入口，对新区跨 zh×en × light×dark(+reduced) 截图（矩阵并入 §9 验收） |
| （无） | — | 不碰 `AgentAvatar.tsx` 现有引用（留待 A1/B1 迁移）；不碰 `AgentProfile` / `mock` / i18n 结构；**不碰 Home / Inspector / Welcome** |

---

## 8. 验收标准（基于 Phase 1 §9，C1 子集）

| # | 项 | 标准 |
|---|---|---|
| 1 | 回归不回退 | 现有 **28 张矩阵 + 窄视口断言全绿**（hotfix 断言：`overlaps=[]` / `ctaSpill=[]` / errors=0 / 404=0 / data-theme 首帧 / motionOff=ok / CJK=0） |
| 2 | 新 Employee 矩阵 | 新增 `employee` surface：zh×en × light×dark(+reduced)，几何断言同上 |
| 3 | 玻璃预算 | Identity Unit 自身活跃 `backdrop-filter` 层 ≤1；组合预算留 A1/B1 复核 |
| 4 | reduced-motion | `motionOff=ok`；无 scale/tilt/视差（mascot 循环动画在 reduced 下关闭） |
| 5 | 母版资产 | `public/mascots/*.png` **byte-identical**，未被重生成/替换；`knowledge`/`task` 走 CSS 占位**未生成 PNG** |
| 6 | i18n | 无新增 key（状态 key `status.employee.*` 已存在）；如确需新 key 须 zh/en **1:1** |
| 7 | 依赖 | 未引入新依赖（纯 CSS，守 D1=纯 CSS） |
| 8 | 红线 | 未接入 Home/Inspector；未改 `AgentProfile`/mock/数据层；未改布局/Welcome；无 Window Manager；无 3D/WebGL |

---

## 9. C1 红线（显式，违反即 fail）

**禁止（❌）**：
- ❌ 修改 `AgentProfile` 类型（数据层冻结）
- ❌ 新建 Registry Manager（员工注册/管理逻辑）
- ❌ 接真实 Agent 状态（C1 用 mock status 陈列）
- ❌ 接 Marketplace（仅预留未来形态，不实现）
- ❌ 接 Memory 系统（L3 仅占位结构）
- ❌ 接商业化逻辑（计费/订阅/雇佣流）
- ❌ 提前侵入 Home / Inspector / Welcome 页面

**只完成（✅）**：
- ✅ Employee Card 视觉组件（`EmployeeIcon` / `EmployeeIdentity` / `EmployeeCard`，纯展示）
- ✅ Showcase 展示（P3Showcase 专区 + 截图）
- ✅ token 消费（E0 `--aios-*` 全系，零新增）
- ✅ light / dark / reduced-motion 验证

---

## 10. 待裁定（C 级小决策，建议值可 Override）

| ID | 问题 | 选项 | 建议 |
|---|---|---|---|
| **C-D1** | 组件 CSS 放置 | A. 共置 `EmployeeCard.css`（隔离、易评审） / B. 追加到 `app.css` | **A**（与仓库 FirstRunScreen/EmptyState 共置约定一致） |
| **C-D2** | 是否在本步迁移现有 `AgentAvatar` 引用 | A. 留待 A1/B1 页面集成时迁移 / B. C1 一并替换 | **A**（C1 只建共用件+陈列；页面集成归 A1/B1，避免范围蔓延） |
| **C-D3** | `knowledge`/`task` 无 avatarUrl 的处理 | A. CSS 占位 tile（渐变+monogram，不生成 PNG） / B. 临时占位图 | **A**（严守母版资产红线：未确认母版前不生成） |
| **C-D4** | `level`/`capabilities`/`statusPhrase`/`growth` 作为可选展示 props（不入数据层） | A. 接受（C1 陈列样例值） / B. 完全不暴露，等数据层 | **A**（不违反 D2，因仅组件 props；A1/B1 真实接入时再评是否提升为字段） |
| **C-D5** | 玻璃默认档（E0 §7.2 待决 D5） | A. `regular` 40px/180% / B. `soft` 20px/160% | **跟随 E0 D5 裁决**（建议 `regular` + 自动降级）；C1 用同档 |
| **C-D6** | Identity Unit 在 A/B 页面作为浮动元素时的 z 冲突 | 风险：hero（A 段）若悬浮须 `≤ --aios-layer-panel(100)` 且不落 canvas-actions/modeswitch 角带 | 执行 A1/B1 时由 hotfix 几何断言自动捕获 |

---

## 11. 与更大蓝图的衔接

- **A（首页 Presence）**：复用 `EmployeeCard variant="hero"` 作主角 + `EmployeeIcon` 作 Dock tile。
- **B（Inspector Command Center）**：复用 `EmployeeCard variant="card"` 作顶部 Presence 区。
- **D（Spatial Knowledge，Phase 2）**：员工在知识空间中的「在场」可由同一 Identity Unit 的 `EmployeeIcon` 表达，保持视觉一致。
- **Registry（D2 预留）**：Identity Unit 的输入是 `AgentProfile`（一个对象）→ 未来 Employee Registry 只需扩展该对象，组件无需改（呼应 react-ui-os「apps are data，一处注册多处点亮」）。

> 结论：C1 是「**一处定义、五面点亮**」的支点。先做对，A/B 才不会各自造卡（避免 P4-1/5 的 token 漂移重演）。
