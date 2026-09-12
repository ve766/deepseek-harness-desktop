# Stage 7 · LightRAG Adapter Prototype — Mini Plan

> **仅设计，不编码。** 本 Mini Plan 设计最小 adapter：`LightRAGBackend implements KnowledgeBackend`，
> 验证链路 `KnowledgeBackend → LightRAG Adapter → NetworkX Graph` 是否成立。审核通过并裁决后才决定是否进入编码。
> 前置：Stage 6 评估已通过（commit `a34cb7d`），R1–R5 裁决已落地。本阶段在 Stage 6 结论上收敛到**单一验证目标 = LightRAG @ NetworkX**。

---

## 1. 目标、定位与红线

**目标**：设计一个最小 `LightRAGBackend`，把既有 `KnowledgeBackend` 5 方法契约映射到 LightRAG（默认 NetworkX 图存储），
验证「adapter → Graph Engine」这条链路在架构上成立，为后续 Phase 1（LightRAG + NetworkX 本地）落地铺路。

**Stage 6 裁决（已确认，本阶段必须遵守）**：
- **R1 ✅** 首推 **LightRAG @ NetworkX** 作为第一验证目标（最贴合当前 AI Employee OS 阶段、不引入数据库、不破坏 seam、支持本地 Ollama、适合 RTX 3060 6GB）。目标不是生产方案，而是验证链路。
- **R2 ✅（有条件）** LlamaIndex 仅作**可选抽取层**，不是 `KnowledgeBackend` 核心。职责划分：LlamaIndex 负责 `Source → Entity/Relation Extraction → KnowledgeNode/KnowledgeEdge`；LightRAG/图存储负责 `listNodes/listEdges/getNeighbors`。**禁止 UI 直接依赖 LlamaIndex；禁止 `KnowledgeBackend` 被 LlamaIndex API 污染。**
- **R3 ✅** 长期渐进路线：Phase 1 = LightRAG + NetworkX（本地 AI Employee）→ Phase 2 = LightRAG + Memgraph（轻量服务化）→ Phase 3 = Neo4j / GraphRAG（团队/云端/大规模）。**不提前引入 Neo4j**；当前瓶颈是数据模型稳定、Agent 知识贡献关系、adapter 验证，而非图库能力。
- **R4 ✅** 任何代码接入前**必须新增 License Review 节点**：确认 LightRAG license、依赖包 license、商业使用限制（尤其 AI Employee OS + 商业授权），不留合规风险。
- **R5 ✅** **Memory 永远不进入 KG**。Memory（用户上下文）/ Knowledge（共享宇宙）/ Capability（员工身份能力）三者保持正交。

**本阶段红线（设计 + 后续编码共同遵守）**：
- ❌ 不改 UI / 不改 `Employee` 模型 / 不改 `KnowledgeBackend` 接口签名。
- ❌ 不引入生产数据库（NetworkX 内存图 ≠ 数据库；持久化仅本地文件 `rag_storage/`）。
- ❌ 改 `createBackend()` 前必须先评审（本阶段只设计，不触碰 `knowledgeUniverse.ts`）。
- ❌ UI / Employee 层不得 import LightRAG / LlamaIndex 具体 API。

---

## 2. 架构审计（真实现状 + Stage 7 插入点）

### 2.1 现有接缝（单点，来自 Stage 4）
`src/knowledge/knowledgeUniverse.ts:44-46`
```ts
function createBackend(): KnowledgeBackend {
  return new MockBackend()
}
```
- `getSharedUniverse()`（:49-52）模块级单例，返回 `KnowledgeBackend` 实例本身。
- `bindEmployee(id)`（:65-76）经接口 `listNodes()`/`listEdges()` 派生只读 lens。
- **唯一** concrete backend 命名处 = 此函数。Stage 7 编码阶段只在此处把 `new MockBackend()` 换成 `new LightRAGBackend(...)`，**调用方零改动**。

### 2.2 `KnowledgeBackend` 契约（5 方法，adapter 必须完整实现）
`src/types.ts:165-174`

