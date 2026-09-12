# Stage 9 · AI Employee 如何消费 Shared Knowledge Universe — Mini Plan（仅设计）

> 状态：**设计文档，未编码**。Stage 8（`5763205`）已验收，本文停在审核节点，等待 D1–D8 裁决。
> 本文只回答「Employee 如何**读 / 贡献 / 被授权**共享知识」，不继续扩 backend。

---

## 1. 目标与红线（Scope & Red Lines）

### 1.1 Stage 9 要解决的问题

Stage 4–8 建立了 Shared Knowledge Universe 的**供给侧**（seam → adapter → LightRAG → ingestion），但消费侧仍然空缺：

| 缺口 | 现状 |
|---|---|
| Employee 读不到知识 | `bindEmployee()` 只返回 `nodeCount / edgeCount / ownedNodeIds`，**没有任何内容读取方法** |
| Employee 无法检索 | `getNeighbors(nodeId, text)` 存在，但**没有 agent 维度**、没有 lens 级入口 |
| 贡献无归属、无流程 | 只有 `importSource(src)`（无 agent）；Stage 7 的 `importSourceAs` 是**接口外**扩展，UI 不可见 |
| Memory 归属模糊 | `getMemory()` 是全局的，Employee 与 Memory 的关系未定义 |
| Capability 与 Knowledge 混淆 | `capabilities` 目前是 `EmployeeCard` 的 display-only mock props，边界未声明 |
| 无权限模型 | 全仓零 permission 概念（`grep permission` 无实现命中） |

### 1.2 目标（本阶段设计范围）

1. 定义 **Employee → Knowledge 读路径**（不创建新存储、不复制知识）。
2. 定义 **Agent Knowledge Lens** 的形态与能力边界。
3. 划清 **Memory / Knowledge / Capability** 三者边界（正交性声明）。
4. 定义 **AI Employee 贡献知识**的入口、归属与生命周期。
5. 定义 **权限模型** `read-only / contribute / owner`，并确定策略存放位置。

### 1.3 硬红线（Stage 9 全程不可越）

**禁止修改：**

- `KnowledgeBackend` 接口（5 方法签名一字不动）
- `KnowledgeNode` / `KnowledgeEdge` / `MemoryEntry` / `Relationship` 类型
- Employee 体系：`AgentId`、`AgentProfile`、`mock/agents.ts` 数据
- UI surface：`Home` / `EmployeeCenter` / `EmployeeDetail` / `EmployeeCard` / `NavigationRail` / `SharedKnowledgeSpace`
- `createBackend()` 的唯一切换点地位与 `MockBackend` 默认回退（R7）
- LightRAG 的隔离边界（R6）

**禁止引入：**

- Neo4j / Memgraph / LlamaIndex / Agent runtime / workflow / 自动知识消费 / 自动知识写入
- 第二套知识存储（lens 是**投影**，不是副本）
- 后端内部的权限判断代码（见 D7）
- 新的 Rail 项或新页面

**允许（编码阶段，待批准）：**

- 新增 `src/knowledge/lens/` 模块（lens + 权限 gate + 贡献入口）
- 在 `knowledgeUniverse.ts` **追加导出**新函数（不改已有导出契约）
- 新增 capture 探针断言

---

## 2. 架构审计（当前状态）

### 2.1 现有 Employee 相关模型

```ts
// src/types.ts
export type AgentId = 'assistant' | 'nox' | 'knowledge' | 'task'      // 行 15

export interface AgentProfile {                                        // 行 183
  id: AgentId
  name: string
  role: string
  nameLoc?: LocText
  roleLoc?: LocText
  color: string
  avatarUrl?: string
}
```

审计结论：

- `AgentProfile` **没有** capability 字段、**没有** permission 字段 → 权限不能塞进 `AgentProfile`（红线）。
- `capabilities?: LocText[]` 只存在于 `EmployeeCard` / `EmployeeDetail` 的 **props**，且注释明确标注 *display-only mock*（`EmployeeCard.tsx:75`）。
- `mock/agents.ts` 定义 4 名员工：`assistant`(田园犬/默认助手)、`nox`(黑猫/研究)、`knowledge`(布偶猫/知识管家)、`task`(边牧/任务)。

