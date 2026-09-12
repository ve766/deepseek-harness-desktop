# Stage 4 · AI Employee ↔ Shared Knowledge Universe — 架构入口 Mini Plan

> 状态：**设计文档（零代码）** · 审核节点 · 未编码
> 上游验收：A3 Shell Integration、Stage 2-A Employee Center、Stage 3 Employee Detail 均已通过
> 纪律：先出 Mini Plan，审核通过后才编码；本计划不实现知识宇宙本身，只规划「员工 ↔ 共享知识宇宙」的架构入口

---

## 0. 本计划回答的核心问题（用户重点审查项）

| # | 审查问题 | 本计划结论 |
|---|---------|-----------|
| Q1 | Knowledge Space / Memory / Shared Knowledge Universe 是否应为独立 Rail 目的地？ | **否**。三者不应各自成 Rail 项。`knowledge` 路由即「共享知识宇宙」唯一入口；Memory 是用户级上下文子层，不做 Rail 同级项 |
| Q2 | AI Employee 是否共享同一知识宇宙？ | **是**。单一共享宇宙，员工是图谱的 contributor/owner（`ownerAgent` 标记归属），不做员工级孤岛 |
| Q3 | 员工能力 / 记忆 / 知识资产之间的边界？ | 能力∈员工身份（mock 展示）；记忆∈用户级上下文（category）；知识资产∈共享图谱（node/edge/path）。三者正交，员工模型 ⊥ 知识宇宙，仅经只读 lens 绑定 |
| Q4 | 未来接入开源知识图谱（KG）项目的位置？ | `KnowledgeBackend` 接口（`types.ts`）+ `canvasStore(backend)` 已是引擎 seam；本计划新增的 `knowledgeUniverse` 模块是**唯一**未来换真实引擎的 import 点，UI 永不 import 具体引擎 |

---

## 1. 当前真实 Shell 架构审计（不假设已有能力）

> 所有结论来自实际读取的代码，非推测。

### 1.1 Rail 与路由（NavigationRail.tsx / MacWindowShell.tsx）

- `NavRoute` 联合：`home | employees | knowledge | memory | projects | marketplace | settings`（7 项）。
- Rail `NAV` 数组：`home`、`employees`、`knowledge`、`memory`、`projects`、`marketplace`(disabled)、`settings`。CC 按钮独立于 7 项之外（保留 no-op 唤起）。
- `knowledge` 路由当前 `default` 分支 → 渲染 `children`（即 App 传入的已进入网关的 **canvas = 知识图谱工作区**）。**所以「共享知识宇宙」已有一个目的地**，它是 canvas，不是某个待建页面。

### 1.2 知识宇宙的既有实现（已存在，本阶段不改）

- `mock/mockBackend.ts`：`class MockBackend implements KnowledgeBackend` —— 真正的种子数据源。
- `mock/bootstrap.ts`：`new MockBackend()` → `listNodes()/listEdges()` 注入 `store/canvasStore.ts`。
- `store/canvasStore.ts`：`constructor(backend: KnowledgeBackend)` + `createStore(backend)` —— 图谱状态层。
- `types.ts`：`KnowledgeBackend` 接口（`listNodes / listEdges / importSource / getNeighbors / getMemory`）已是「真实引擎替换点」。
- 结论：**宇宙本体与引擎 seam 已就位**。Stage 4 不去碰 `canvasStore` / `mockBackend` / `bootstrap`（红线）。

### 1.3 员工体系现状（已交付，本阶段不破坏）

- `AgentProfile`（`types.ts`）：`id/name/role/nameLoc/roleLoc/color/avatarUrl` —— **无任何 knowledge 字段**，保持纯洁。
- `SHELL_EMP_CAPS` / `SHELL_EMP_LEVEL` / `SHELL_EMP_GROWTH`（MacWindowShell.tsx）：纯 mock 展示数据，属员工身份层。
- `EmployeeCenterContext` / `EmployeeDetailContext`：不含任何知识宇宙字段。
- `employees` 路由：`detailId ? <EmployeeDetail> : <EmployeeCenter>`，surface 切换（非 overlay）。

