# Shell Integration Mini Plan

> 目标：将 A3 已验收的 **Navigation Rail** 从「P3Showcase 验证组件」演进为「真实 App Shell 的一级导航」。
> 性质：**设计文档，零代码**。提交后停在确认节点，不进入编码。
> 仓库：`packages/apps/knowledge-canvas-ui`，分支 `main`。
> **修订（2026-09-07）**：依审核裁决落地 D1–D4（agents 入口保留 / import 不进 CC / Home 仅挂载 / CC 最小实现）+ 新增真实 Shell surface 验收清单。本修订仍为零代码，提交后停确认节点。

---

## §0 · 当前 Shell 架构审计（已实测，非推测）

所有结论均来自对真实源码的读取，定位见括号内。

### 0.1 入口与挂载
- `src/main.tsx` → `<FirstRunGate><App /></FirstRunGate>`。`App` 自身只持 `entered` 状态（`src/App.tsx:6`）。
- `src/p3DemoEntry.tsx` → `<P3Showcase />`（独立 bundle，仅用于设计验证）。
- **结论**：真实 app 与 P3Showcase 是**两套独立挂载入口**，Home/CommandCenter/NavigationRail 只在 P3Showcase 出现，**从未进入真实 app 树**。

### 0.2 真实 Shell（`MacWindowShell.tsx`，全文 15 行）
```
<div className="shell">
  <TitleBar />          // grid-column 1/-1, row1
  <SideNav />           // grid-column 1, row2 —— 硬编码、无 props、无分支
  <main className="canvas-region-host">{children}</main>  // col2 row2
  <AIInsightPanel />    // col3 row2
</div>
```
- `children` = `entered ? <CanvasRegion /> : <WelcomeDashboard />`（`App.tsx:10`）。
- **无路由**：grep `react-router|useNavigate|useLocation|renderSlot|app.view` 在 `src/**` 全无命中。
- **SideNav 无任何 prop 注入点**：无法条件渲染、无法传 activeRoute。

### 0.3 真实 Shell 的玻璃层现实（重要）
- `TitleBar`：`--bg-layer-1` + `backdrop-filter: blur(20px)`（`app.css:80-82`）→ **玻璃**。
- `SideNav`：`--bg-layer-1` + `backdrop-filter: blur(20px)`（`app.css:121-123`）→ **玻璃**。
- **结论**：真实 shell 当前已是 **2 层玻璃**（TitleBar + SideNav）。这与 P3Showcase 里「仅 Dock+CommandCenter 玻璃」的纪律不同——P3Showcase 没有 TitleBar/SideNav 玻璃体系。
- 含义：用**扁平** NavigationRail 替换 **玻璃** SideNav，**反而减少一层玻璃**，与「单玻璃层」方向一致（替换后真实 shell = 仅 TitleBar 玻璃 + Rail 扁平）。

### 0.4 SideNav 独有内容（Rail 当前没有）
`SideNav.tsx` 渲染 4 个 `sidebar.*` 导航项 + 1 个 `sidebar.agents` 区域（AgentAvatar 员工栈）：
- `sidebar.knowledge`(active) / `sidebar.memory` / `sidebar.import`（导入）/ `sidebar.settings`
- `sidebar.agents` = AI 员工快捷在场栈（`AGENTS.map → AgentAvatar size=34 withName`）

**Rail 与 SideNav 的差异（即迁移必须处理的点）**：
| 能力 | SideNav | NavigationRail(A3) |
|---|---|---|
| 宽度 | 232px（含标签） | 72px（icon-forward） |
| 玻璃 | 是 | 否（扁平 `--bg-base`） |
| 员工栈 | 有（agents 区） | 无 |
| 导入动作 | 有（import） | 无对应路由 |
| 命名空间 | `sidebar.*` | `nav.*` |
| CC 唤起 | 无 | 有（底部独立 affordance，no-op） |

### 0.5 CommandCenter 当前挂载位置
- **无**。CommandCenter 组件（`CommandCenter.tsx`）仅在 `P3Showcase.tsx` 内被挂载；真实 shell 从未引用。
- Rail 的 `onCommandCenter` 在 A3 中是 **no-op**，未接任何 Shell state。