### 2.2 现有 Lens（`knowledgeUniverse.ts:31`）

```ts
export interface EmployeeKnowledgeLens {
  agentId: AgentId
  nodeCount: number
  edgeCount: number
  readonly ownedNodeIds: readonly string[]
  readonly canWrite: false          // ← 字面量类型，写死只读
}
```

`bindEmployee(id)`（行 107）实现：

```ts
const [nodes, edges] = await Promise.all([universe.listNodes(), universe.listEdges()])
const owned = nodes.filter(n => n.ownerAgent === id)
```

审计结论与缺口：

| 维度 | 评价 |
|---|---|
| 只读保证 | ✅ `canWrite: false` 类型级保证 |
| 归属判定 | ✅ 通过 `ownerAgent` 过滤 |
| **内容读取** | ❌ 只给 id 数组，Employee 拿不到节点内容 |
| **语义检索** | ❌ 未使用 `getNeighbors(nodeId, text)` |
| **Memory** | ❌ 未接入 `getMemory()` |
| **贡献** | ❌ 完全缺失 |
| **权限** | ❌ 无（只有 `canWrite:false` 一个常量） |

### 2.3 现有 Backend 接口（`types.ts:165`）

```ts
export interface KnowledgeBackend {
  listNodes(): Promise<KnowledgeNode[]>
  listEdges(): Promise<KnowledgeEdge[]>
  importSource(src: SourceRef): Promise<{ nodeId: string }>
  getNeighbors(nodeId: string, text: string): Promise<{ nodeId: string; score: number; reason: string }[]>
  getMemory(): Promise<MemoryEntry[]>
}
```

关键约束：**5 个方法全部没有 `agentId` 参数**。这意味着：

- 任何「按员工区分」的语义都**必须在接口之外**构造（lens / gate / side-map），**不得**给接口加参数。
- 这与 Stage 7 的 `importSourceAs(src, ownerAgent)` 思路一致 —— **接口外扩展**是本项目已确立的模式。

### 2.4 现有 Memory / Capability 落点

| 概念 | 当前位置 | 归属 |
|---|---|---|
| Memory | `backend.getMemory()` → `MemoryEntry{id, category:'user'\|'project'\|'habit'\|'task', text}` | **全局**，无 agent 维度 |
| Knowledge | `backend.listNodes()/listEdges()` → `KnowledgeNode.ownerAgent?` | 共享宇宙，可归属 |
| Capability | `EmployeeCard/EmployeeDetail` 的 `capabilities?: LocText[]` props | **display-only mock**，无数据层 |

---

## 3. Employee → Knowledge Read Path（焦点 1）

### 3.1 核心判断：Shared Universe 是单一事实源，lens 是投影

**原则：Employee 不拥有知识的副本。** Universe 只有一份（`getSharedUniverse()` 单例），lens 只是：

```
Shared Knowledge Universe (唯一事实源)
        │
        │  listNodes / listEdges / getNeighbors / getMemory
        ▼
  EmployeeKnowledgeLens(agentId)     ← 过滤 + 排序 + 只读投影
        │
        ▼
   Employee 消费（读）
```

- lens **不缓存**、**不复制**、**不写回**。
- lens 的所有读取**必须**经由 `KnowledgeBackend` 5 方法，禁止绕过（D3 既有约束）。
- 因此 Employee 读路径天然与 backend 实现解耦：Mock / InMemory / LightRAG HTTP 三态下行为一致。

### 3.2 读路径分层（3 个层次）

| 层 | 语义 | 数据源 | 是否区分 agent |
|---|---|---|---|
| **L0 全域读** | Universe 全部节点/边 | `listNodes()` / `listEdges()` | 否（共享） |
| **L1 归属读** | `ownerAgent === self` 的节点 | L0 过滤 | ✅ 是 |
| **L2 语义检索** | 给定文本找相关节点 | `getNeighbors(nodeId, text)` | 否（检索本身共享），但**可限定在 L1 作用域内** |

