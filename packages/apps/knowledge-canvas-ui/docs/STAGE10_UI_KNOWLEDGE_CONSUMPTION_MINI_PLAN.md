# Stage 10 · AI Employee 知识消费 UI 层 — Mini Plan（仅设计）

> 状态：**设计文档，未编码**。Stage 9（`ce8c9a3`）已验收通过（33/33 ALL_PASS，含 capability 正交 A/B/C 三耦合点扫描）。本文停在审核节点，等待 D1–D8 裁决。
> 本文只回答「Employee Center / Detail / Shared Knowledge Space **如何展示** Knowledge Access 结果」，不新增任何后台能力、不写知识、不引入 Runtime。

---

## 0. 本计划回答的核心问题（用户重点审查项）

| # | 审查问题 | 本计划结论 |
|---|---------|-----------|
| Q1 | 在哪些 UI surface 展示 `EmployeeKnowledgeAccess` 的读投影？ | **既有三个 surface**：`EmployeeCenter`、`EmployeeDetail`、`SharedKnowledgeSpace`。不新增任何 surface。 |
| Q2 | 是否新增 Rail 项 / 新页面？ | **否**。`NavigationRail` 的 7 个 `NavRoute` 与 `NAV` 数组冻结（Stage 4 Q1 已裁定 Knowledge 即唯一宇宙入口）。 |
| Q3 | 是否引入 Chat / Agent Runtime / 自动知识消费？ | **否**。纯展示层；只读投影经 props 下发，无后台循环、无 workflow、无 agent 执行。 |
| Q4 | 是否触碰 Capability 系统 / Memory 私有化？ | **否**。Capability 保持 `EmployeeCard/Detail` 的 display-only mock；Memory 仍属用户级，绝不建 per-agent memory。 |
| Q5 | 是否改动 Stage 9 已交付的 seam？ | **否**。`EmployeeKnowledgeAccess` / `resolvePermission` / `bindEmployeeAccess` 作为只读数据源被 UI 直接消费，接口不变。 |

---

## 1. 目标与红线（Scope & Red Lines）

### 1.1 Stage 10 要解决的问题

Stage 9 交付了 `EmployeeKnowledgeAccess`（读投影 + 贡献 seam），但它是**不可见的纯能力层**——没有任何 UI 暴露其结果。员工/用户至今无法「看到」某员工对共享宇宙的贡献与可读知识。

| 缺口 | 现状 |
|---|---|
| Center 看不到知识足迹 | `EmployeeCenterEntry` 只有 `profile/status/level/capabilities`（capabilities = display-only mock），无知识维度 |
| Detail 看不到知识贡献 | `EmployeeDetailContext` 是纯 mock 展示（identity/capability/growth），无 `listOwned()` 投影 |
| Space 已有员工只读 lens | `SharedKnowledgeSpace`（Stage 5）已列出 contributing employees 并支持点击高亮，但未对接 `bindEmployeeAccess` 的投影数据 |
| 读投影无 UI 出口 | `window.__kcuKnowledgeUniverse.bindEmployeeAccess` 已就绪，但无组件消费 |

### 1.2 目标（本阶段设计范围）

1. 定义 **Employee Center 知识足迹展示**：每位员工的只读「贡献/可读」摘要。
2. 定义 **Employee Detail 知识区块**：该员工 `listOwned()` 投影（归属节点、provenance）的只读呈现。
3. 定义 **Shared Knowledge Space 对接**：复用 Stage 5 员工只读 lens，展示选中员工的 `EmployeeKnowledgeAccess` 投影。
4. 重申 **Memory / Knowledge / Capability** 三者边界在 UI 层不被破坏。

### 1.3 硬红线（Stage 10 全程不可越）

**禁止新增：**