### 1.4 记忆（Memory）现状

- `MemoryEntry`（`types.ts`）：`category: 'user'|'project'|'habit'|'task'`，`text: LocText` —— **用户级（OS 拥有者）上下文**，非员工级。
- `memory` 路由 → `InertSurface`（占位，未启用）。记忆与知识宇宙当前**无任何连接**。

### 1.5 关键缺口（Stage 4 要补的「架构入口」）

1. **无员工↔宇宙绑定**：`KnowledgeNode.ownerAgent?` / `LearningPath.ownerAgent?` 类型已预留，但 Shell 层从未把「某员工的归属节点」暴露出来。
2. **记忆孤儿**：Memory 既未接入宇宙，也未在任意 surface 呈现。
3. **无统一 seam 出口**：换真实 KG 引擎的 import 点散落在 `bootstrap`，没有一处被正式命名为「宇宙入口」。
4. **边界无文档化约定**：员工身份 / 用户记忆 / 共享知识三者关系仅隐含在类型里，无显式边界规则。

---

## 2. Stage 4 定位（避免 Dashboard 化）

**Stage 4 = 共享知识宇宙的「架构入口层（Architecture Seam）」，不是新功能 surface，不是 Dashboard。**

- 它**不新建任何可见 UI surface**，不新增 Rail 项，不修改 Home / Employee Center / Employee Detail 的呈现。
- 它交付一个**薄薄的架构模块** `src/knowledge/knowledgeUniverse.ts`：
  - 正式宣示「宇宙是单一共享实例」（singleton 出口）；
  - 提供 `bindEmployee(id)` → 返回**只读 lens**（`canWrite:false`），从宇宙派生该员工的归属计数，零修改 `AgentProfile`；
  - 成为未来真实 KG 引擎的**唯一 import 点**。
- 这是「埋架构入口 / 预留接缝」，符合用户要求「不直接实现；只规划架构入口；不污染当前员工体系」。

**为什么不是 Dashboard**：Dashboard 意味着在 Home 或某处堆叠知识统计卡片——这会破坏「Home=客厅 / 在场感」的既定语义。Stage 4 仅建立可被未来 surface 消费的「数据源契约」，不渲染任何聚合视图。

---

## 3. 四层职责重申（Stage 4 不改）

| 层 | 职责 | Stage 4 是否触碰 |
|---|------|----------------|
| Rail | 去哪里（go-where，扁平非玻璃） | **否**（项数与顺序不变） |
| Home | AI Employee Presence（客厅） | **否** |
| Employee Center | 员工管理空间（列表/选择） | **否** |
| Employee Detail | 员工下钻档案 | **否** |
| Command Center | 当前上下文控制（overlay） | **否** |
| **knowledge（canvas）** | **共享知识宇宙本体** | **否**（本体不改；Stage 4 只在它之外架一层只读 seam） |

---

## 4. 组件 / 模块拆分（设计，未编码）

### 4.1 新建模块（唯一新建文件）

`src/knowledge/knowledgeUniverse.ts`

```
// 架构入口：共享知识宇宙的只读 seam。
// 当前返回 Mock 数据源；未来替换为真实 KnowledgeBackend 实现的唯一位置。

export interface EmployeeKnowledgeLens {
  agentId: AgentId
  nodeCount: number        // ownerAgent === id 的节点数（只读派生）
  edgeCount: number
  pathCount: number
  ownedNodeIds: string[]   // 仅引用，不持有
  canWrite: false          // 架构保证：lens 永远只读
}

let _sharedUniverse: KnowledgeBackend | null = null
export function getSharedUniverse(): KnowledgeBackend {
  // 单一共享宇宙：始终返回同一实例
  if (!_sharedUniverse) _sharedUniverse = createMockUniverse() // 或未来 new RealKgBackend()
  return _sharedUniverse
}

export function bindEmployee(id: AgentId): EmployeeKnowledgeLens {
  const u = getSharedUniverse()
  // 仅读取，派生归属视图；绝不写回 AgentProfile / Employee*Context
  const nodes = await u.listNodes()  // 注：实际实现内联为同步 mock 派生
  const owned = nodes.filter(n => n.ownerAgent === id)
  return { agentId: id, nodeCount: owned.length, ..., canWrite: false }
}
```