设计要点：**L2 检索接口没有作用域参数**，所以「在员工作用域内检索」必须由 lens 实现：
先取 L1 作用域节点 id 集合 → 对 `getNeighbors` 结果做**交集过滤**。这是纯 lens 侧逻辑，不触碰接口。

### 3.3 Employee 能否读「别人」的知识？

这是 Stage 9 必须裁决的语义问题（见 D2）：

- **方案 A（推荐）：全域可读。** Universe 被定义为 *Shared*，所有员工默认可读全部知识；`ownerAgent` 只表示**贡献归属**，不构成访问隔离。
  - 理由：与「Shared Knowledge Universe」命名一致；避免提前引入多租户隔离复杂度；`getNeighbors` 的语义检索价值依赖全图。
- **方案 B：按归属分区。** 员工默认只读自己的 + 显式共享的。
  - 代价：需要新增「共享标记」概念（现有 `KnowledgeNode` 无此字段，且禁止改类型 → 只能复用 `meta` 自由字段，语义隐晦）。

**推荐 A**。`ownerAgent` 保持**归属语义（attribution）**，不承担**隔离语义（isolation）**。隔离若将来需要，应作为独立 Stage 引入显式 ACL，而非复用归属字段。

### 3.4 Memory 在 Employee 读路径中的角色（详见第 5 节）

Employee **可以读** Memory 作为上下文，但：

- Memory 属于**用户（human）**，不属于员工；
- Employee **永不写** Memory（R5 延伸）；
- `getMemory()` 无 agent 参数 → lens 只能**全量读 + 按 category 客户端过滤**。

---

## 4. Agent Knowledge Lens 设计（焦点 2）

### 4.1 关键决策：不修改 `EmployeeKnowledgeLens`，新增兄弟接口

`EmployeeKnowledgeLens` 的 `canWrite: false` 是**字面量类型**，且已被 Stage 4/7/8 的验收断言依赖。若把它放宽为 `boolean`，会破坏既有只读契约的类型级保证。

**方案：加性扩展** —— 保留 `EmployeeKnowledgeLens` 原样（作为「只读摘要 lens」，向后兼容），新增 `EmployeeKnowledgeAccess` 作为完整访问面。

```ts
// 新增（示意，编码阶段落地）
export type KnowledgePermission = 'read' | 'contribute' | 'own'

export interface EmployeeKnowledgeAccess {
  readonly agentId: AgentId
  readonly permission: KnowledgePermission
  /** 由 permission 派生：'read' → false；'contribute'/'own' → true */
  readonly canWrite: boolean

  // ---- 读（全部委派给 KnowledgeBackend，纯投影）----
  /** L1：本人贡献/拥有的节点（ownerAgent === agentId） */
  listOwned(): Promise<KnowledgeNode[]>
  /** L0：全域节点（Shared Universe 默认全域可读，D2-A） */
  listAll(): Promise<KnowledgeNode[]>
  /** L2：语义检索，可选限定在本人作用域内 */
  query(text: string, opts?: { scope?: 'owned' | 'all' }): Promise<NeighborHit[]>
  /** Memory：只读用户记忆作为上下文，可按 category 过滤 */
  memory(category?: MemoryCategory): Promise<MemoryEntry[]>
  /** 只读摘要（与旧 EmployeeKnowledgeLens 等价，供兼容） */
  summary(): Promise<EmployeeKnowledgeLens>

  // ---- 贡献（受 gate 约束，见第 6/7 节）----
  contribute(src: SourceRef): Promise<ContributionResult>
}
```

### 4.2 Lens 的实现约束（不可违反）

1. **只调 5 方法**：`listNodes` / `listEdges` / `getNeighbors` / `getMemory` / （贡献时）`importSource`。
2. **无状态或最小状态**：lens 不持有节点副本；每次读取重新走 backend（保证共享宇宙的实时性）。
3. **不 import 任何 backend 实现类**：lens 只依赖 `KnowledgeBackend` 接口类型 —— 换 LightRAG / Mock 对 lens 零影响（R6/R7）。
4. **不 import Employee UI 组件**：lens 只依赖 `AgentId`，不依赖 `AgentProfile` 的展示字段（Employee ⊥ Knowledge）。