- **新 Rail 项 / 新页面 / 新路由**：`NavRoute` 联合与 `NAV` 数组冻结（Stage 4 Q1）。
- **Chat UI**：任何 prompt / 输入框 / 对话流进入这三个 surface。
- **Agent Runtime**：后台 agent 执行循环、workflow、自动知识消费/写入、任务历史查询。
- **Capability 系统**：不建 capability 注册表 / 数据层；不把 capability 混入知识展示；`capabilities` 仍只是 `EmployeeCard/Detail` 的 display-only mock props。
- **Memory 私有化**：不建 per-agent memory store；不在员工 surface 展示「员工拥有的记忆」；若展示用户记忆，必须 `memory('user')` 且明确标注为**用户级上下文**，绝不可归因到员工。

**禁止修改：**

- `KnowledgeBackend` 接口（5 方法签名一字不动，Stage 9 红线延续）。
- `EmployeeKnowledgeAccess` / `knowledgeAccess.ts` / `employeeKnowledgeAccess.ts`（Stage 9 交付，只读消费）。
- `AgentProfile` / `AgentId` / `mock/agents.ts`。
- `EmployeeCard` / `EmployeeIdentity` 内部实现（Stage 2-A / 3 红线：只能复用，不能改）。
- `createBackend()` 唯一切换点地位与 `MockBackend` 默认回退（R7）。

**禁止引入：**

- 第二套知识存储、第二套记忆真相、capability 注册表。
- 新的 React Provider / Context 做全局知识状态（避免隐式 Runtime）；投影经**组件 props** 下发（与现有 `EmployeeCenterContext`/`EmployeeDetailContext` 的 prop-driven 模式一致）。
- 任何写/贡献 UI：`contribute` 在 Stage 10 为**纯展示只读**，写动作 UI 不在范围（延续 Stage 9 D8「权限/贡献不对用户可见」）。

**允许（编码阶段，待批准）：**

- 新增一个轻量 UI 适配层（如 `src/components/useEmployeeKnowledgeAccess.ts` hook，或 `knowledgeAccessAdapter.ts`），**仅依赖** `knowledgeUniverse` 的导出与 `EmployeeKnowledgeAccess` 类型（R6：不 import 任何 `LightRAG*`、不 import 后台实现）。
- 在 `EmployeeCenterContext` / `EmployeeDetailContext` 中**追加可选字段**（如 `knowledge?: EmployeeKnowledgeSummary`），不改动既有字段。
- 在 `SharedKnowledgeSpace` 内扩展 Stage 5 既有的员工只读 lens（只读渲染投影，不新增图渲染器、不加统计，守 Stage 5 D1/D3）。

---

## 2. 架构审计（当前 UI 真实状态）

### 2.1 NavigationRail（路由冻结）

```ts
// components/NavigationRail.tsx:24
export type NavRoute =
  | 'home' | 'employees' | 'knowledge' | 'memory'
  | 'projects' | 'marketplace' | 'settings'
// 注释明确："only edit this array + the NavRoute union; the rail layout is untouched."
const NAV: NavItemDef[] = [
  { route: 'home', ... }, { route: 'employees', ... }, { route: 'knowledge', ... },
  { route: 'memory', ... }, { route: 'projects', ... },
  { route: 'marketplace', disabled: true }, { route: 'settings', ... },
]
```

结论：`employees` 与 `knowledge` 已是两个独立目的地；Stage 10 只在这二者 + 其下的 Center/Detail/Space 内做**只读展示增强**，不新增 Rail。

### 2.2 EmployeeCenter（Stage 2-A，管理空间）

```ts
// components/EmployeeCenter.tsx
export interface EmployeeCenterEntry {
  profile: AgentProfile
  status: EmployeeStatus
  statusPhrase?: LocText
  level?: number
  capabilities?: LocText[]        // ← display-only mock，红线不可改其语义
}
export interface EmployeeCenterContext {
  entries: EmployeeCenterEntry[]
  activeId?: string
}
```

