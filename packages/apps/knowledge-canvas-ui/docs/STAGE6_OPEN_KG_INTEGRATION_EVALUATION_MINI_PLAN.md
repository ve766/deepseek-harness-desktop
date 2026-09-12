# Stage 6 · Open Knowledge Graph Integration Evaluation — Mini Plan

> **仅评估，不编码。** 本 Mini Plan 只做开源 KG / GraphRAG 方案调研、评估维度打分、推荐接入顺序与
> `KnowledgeBackend` adapter 映射设计。审核通过并裁决后才决定是否进入接入实现。
> 前置：Stage 4 已落地 `knowledgeUniverse.ts` 单点接缝（commit `356caaf`），Stage 5 已落地
> Shared Knowledge Space surface（commit `094aeca`），确立了 "Shared Knowledge Universe = 经
> `KnowledgeBackend` 接口读取的共享基础设施" 的架构基线。

---

## 1. 目标与红线

**目标**：为未来替换 `KnowledgeBackend` 后端（当前 = `MockBackend`）评估开源方案，确认：
1. 哪个（些）方案能最干净地实现 `KnowledgeBackend` adapter（5 方法契约不变）；
2. 是否原生支持 Node / Edge / source / ownerAgent 数据模型；
3. 是否支持本地部署（无云依赖）；
4. 是否适合本机 **RTX 3060（6GB 显存）/ 本地 AI Employee OS**；
5. 是否破坏现有 seam（`createBackend()` 单点、UI 经接口读取、Employee 模型独立）。

**红线（本阶段 + 后续接入阶段共同遵守）**：
- ❌ 不修改 `createBackend()`（评估阶段）；接入阶段也只在该函数内替换实现，不影响调用方。
- ❌ 不接真实 KG / 数据库（本阶段 mock only）。
- ❌ 不引入数据库依赖到仓库（本阶段不写任何代码）。
- ❌ 不改 UI / 不改 `Employee` 模型 / 不改 `KnowledgeBackend` 接口签名。
- ❌ 不绕过 `KnowledgeBackend` 直连具体引擎。

> 注：本阶段产物 = 本文档。任何代码改动都等审核通过后的下一阶段进行。

---

## 2. 架构审计（真实现状，非假设）

### 2.1 适配器接缝（单点）
`src/knowledge/knowledgeUniverse.ts:44-46`

```ts
function createBackend(): KnowledgeBackend {
  return new MockBackend()
}
```

- `getSharedUniverse()`（:49-52）模块级单例，返回 `KnowledgeBackend` 实例本身（**非 `{backend}` 包装**）。
- `bindEmployee(id)`（:65-76）经接口 `listNodes()`/`listEdges()` 派生 `ownedNodeIds`，只读 `canWrite:false`。
- **唯一** concrete backend 命名处就是这个 `createBackend()`。UI/store 全部经接口，故换引擎 = 改这一行 + 新增一个 `implements KnowledgeBackend` 的类。

### 2.2 `KnowledgeBackend` 契约（5 方法，需被 adapter 完整实现）
`src/types.ts:165-174`

| 方法 | 语义 | adapter 必须做的映射 |
|---|---|---|
| `listNodes()` | 返回全部 `KnowledgeNode[]` | KG 图节点 → `KnowledgeNode`（含 source/ownerAgent/position） |
| `listEdges()` | 返回全部 `KnowledgeEdge[]` | KG 边 → `KnowledgeEdge`（from/to/kind/reason） |
| `importSource(src: SourceRef)` | 导入一个来源，返回 `{ nodeId }` | 触发 LLM 抽取 / 建节点（pdf/url/video/github/chat） |
| `getNeighbors(nodeId, text)` | 返回相关节点 + 分数 + 理由 | 图遍历 / 语义检索 → 相关实体 |
| `getMemory()` | 返回 `MemoryEntry[]` | **保持独立**（Memory = 用户上下文，不进 KG） |

### 2.3 数据模型（已就绪，adapter 仅填充字段，不改结构）
`src/types.ts`

- `KnowledgeNode`：`id / kind / title / meta / source? / aiStatus? / position / groupId? / ownerAgent? / isHub? / titleLoc? / concept? / pathId? / pathOrder?`
- `KnowledgeEdge`：`id / from / to / kind('manual'|'ai-auto') / reason?`
- `Relationship`（Galaxy 可解释边）：`source / target / type / confidence / reason`
- `SourceRef`：`type('pdf'|'url'|'video'|'github'|'chat') / uri`
- `AgentId`：`'assistant'|'nox'|'knowledge'|'task'`（ownerAgent 域）
- `MemoryEntry`：`category / text`（**不进 KG**，adapter 的 `getMemory()` 仍走原 Memory 通道）