### 4.3 作用域过滤的实现（不改接口）

```ts
// L2 语义检索限定作用域：lens 侧过滤，接口侧无感
async query(text, opts) {
  const hits = await backend.getNeighbors(seedNodeId, text)   // 接口无 scope 参数
  if (opts?.scope === 'owned') {
    const owned = new Set((await this.listOwned()).map(n => n.id))
    return hits.filter(h => owned.has(h.nodeId))
  }
  return hits
}
```

> ⚠️ 注意 `getNeighbors(nodeId, text)` 需要一个**种子 nodeId**。员工级「凭空检索」没有直接接口支持。
> 设计取舍（编码阶段两种做法，见 D1）：
> - **a) 以员工首个 owned 节点为种子**（简单，语义弱）
> - **b) 对每个 owned 节点并发检索后归并重排**（语义好，成本 O(n) 请求）
> - **c) 暂不提供 lens 级自由检索**，仅提供「给定节点找邻居」（最保守，零新语义）
>
> **推荐 c → 后续需要时再上 b**，避免原型期制造伪语义。

### 4.4 Window 探针扩展（capture 用）

`window.__kcuKnowledgeUniverse` 追加（不改已有字段）：

```
+ bindEmployeeAccess: (id: AgentId) => Promise<EmployeeKnowledgeAccess>
+ resolvePermission:  (id: AgentId) => KnowledgePermission
```

---

## 5. Memory / Knowledge / Capability 三者边界（焦点 3）

### 5.1 正交性声明（Stage 9 的核心产出）

| | **Memory** | **Knowledge** | **Capability** |
|---|---|---|---|
| **属于谁** | 用户（human） | 共享宇宙（可归属 ownerAgent） | 员工自身 |
| **存哪里** | `memoryProvider`（R5：委派，绝不入图） | `KnowledgeBackend`（Mock / LightRAG 图） | 员工档案 / 注册表（**不在 backend**） |
| **进 KG 吗** | ❌ **永不**（R5） | ✅ 是 | ❌ 永不 |
| **谁可写** | 用户 / 系统 | `importSource(As)`（含员工贡献） | 配置 / 注册表 |
| **员工权限** | **只读**（作上下文） | 读 + 授权后贡献 | 只读展示 |
| **生命周期** | 长期、可增删 | 导入 → draft/auto → 人工确认 → confirmed | 随员工配置变更 |
| **当前代码位置** | `backend.getMemory()` | `backend.listNodes()/listEdges()` | `EmployeeCard.capabilities`（display-only） |

**三者禁止互相 import**：

- `knowledge/` 模块不得引入 capability 概念；
- capability 不得写入 `KnowledgeNode`；
- Memory 不得进入任何图结构（`LightRAGBackend` 已用 `memoryProvider` 委派实现 R5，Stage 7/8 已验证）。

### 5.2 Memory 边界细化

- Memory 是**用户级**的：`getMemory()` 无参数，返回用户全部记忆。
- Employee **消费** Memory 是为了「理解用户」，而不是「拥有记忆」。
- **不引入 per-agent memory store**（会创造第二套记忆真相，且与 R5 冲突）。
- 若将来需要「员工记住与某用户的协作偏好」，正确做法是**写入 Knowledge（作为节点，ownerAgent=该员工）**，而非新增 Memory 分类。

### 5.3 Capability 边界细化

- Capability = **员工能做什么**（技能/等级），与「知识库里有什么」正交。
- 现状 `capabilities?: LocText[]` 是 display-only props，**Stage 9 建议保持 display-only**（见 D4）。
- 若将来要做「能力驱动的知识推荐」（如 Nox 的研究能力 → 推荐深读），正确做法是 **lens 侧读取 capability 做排序**，而不是把 capability 写进 backend 或 KnowledgeNode。

---

## 6. AI Employee 如何贡献知识（焦点 4）

### 6.1 贡献入口：受 gate 保护的 `contribute(src)`

