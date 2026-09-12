# Stage 2-A · AI Employee Center Mini Plan

> 阶段定位：Shell Integration（d316a13）已验收通过。Rail 已替换 SideNav、Home 已真实挂载、Command Center 已完成 Shell Overlay 唤起。本阶段进入 **Stage 2：AI Employee Center**，先做 **2-A Mini Plan（纯设计、零代码）**，提交后停在审核节点，待确认后再放行编码。
>
> 纪律沿用：单一计划文档提交，工作区 228 个无关 harness 噪声（tsconfig / package.json 等）**不纳入本 commit**。

---

## §0 当前代码审计（真实状态，非假设）

| 事项 | 现状 | 对 2-A 的影响 |
|------|------|---------------|
| `employees` 路由（真实 Shell） | `MacWindowShell.tsx` line 170–175：`case 'employees':` 当前走 `<InertSurface route="employees" />`（仅显示 `nav.employees` 标题占位，无功能） | 2-A 把该分支改为渲染 `<EmployeeCenter />` |
| Rail `employees` 项 | `NavigationRail.tsx` NAV 数组已含 `{ route:'employees', key:'nav.employees', icon:'🐾' }`，`NavRoute` 联合类型已含 `'employees'` | **Rail 无需改动**（入口已存在，仅 Shell 侧接入 surface） |
| `makeShellHomeCtx()` | `MacWindowShell.tsx` line 40–64：本地 mock，从 `AGENTS` 取 4 个 agent 构造 HomeContext；同文件另有 `makeShellCCCtx()` | 仿照新增 `makeShellEmployeeCtx()`，本地 mock，不污染 P3Showcase |
| `EmployeeCard` / `EmployeeIcon` | `EmployeeCard.tsx`：`EmployeeIdentity`（props: `agent`,`status?`,`statusPhrase?`,`capabilities?`,`level?`,`growth?`,`variant`,`size`）、`EmployeeIcon`（`agent`,`size`,`status`）。**非玻璃、纯 E0 token、不接数据层** | 2-A **直接复用**，不新建身份组件、不改 `EmployeeCard` |
| `AGENTS` mock | `mock/agents.ts`：4 个（`assistant` 田园犬 / `nox` 黑猫 / `knowledge` 布偶猫 / `task` 边牧），含 `name/nameLoc/role/roleLoc/color/avatarUrl`；另有 `AGENT_MAP`。**数据层冻结** | 2-A 仅 `map` 遍历，不新增 Manager/Registry，不修改 `AgentProfile` |
| `EmployeeStatus` | `morphicons/states.ts`：canonical C1 集 `idle/thinking/working/completed/offline`（`blocked` 保留但不入 C1 规范） | 员工状态用 canonical 5 态 |
| i18n `nav.employees` | `zh-CN.ts:376` / `en-US.ts:380` 已存在 `'员工' / 'Employees'` | 新增 **`employees.*` 顶层命名空间**（与 `nav.employees` 父子不同键，无冲突） |
| i18n `employees.*` | **当前不存在** | 需新增 5 键 × 2 语言（见 §4） |
| 玻璃层纪律 | 真实 shell 仅 TitleBar 常驻玻璃 + CC 开启时浮动层；Rail/Home 均非玻璃 | Employee Center 同 Home：**透明非玻璃 surface**，单玻璃层纪律保持 |
| capture 回归 | `capture-showcase.cjs` `shell` surface 已含 `employeesEntryKept===1`（Rail 项保留）；`ok` 门按 `surface` 分支判定 | 2-A 新增独立 `employee-center` 真实 shell surface，不动 `shell` 既有 10 断言 |

**审计结论**：接入 Employee Center 的爆炸半径极小——Rail 不动、EmployeeCard 不动、Home/CommandCenter 不动、P3Showcase 仅新增一个展示区（不回改既有区）。核心新增 = 1 个 `EmployeeCenter` 组件 + mock ctx 接线 + i18n + capture surface。

---

## §1 AI Employee Center 定位

**职责（用户裁定）**：
- 不是 Dashboard、不是聊天窗口。
- Rail（Employees）→ Employee Center → Home Presence → Command Center 三层职责链中的**「管理空间」**一环。
- 只负责：**员工列表 / 身份展示 / 能力概览 / 员工状态 / 员工切换入口**。

