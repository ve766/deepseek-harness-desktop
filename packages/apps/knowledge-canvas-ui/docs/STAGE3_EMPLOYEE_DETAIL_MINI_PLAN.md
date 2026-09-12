# Stage 3 · AI Employee Detail Mini Plan

> 阶段定位：Stage 2-A（AI Employee Center，commit `3c3fb6a`）已验收通过，focusedId 已提升至 Shell 层、`onOpenEmployee` 已接「聚焦 + 切回 Home」、capture 修复已确认属测试逻辑修正。
>
> 本阶段是 Stage 2-A 计划 §9「蓝图衔接」中预定义的 **Stage 2-B（员工详情面板）** 的正式化命名——2-A 交付了 Employee Center 的「列表 / 选择 / 切换入口」半边，Stage 3 延伸出「下钻详情」半边。**沿用 2-A 同一套 scope freeze 纪律**：单一计划文档提交，工作区无关 harness 噪声（tsconfig / 各包 package.json 等）**不纳入本 commit**。
>
> 纪律：纯设计文档，零代码改动；提交后停在审核节点，待确认后再放行编码（单 commit，严格按 §6 scope freeze 与 §7 红线）。

---

## §0 当前代码审计（真实状态，非假设）

| 事项 | 现状（基于 2-A 已落地代码） | 对 Stage 3 的影响 |
|------|------------------------------|-------------------|
| `employees` 路由 | `MacWindowShell.tsx` line 259–270：渲染 `<EmployeeCenter ctx={makeShellEmployeeCtx(focusedId)} onOpenEmployee={handleOpenEmployee} />` | Stage 3 在该 `case` 内引入 `detailId` 局部态，按 `detailId ? <EmployeeDetail/> : <EmployeeCenter/>` 切换；**不改 Rail、不改 NavRoute 联合** |
| `handleOpenEmployee` | `MacWindowShell.tsx` line 243–246：`setFocusedId(id)` + `setActiveRoute('home')` —— 即「查看在场状态 / Open」路径 | Stage 3 新增 **独立** 的 `handleOpenDetail(id)`（设 `detailId`，**不切路由**），与 Open 路径并存、互不干扰 |
| `EmployeeCenter.tsx` | 107 行；每卡底部含 `data-employee-open` 按钮（line 92–100）调 `onOpenEmployee`；无详情入口 | Stage 3 在该卡**追加**一个「详情」次级入口（`data-employee-detail` + `onOpenDetail` prop），**仅加法、不改既有 Open 语义** |
| `EmployeeIdentity` | `EmployeeCard.tsx` line 105：`variant === 'hero' → iconSize 160` 已支持 | 详情头部直接复用 `<EmployeeIdentity variant="hero">`，无需新建身份组件 |
| `AgentProfile` | `types.ts:183`：`id/name/role/nameLoc/roleLoc/color/avatarUrl`，**无 bio/描述/成长字段** | 详情的成长时间线 / 职责描述**只能来自 Shell mock map**，不触碰 `AgentProfile`（数据层冻结红线） |
| Shell mock 资产 | `MacWindowShell.tsx` 已含 `SHELL_EMP_CAPS`（line 97–118）与 `SHELL_EMP_LEVEL`（line 120–125） | Stage 3 复用二者于详情；另新增 `SHELL_EMP_GROWTH`（纯展示里程碑，mock-only） |
| i18n `employees.*` | `zh-CN.ts:385–389` / `en-US.ts` 并行：title/subtitle/view/active/empty；**无 detail.* 键** | 新增 `employees.detail.*` 子命名空间（见 §4），不污染既有键 |
| capture `employee-center` surface | `capture-showcase.cjs` line 1024–1084 + ok 门 line 1218 | Stage 3 新增独立 `employee-detail` surface（4 主题），**不动** `employee-center` 既有断言；守住 `employeesEntryKept===1` |
| 玻璃层纪律 | 真实 shell 仅 TitleBar 常驻玻璃 + CC 浮动层；Employee Center 透明非玻璃 | Employee Detail **同为非玻璃 surface**，单玻璃层保持 |

**审计结论**：Stage 3 爆炸半径与 2-A 同级且更小——核心新增 = 1 个 `EmployeeDetail` 组件 + Shell `detailId` 切换接线 + EmployeeCenter 次级入口 + i18n + capture surface。Rail / EmployeeCard / Home / CommandCenter / SideNav / App / types / AgentProfile 一律不碰。

---

## §1 AI Employee Detail 定位