```ts
type ContributionResult =
  | { ok: true; nodeId: string; status: AiStatus }      // 'draft' | 'auto'
  | { ok: false; reason: 'permission-denied' | 'backend-unsupported' | 'ingest-failed' }
```

调用链（**不改接口**）：

```
Employee.contribute(src)
   ↓  gate: permission !== 'read' ?
   ↓  backend 是否支持归属写入？
   ├── 是 → backend.importSourceAs(src, agentId)     // Stage 7 接口外扩展
   └── 否 → backend.importSource(src)                // 优雅降级：无归属
   ↓  返回 nodeId
   ↓  provenance 记录（见 6.2）
```

关键设计：

- **员工永远不直接调用 `importSource`**，一律走 gate → 保证权限与归属不被绕过。
- 降级策略：MockBackend 不支持 `importSourceAs` 时，退化为 `importSource`，并在结果中标注 `ownerAttribution: 'unsupported'`（**不静默丢失语义**）。

### 6.2 归属与 provenance（不改 `KnowledgeNode` 类型）

`KnowledgeNode` 已具备的承载位：

| 字段 | 用途 |
|---|---|
| `ownerAgent?: AgentId` | **主归属**：贡献者（lens 的 `listOwned()` 依据） |
| `aiStatus?: 'draft' \| 'confirmed' \| 'auto'` | **贡献状态**：AI 产出标 `auto`/`draft`，人工确认后转 `confirmed` |
| `source?: SourceRef` | 来源可追溯 |
| `meta: Record<string, string>` | **自由字段**：可承载 `contributedBy` / `contributedAt` / `contributionId`（无需改类型） |

> ✅ 结论：**provenance 三元组 = `ownerAgent` + `aiStatus` + `source`**，`meta` 作为补充通道。全程零类型修改。

### 6.3 贡献生命周期（推荐，见 D6）

```
[员工提出]  contribute(src)
     ↓
[写入]     节点进入宇宙，aiStatus = 'auto'（AI 自动关联）/ 'draft'（AI 生成未确认）
     ↓
[人工确认]  aiStatus → 'confirmed'（用户拥有）
     ↓
[归属]     ownerAgent 保持不变 → 贡献者永久可追溯
```

- **默认不自动 confirmed**：AI 贡献一律先落 `auto`/`draft`，避免 AI 产出污染用户确认知识（与「知识质量优先」原则一致）。
- 员工**不能**修改/删除他人节点（lens 无写接口除 `contribute`）。
- 「自动知识写入」明确**不在 Stage 9 范围**（用户在 Stage 8 验收时已列为暂不进入项）。

### 6.4 贡献示例（示意）

```
nox.contribute({ type: 'url', uri: 'https://.../graphrag.pdf' })
  → gate: permission('nox') = 'contribute' ✅
  → LightRAGBackend.importSourceAs(src, 'nox')
  → ingestSource(src) → client.insert → 抽取 → 图节点 src:<hash>
  → 节点 ownerAgent='nox', aiStatus='auto', source=src
  → { ok: true, nodeId: 'src:7f8fbb99', status: 'auto' }
```

---

## 7. 权限模型 read-only / contribute / owner（焦点 5）

### 7.1 权限等级定义

| 等级 | 含义 | 读 | 贡献 | 归属 | 典型对象 |
|---|---|---|---|---|---|
| **`read`**（默认） | 只读消费共享宇宙 | ✅ 全域 | ❌ | — | 所有员工默认 |
| **`contribute`** | 可导入新知识 | ✅ 全域 | ✅ | 贡献者（ownerAgent = self） | `nox`(研究)、`knowledge`(知识管家) |
| **`own`** | 对自有节点具备管理权（确认/修正归属） | ✅ 全域 | ✅ | 拥有者 | 用户本人（human）；员工的 own 由授权授予 |

> 注：`own` 在 MVP 阶段**只影响归属与确认语义**，不赋予删除/改写他人内容的权力（lens 无此类接口，天然不可能）。

### 7.2 默认授权建议（P1 原型）