设计要点：
- `getSharedUniverse()` 返回**单例** → 落实 Q2「共享同一宇宙」。
- `bindEmployee` 返回 `canWrite:false` 的纯读对象 → 落实 Q3「员工模型 ⊥ 知识宇宙，仅经只读 lens 绑定」，且**不修改任何 Employee 类型**（落实不污染）。
- 模块内部 `createMockUniverse()` 用一组带 `ownerAgent` 标签的小 fixture，**不依赖 `canvasStore`**，与 canvas 完全解耦、零风险；未来把这一行换成 `new RealKgBackend()` 即完成引擎替换（落实 Q4）。

### 4.2 接线（最小、可选）

- `MacWindowShell.tsx`：在 shell 初始化处调用一次 `getSharedUniverse()` 以「声明宇宙入口已挂载」（可仅作为模块级 side-effect 或轻量 `useEffect` 探针），**不向任何 surface 传递新知识 props**。
- 不引入 router、不新增 context provider 到 React 树（用模块单例即可，避免污染组件树与玻璃预算）。

### 4.3 不做的事（红线，同前序纪律）

- 不改 `NavigationRail` / `NavRoute` 联合（无新 Rail 项）。
- 不改 `Home` / `EmployeeCenter` / `EmployeeDetail` 内部结构或 props。
- 不改 `AgentProfile` / `EmployeeCenterContext` / `EmployeeDetailContext`（不增 knowledge 字段）。
- 不改 `canvasStore` / `mockBackend` / `bootstrap`（宇宙本体不动）。
- 不接入 Runtime / Registry / Workflow / Chat / Prompt。
- 不新增玻璃层（单玻璃纪律保持）。

---

## 5. 边界规则（写入计划的显式约定）

| 资产类 | 归属层级 | 可变方 | 与员工的关系 |
|--------|---------|--------|-------------|
| **Capability**（`SHELL_EMP_CAPS`） | 员工身份 / 展示 | Shell mock | 员工私有，mock 静态标签 |
| **Memory**（`MemoryEntry`） | 用户级（OS 拥有者）上下文 | 未来 Memory 子系统 | 与员工无关；category 维度，非 per-agent |
| **Knowledge asset**（`KnowledgeNode/Edge/LearningPath`） | 共享宇宙（集体） | 宇宙后端 | `ownerAgent` 仅标记**归属/贡献**，不隔离 |
| **EmployeeKnowledgeLens** | 派生只读视图 | `bindEmployee` | 上述三者的**桥**，仅读不写 |

**核心不变量**：`AgentProfile` 永远不含知识字段；员工对宇宙只有「只读 lens」视角；宇宙对所有员工共享同一份数据。

---

## 6. i18n 规划

Stage 4 **不新增任何 UI 文案**（无新 surface、无新按钮）。因此 **i18n 零改动**。

若未来 Stage 5+ 要在 Employee Detail 展示只读「知识贡献」lens（明确**不在本阶段范围**），届时仅新增 `employees.detail.knowledge*` 少量键，不污染 `nav.*` / `home.*`。

---

## 7. 验收断言（架构级，零功能 UI）

capture 新增 `shell-knowledge-seam` 探针（4 主题），验证「入口已埋、零污染、单玻璃不变」：