---

## §1 · 两种方案比较

### 方案 A · Rail 替换 SideNav
将 `MacWindowShell` 中 `<SideNav />` 直接替换为 `<NavigationRail />`，并把 `.shell` 网格首列 `232px → 72px`。

- **兼容风险**：中。SideNav 两处独有内容需安置——(1) `agents` 员工栈；(2) `import` 导入动作。Rail 不承载二者，若直接丢弃会丢功能。
- **回滚成本**：中低。单组件替换 + 1 处 CSS 列宽改动；`SideNav.tsx` 保留不删即可秒级回滚。
- **对现有功能影响**：`CanvasRegion`/`WelcomeDashboard`（children）仍在 col2，不受影响；`AIInsightPanel`（col3）不受影响；知识工具链路零改动。仅左侧导航形态改变。
- **玻璃纪律**：替换后真实 shell = TitleBar(玻璃) + Rail(扁平) = **1 层玻璃**，更干净。
- **产品一致性**：与 A1–A3「Rail 是去哪里、≠ Sidebar」的方向完全一致；`nav.*` 成为唯一导航命名空间（长期）。

### 方案 B · Rail 与 SideNav 并存迁移
保留 SideNav，在更左侧新增 NavigationRail（网格变 `72px 232px 1fr 320px`，4 列）。

- **兼容风险**：低（不碰 SideNav）。但引入**双导航并存**的产品级问题。
- **回滚成本**：低（删除 Rail 即可）。
- **对现有功能影响**：表面零影响；但**横向空间被吃 72px**，窄屏更挤；两套导航同时可见且都指向部分重叠的 surface，active 态需双处同步，状态模型变复杂。
- **玻璃纪律**：TitleBar(玻璃) + SideNav(玻璃) + Rail(扁平) = 仍 2 层玻璃，且「为何有两个导航」是产品异味，最终仍要移除 SideNav，B 只是把 A 的工作延后并叠加过渡复杂度。
- **产品一致性**：**违背**用户已确立的「Rail ≠ Sidebar」边界；双 nav 让用户困惑。

### 对比小结
| 维度 | A（替换） | B（并存） |
|---|---|---|
| 产品清晰度 | 高（单一 nav） | 低（双 nav 异味） |
| 兼容风险 | 中（需安置 2 项 SideNav 独有内容） | 低 |
| 回滚成本 | 中低 | 低 |
| 现有功能影响 | 仅左侧形态 | 横向空间+状态同步复杂 |
| 玻璃纪律 | 降至 1 层（更好） | 维持 2 层 |
| 是否达成用户方向 | 是 | 否（违背边界） |

---

## §2 · 推荐迁移方案（A，分阶段执行）

**采用方案 A**，但**分阶段、可回滚**执行，把 A 的清洁度与 B 的安全性结合起来：

1. **阶段 1（本 Mini Plan 的编码范围）— 视觉替换 + 受控 surface 切换**
   - `MacWindowShell` 用 `<NavigationRail />` 替换 `<SideNav />`，`.shell` 首列 `232px → 72px`。
   - Shell 持有 `activeRoute: NavRoute` 与 `ccOpen: boolean` 两个 state。
   - `activeRoute` 驱动真实 surface（D1/D2/D3 已裁定）：
     - `home` → 挂载**已有** `<Home />`（**D3**：仅挂载，禁止修改 Home 内部结构、禁止接 Runtime、禁止引入 workflow）。
     - `knowledge` → 现有 `<CanvasRegion />`（保留 `entered` 网关；`home` 与 `entered` 互斥切换，不丢 WelcomeDashboard 入口）。
     - `employees` → **保留入口**（**D1**：不隐藏），映射到**既有员工 surface 占位**（占位承接，不恢复旧 `agents` stack UI；真实 Employee Center 留待阶段 2）。
     - `memory` / `projects` / `settings` → **inert 占位**（高亮但无 surface，与 marketplace disabled 同策略——不声称不存在的功能）。
     - `marketplace` → 保持 disabled（A3 已验证）。
     - `import` → **Rail 不显示**（**D2**：import 属输入能力、非上下文控制；且不进 CommandCenter，不污染 CC；在 nav 模型中预留迁移槽位，未来归 Business Workflow Layer / Knowledge ingestion）。
   - `onCommandCenter` 接 Shell state，切换 `ccOpen`（见 §4，**D4** 最小实现）。
   - **SideNav 不删除**，仅从 MacWindowShell 卸载；保留为回滚兜底。