| 方法 | 语义 | LightRAG 映射落点 |
|---|---|---|
| `listNodes()` | 全部 `KnowledgeNode[]` | LightRAG entities（NetworkX 图节点） |
| `listEdges()` | 全部 `KnowledgeEdge[]` | LightRAG relationships（NetworkX 图边） |
| `importSource(src: SourceRef)` | 导入来源，返回 `{ nodeId }` | `insert()` 抽取实体/关系 → 返回 source 节点 id |
| `getNeighbors(nodeId, text)` | 相关节点 + 分数 + 理由 | `query(text, mode='local')` + 图邻域过滤 |
| `getMemory()` | `MemoryEntry[]` | **不进 KG**，委派独立 MemoryProvider |

### 2.3 关键技术事实（已 WebSearch 核实，2026-09-08）
- **License**：LightRAG（HKUDS `lightrag-hku`）为 **MIT**（`pyproject.toml: license = {text = "MIT"}`）；主流 fork 均 MIT。依赖：`networkx`(BSD-3)、`nano-vectordb`、`numpy`(BSD)、`pandas`(BSD)、`aiohttp`(Apache-2.0) 等，均为宽松许可。**仍须走 R4 License Review 节点**（含传递依赖 + 商业授权确认）。
- **本地 Ollama**（已验证 6GB GPU 可行）：
  ```python
  from lightrag.llm import ollama_model_complete, ollama_embedding
  from lightrag.utils import EmbeddingFunc
  rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=ollama_model_complete,
    llm_model_name="qwen2.5-coder:7b",          # 或 qwen3:8b
    llm_model_kwargs={"options": {"num_ctx": 32768}},  # 上下文 ≥32k，6GB 实测 26k 可跑
    embedding_func=EmbeddingFunc(
      embedding_dim=768, max_token_size=8192,
      func=lambda texts: ollama_embedding(texts, embed_model="nomic-embed-text")),
  )
  ```
  RTX 3060 6GB：qwen2.5-coder:7b(~4.7GB) 可全量进显存；nomic-embed-text 极小；gemma2:2b@26k 实测抽得 197 实体/19 关系。
- **图存储**：默认 `NetworkXStorage` → `rag_storage/graph_chunk_entity_relation.graphml`（可用 `nx.read_graphml` 直接读）。查询模式：`local/global/hybrid/naive/mix`，`top_k` 控制召回。

### 2.4 TS / Python 边界（关键架构认知）
LightRAG 是 **Python** 库；kcu 是 **TS/Electron** 前端。`LightRAGBackend`（TS）**不能直接 `import lightrag`**。
→ 必须通过一个 **client 抽象** 与 LightRAG 通信。两种 client（均不污染 TS 侧接口）：

| Client | 形态 | 用途 | 是否引入 Python/DB |
|---|---|---|---|
| `InMemoryLightRAGClient` | 纯 TS，镜像 LightRAG 的 entity/relation/NetworkX 模型于内存 | **Stage 7 原型首选**：零基础设施验证 adapter 链 | 否（内存图，本地文件可选持久化） |
| `LightRAGHttpclient` | TS HTTP 客户端 → 本地 `lightrag-server`（Python） | Phase 1 真实 LightRAG 接入 | 是（Python 进程，但非「数据库」） |

> R3 Phase 1 = LightRAG + NetworkX；原型阶段用 `InMemoryLightRAGClient` 验证形态，编码放行后再换 `LightRAGHttpclient` 接真实服务。**两者都只实现同一个 `LightRAGClient` 接口，换 client 不影响 `KnowledgeBackend` / UI**。

---

## 3. 设计决策（待用户裁决 D1–D6）

### D1 · adapter 形态（推荐：client 抽象 + 双实现）
`LightRAGBackend implements KnowledgeBackend`，内部依赖 `LightRAGClient` 接口。
- 5 方法全部经 client 读写；client 具体实现可切换（内存 / HTTP）。
- 收益：adapter 链形态一次验证，真实 LightRAG 接入时只换 client，UI/store/lens 零改动。