**关键结论**：数据模型已包含 Node/Edge/source/ownerAgent 全部要素；KG 接入的本质是
**把这些字段映射到图节点/边的属性（或关联节点）**，而非改造模型。

---

## 3. 候选方案比较（6 方案 × 评估维度）

评估维度：① adapter 适配度（5 方法映射干净度）② Node/Edge/source/ownerAgent 模型支持
③ 本地部署 ④ RTX 3060 适配 ⑤ 破坏 seam 风险。打分 1–5（5 最优）。

| 候选 | ① adapter 适配 | ② 模型支持 | ③ 本地部署 | ④ RTX 3060 | ⑤ seam 安全 | 定位 |
|---|---|---|---|---|---|---|
| **LightRAG**（默认 NetworkX） | 4 | 4（实体=节点，关系=边；source 需自映射） | 5（零外部服务，文件持久化） | **5**（纯内存+小模型抽取） | 5（仅换 `createBackend`） | **轻量本地首选** |
| **Memgraph** | 4（Bolt/openCypher，复用 Neo4j 适配器） | 5（属性图原生） | 4（Docker 单容器 ~400MB RAM） | 4（轻量内存库） | 5 | 轻量真图库备选 |
| **Neo4j** | 5（Cypher 表达力最强） | 5（属性图原生） | 4（Docker） | 2（JVM 2.2GB+ 开销） | 5 | 生产级备选 |
| **Apache AGE** | 4（openCypher over PG） | 5（属性图原生） | 4（Docker PG 扩展） | 3（PG 基线开销） | 5 | 已 PG 优先平台适用 |
| **LlamaIndex PropertyGraphIndex** | 3（是抽取/索引框架，非存储；需配后端） | 4（PropertyGraphStore 抽象） | 5（in-memory/disk 可选） | 4（抽取可用小模型） | 5 | **抽取层 / 喂数据层** |
| **Microsoft GraphRAG** | 3（重 pipeline + 需 Neo4j） | 4（社区/实体/关系丰富） | 3（需 Neo4j + Docker） | 1（≥12GB 显存 / 32GB RAM） | 4（改 createBackend 即可接） | 高端硬件专用 |

### 3.1 关键事实（来自调研）
- **LightRAG**：默认图存储 **NetworkX（纯内存 + 文件持久化，零外部服务）**；模块化支持 Neo4j/Memgraph/AGE；
  本地一键 Web UI + API（Ollama 兼容）；索引需 LLM 抽取实体/关系，查询可用本地小模型。**极适合 RTX 3060 本地**。
  风险：license 未显式声明（接入前需确认）。
- **Microsoft GraphRAG**：需 Neo4j（Docker），硬件 **≥12GB 显存（RTX 3090/4090）、32GB 内存、50GB 存储**——对 RTX 3060 偏重。
- **Memgraph**：内存图库，同任务约 **400MB RAM vs Neo4j 2.2GB**；Bolt 协议兼容 Neo4j 驱动；openCypher（90–95% 兼容）；
  Docker 易部署；轻量。
- **Neo4j**：JVM 系，2.2GB+ 内存开销，成熟、ACID、Cypher、生态全；Docker 部署。
- **Apache AGE**：PostgreSQL 扩展，openCypher，Docker 部署，ACID 继承自 PG，复用现有 PG；适合已 PG 优先平台。
- **LlamaIndex PropertyGraphIndex**：`PropertyGraphStore` 抽象（upsert_nodes / upsert_relations / structured_query），
  支持 in-memory、disk、Neo4j、Memgraph；是**索引/抽取框架而非数据库**，需配后端存储。

---

## 4. 推荐接入顺序

> 原则：**先轻量本地验证 → 再按需升级存储**。每个方案都只改 `createBackend()` 一行 + 新增一个 adapter 类，
> 调用方（UI/store/lens）零改动。