- 复用 `<EmployeeCard>`，不修改它（Stage 2-A 红线）。
- **缺口**：无知识维度。Stage 10 通过给 `EmployeeCenterEntry` 追加 `knowledge?: EmployeeKnowledgeSummary` 来呈现只读「知识足迹」。

### 2.3 EmployeeDetail（Stage 3，钻取档案）

```ts
// components/EmployeeDetail.tsx
export interface EmployeeDetailContext {
  profile: AgentProfile
  status: EmployeeStatus
  capabilities: LocText[]
  level: number
  growth: EmployeeDetailGrowthItem[]
}
```

- 纯 mock 展示（Stage 3 红线：无 Agent Runtime / 无 Memory query / 无 capability 自动探测）。
- **缺口**：无知识贡献区块。Stage 10 通过追加 `knowledge?: EmployeeKnowledgeDetail` 呈现该员工 `listOwned()` 投影（归属节点 + provenance）。

### 2.4 SharedKnowledgeSpace（Stage 5，知识图谱可视化）

```ts
// components/SharedKnowledgeSpace.tsx
// 四大只读 overlay：① Space identity header ② Knowledge graph legend
// ③ Inspector（选中节点的 source + contributor chip + relationships）
// ④ Employee readonly lens（列出 contributing employees；点击高亮其节点）
// 红线：D1 只包 canvas 不改写；D3 只读无统计；D4 高亮=store.setSelection；
//       D5 Knowledge ONLY（不带 Memory/Capability）。
```

- 已通过 `store` + `getSharedUniverse()` 消费 `KnowledgeBackend` 接口（R6 已就位）。
- **缺口**：员工只读 lens 尚未对接 `bindEmployeeAccess(id)` 的投影数据。Stage 10 在此扩展（仍只读）。

### 2.5 既有知识 seam 出口（Stage 9 已交付，可直接消费）

```ts
// knowledge/knowledgeUniverse.ts
export function bindEmployeeAccess(id: AgentId): EmployeeKnowledgeAccess
export function resolvePermission(id: AgentId): KnowledgePermission
// window.__kcuKnowledgeUniverse.{ getSharedUniverse, bindEmployee, createBackend,
//   resolveLightRAGConfig, isScrapingEnabled, bindEmployeeAccess, resolvePermission }
```

```ts
// knowledge/lens/employeeKnowledgeAccess.ts
export interface EmployeeKnowledgeAccess {
  readonly agentId: AgentId
  readonly permission: KnowledgePermission
  readonly canWrite: boolean
  listOwned(): Promise<KnowledgeNode[]>      // L1：ownerAgent === self
  listAll(): Promise<KnowledgeNode[]>        // L0：全域（Shared 默认全域可读）
  query(seedNodeId, text, opts?): Promise<NeighborHit[]>  // L2：邻居投影
  memory(category?: MemoryCategory): Promise<MemoryEntry[]>  // 用户级只读
  summary(): Promise<{ agentId; nodeCount; edgeCount; ownedNodeIds; canWrite: false }>
  contribute(src): Promise<ContributionResult>   // ← Stage 10 不暴露为 UI
}
```

结论：UI 层只需**只读消费** `summary()` / `listOwned()` / `query()`（只读投影），完全不需要触碰贡献/写路径。

---

## 3. UI 消费层设计（焦点 1–3）

### 3.1 核心判断：UI 是投影的「渲染器」，不是数据源

```
EmployeeKnowledgeAccess(id)          ← Stage 9 seam（只读投影，单例 universe）
        │  summary() / listOwned() / query()
        ▼
useEmployeeKnowledgeAccess(id) hook  ← 新增轻量适配层（仅依赖 knowledgeUniverse）
        │  返回只读投影对象
        ▼
EmployeeCenter / EmployeeDetail / SharedKnowledgeSpace   ← 经 props 下发渲染
```