| AgentId | 建议权限 | 理由 |
|---|---|---|
| `assistant`（田园犬） | `read` | 默认助手，消费知识作答，不主动写入 |
| `nox`（黑猫） | `contribute` | 研究型 Agent，产出研究成果属于知识贡献 |
| `knowledge`（布偶猫） | `contribute` | 知识管家，负责导入与整理 |
| `task`（边牧） | `read` | 任务型 Agent，消费知识执行任务 |

### 7.3 权限策略存放位置（关键架构决策，见 D7）

**推荐：策略在 backend 之外。**

```
Employee  ──▶  knowledgeAccess（gate 模块）  ──▶  KnowledgeBackend
                      │
                      └── 权限表 + 归属注入（策略唯一来源）
```

理由：

1. **Backend 保持单一职责** —— 只负责存取知识，不做授权判断（与 R6「LightRAG 只作实现」精神一致）。
2. **接口零参数** —— `KnowledgeBackend` 5 方法无 agent 参数，若权限进 backend，必须改接口或走隐式上下文（**两者都违反红线**）。
3. **可测试** —— gate 是纯函数式模块，可不启 backend 单测权限矩阵。
4. **可切换** —— 未来接真实多租户，只需替换 gate，backend 不动。

被否决的方案：

- ❌ 写进 `AgentProfile`：违反「不改 Employee 体系」红线，且把策略耦合进展示模型。
- ❌ 写进 backend：需要 `agentId` 参数 → 改接口 → 违反红线。

### 7.4 Gate 的最小实现形态（示意）

```ts
// src/knowledge/lens/knowledgeAccess.ts（新增，编码阶段）
const DEFAULT_POLICY: Record<AgentId, KnowledgePermission> = {
  assistant: 'read',
  nox: 'contribute',
  knowledge: 'contribute',
  task: 'read',
}

export function resolvePermission(id: AgentId): KnowledgePermission {
  // 优先级：运行时覆盖 > 默认策略表（与 Stage 8 D2 的 config 优先级风格一致）
  ...
}

export function bindEmployeeAccess(id: AgentId): EmployeeKnowledgeAccess {
  const permission = resolvePermission(id)
  const backend = getSharedUniverse()
  return { agentId: id, permission, canWrite: permission !== 'read', ... }
}
```

- `canWrite: false` 对 `read` 级员工**依然成立** → 与 Stage 4/7/8 只读契约**向后兼容**。
- 默认策略表是**代码内常量**（非 UI 配置），Stage 9 不引入权限配置 UI（属于 UI surface，红线）。

---

## 8. 边界对照 + 验收规划

### 8.1 边界对照表（编码后需逐条验证）

| 约束 | 编码后必须成立 |
|---|---|
| R5 Memory 不入 KG | `memory/` 与图写入路径零交叉；`LightRAGBackend` 仍走 `memoryProvider` 委派 |
| R6 LightRAG 隔离 | `lens/` 不 import 任何 `LightRAG*`；只依赖 `KnowledgeBackend` 接口类型 |
| R7 Mock 回退 | `createBackend()` 仍默认 `MockBackend`；lens 在 Mock 下同样可用（`contribute` 降级为 `importSource`） |
| D3 接口外扩展 | 归属写入继续走 `importSourceAs`，接口仍是 5 方法 |
| Employee ⊥ Knowledge | `lens/` 只 import `AgentId`，不 import `AgentProfile` / 任何 Employee 组件 |
| Capability ⊥ Knowledge | `lens/` 与 backend 内不出现 capability 概念 |
| Shared Universe 单例 | lens 不持有节点副本，不新建 universe 实例 |

### 8.2 验收断言（编码阶段目标）

```
employeeReadPathDefined=true             # lens 提供 listOwned/listAll/query/memory
lensReadOnlyByDefault=true               # 'read' 级员工 canWrite=false，且无写方法可用
memoryKnowledgeCapabilityOrthogonal=true # 三者模块零交叉 import
contributionProvenanceRecorded=true      # 贡献后 ownerAgent + aiStatus + source 可回溯
permissionGateOutsideBackend=true        # backend 模块内零权限判断代码
knowledgeBackendInterfaceUnchanged=true  # types.ts 5 方法签名未变
employeeModelUnchanged=true              # AgentId / AgentProfile / agents.ts 未变
uiNoRegression=true                      # Home/EmployeeCenter/Detail/Card/Rail 未改
sharedKnowledgeSpaceNoRegression=true    # 既有知识空间读取无回归
mockFallbackAvailable=true               # MockBackend 默认可用且 lens 可工作
```