| 断言 | 期望 |
|------|------|
| `knowledgeUniverseSeam` | 1（`src/knowledge/knowledgeUniverse.ts` 存在并导出 `getSharedUniverse` + `bindEmployee`） |
| `sharedUniverseSingleton` | 1（两次 `getSharedUniverse()` 返回同一引用） |
| `employeeLensReadonly` | 1（`bindEmployee(id).canWrite === false`，且 `AgentProfile` 等未被运行时改写） |
| `noNewRailItem` | 1（Rail 项数与顺序与 Stage 3 一致：7 项，marketplace 仍 disabled） |
| `employeeTypesUnpolluted` | 1（`AgentProfile` / `EmployeeCenterContext` / `EmployeeDetailContext` 接口无 knowledge 字段增改） |
| `singleGlassUnaffected` | ok（无新玻璃层） |
| `kgIntegrationReserved` | 1（全仓仅经 `KnowledgeBackend` 接口引用后端，无具体引擎 import） |
| `cjkLeak` | false |
| `overflow` | []（现有 surface 无回归） |
| 既有 surface 无回退 | shell / shell-employee-center / shell-employee-detail / home / P3 Employee·CommandCenter·Home 全部仍 ALL_PASS |

> 注：因 Stage 4 不新增可见 surface，验收以「架构断言 + 全量回归不破」为主，符合「只规划架构入口」。

---

## 8. 文件 scope freeze

### 允许（Stage 4 编码时）
- `src/knowledge/knowledgeUniverse.ts`（**新建**，唯一新建文件）
- `src/components/MacWindowShell.tsx`（**最小**接线：声明宇宙入口已挂载，不新增 surface / 不改动点 props）
- `scripts/capture-showcase.cjs`（新增 `shell-knowledge-seam` 探针 + ok 门）

### 禁止（红线）
- `NavigationRail.tsx` / `NavRoute` 联合（不改 Rail）
- `Home.tsx` / `EmployeeCenter.tsx` / `EmployeeDetail.tsx`（不改内部结构）
- `EmployeeIdentity` / `EmployeeCard` 契约
- `types.ts` 的 `AgentProfile` / `EmployeeCenterContext` / `EmployeeDetailContext`（不加 knowledge 字段；`KnowledgeBackend` / `KnowledgeNode.ownerAgent` 等**已有**字段不挪动）
- `store/canvasStore.ts` / `mock/mockBackend.ts` / `mock/bootstrap.ts`（宇宙本体不动）
- 引入 Runtime / Registry / Workflow / Chat / Prompt / Router
- 新增玻璃层 / Dashboard 化聚合视图

### 提交纪律
- 单 commit，仅上述 3 文件（1 新建 + 2 修改）；lefthook 全过；不混入工作区 200+ 无关 harness 噪声。

---

## 9. 蓝图衔接（未来，非本阶段）

- **Stage 5（可选）**：在 Employee Detail 以只读「知识贡献」lens 呈现（经 `bindEmployee`，不污染类型）；或把 `memory` 占位升级为「用户级记忆」只读子面板。
- **引擎替换**：当接入开源 KG（如 Neo4j / Weaviate / 自研 RAG 图谱）时，仅在 `knowledgeUniverse.ts` 把 `createMockUniverse()` 换为真实 `KnowledgeBackend` 实现；canvas 与 Shell 零改动。
- **边界纪律延续**：任何「员工 × 知识」交互都经只读 lens，严禁把知识状态写回 `AgentProfile`。

---

## 10. 待裁定（D1–D3，审核时确认）

- **D1**（推荐）：Stage 4 仅交付架构 seam 模块 + 最小挂载声明，**不新增任何可见 UI**。是否同意（vs 你希望本阶段就顺带在 Employee Detail 露出只读贡献摘要）？
- **D2**（推荐）：`getSharedUniverse()` 用**模块单例**（不进 React context tree），以保持组件树纯净与玻璃预算。是否同意（vs 你偏好 Provider/Context 注入）？
- **D3**（推荐）：`bindEmployee` 的 mock 数据源**独立于 `canvasStore`**（自带小 fixture），不与 canvas 耦合。是否同意（vs 你希望 lens 直接读 canvasStore 的真实节点）？

> 若 D1 选「顺带露出来」，该可见部分将**移出本阶段 scope**，另立 Stage 5，本计划随之缩小为纯 seam。