2. **阶段 2（后续，不在本范围）— 安置 SideNav 独有内容**
   - `agents` 员工栈能力 → 迁移到 **Home Dock / Employee Center**（**D1**：`employees` 入口已在 Rail 保留，阶段 2 把员工在场能力迁入新主场，**不恢复旧 stack UI**）。
   - `import` 导入 → 归 **Business Workflow Layer / Knowledge ingestion**（**D2**：不进 CommandCenter，不污染 CC 的上下文控制语义）。
   - 安置完成后删除 `SideNav.tsx`，`sidebar.*` 键进入废弃流程。

3. **阶段 3（后续）— `nav.*` 成为唯一导航命名空间**
   - SideNav 删除后，`sidebar.*` 键从 i18n 移除；`nav.*` 正式唯一。

---

## §3 · 迁移边界（scope freeze）

### 3.1 允许修改
- `src/components/MacWindowShell.tsx`：`SideNav`→`NavigationRail`；新增 `activeRoute`/`ccOpen` state；渲染 `<CommandCenter>`（条件）；导入 Home/CommandCenter/NavigationRail。
- `src/styles/app.css`：`.shell` 网格首列 `232px → 72px`；如有需要新增 Rail 在真实 grid 下的微调（不影响 P3Showcase 的 `.rail-showcase` 相对容器）。
- `src/components/NavigationRail.tsx`：将 `activeRoute` 接到真实 Shell state（prop 已存在），`onNavigate`/`onCommandCenter` 由 Shell 注入（接口已预留，**不改契约**）。
- `src/i18n/zh-CN.ts` / `en-US.ts`：**不新增键**（A3 的 `nav.*` 已齐备）；若阶段 2 安置需要再加。

### 3.2 禁止修改（硬红线）
- `src/components/SideNav.tsx`：**禁止删除**、禁止改（回滚兜底；阶段 2 前保留）。
- `src/App.tsx`：保持 `entered` 最小逻辑；不在此引入路由库。
- `src/components/Home.tsx`：**禁止内部重构**（**D3**：本步仅由 Shell 挂载，不改其内部结构、不接 Runtime、不引入 workflow）。
- `src/components/CommandCenter.tsx`：**禁止内部重构**（**D4**：只消费既有 B 契约；`role="dialog"`/Esc/aria 的最小浮层包装由 **Shell 层（MacWindowShell）** 提供，CC 组件本身不变；不增 chat/prompt/对话历史/workflow）。
- `src/components/EmployeeCard.tsx`：保持 A 已验收契约，不扩字段。
- `src/types.ts` / `AgentProfile`：数据层冻结（**禁止大改**）。
- `src/P3Showcase.tsx` + `capture-showcase.cjs`：A3 验收 surface **禁止回改**（扩 surface 而非改）。
- **不引入 react-router 或任何路由库**：本步用 Shell 内 `useState` 做 surface 切换，与 A3 的 mock-only 纪律一致。

### 3.3 `sidebar.*` 兼容性
- **本步不强制 `nav.*` 唯一**。SideNav 保留 → `sidebar.*` 仍被使用，i18n 不破。
- 仅在阶段 2/3 删除 SideNav 后才废弃 `sidebar.*`。本步两命名空间共存是合法过渡态。

### 3.4 `nav.*` 成为唯一命名空间？
- **否，本步不是**。明确目标：阶段 3 才让 `nav.*` 唯一。本步只消费已有 `nav.*`，不增不减。

---

## §4 · Command Center 真实唤起设计