**职责（本阶段裁定）**：
- Employee Center = 「管理谁」（名册 + 身份 + 能力概览 + 状态 + 切换入口）。
- **Employee Detail = 「看清某一个员工」**（身份全景 + 能力展开 + 等级 + 成长时间线）——是名册的**下钻视图**，不是第二个列表、不是聊天窗、不是仪表盘。
- 与相邻 surface 的边界：
  - **Employee Center**（名册 N）— 选谁。
  - **Employee Detail**（单员工 1）— 看清某人。二者在 `employees` 路由内切换，Rail 项 `employees` 不变。
  - **Home Presence**（主角色在场）— Open 路径已接；Detail 不替代 Open，仅提供「停留查看详情」的另一种动作。
  - **Command Center** — 不涉及。

> 关键区分：Open（查看在场状态）→ 切回 Home 并聚焦；Detail（详情）→ 停留在 employees 路由内展开该员工全景。两条路径语义正交，均 mock-only。

---

## §2 Layout 草图

真实 shell 下（`employees` 路由，`detailId` 命中时渲染 `<EmployeeDetail>` 替换 `<EmployeeCenter>`）：

```
┌────┬──────────────────────────────────────────────────────────┐
│ 🐾 │  ← 返回员工中心 (employees.detail.back)                    │  ← 顶栏返回，清除 detailId
│ 🏠 │                                                            │
│ ◎  │  ┌─────────────────────────────────────────────────────┐ │
│ 💾 │  │  [ avatar 160 ]   田园犬                               │ │  ← EmployeeIdentity variant="hero"
│ 📁 │  │                  默认助手 · ● 工作中                    │ │     复用，非玻璃
│ 🛒*│  │                  正在处理你的日常请求                  │ │
│ ⚙  │  ├─────────────────────────────────────────────────────┤ │
│ ◈  │  │ 能力 (employees.detail.capabilities)                 │ │
│    │  │ [日常助理] [任务编排] [信息检索]  ← 展开自 SHELL_EMP_CAPS │
│    │  │ 等级 (employees.detail.level)  ▓▓▓▓▓░░░ Lv 82          │ │
│    │  │ 成长 (employees.detail.growth)                        │ │
│    │  │ · 入职第 1 天 —— 完成引导                             │ │  ← SHELL_EMP_GROWTH（mock）
│    │  │ · 第 14 天 —— 首次独立任务                            │ │
│    │  │ · 第 30 天 —— 晋升为默认助手                          │ │
│    │  └─────────────────────────────────────────────────────┘ │
│    │  （透明根，无玻璃外壳；仅 TitleBar 为系统 chrome 玻璃）    │
└────┴──────────────────────────────────────────────────────────┘
```

- 容器：透明 `.employee-detail`，无 background / 无 backdrop-filter；仅消费 E0 `--aios-*` / `--bg-layer-*` / `--label-*` / `--border-l1`。
- 头部：复用 `<EmployeeIdentity agent status level capabilities variant="hero" />`。
- 分区：能力（chip 列表）、等级（track + 文本）、成长（静态里程碑列表）。
- 返回：顶栏「← 返回」清除 `detailId`，回到 Employee Center 列表（**不切 NavRoute**，Rail `employees` 保持高亮）。

---

## §3 Component 拆分

### 3.1 新增 `EmployeeDetail.tsx` + `EmployeeDetail.css`（唯一新组件）

```ts
export interface EmployeeDetailProps {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
  capabilities?: LocText[]
  /** Mock-only growth milestones (display only). */
  growth?: { at: LocText; text: LocText }[]
  onBack: () => void
}

export function EmployeeDetail(props: EmployeeDetailProps) {
  // 渲染顶栏返回（employees.detail.back）→ onBack()
  // 渲染 .employee-detail__hero：<EmployeeIdentity variant="hero" .../>
  // 渲染 .employee-detail__section*：capabilities(level)/growth
  // 复用 EmployeeStatusIcon / status.employee.* 键
}
```

- **不新建身份组件**：直接消费 `EmployeeIdentity`（同 Home / Employee Center / P3Showcase 用法一致）。
- **非玻璃**：`.employee-detail` 透明扁平，无 `--aios-glass-*` / backdrop-filter。
- **数据**：全部来自 Shell mock map 传入的 props，**不引入 Registry / Manager / Runtime**。
- **无交互副作用**：返回仅清 `detailId`；无 chat / prompt / 上传 / 任务创建。

### 3.2 修改 `MacWindowShell.tsx`（仅 `employees` 分支 + 局部态，不重构）