- hook 在**浏览器（window）上下文**运行；SSR/测试环境用 `typeof window` 守卫（与 Stage 4/8/9 一致），无 window 则投影为空数组（不崩）。
- hook **只调用** `bindEmployeeAccess` 的读方法；绝不调用 `contribute`、绝不 import `LightRAG*`、绝不 import `AgentProfile` 展示字段（Employee ⊥ Knowledge）。

### 3.2 三个 surface 的展示契约

| Surface | 展示内容（只读） | 数据来源 | 新增字段 |
|---|---|---|---|
| **EmployeeCenter** | 每人「知识足迹」摘要：归属节点数（`summary().nodeCount`）、贡献状态（`ownedNodeIds.length`）、权限等级徽标（`permission`） | `bindEmployeeAccess(id).summary()` | `EmployeeCenterEntry.knowledge?: { ownedCount: number; permission: KnowledgePermission }` |
| **EmployeeDetail** | 该员工 `listOwned()` 投影：归属节点列表（title/source/contributor chip/aiStatus），点击可在 Space 高亮 | `bindEmployeeAccess(id).listOwned()` | `EmployeeDetailContext.knowledge?: { nodes: KnowledgeNode[]; permission }` |
| **SharedKnowledgeSpace** | 复用 Stage 5 员工只读 lens；选中某员工时，渲染其 `listOwned()` 投影（只读列表 + provenance），点击节点走既有 `store.setSelection` 高亮 | `bindEmployeeAccess(id).listOwned()` + 既有 canvas | 扩展既有 lens（无新渲染器） |

### 3.3 渲染约束（不可违反）

1. **只读**：所有展示来自 `summary()` / `listOwned()` / `query()`；无任何写按钮、无 `contribute` 入口。
2. **引用而非统计**：节点列表、contributor chip、relationships（与 Stage 5 D3 一致），**禁止**聚合统计（count 数字除外，那是 `summary().nodeCount` 已提供的轻量指标）。
3. **不混淆三者**：知识足迹区域与 `capabilities` mock 区域**物理分离**（不同 UI 区块、不同数据源）；绝不把 `capabilities` 当作知识指标。
4. **Memory 不入场**：三个 surface 均**不展示 per-agent memory**；若后续确需「用户上下文」提示，须 `memory('user')` 且明确标注用户级——本计划默认**不展示 Memory**，以干净守住在「Memory 私有化禁止」。
5. **Capability 不入场**：知识展示不使用 `capabilities` 字段；权限等级徽标（`permission`）来自 `resolvePermission`，是**知识访问权限**，与员工能力（capability）语义正交，UI 上分开展示。

---

## 4. 数据流与适配层（焦点 4）

### 4.1 适配层形态（示意，编码阶段落地）

```ts
// src/components/useEmployeeKnowledgeAccess.ts（新增，编码阶段）
import { bindEmployeeAccess, type EmployeeKnowledgeAccess } from '../knowledge/knowledgeUniverse'

export interface EmployeeKnowledgeProjection {
  agentId: AgentId
  permission: KnowledgePermission
  ownedCount: number
  ownedNodeIds: readonly string[]
  /** 轻量摘要；完整节点列表按需由 listOwned() 拉取 */
  ownedNodes: KnowledgeNode[]
}

export function useEmployeeKnowledgeAccess(id: AgentId): EmployeeKnowledgeProjection | null {
  // 浏览器上下文才消费；SSR/测试返回 null（不崩）
  if (typeof window === 'undefined') return null
  // 同步包装：bindEmployeeAccess 返回同步对象，读方法为 async；
  // 组件内用 useEffect+state 拉取 summary()/listOwned()。
  const access = bindEmployeeAccess(id)
  return { agentId: access.agentId, permission: access.permission, /* ... */ } as EmployeeKnowledgeProjection
}
```

- 该 hook **仅 import `knowledgeUniverse`**（其导出已含 `bindEmployeeAccess` + 类型），不触达 `LightRAG*`、不触达后台实现（R6）。
- 组件侧保持 **prop-driven**：`EmployeeCenter` / `EmployeeDetail` 通过既有 `Context` 的追加可选字段接收投影，或由容器组件调用 hook 后注入——**不引入新的全局 Provider**（避免隐式 Runtime）。