| 优先级 | 方案 | 适用时机 | 硬件门槛 | 备注 |
|---|---|---|---|---|
| **P0（首推试用）** | **LightRAG @ NetworkX** | 立即本地验证 adapter 形态 | 极低（纯内存） | 零外部服务，最快打通全链路；验证 `importSource`→`listNodes`→`getNeighbors` |
| **P1** | **Memgraph** | 想要"真图库"但保持轻量 | 低（~400MB RAM） | Bolt 驱动与 Neo4j 适配器几乎复用；可平滑从 NetworkX 升级 |
| **P2** | **Neo4j** | 规模 / ACID / 生态需求 | 高（JVM 2.2GB+） | Cypher 表达力最强；本机略重但可行 |
| **P3** | **Apache AGE** | 平台已 PG 优先 | 中 | openCypher over PG，复用 PG 运维 |
| **抽取层（贯穿）** | **LlamaIndex PropertyGraphIndex** | 作为 `importSource` 的抽取引擎 | 低 | 产出 PropertyGraph → 喂给上述任一存储；负责 LLM 实体/关系抽取 |
| **暂缓** | **Microsoft GraphRAG** | 高端硬件 + 全局社区特征 | 极高（≥12GB 显存） | RTX 3060 不推荐；待硬件升级或减配 |

**推荐路径**：P0 LightRAG/NetworkX 先打通 adapter 形态 → 若需持久化真图库升级到 P1 Memgraph
（适配器近乎平移）→ 生产化再考虑 P2 Neo4j。LlamaIndex 作为 import 抽取层可叠加在任意存储之上。

---

## 5. adapter 映射设计

### 5.1 两层架构认知（关键）
KG 接入本质分两层，均收敛到 `KnowledgeBackend` 5 方法：

```
importSource(src)  ──►  [抽取层] LLM 实体/关系抽取（LightRAG insert / LlamaIndex extractor / GraphRAG indexer）
                              │  产出：nodes + edges
                              ▼
listNodes / listEdges / getNeighbors  ──►  [存储/查询层] 图库或内存图（NetworkX / Memgraph / Neo4j / AGE）
```

- `importSource` = 抽取层（这里发生 LLM 调用，最适合用本地小模型 qwen2.5-coder / qwen3）。
- 其余 4 方法 = 存储/查询层（纯图遍历，无 LLM）。
- `getMemory()` **不属于 KG**，保持原 Memory 通道（Memory = 用户上下文，边界不变）。

### 5.2 `KnowledgeNode` 字段 → 图映射（通用）

| `KnowledgeNode` 字段 | Neo4j / Memgraph（Cypher） | AGE（openCypher over PG） | LightRAG / NetworkX |
|---|---|---|---|
| `id` | 节点属性 `id` + 唯一约束 | 同 | NetworkX 节点 key |
| `kind` | 节点标签 `:KnowledgeNode` + 属性 `kind` | 同 | 节点属性 `kind` |
| `title` | 属性 `title` | 同 | 属性 `title` |
| `meta` | 属性 `meta`（map） | 同 | 属性 `meta` |
| `source?: SourceRef` | 关联 `:Source` 节点 `-[:HAS_SOURCE]->` 或属性 `sourceType/sourceUri` | 同 | 节点属性（抽取后写入） |
| `ownerAgent?: AgentId` | 属性 `ownerAgent`（lens 过滤键） | 同 | 属性 `ownerAgent` |
| `position` | 属性 `position{x,y}`（布局持久化用，非语义） | 同 | 属性（LightRAG 默认不存，由可视化层算） |
| `aiStatus? / isHub? / titleLoc?` | 属性透存 | 同 | 属性透存 |

### 5.3 `KnowledgeEdge` / `Relationship` → 图映射

| 字段 | 映射 |
|---|---|
| `from / to` | 边两端节点（`MATCH (a{id:$from})-[r]->(b{id:$to})`） |
| `kind`（`'manual'|'ai-auto'`） | 边类型标签 / 属性 `kind` |
| `reason?` | 边属性 `reason`（满足"可解释"） |
| `Relationship.confidence` | 边属性 `confidence`（Galaxy 可解释加权边，可与 `KnowledgeEdge` 合并存储） |

### 5.4 5 方法 → 各方案查询映射