### 8.3 验证方式（沿用 Stage 7/8 已验证的做法）

- `tsx` 跑真实 TS 模块闭环（**非 mock 断言**）：
  `bindEmployeeAccess('nox') → listOwned → contribute(src) → listOwned 增加 → query → memory`
- `oxlint --config .oxlintrc.staged.json --fix` 零错误
- 权限矩阵断言：4 名员工 × 3 权限的行为符合 7.2 表
- 降级断言：MockBackend 下 `contribute` 返回 `importSource` 结果且标注 `ownerAttribution: 'unsupported'`

---

## 9. Scope Freeze + 待裁决 D1–D8

### 9.1 Scope Freeze

本文为**设计文档**：本轮不修改任何 `.ts` / `.tsx` / 配置 / 依赖。落地需 D1–D8 裁决后另起编码 commit。

### 9.2 待裁决

| # | 议题 | 选项 | 建议 |
|---|---|---|---|
| **D1** | Lens 形态 | A. 新增兄弟接口 `EmployeeKnowledgeAccess`（保留旧 lens）<br>B. 放宽 `EmployeeKnowledgeLens.canWrite` 为 boolean 并加方法 | **A**（零回归，保住 `canWrite:false` 类型级只读保证） |
| **D2** | 读作用域 | A. 全域可读（`ownerAgent` 仅归属，不隔离）<br>B. 按归属分区（需共享标记，语义隐晦） | **A**（与 Shared Universe 语义一致） |
| **D3** | lens 级语义检索 | a. 以首个 owned 节点为种子<br>b. 多节点并发检索归并<br>c. 暂不提供，仅「给定节点找邻居」 | **c**（原型期不做伪语义） |
| **D4** | Capability | A. 保持 display-only，Stage 9 不建数据层<br>B. 引入 capability 注册表 | **A**（守住三者正交，避免过度设计） |
| **D5** | Memory 与员工 | A. Memory 属用户，员工只读；不建 per-agent memory<br>B. 引入 per-agent memory | **A**（R5 延伸，避免第二套记忆真相） |
| **D6** | 贡献生命周期 | A. AI 贡献先落 `auto`/`draft`，人工确认后 `confirmed`<br>B. 直接 `confirmed` 写入 | **A**（知识质量优先，防 AI 污染） |
| **D7** | 权限策略位置 | A. backend 之外（`lens/knowledgeAccess.ts` gate）<br>B. 写进 `AgentProfile`<br>C. 写进 backend | **A**（唯一不违反红线的方案） |
| **D8** | Stage 9 是否引入 UI | A. 纯 seam，无 UI（权限/贡献不对用户可见）<br>B. 在 EmployeeDetail 增加「知识贡献」区块 | **A**（UI 留到 Stage 10，本阶段只做不可见能力层） |

### 9.3 建议的编码范围（若 D1–D8 按建议通过）

1. 新增 `src/knowledge/lens/knowledgeAccess.ts`（权限表 + gate + `bindEmployeeAccess`）
2. 新增 `src/knowledge/lens/employeeKnowledgeAccess.ts`（lens 实现：读投影 + `contribute`）
3. `knowledgeUniverse.ts` **追加导出** `bindEmployeeAccess` / `resolvePermission` + window 探针追加字段（不改已有导出）
4. tsx 闭环验收 + oxlint 全过
5. 单 commit，仅上述文件，不混 harness 噪声

---

**结论**：Stage 9 不改变「知识怎么来」（Stage 4–8 已解决），而是定义「知识怎么被员工用起来」——读路径用**投影**而非副本，贡献走 **gate + 接口外归属**，权限**外置于 backend**，Memory / Knowledge / Capability **三者严格正交**。全程零类型修改、零 UI 改动、零 backend 接口变更。