### 4.2 MacWindowShell 是否需改？

- **不需要**。`MacWindowShell` 已 `import { getSharedUniverse }` 并作为 singleton 入口；UI 适配层直接消费 `knowledgeUniverse` 导出，不经过 Shell 中转。
- 仅当决定「在 Shell 层预拉投影并注入 Context」时才动 Shell，但本计划**推荐**组件级 hook（最小化改动面，避免新增全局状态）。

---

## 5. Memory / Knowledge / Capability 边界在 UI 层重申

| 概念 | UI 层处理 | 违规示例（禁止） |
|---|---|---|
| **Memory** | 不展示；若展示须 `memory('user')` 且标注用户级 | 展示「员工记忆」「员工 habit」→ 私有化，禁止 |
| **Knowledge** | 三 surface 只读投影（`summary/listOwned/query`） | 写按钮、贡献入口、统计大盘 → 禁止 |
| **Capability** | 保持 `EmployeeCard/Detail` 的 `capabilities` mock；与知识区块物理分离 | 把 capabilities 当知识指标、混入知识展示 → 禁止 |

UI 层**不引入**三者之间的 import：组件不 import capability 注册表（不存在）、不把 Memory 写入知识结构、不把 Knowledge 当作 Capability 来源。

---

## 6. 禁止项明细（与用户指令对齐）

| 禁止项 | 含义 | 本计划处理 |
|---|---|---|
| 新 Rail | 不增 `NavRoute`/不增 `NAV` 项/不增页面 | 仅在 `employees` + `knowledge` 既有 surface 内增强 |
| Chat UI | 无 prompt/输入/对话 | 三 surface 纯展示，无会话 |
| Agent Runtime | 无后台循环/workflow/自动消费 | 仅同步读投影，无 agent 执行 |
| Capability 系统 | 无注册表/无数据层/不混入知识 | capabilities 维持 mock；知识区块独立 |
| Memory 私有化 | 无 per-agent memory/无员工记忆展示 | 不展示；若展示须用户级且标注 |

---

## 7. 边界对照 + 验收规划

### 7.1 边界对照表（编码后需逐条验证）

| 约束 | 编码后必须成立 |
|---|---|
| 无新 Rail | `NavigationRail.tsx` 的 `NavRoute` 联合与 `NAV` 数组字节级不变 |
| 无 Chat | 三个 surface 组件内无 `<input>`/对话状态/发送逻辑 |
| 无 Agent Runtime | 无 `setInterval`/后台 fetch 循环/agent 执行；投影为同步或单次 effect 拉取 |
| 无 Capability 系统 | 无 capability 注册表文件；知识区块不读 `capabilities` |
| 无 Memory 私有化 | 无 per-agent memory 结构；不展示员工记忆 |
| R6 隔离 | `useEmployeeKnowledgeAccess` 不 import 任何 `LightRAG*`、不 import 后台实现 |
| Employee ⊥ Knowledge | 适配层不 import `AgentProfile` 展示字段；只依赖 `AgentId` + `EmployeeKnowledgeAccess` 类型 |
| Stage 5 红线 | `SharedKnowledgeSpace` 仍 wraps canvas、只读、无新渲染器、无统计 |
| Stage 2-A/3 红线 | `EmployeeCard`/`EmployeeIdentity` 内部未改；只复用 |
| 只读 | 三 surface 无 `contribute` 调用、无写按钮 |

### 7.2 验收断言（编码阶段目标）

**5 项强制断言（用户 D5 点名，缺一则 Stage 10 验收不通过）：**