当前：`NavigationRail` 的 CC 按钮是 no-op。
目标链路：**Rail 按钮 → Shell state → CommandCenter surface 挂载**。

```
[NavigationRail CC affordance]
   onClick → onCommandCenter()
      ↓ (Shell 注入)
setCcOpen(o => !o)            // MacWindowShell 持有 ccOpen
      ↓
{ccOpen && <CommandCenter ctx={MOCK_CTX} variant="floating" />}
      ↓
渲染于 --aios-layer-command:300（浮层，不抢占 grid 列）
```

- **数据**：仅传 **mock** `CommandCenterContext`（B 契约），**不接** AgentProfile registry / Agent runtime / Task runtime / Memory remote。
- **禁止**：chat 气泡、prompt 输入、对话历史、workflow 入口。严守 B 红线条。
- **玻璃**：CommandCenter 自身为 sanctioned 玻璃层，仅 `ccOpen` 时短暂出现，与「单玻璃层」纪律兼容（真实 shell 玻璃 = TitleBar 常驻 + CommandCenter 按需）。
- **位置**：floating 变体浮于 canvas 之上（`variant="floating"`），不影响 `.shell` 网格；后续可切 `docked`。
- **可访问性（D4 最小实现）**：CC 按钮已有 `aria-label={t('nav.commandCenter.hint')}`；**浮层包装在 Shell 层**（`MacWindowShell`）提供 `role="dialog"` + `aria-modal="true"` + Esc keydown 关闭 + 点击遮罩关闭，并管理 focus 回到 Rail 按钮；**CommandCenter 组件内部不变**（不引入新依赖、不加 chat/prompt）。CC 打开/收起均由 `ccOpen` 单一 state 控制。

---

## §5 · 验收方案

### 5.1 不回退断言（回归基线）
- **Home 不回退**：P3Showcase 的 Home surface 仍通过既有断言（`homePresent/dockTiles/dockActive/...`）。
- **CommandCenter 不回退**：P3Showcase 的 command-center surface 仍通过（`cc.title`/sections/glass/single-glass ok）。
- **Navigation 不回退**：P3Showcase 的 navigation-rail surface 仍通过 A3 八项断言（`railItems=7/railActive=1/railMarketplaceDisabled=1/railCCInvoke=1/singleGlass=ok/cjkLeak=false/overflow=[]/motionOff=ok`）。

### 5.2 真实 Shell 新增断言（新增 `shell` surface）
`capture-showcase.cjs` 扩展：除加载 P3Showcase 外，新增加载**真实 app 入口**（main bundle）的 surface，断言：
- `shellRailPresent=1`：`.nav-rail` 存在于真实 `.shell` 中（SideNav 已不在）。
- `shellGridFirstCol≈72px`：`.shell` 首列宽度为 Rail 宽度（非 232）。
- **`shellRailSingleGlass=ok`**：真实 shell 中 `.nav-rail` **非玻璃**（无 `backdrop-filter`、背景为不透明 `--bg-base`），`singleGlass` 同类断言复用。
- **`shellTitleBarGlassCheck`**：核验 **TitleBar 玻璃是否为「系统 chrome 常驻」单一语境**——断言真实 shell 玻璃层 ≤ 2（TitleBar + 按需 CC），且 TitleBar 与 Rail 分处不同区域、不形成相邻 double-blur 叠影；若 TitleBar 玻璃对 Rail 区域产生视觉污染则判 FAIL（记录 `shellTitleBarGlassIssue`）。
- `shellSideNavAbsent=1`：`.sidebar` 不再挂载于真实 shell。
- **`shellHomeMount=1`**：`activeRoute='home'` 时真实 `<Home />` 成功挂载、无崩溃（D3）。
- **`shellCCMountOnInvoke=1`**：触发 CC 按钮后 `.command-center` 出现于 `--aios-layer-command`；再触发 `ccOpen=false` 消失（D4 开/关）。
- **`shellCCCloseOnEsc=1`**：CC 打开状态下派发 Esc keydown → `ccOpen=false`、浮层卸载、`role="dialog"` 消失（D4）。
- `shellInertRoutes`：employees(占位)/memory/projects/settings 高亮但无 surface 崩溃（不抛错、不空白整页）；employees 占位承接（D1）不报错。
- `shellEmployeesEntryKept=1`：Rail 的 `employees` 项仍存在且可高亮（D1：入口不隐藏）。