- 新增 `const [detailId, setDetailId] = useState<string | null>(null)`（与 `focusedId` 平行，均为 Shell 局部态）。
- 新增 `handleOpenDetail(id)`：`if (AGENT_MAP[id]) setDetailId(id)`（**不切路由、不调 setActiveRoute**）。
- `case 'employees':` 改为：
  ```tsx
  surface = detailId ? (
    <div className="shell-surface">
      <EmployeeDetail
        {...deriveDetailCtx(detailId)}   // 从 SHELL_EMP_* + SHELL_EMP_GROWTH 构造
        onBack={() => setDetailId(null)}
      />
    </div>
  ) : (
    <div className="shell-surface">
      <EmployeeCenter
        ctx={makeShellEmployeeCtx(focusedId)}
        onOpenEmployee={handleOpenEmployee}
        onOpenDetail={handleOpenDetail}
      />
    </div>
  )
  ```
- 新增本地 `makeShellDetailCtx(id): EmployeeDetailProps`（从 `AGENT_MAP` / `SHELL_AGENT_STATE` / `SHELL_EMP_CAPS` / `SHELL_EMP_LEVEL` / `SHELL_EMP_GROWTH` 组装）。
- 其余（`home` / `memory` / `projects` / `settings` / CC overlay / Rail）**完全不动**。

### 3.3 修改 `EmployeeCenter.tsx`（仅加法：次级详情入口）

- 组件签名新增 `onOpenDetail?: (id: string) => void`。
- 每卡在既有 `data-employee-open` 按钮旁**追加**一个 `data-employee-detail` 按钮（文案 `employees.detail.openDetail`），点击调 `onOpenDetail?.(e.profile.id)`。
- 既有 Open 按钮语义、布局、类名**完全不变**（零回退风险）。

### 3.4 修改 `capture-showcase.cjs`（新增真实 shell surface）

- 新增 `employee-detail` surface：真实 app → 点 `.nav-rail__item[data-route="employees"]` → 点首卡 `.employee-center__detail[data-employee-id="assistant"]` → 断言（见 §5）。
- 在 `ok` 门新增 `if (r.surface === 'employee-detail')` 分支。
- **不动** `employee-center` 既有断言；`employeesEntryKept===1` 继续成立。
- 可选 `employee-detail-narrow`（560px）几何守卫。

---

## §4 i18n 规划

新增 **`employees.detail.*` 子命名空间**（7 键，zh/en 1:1），**不污染** `employees.*` / `nav.*` / `home.*` / `status.employee.*`：

| Key | zh-CN | en-US |
|-----|-------|-------|
| `employees.detail.back` | 返回员工中心 | Back to Employee Center |
| `employees.detail.title` | 员工详情 | Employee Details |
| `employees.detail.openDetail` | 详情 | Details |
| `employees.detail.capabilities` | 能力 | Capabilities |
| `employees.detail.level` | 等级 | Level |
| `employees.detail.growth` | 成长轨迹 | Growth |
| `employees.detail.roleDesc` | 职责 | Role |

落地：`src/i18n/zh-CN.ts` 与 `src/i18n/en-US.ts` 各追加上述 7 键（紧邻 `employees.*` 区块）。

---

## §5 验收断言

### 5.1 真实 shell `employee-detail` surface（4 主题：zh-light / en-light / zh-dark / zh-reduced）

| 断言 | 期望值 |
|------|--------|
| `detailMount` | `=== 1`（`.employee-detail` 已挂载，替换 Center） |
| `heroIdentityPresent` | `=== 1`（`<EmployeeIdentity variant="hero">` 头像 160 区存在） |
| `capabilitiesRendered` | `>= 1`（能力 chip 区渲染） |
| `levelRendered` | `=== 1`（等级条渲染） |
| `growthRendered` | `>= 1`（成长里程碑列表渲染） |
| `backReturnsToCenter` | `true`（点返回后 `.employee-center` 重新出现、`detailId` 清空） |
| `singleGlass` | `'ok'`（Detail 非玻璃，玻璃层数不新增） |
| `cjkLeak` | `false`（en 帧 Detail 区域无 CJK 泄漏） |
| `overflow` | `[]`（无横向溢出；窄屏单列亦无溢出） |
| `themeAttr === theme` & `motionOff === 'ok'`（reduced 帧折叠） | 通过 |
| `errors === 0` & `fourohfour` 空 | 通过 |

### 5.2 回归基线（必须保持，不回退）