### D2 · 原型验证载体（推荐：先 `InMemoryLightRAGClient`）
Stage 7 编码（若放行）先落地 `InMemoryLightRAGClient`（纯 TS 镜像 LightRAG 数据模型），验证 `importSource→listNodes→getNeighbors` 全链路；
随后再接真实 `lightrag-server`（`LightRAGHttpclient`）。**不把验证绑定到先装 Python 环境**。

### D3 · ownerAgent 归属（关键：接口冻结下的归属策略）
`importSource(src: SourceRef)` 签名**不含 agent**（R-scope 禁止改接口）。LightRAG 抽取出的实体也不含 owner。
→ 策略：adapter 暴露**接口外的扩展方法** `importSourceAs(src, ownerAgent)`（不改动 `KnowledgeBackend` 本身），
内部把 `sourceId → ownerAgent` 记入 side-map（随 `rag_storage/` 持久化）；`listNodes()` 据此回填 `node.ownerAgent`。
UI 只用 5 方法（ownerAgent 经 mock/未来 seeding 已存在），归属层不影响契约。
若保守：原型阶段 `ownerAgent` 留空，仅验证实体/关系链路，归属作为 Phase 1.5 增强。

### D4 · Memory 委派（R5 落地）
`LightRAGBackend` 构造时注入 `memoryProvider: { getMemory(): Promise<MemoryEntry[]> }`；
`getMemory()` 直接委派它，**绝不查 LightRAG**。Memory 与 KG 在 adapter 内即物理分离。

### D5 · 本地 Ollama 配置（R1 落地）
真实 `lightrag-server` 启动配置固定为本地 Ollama：`llm_model_name="qwen2.5-coder:7b"`、`num_ctx=32768`、
embedding=`nomic-embed-text`。RTX 3060 6GB 验证通过（见 §2.3）。

### D6 · License Review 门（R4 落地，**编码前强制**）
在 Stage 7 编码 commit 之前，必须完成 License Review 节点并归档结论：
1. LightRAG（MIT）主许可 + 商业使用无限制确认；
2. 依赖树 license 扫描（networkx / nano-vectordb / numpy / pandas / aiohttp / openai 等）→ 全部宽松；
3. AI Employee OS 未来商业授权的合规结论。
**未通过此门，不写任何 adapter 代码。**

---

## 4. 组件与文件设计（编码阶段才落地，本阶段只规划）

### 新增（编码阶段）
- `src/knowledge/lightragBackend.ts`
  - `class LightRAGBackend implements KnowledgeBackend`；构造 `{ client: LightRAGClient, memoryProvider: MemoryProvider }`。
  - 5 方法经 client 映射；`importSourceAs(src, ownerAgent)` 为接口外扩展（D3）。
- `src/knowledge/lightragClient.ts`
  - `interface LightRAGClient`：`insert(content, sourceId)`, `query(text, mode)`, `getEntities()`, `getRelations()`, `getGraphNeighbors(nodeId)`。
- `src/knowledge/inMemoryLightRAGClient.ts`
  - `class InMemoryLightRAGClient implements LightRAGClient`：内存维护 `entities`/`relations`/`networkx-like` 邻接表；`insert` 用轻量规则（或挂 LlamaIndex 抽取层，见 D7）生成实体/关系；镜像 LightRAG 字段。
- `src/knowledge/lightragHttpClient.ts`（Phase 1 真实接入）
  - `class LightRAGHttpclient implements LightRAGClient`：HTTP 调 `lightrag-server`（`/documents` / `/query` / `/graph`）。
- `src/knowledge/lightragMapping.ts`
  - `entityToNode()` / `relationToEdge()` / `sourceRefToContent()` 纯映射函数（§5）。

### 修改（编码阶段，单点）
- `src/knowledge/knowledgeUniverse.ts` 的 `createBackend()`：
  ```ts
  function createBackend(): KnowledgeBackend {
    return new LightRAGBackend({
      client: new InMemoryLightRAGClient(),   // 原型期；后续换 LightRAGHttpclient
      memoryProvider: /* 现有 Memory 通道 */,
    })
  }
  ```
  **本阶段（设计）不触碰此文件。**