**与相邻 surface 的边界**（避免职责重叠）：
- **Rail** = "去哪里"（系统导航，7 项，employees 是其中一项）—— 不动。
- **Employee Center** = "管理谁"（名册 + 身份 + 能力 + 状态 + 进入某员工的入口）—— 本阶段新建。
- **Home Presence** = "看某员工在场状态"（主角色 stage + 叙事 + 快速行动 + Dock）—— 已验收，不改内部结构。
- **Command Center** = "当前上下文控制"（项目/任务/操作/系统入口）—— 已验收，不改。

> 关键区分：Home 是**单个主角色**的在场客厅；Employee Center 是**全员名册**的管理视图。二者复用同一 `EmployeeCard` 身份组件，但聚合维度不同（1 vs N）。

---

## §2 Layout 草图

真实 shell 下（Rail 72px 首列 + main 区），Employee Center 渲染于 `<main className="canvas-region-host">`：

```
┌────┬──────────────────────────────────────────────────────────┐
│ 🐾 │  AI 员工 (employees.title)                                 │  ← surface header（非玻璃）
│ 🏠 │  管理你的 AI 员工团队 (employees.subtitle)                 │
│ ◎  │                                                            │
│ 💾 │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│ 📁 │  │ [avatar]    │  │ [avatar]    │  │ [avatar]    │  ...   │  ← EmployeeCard variant="card"
│ 🛒*│  │ 田园犬       │  │ 黑猫 Nox    │  │ 布偶猫       │        │     复用，非玻璃
│ ⚙  │  │ 默认助手     │  │ 研究型 Agent │  │ 知识管家     │        │
│ ◈  │  │ ● 思考中     │  │ ● 工作中     │  │ ○ 空闲       │        │
│    │  │ [能力] [能力] │  │ [能力] [能力] │  │ —           │        │
│    │  │ 进入 →       │  │ 进入 →(active)│  │ 进入 →       │        │  ← employees.view 切换入口
│    │  └─────────────┘  └─────────────┘  └─────────────┘        │
│    │                                                            │
│    │  （透明根，无玻璃外壳；仅 TitleBar 为系统 chrome 玻璃）       │
└────┴──────────────────────────────────────────────────────────┘
```

- 网格：`auto-fill / minmax(240px, 1fr)`，自适应列数；窄屏（≤560px）转单列。
- 卡片：复用 `EmployeeCard variant="card"`（含 avatar / name / role / status / statusPhrase / capabilities / level）。
- 切换入口：每张卡底部一个 `employees.view` 按钮（data 属性 `data-employee-open`，`data-employee-id`），点击 → Shell `onOpenEmployee(id)`。
- 当前聚焦员工：被切换过的员工卡加 `is-active` 标记（圆点 / 边框），对应 `employees.active` 标签。

---

## §3 Component 拆分

### 3.1 新增 `EmployeeCenter.tsx` + `EmployeeCenter.css`（唯一新组件）

```ts
// 展示层上下文（mock only，不接数据层）
export interface EmployeeCenterEntry {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
  capabilities?: LocText[]
}
export interface EmployeeCenterContext {
  entries: EmployeeCenterEntry[]
  activeId?: string
}

export function EmployeeCenter({
  ctx,
  onOpenEmployee,
}: {
  ctx: EmployeeCenterContext
  onOpenEmployee?: (id: string) => void
}) {
  // 渲染 header（employees.title / employees.subtitle）
  // 渲染 .employee-center__grid：
  //   ctx.entries.map(e => <EmployeeCard variant="card" .../> + 底部 employees.view 按钮)
  //   被聚焦的 entry 加 is-active + employees.active 角标
  // 空态：entries.length===0 → employees.empty
  // 复用 EmployeeCard / EmployeeIcon / EmployeeStatusIcon / status.employee.* 键
}
```

- **不新建身份组件**：直接消费 `EmployeeCard`（同 Home / P3Showcase / Marketplace 未来用法一致）。
- **非玻璃**：`.employee-center` 与 `.employee-center__grid` 透明/扁平，仅消费 E0 `--aios-*` token 与既有 `--bg-layer-*`/`--label-*`/`--border-*`；**不使用 `--aios-glass-*` / backdrop-filter**。
- **数据**：`map` 遍历 `ctx.entries`，不引入 Agent Registry / Manager。
- **切换入口语义**：`onOpenEmployee(id)` 为 mock 回调；在真实 shell 中由 MacWindowShell 实现为「设定聚焦 id + 切到 home 路由」（复用既有 `setActiveRoute('home')` 机制），**不接 Runtime、不改 AgentProfile**。