- `employee-center` surface 既有断言全绿（含 `centerMount` / `cardCount=4` / `openCount=4` / `switchNavigatesToHome=true`）。
- `shell` surface 既有 10 断言全绿，尤其 **`employeesEntryKept === 1`**（Rail 项未删、Detail 不新增 Rail 项）。
- P3Showcase 三类既有 surface 无回退：**Employee** / **CommandCenter** / **Home**。
- Open 路径（查看在场状态 → 切 Home）行为不变（本次仅加法，不触碰该语义）。

---

## §6 文件 scope freeze（仅以下 7 文件，编码阶段落地）

**新建（2）**
1. `src/components/EmployeeDetail.tsx`
2. `src/components/EmployeeDetail.css`

**修改（5）**
3. `src/components/MacWindowShell.tsx`（仅 `employees` 分支加 `detailId` 切换 + `handleOpenDetail` + `makeShellDetailCtx`；`home` / 其他 InertSurface / CC overlay / Rail 不动）
4. `src/components/EmployeeCenter.tsx`（仅加法：`onOpenDetail` prop + 每卡 `data-employee-detail` 按钮；Open 语义不变）
5. `src/i18n/zh-CN.ts`（+7 `employees.detail.*` 键）
6. `src/i18n/en-US.ts`（+7 `employees.detail.*` 键）
7. `scripts/capture-showcase.cjs`（新增 `employee-detail` surface + `ok` 门分支）

**红线（本阶段明确不碰）**：
- ❌ 不改 `NavigationRail`（入口已存在、不新增 Rail 项）、`EmployeeCard` / `EmployeeIdentity`（复用）、`Home` 内部结构、`CommandCenter` 内部结构、`SideNav`（保留兜底）、`App.tsx`、`types.ts` / `AgentProfile`（数据层冻结）。
- ❌ 不引入路由库 / Runtime / Agent Registry / Manager / Memory Runtime。
- ❌ 不接 chat / prompt / 文件上传 / 任务创建。
- ❌ 不新增第二套玻璃体系；保持单玻璃层（仅 TitleBar + CC 浮动层）。
- ❌ 不在 Detail 内嵌「进入/切换主角色」——那仍是 Open 路径的职责，Detail 只展示。

---

## §7 视觉与交互约束

- 风格延续 Apple / visionOS：克制、留白、圆角、`--aios-radius-*` / `--aios-motion-*`（功能运动 180–280ms 无过冲，reduced 折叠）。
- 全部消费 **E0 `--aios-*` token**；分区边框/分隔用 `--border-l1`，文字用 `--label-*`。
- 无 loop 动画；状态点复用 `EmployeeStatusIcon`。
- 返回交互：顶栏文字按钮 + Esc 关闭（Esc 清 `detailId`，焦点回 Rail 或列表首项），不依赖玻璃投影。

---

## §8 待裁定（D1–D4，审核时确认）

- **D1 详情入口语义**：推荐在每张卡**追加**一个「详情」次级按钮（与既有「查看在场状态 / Open」并列），点击设 `detailId` 并停留在 `employees` 路由内展开——**不切 Home、不切 NavRoute**。是否接受此正交双入口设计？
- **D2 详情内容来源**：推荐复用 `EmployeeIdentity variant="hero"` 作头部 + 三段 mock 区（能力 / 等级 / 成长），全部来自 Shell mock map（`SHELL_EMP_CAPS` / `SHELL_EMP_LEVEL` / 新增 `SHELL_EMP_GROWTH`）。是否接受纯展示、不接真实能力/成长探测？**推荐接受**（守红线）。
- **D3 返回行为**：推荐顶栏「返回员工中心」清除 `detailId`，回到 Employee Center 列表且 Rail `employees` 保持高亮（无路由跳转）。是否接受？
- **D4 呈现形态**：推荐在 `employees` 路由内「surface 切换」（Detail 替换 Center），而非 overlay 浮层——更简单、单玻璃纪律更易守、与 CC overlay 不冲突。是否接受？（若你想要 overlay 形态请在审核时指出。）

---

## §9 蓝图衔接

- **Stage 4（后续候选）**：Home Dock 的「快速切换」与 Employee Center 的 `focusedId` 统一为单一切换源；或把 Detail 的「在场状态」与 Home Presence 做更深联动。
- **Business Workflow Layer（远期）**：员工「进入」后可在 Home/Command Center 触发任务，但任务创建入口**不在本阶段、不在 Employee Detail**。
- **Marketplace / Memory / Projects / Settings** 仍为 `InertSurface`，与 Employee Detail 平行，互不耦合。

---

*本计划为纯设计文档，零代码改动。提交后停在审核节点，待确认后再进入 Stage 3 编码（严格按 §6 scope freeze 与 §7 红线，单 commit）。*