| 方法 | Neo4j / Memgraph（Cypher） | Apache AGE | LightRAG / NetworkX |
|---|---|---|---|
| `listNodes()` | `MATCH (n:KnowledgeNode) RETURN n` | `SELECT * FROM cypher('g',$$ MATCH (n:KnowledgeNode) RETURN n $$) AS (n agtype)` | 读 `graph_chunk_entity_relation.graphml` 实体节点 → map |
| `listEdges()` | `MATCH (n:KnowledgeNode)-[r]->(m) RETURN n,r,m` | 同上 openCypher | 读 graphml 边 → map |
| `importSource(src)` | 先 LLM 抽取（LlamaIndex/自写）→ `MERGE` 节点/`CREATE` 边 | 同上 | `lightrag.insert(content)`（按 `src.type` 选加载器） |
| `getNeighbors(nodeId,text)` | `MATCH (n{id:$id})-[r]-(m) RETURN m,r,score` 或向量检索 | 同上 | `lightrag.query(text, mode='local')` → 相关实体 + 分数 + 理由 |
| `getMemory()` | 原 Memory 通道（不进 KG） | 同 | 同 |

> Bolt 驱动兼容性：Memgraph 与 Neo4j **驱动级兼容**，故 P1 适配器可在 P2 Neo4j 适配器基础上
> 仅改连接串，近乎平移。

---

## 6. 边界对照表（接入后仍守住）

| 维度 | Memory（用户上下文） | Capability（员工能力） | Knowledge（共享宇宙） |
|---|---|---|---|
| 载体 | `MemoryEntry` via `getMemory()`（**不进 KG**） | `AgentProfile` + shell mock | `KnowledgeNode`/`Edge` via `getSharedUniverse()` |
| 接入后变化 | 无 | 无 | backend 由 MockBackend → KgBackend（仅 `createBackend()` 一处） |
| 是否进 Space | 否 | 否 | 是 |
| lens 只读 | 否 | 否 | 是（`bindEmployee` 派生，`canWrite:false`） |
| 模型边界 | Memory ⊥ Knowledge | Capability ⊥ Knowledge | 三者不可合并 |

---

## 7. 验收断言（未来接入阶段的 capture 探针，本阶段仅规划）

- `backendSwapped`：`getSharedUniverse()` 返回 `KgBackend`（非 `MockBackend`），且 `canvasStore.backend === getSharedUniverse()`（复用 Stage 4/5 单例身份断言）。
- `seamSinglePoint`：`createBackend()` 是唯一 concrete 命名处（grep 无第二处 `new MockBackend`/new Kg）。
- `interfaceIntact`：UI/store/lens 无任何 `import` 具体引擎（只经 `KnowledgeBackend` 接口）。
- `modelFieldsMapped`：至少 1 个节点带 `data-source-type` 与 `data-owner`（source/ownerAgent 已落图）。
- `employeeModelUntouched`：`AgentProfile` / Employee 类型无变更，lens 仍只读。
- `memoryBoundaryKept`：`getMemory()` 路径不指向 KG。

---

## 8. Scope Freeze（本阶段 + 后续接入阶段）

**本阶段（评估）允许**
- 仅撰写本文档（`docs/STAGE6_*.md`）。
- 更新调研结论（不写代码）。

**本阶段（评估）禁止**
- 修改 `createBackend()` / `knowledgeUniverse.ts`。
- 接真实 KG / 数据库 / 新增依赖。
- 改 UI / 改 `Employee` 模型 / 改 `KnowledgeBackend` 接口签名。
- 写任何 adapter 实现代码。

**后续接入阶段（审核通过后）允许**
- 在 `createBackend()` 内替换 `new MockBackend()` → `new KgBackend()`（1 行）。
- 新增 `KgBackend implements KnowledgeBackend`（仅实现 5 方法 + 字段映射）。
- 可选：将 LlamaIndex 抽取层挂到 `importSource`。

**后续接入阶段禁止**
- 触碰 UI / Employee 模型 / `KnowledgeBackend` 接口签名。
- 绕过接口直连引擎。
- 把 Memory 并入 KG。

---

## 9. 待裁决

- **R1 · 首推方案**：确认 P0 = **LightRAG @ NetworkX** 作为首个 adapter 验证（推荐）/ 或直接从 Memgraph？
- **R2 · 抽取层**：`importSource` 的 LLM 抽取是否复用 **LlamaIndex PropertyGraphIndex**（推荐）/ 自写轻量抽取 / 直接用 LightRAG 内置 `insert`？
- **R3 · 硬件路线**：本机 RTX 3060 是否长期走轻量路线（NetworkX/Memgraph），还是计划升级硬件后上 Neo4j/GraphRAG？
- **R4 · license 风险**：LightRAG license 未显式声明，接入前是否需先确认合规？
- **R5 · Memory 边界**：确认 `getMemory()` 永远不进 KG（默认通过）？

审核通过后按 R1–R5 推荐方案放行**接入实现**（下一阶段），单 commit，停在对应验收节点。