```
noNewRailItem=true               # NavigationRail 的 NavRoute 联合 + NAV 数组字节级不变；无新页面/路由
noEmployeeCardContractChange=true  # EmployeeCard / EmployeeIdentity 内部实现与 props 契约未改动（仅复用）
noKnowledgeBackendChange=true   # KnowledgeBackend 5 方法接口签名未变；EmployeeKnowledgeAccess 只读消费
noMemoryLeak=true                # 无 per-agent memory 结构、无员工记忆展示、无内存泄漏（投影 useEffect 清理）
noCapabilityCoupling=true        # 知识区块不 import/读取/显示 capability；capability 仍仅 EmployeeCard/Detail mock
```

**补充断言（守住其余红线）：**

```
employeeCenterShowsKnowledge=true  # EmployeeCenterEntry.knowledge 被渲染（只读摘要）
employeeDetailShowsOwned=true      # EmployeeDetail 只读列出 listOwned() 节点 + provenance
spaceLensUsesProjection=true       # SharedKnowledgeSpace 员工 lens 对接 bindEmployeeAccess（只读）
capabilityUntouched=true           # capabilities 仍仅 mock，未与知识混合
memoryNotPrivatized=true           # 无 per-agent memory 结构/展示
noChatNoRuntime=true                # 无输入/对话/后台循环
dataFromAccessOnly=true            # 所有展示数据来自 EmployeeKnowledgeAccess；无组件直接读 backend
adapterR6Isolated=true             # 适配层不 import LightRAG*/后台实现
readOnlySurface=true               # 无 contribute/写按钮
oxlintClean=true                   # .oxlintrc.staged.json 0w/0e
```

### 7.3 验证方式

- 复用 Stage 9 的 capture 探针：`window.__kcuKnowledgeUniverse.bindEmployeeAccess('nox')` 在浏览器中返回投影，UI 组件读取并渲染。
- `oxlint --config .oxlintrc.staged.json --fix` 零错误。
- 视觉冒烟（P3Showcase / 手动）：Center 显示知识足迹、Detail 显示归属节点、Space 员工 lens 高亮其节点。
- 红线 grep 断言：`NavigationRail.tsx` 的 `NAV`/`NavRoute` 与基线一致；组件无 `<input` 会话；适配层 import 集合 ⊆ `{ knowledgeUniverse, react, 既有 ui 组件 }`。

---

## 8. Scope Freeze + 待裁决 D1–D8

### 8.1 Scope Freeze

本文为**设计文档**：本轮不修改任何 `.tsx` / `.ts` / 配置 / 依赖。落地需 D1–D8 裁决后另起编码 commit（且编码 commit 也必须**单 commit、仅目标文件、不混 harness 噪声**，与 Stage 9 一致）。

### 8.2 D1–D5 设计裁决（用户审查项，本计划直接作答）

**D1 · EmployeeCenter 只增加只读 Knowledge 摘要入口？**
✅ **是，仅摘要，不展示真实检索界面。**
- 给 `EmployeeCenterEntry` 追加可选字段 `knowledge?: { ownedCount: number; permission: KnowledgePermission }`（来自 `summary().nodeCount` / `ownedNodeIds.length`）。
- 在既有卡片布局内渲染只读摘要（如「贡献 N 节点 · 权限：contribute」），**不引入搜索框、不引入查询面板、不暴露 `query()` 交互界面**；`query()` 仅在 Detail / Space 的「点选节点→高亮」链路内被间接使用，不在 Center 暴露。

**D2 · EmployeeDetail 增加 Knowledge section？仅展示 owned contributions / related count / source/provenance？**
✅ **是，且明确不展示私有库 / memory / capability。**
- 给 `EmployeeDetailContext` 追加可选字段 `knowledge?: { nodes: KnowledgeNode[]; permission }`，由 `listOwned()` 投影填充。
- 只读呈现：① 归属贡献节点列表（title + source chip + contributor chip = provenance）② related knowledge count（`summary().nodeCount` 或邻居计数）③ source / provenance 标签。
- **禁止展示**：agent 私有知识库（不存在、且红线禁止）、Memory（§D5）、Capability 数据（capabilities 字段留在卡片其他区块，物理分离）。