### 复用（不修改契约）
`KnowledgeBackend` / `KnowledgeNode` / `KnowledgeEdge` / `SourceRef` / `AgentId` / `MemoryEntry` /
`getSharedUniverse()` / `bindEmployee` / `canvasStore` / 全部 UI surface。

### D7 · LlamaIndex 抽取层角色（R2 落地，可选）
若 `InMemoryLightRAGClient.insert` 需要真实抽取，可挂 **LlamaIndex 抽取层**（仅在 `lightragClient` 内部，TS 侧用其 Node 绑定或 Python 侧用 `lightrag.llm.llama_index_impl`）。
**约束**：LlamaIndex 只存在于 client 内部实现；`LightRAGBackend` / `KnowledgeBackend` / UI 对此无感知（R2 禁止污染）。

---

## 5. 数据映射设计（KnowledgeNode/Edge ↔ LightRAG entity/relation）

### 5.1 `KnowledgeNode` → LightRAG entity
| `KnowledgeNode` 字段 | LightRAG entity 字段 | 说明 |
|---|---|---|
| `id` | `entity_name`（作为 key） | 实体名即节点 id |
| `kind`（NodeKind） | `entity_type` | 类型（person/org/concept/…） |
| `title` | `entity_name` | 展示名 |
| `meta` | entity 自定义属性 `meta` | 透存 |
| `source?: SourceRef` | `source_id` + 关联 source 记录 | 映射回 SourceRef（type/uri） |
| `ownerAgent?: AgentId` | entity 自定义属性 `owner_agent`（D3 side-map 回填） | LightRAG 原生无，adapter 扩展 |
| `position` | **不存**（布局非语义） | 由可视化层计算（同 mock） |
| `aiStatus? / isHub? / titleLoc?` | entity 自定义属性透存 | — |

### 5.2 `KnowledgeEdge` / `Relationship` → LightRAG relation
| 字段 | LightRAG relation 字段 |
|---|---|
| `from` / `to` | `src_id` / `tgt_id`（entity_name） |
| `kind` | 固定 `'ai-auto'`（LLM 抽取）或 `'manual'`（用户标注） |
| `reason?` | `description`（关系描述，满足「可解释」） |
| `Relationship.confidence` | `weight`（LightRAG 关系权重，1–10） |

### 5.3 `getNeighbors(nodeId, text)` 映射
1. `client.query(text, mode='local')` → 相关实体候选（带 score）。
2. `client.getGraphNeighbors(nodeId)` → 图中直接邻域。
3. 取交集/加权：以 query score 为主，邻域命中加权；返回 `{ nodeId, score, reason }[]`，
   `reason` = 对应 relation 的 `description`（可解释）。
> 若 `text` 为空，退化为纯图邻域遍历（BFS 一层）。

---

## 6. importSource 流程设计

```
SourceRef{type,uri}
   │
   ├─ sourceRefToContent(src)         # 按 type 解析为文本
   │     pdf    → PDF 文本抽取（loader）
   │     url    → fetch + markdown 清洗
   │     video  → 转录（Phase 1.5，原型期跳过）
   │     github → 取文件/README 内容
   │     chat   → 对话转录序列化
   ▼
client.insert(content, sourceId)       # LightRAG 抽取：chunk → LLM 实体/关系 → NetworkX + 向量
   │                                   # （若挂 LlamaIndex 抽取层，在此内部发生，R2）
   ▼
创建并返回 source 节点 id = `src:<uri-hash>`   # 代表被导入的来源本身
   │                                   # 抽取的实体/关系成为额外 KnowledgeNode/Edge
   ▼
（D3 扩展）记录 sourceId → ownerAgent side-map
   ▼
return { nodeId: `src:<uri-hash>` }
```

- **返回语义**：`importSource` 返回「来源节点」id；真实知识节点是抽取产物，经 `listNodes()` 暴露。
  这与 mock 当前行为（导入生成一个节点）一致，UI 契约不变。
- **异步**：`insert` 含 LLM 调用（抽取），故 `importSource` 为 async；真实 LightRAG 抽取时间受模型速度限制（本地小模型可接受）。