### 5.3 主题、布局与玻璃专项
- **light / dark / reduced**：真实 shell + Rail + CommandCenter 三主题下断言 `shellCJKNoLeak=false`（无 CJK 残留）与 `shellReducedMotion=ok`（reduced 时 motion 关闭）。
- **narrow layout（≤560px）**：真实 shell 下 Rail 转底部横向 tab 条（复用 A3 的 `@media(max-width:560px)`），`.shell` 网格相应降级为单行底部栏，断言 `shellNarrowOverflow=[]`（无溢出）。
- **无玻璃层污染（专项）**：Rail 始终扁平（无 `backdrop-filter`）；CommandCenter 仅在 `ccOpen` 时玻璃；TitleBar 为系统 chrome 常驻玻璃，已通过 `shellTitleBarGlassCheck` 确认不污染 Rail（见 §5.2）。

---

## §6 · D1–D4 已裁定（编码生效）

> 用户于 2026-09-07 审核通过本 Mini Plan，并落地以下四项裁决，编码阶段据此执行。

- **D1 · agents 入口保留（不隐藏）**：`employees` 项保留在 Rail（入口不消失）；阶段 1 映射到**既有员工 surface 占位**（仅占位承接），**不恢复旧 `agents` stack UI**；阶段 2 将员工在场能力迁移到 **Home Dock / Employee Center**。即「入口保留、旧表现迁移」。
- **D2 · import 不进 Rail、不进 CC**：import 属输入能力、非上下文控制，阶段 1 **Rail 不显示**；且不进入 CommandCenter（不污染 CC 语义）；在 nav 模型预留迁移槽位，未来归 **Business Workflow Layer / Knowledge ingestion**。
- **D3 · Home 本步接入（仅挂载）**：`home` 路由 → Shell `activeRoute` → 真实 `<Home />`；**只负责挂载已有 Home**，禁止修改 Home 内部结构、禁止接 Runtime、禁止引入 workflow。
- **D4 · CC 最小实现**：Rail CC 按钮 → Shell `ccOpen` state → CommandCenter floating；要求 `role="dialog"` + `aria-modal` + **Esc 关闭** + aria；**不新增 prompt/chat、不接真实 command runtime**。浮层包装由 Shell 层提供，CC 组件内部不变。

---

## §6.1 · 最终编码范围确认（用户显式裁定）

**允许修改**
- `src/components/MacWindowShell.tsx`（替换 + state + 条件挂载 CC + 导入 Home/CommandCenter/NavigationRail）
- `src/components/NavigationRail.tsx`（接真实 Shell state，契约不变）
- `src/styles/app.css`（`.shell` 首列 `232px → 72px` + 真实 grid 微调，不动 `.rail-showcase`）
- 必要 i18n（`nav.*` 已齐备，本步预计零新增；若阶段 2 安置才补）

**禁止修改（硬红线）**
- `SideNav.tsx` 删除 / `AgentProfile` 修改 / `types.ts` 大改
- `Home.tsx` 内部重构 / `CommandCenter.tsx` 内部重构
- `P3Showcase.tsx` 回改
- 引入路由库 / 接 Runtime / 接真实 command runtime / 加 chat/prompt/workflow

---

## §7 · 蓝图衔接与提交纪律
- 本 Mini Plan 是 A3 → 真实 Shell 的桥梁；不触碰 B/A 已验收 surface 的契约。
- 编码（用户确认后）严格 per-commit scope freeze：本步仅改 §3.1 列出的目标文件，单文件 commit，lefthook 全过，不混入 `tsconfig`/`pnpm-lock` 等无关改动。
- 完成后停在「Shell Integration 验收节点」，不自动进入阶段 2（员工栈/导入安置）或后续 Workflow Layer。
- 阶段 2/3 为独立立项，需用户再次显式放行。