**D3 · SharedKnowledgeSpace 保持现有 overlay？只增强 lens 信息展示，不改 canvas 架构？**
✅ **是，overlay 不变，仅增强员工只读 lens 信息。**
- 复用 Stage 5 的四大只读 overlay（identity header / legend / inspector / employee readonly lens）；在「employee readonly lens」内扩展：选某员工时，额外渲染其 `listOwned()` 投影（只读列表 + provenance），点击节点仍走既有 `store.setSelection` 高亮。
- **不变**：canvas 渲染架构、渲染器、统计逻辑（守 Stage 5 D1/D3）；不新增图渲染器、不新增统计大盘。

**D4 · 所有数据必须来自 EmployeeKnowledgeAccess，禁止直接读取 backend？**
✅ **是，单一只读数据源。**
- 新增适配层 `useEmployeeKnowledgeAccess(id)` **仅 import `knowledgeUniverse`**（其导出含 `bindEmployeeAccess`），只读调用 `summary()` / `listOwned()` / `query()`。
- **禁止**任何组件直接 `import { createBackend }` / 直接消费 `KnowledgeBackend` 实例 / 直接读 `MockBackend` / `LightRAG*`；组件只接收 `EmployeeKnowledgeAccess` 投影（prop-driven）。
- R6 隔离：适配层不 import 任何 `LightRAG*`、不 import 后台实现。

**D5 · 验收必须包含 5 项断言？**
✅ **是，已在 §7.2 列为强制断言（缺一则不通过）：**
`noNewRailItem`、`noEmployeeCardContractChange`、`noKnowledgeBackendChange`、`noMemoryLeak`、`noCapabilityCoupling`。
补充：Memory 不私有化（无 per-agent memory 结构 / 无员工记忆展示 / 投影 `useEffect` 清理无泄漏）；Capability 与知识区块零耦合（不 import / 不读取 / 不显示）。

### 8.3 三项守卫裁决（延续红线）

| # | 议题 | 结论 |
|---|---|---|
| **D6** | Capability 隔离 | 知识区块与 `capabilities` 物理分离、独立数据源；不把 capabilities 当知识指标 |
| **D7** | 写/贡献 UI | Stage 10 纯展示只读，无 `contribute` 按钮（延续 Stage 9 D8；写 UI 留后续 Stage） |
| **D8** | 新 Rail / Chat / Runtime | 全部禁止，守住红线，零例外（与用户指令一致） |

### 8.3 建议的编码范围（若 D1–D8 按建议通过）

1. 新增 `src/components/useEmployeeKnowledgeAccess.ts`（轻量 hook，仅依赖 `knowledgeUniverse`）。
2. `EmployeeCenter.tsx` / `EmployeeCenterContext`：追加可选 `knowledge?` 字段并渲染只读摘要（不改 `EmployeeCard`）。
3. `EmployeeDetail.tsx` / `EmployeeDetailContext`：追加可选 `knowledge?` 字段并渲染 `listOwned()` 只读区块。
4. `SharedKnowledgeSpace.tsx`：扩展 Stage 5 员工只读 lens，对接 `bindEmployeeAccess(id)` 投影（只读、无统计）。
5. `oxlint` 全过 + 红线 grep 断言通过 + 视觉冒烟。
6. 单 commit，仅上述文件，不混 harness 噪声。

---

**结论**：Stage 10 不改变「知识怎么被员工用起来」的能力层（Stage 9 已交付 seam），而是把**只读投影结果**呈现在**既有的** Employee Center / Detail / Shared Knowledge Space 中——不新增 Rail、不引入 Chat、不引入 Agent Runtime、不触碰 Capability 系统、不私有化 Memory。全程复用既有 surface 与 Stage 5 只读 lens，零新增数据源、零写入口、零类型修改。