---

## 7. 边界对照 + License Review（R4/R5 落地）

### 7.1 三者正交（R5）
| 维度 | Memory（用户上下文） | Capability（员工能力） | Knowledge（共享宇宙） |
|---|---|---|---|
| 载体 | `MemoryEntry` via `memoryProvider.getMemory()`（**不进 LightRAG**） | `AgentProfile` + shell mock | `KnowledgeNode`/`Edge` via `LightRAGBackend` |
| 编码后变化 | 无（adapter 内委派） | 无 | backend 由 MockBackend → LightRAGBackend（仅 `createBackend()` 一处） |
| 是否进 Space | 否 | 否 | 是（只读 lens） |

### 7.2 License Review 门（R4，编码前强制）
- **门控对象**：任何 `lightragBackend.ts` / `lightragClient.ts` / `lightragHttpClient.ts` 的落地 commit。
- **检查清单**：
  1. LightRAG 主许可 = MIT，商业使用无限制（已初判，需归档正式结论）；
  2. `pip` 依赖树 license 扫描全为宽松（含 `networkx` BSD、`nano-vectordb` MIT、`numpy`/`pandas` BSD、`aiohttp` Apache-2.0、`openai` MIT 等）；
  3. 传递依赖 + AI Employee OS 未来商业授权的合规结论；
  4. 归档位置：`docs/LICENSE_REVIEW_LIGHTRAG.md`（或仓库既有 license 记录区）。
- **fail 处理**：任一阻塞项未过 → 暂停编码，回到评估（不接 LightRAG，回退保持 MockBackend）。

---

## 8. Scope Freeze

**本阶段（设计）允许**
- 仅撰写本文档（`docs/STAGE7_*.md`）。
- 完成 R4 License Review 节点的**规划**（检查清单、归档位置设计）；实际 license 扫描在编码前执行。

**本阶段（设计）禁止**
- 修改 `createBackend()` / `knowledgeUniverse.ts`。
- 写任何 `LightRAGBackend` / client / mapping 代码。
- 接真实 LightRAG / Python / 数据库。
- 改 UI / 改 `Employee` 模型 / 改 `KnowledgeBackend` 接口签名。

**后续编码阶段（审核 + License Review 通过后）允许**
- 新增 `lightragBackend.ts` / `lightragClient.ts` / `inMemoryLightRAGClient.ts`（+ 可选 `lightragHttpClient.ts`、`lightragMapping.ts`）。
- 在 `createBackend()` 内替换 `new MockBackend()` → `new LightRAGBackend({ client, memoryProvider })`（1 处）。
- 挂 LlamaIndex 抽取层（仅限 client 内部，R2）。

**后续编码阶段禁止**
- 触碰 UI / Employee 模型 / `KnowledgeBackend` 接口签名。
- UI/Employee 层 import LightRAG / LlamaIndex 具体 API。
- 引入生产数据库（NetworkX 内存图 + 本地文件持久化除外）。
- 绕过接口直连引擎；把 Memory 并入 KG。

---

## 9. 待裁决

- **D1**：adapter 采用 client 抽象 + 双实现（推荐）/ 直接硬绑 HTTP？
- **D2**：原型先用 `InMemoryLightRAGClient` 零基建验证（推荐）/ 直接接真实 `lightrag-server`？
- **D3**：`ownerAgent` 归属——接口外扩展 `importSourceAs`（推荐）/ 原型期留空后续增强？
- **D4**：`memoryProvider` 注入方式（复用现有 mock Memory 通道，确认无 KG 泄漏）？
- **D5**：本地 Ollama 模型选定 `qwen2.5-coder:7b` + `nomic-embed-text`（推荐）/ 其他本地模型？
- **D6**：License Review 门的检查清单与归档位置（见 §7.2）是否认可？
- **D7**：`InMemoryLightRAGClient.insert` 是否挂 LlamaIndex 抽取层（R2 约束内）/ 先用规则抽取占位？

审核通过 + License Review 门放行后，按 D1–D7 推荐方案放行**编码**（下一阶段），单 commit，停在对应验收节点。