### 3.2 修改 `MacWindowShell.tsx`（仅接线，不重构）

- 新增本地 `makeShellEmployeeCtx(): EmployeeCenterContext`：从 `AGENTS` 构造 4 条 entry，附 mock `status` / `statusPhrase` / `level` / `capabilities`（沿用 `makeShellHomeCtx` 的 nox 主导设定，保证视觉一致）。
- `case 'employees':` 从 `<InertSurface>` 改为：
  ```tsx
  surface = (
    <div className="shell-surface">
      <EmployeeCenter ctx={makeShellEmployeeCtx()} onOpenEmployee={(id) => {
        setFocusedId(id)
        setActiveRoute('home')
      }} />
    </div>
  )
  ```
- 可选（见 §8 D2）：提升 `focusedId` state 至 MacWindowShell，并传入 `makeShellHomeCtx(focusedId)` 使 Home 主角色随切换变化——仍为纯展示态传播，无数据层改动。
- 其余（`memory`/`projects`/`settings` 仍 `InertSurface`、CC overlay、Rail）**完全不动**。

### 3.3 修改 `P3Showcase.tsx`（仅新增展示区，不回改既有区）

- 新增 `EmployeeCenterShowcase()`：本地构造与 shell 同构的 `EmployeeCenterContext`（4 AGENTS + mock 状态），渲染 `<EmployeeCenter ctx={...} />`。
- 在 `P3Showcase()` 的 `.p3-scroll` 中追加一个 `<section className="p3-region">` 区块（置于 HomeShowcase / NavigationRailShowcase 之间或之后）。
- **不修改** EmployeeCardShowcase / CommandCenterShowcase / HomeShowcase / NavigationRailShowcase 任何内容。

### 3.4 修改 `capture-showcase.cjs`（新增真实 shell surface）

- 新增 `employee-center` surface：真实 app（`BASE` = index.html）→ 点击 `.nav-rail__item[data-route="employees"]` → 断言（见 §5）。
- 在 `ok` 门新增 `if (r.surface === 'employee-center')` 分支（判定条件见 §5）。
- 不动 `shell` surface 既有 10 断言（保证无回归）；`employeesEntryKept===1` 继续成立。
- 可选 `employee-center-narrow`（560px）几何守卫。

---

## §4 i18n 规划

新增 **`employees.*` 顶层命名空间**（5 键，zh/en 1:1），**不污染** `nav.*` / `home.*` / `cc.*` / `status.employee.*`：

| Key | zh-CN | en-US |
|-----|-------|-------|
| `employees.title` | 员工 | Employees |
| `employees.subtitle` | 管理你的 AI 员工团队 | Manage your AI employee crew |
| `employees.view` | 进入 | Open |
| `employees.active` | 当前 | Current |
| `employees.empty` | 暂无员工 | No employees |

落地：`src/i18n/zh-CN.ts` 与 `src/i18n/en-US.ts` 各追加上述 5 键（紧邻 `home.*` / `nav.*` 区块，保持既有序）。

---

## §5 验收断言

### 5.1 真实 shell `employee-center` surface（4 主题：zh-light / en-light / zh-dark / zh-reduced）

| 断言 | 期望值 |
|------|--------|
| `employeeCenterPresent` | `=== 1`（`.employee-center` 已挂载，替换旧 InertSurface） |
| `employeeListCount` | `=== AGENTS.length`（4，全员名册） |
| `employeeCardsRendered` | `>= 4`（EmployeeCard 实例数） |
| `employeeSwitchEntryPresent` | `>= 1`（每张卡含 `data-employee-open` 按钮） |
| `employeeActiveMarked` | `>= 1`（聚焦员工 `is-active` + `employees.active` 角标） |
| `singleGlass` | `'ok'`（Employee Center 非玻璃，玻璃层数不新增） |
| `cjkLeak` | `false`（en 帧 Rail + Center 区域无 CJK 泄漏） |
| `overflow` | `[]`（无横向溢出；窄屏单列亦无溢出） |
| `themeAttr === theme` & `motionOff === 'ok'`（reduced 帧折叠） | 通过 |
| `errors === 0` & `fourohfour` 空 | 通过 |

### 5.2 回归基线（必须保持，不回退）

- `shell` surface 既有 10 断言全绿，尤其 **`employeesEntryKept === 1`**（Rail 项未删）。
- P3Showcase 三类既有 surface 无回退：**Employee**（cardCount/placeholder/overflow/offline/longTrimmed）、**CommandCenter**（floating/docked/singleGlass/overflow）、**Home**（homePresent/dockTiles/hero/primary/context actions/singleGlass/overflow）。

---

## §6 文件 scope freeze（仅以下 7 文件，编码阶段落地）

**新建（2）**
1. `src/components/EmployeeCenter.tsx`
2. `src/components/EmployeeCenter.css`

**修改（5）**
3. `src/components/MacWindowShell.tsx`（仅 `employees` 分支接线 + 本地 `makeShellEmployeeCtx()`；`memory/projects/settings` 维持 InertSurface；CC overlay / Rail 不动）
4. `src/i18n/zh-CN.ts`（+5 `employees.*` 键）
5. `src/i18n/en-US.ts`（+5 `employees.*` 键）
6. `src/P3Showcase.tsx`（仅新增 `EmployeeCenterShowcase` 区块，不回改既有区）
7. `scripts/capture-showcase.cjs`（新增 `employee-center` surface + `ok` 门分支）

**红线（本阶段明确不碰）**：
- ❌ 不改 `NavigationRail`（入口已存在）、`EmployeeCard` / `EmployeeIcon`（复用）、`Home` 内部结构、`CommandCenter` 内部结构、`SideNav`（保留兜底）、`App.tsx`、`types.ts` / `AgentProfile`（数据层冻结）。
- ❌ 不引入路由库 / Runtime / Agent Registry / Manager / Memory Runtime。
- ❌ 不接 chat / prompt / 文件上传 / 任务创建。
- ❌ 不新增第二套玻璃体系；保持单玻璃层（仅 TitleBar + CC 浮动层）。

---

## §7 视觉与交互约束

- 风格延续 Apple / visionOS：克制、留白、圆角、`--aios-radius-*` / `--aios-motion-*`（功能运动 180–280ms 无过冲，reduced 折叠）。
- 全部消费 **E0 `--aios-*` token**；卡片边框/分隔用 `--border-l1`，文字用 `--label-*`。
- 无 loop 动画；状态点复用 `EmployeeStatusIcon`。
- 聚焦态：`is-active` 用 `--brand-primary` 细边框 + 圆点，不依赖玻璃投影。

---

## §8 待裁定（D1–D3，审核时确认）

- **D1 切换入口行为**：推荐 `onOpenEmployee(id)` → `setFocusedId(id)` + `setActiveRoute('home')`（进入该员工 Home Presence）。是否接受此「进入即切换主角色」语义？
- **D2 聚焦传播范围**：是否在本阶段将 `focusedId` 提升至 MacWindowShell 并传入 `makeShellHomeCtx(focusedId)`（使 Home 主角色随切换变化）？还是仅标记 active、Home 主角色暂固定为 nox（纯展示标记，更小 blast radius）？**推荐前者**（仍 mock-only，无数据层改动，切换更真实）。
- **D3 能力概览数据**：`capabilities` 用 mock 静态词（如 研究/写作/分析），沿用 P3Showcase 既有示例；是否接受纯展示、不接真实能力探测？**推荐接受**（守红线）。

---

## §9 蓝图衔接

- **Stage 2-B（后续）**：员工详情面板（点击卡展开能力/等级/成长时间线），仍 mock-only；或把 Home Dock 的「快速切换」与 Employee Center 的 `focusedId` 统一为单一切换源。
- **未来 Business Workflow Layer**：员工「进入」后可在 Home/Command Center 触发任务，但任务创建入口**不在本阶段、不在 Employee Center**。
- **Marketplace / Memory / Projects / Settings** 仍为 `InertSurface`，与 Employee Center 平行，互不耦合。

---

*本计划为纯设计文档，零代码改动。提交后停在审核节点，待确认后再进入 2-A 编码（严格按 §6 scope freeze 与 §7 红线，单 commit）。*
