# Stage 8 · LightRAG 生产接入与 Ingestion Pipeline — Mini Plan（仅设计）

> 状态：设计阶段（design only）。本 commit 只提交本文档，**不编码**。
> 上游：Stage 7 验收通过（commit `1e9b3dd`），`LightRAGBackend` adapter prototype + `InMemoryLightRAGClient` 已落地，6 项验收全绿。
> 下游：本 Plan 经审核确认后，才决定是否进入 Stage 8 编码（真实 LightRAG server 接入 + ingestion layer）。

---

## 1. 目标与红线（Scope & Red Lines）

**目标**：把 Stage 7 的 `LightRAGBackend` prototype 从「内存 NetworkX 镜像」推进到「真实 LightRAG 引擎接入」，并补齐 `SourceRef → Knowledge Universe` 的 ingestion 链路。评估 5 件事项：

1. 真实 LightRAG server / local deployment 接入方案
2. ingestion pipeline 设计
3. `SourceRef → Knowledge Universe` 的数据流
4. Scrapling 网页采集是否作为 ingestion layer 组件加入
5. LlamaIndex 抽取层是否需要引入

**硬红线（不可触碰）**：

- 禁止修改 `KnowledgeBackend` 接口签名（仍是 5 方法）。
- 禁止修改 `KnowledgeNode` / `KnowledgeEdge` / `MemoryEntry` 类型。
- 禁止修改 Employee 体系、Rail/NavRoute、Home / EmployeeCenter / EmployeeDetail、SharedKnowledgeSpace UI。
- 禁止引入 Neo4j / Memgraph 作为本阶段强制依赖（仍按 R3 长期渐进：Phase1 NetworkX → Phase2 Memgraph → Phase3 Neo4j）。
- **Scrapling 只存在于 ingestion layer，绝不进入 `KnowledgeBackend` / 核心模型 / UI / Employee**（用户明确约束）。
- `MockBackend` 保留为默认 fallback；`createBackend()` 仍是唯一切换点（R7）。
- LightRAG 仍只作为 `KnowledgeBackend` 实现，零反向污染核心模型（R6）。

**本 Plan 提交纪律**：单 commit，仅本文件；不混入 `dist/`、不混入 workspace harness 噪声。

---

## 2. 架构审计（当前状态）

### 2.1 已就位（Stage 7）
- `KnowledgeBackend` 接口（`src/types.ts:165`）：`listNodes / listEdges / importSource / getNeighbors / getMemory`。
- `LightRAGClient` 接口（`src/knowledge/backends/lightragClient.ts`）：`insert(content, sourceId) / query(text, mode) / getEntities / getRelations / getGraphNeighbors` —— **唯一** 连接 TS 前端与 LightRAG 引擎的契约，隔离核心模型（R6）。
- `InMemoryLightRAGClient`：纯 TS 镜像 LightRAG 的实体/关系/NetworkX 邻接模型，确定性规则抽取，已验证 adapter 链闭环。
- `LightRAGBackend implements KnowledgeBackend`：5 方法经 client 映射；接口外 `importSourceAs(src, ownerAgent)` 回填 owner；Memory 经 `memoryProvider` 委派（R5）。
- `createBackend()`：`MockBackend` 默认，`__KCU_ENABLE_LIGHTRAG_BACKEND===true` 时 opt-in `LightRAGBackend`（R7）。
- `SourceRef`（`src/types.ts:17`）：`{ type: 'pdf'|'url'|'video'|'github'|'chat', uri }`。

### 2.2 生产化缺口（本 Plan 要解决）
| 缺口 | 说明 |
|---|---|
| 真实引擎接入 | `InMemoryLightRAGClient` 不连真实 LightRAG；需 `LightRAGHttpClient` 对接 `lightrag-server` REST。 |
| 内容获取 | `importSource(src)` 当前只把 `SourceRef` 当纯文本（`sourceRefToContent`）。真实 `url`/`pdf`/`video`/`github` 需先 fetch→解析为文本，才能喂给 LightRAG 抽取。**这是 ingestion layer 的职责。** |
| 实体/关系回读 | `getEntities/getRelations/getGraphNeighbors` 在内存 client 直接读 Map；HTTP client 需对接 server 的 graph 导出端点。 |
| 抽取层选型 | LightRAG 自带 LLM 抽取；是否叠加 LlamaIndex 抽取层需裁决（见 §7）。 |

---

## 3. 真实 LightRAG server / local deployment 接入方案（焦点 1）

### 3.1 部署拓扑（推荐 Option A，P1 原型/首发）
```
                    ┌─────────────────────────────────────────────┐
   SourceRef ──────▶│  Electron 主进程 / 本地 sidecar             │
   (UI 触发)        │  lightrag-server  (Python, pip)             │
                    │   --port 9621 --workspace <space-id>        │
                    │   绑定 Ollama (localhost:11434)             │
                    └───────────────┬─────────────────────────────┘
                                    │ REST (fetch)
                    ┌───────────────▼─────────────────────────────┐
   TS 前端          │  LightRAGHttpClient implements LightRAGClient│
   (kcu)            │  baseURL = VITE_LIGHTRAG_BASE_URL ??         │
                    │           http://localhost:9621             │
                    └───────────────┬─────────────────────────────┘
                                    │ KnowledgeBackend 接口
                    ┌───────────────▼─────────────────────────────┐
                    │  LightRAGBackend (adapter, 不变 5 方法)      │
                    └─────────────────────────────────────────────┘
```
- **安装**：`pip install "lightrag-hku[api]"` → `lightrag-server --port 9621 --workspace kcu-default`。
- **Ollama 绑定**（与 Stage 7 验证一致，RTX 3060 6GB 实测可跑）：
  - `LLM_BINDING=ollama`、`LLM_MODEL=qwen2.5-coder:7b`、`LLM_BINDING_HOST=http://localhost:11434`、`LLM_MODEL_MAX_TOKEN_SIZE=8192`
  - `EMBEDDING_BINDING=ollama`、`EMBEDDING_MODEL=nomic-embed-text`、`EMBEDDING_DIM=768`
- **存储**：默认 `NetworkXStorage` → `data/rag_storage/graph_chunk_entity_relation.graphml`（文件持久化，零外部服务，P1 首选）。
- **数据隔离**：`--workspace` 区分员工/空间知识域（对应 ownerAgent 维度，但 owner 仍由 client/backend side-map 承载，见 §5）。
- **Auth**：本地单用户可关闭；如需可选 `LIGHTRAG_API_KEY`，`LightRAGHttpClient` 在 header 带 `X-API-Key`。

### 3.2 `LightRAGHttpClient` 端点映射（设计）
| `LightRAGClient` 方法 | `lightrag-server` 端点 | 备注 |
|---|---|---|
| `insert(content, sourceId)` | `POST /documents/text` `{ text }` | sourceId 由 client 内部 `docIdBySource` Map 记录血缘；LightRAG 自管 doc id |
| `query(text, mode)` | `POST /query` `{ query, mode, top_k }` | mode ∈ local/global/hybrid/naive/mix |
| `getEntities()` | graph 导出端点 | 见 §3.3 |
| `getRelations()` | graph 导出端点 | 见 §3.3 |
| `getGraphNeighbors(nodeId)` | graph 导出端点 + 本地邻接构建 | 见 §3.3 |

### 3.3 实体/关系回读（待裁决 D6）
LightRAG server 内置 `graph_routes.py`（实体/关系探索端点）。两种取法：
- **(A) 复用内置 graph 路由**：直接对接，零额外代码；需确认返回结构含 entity_name/entity_type/description/source_ids 与 src_id/tgt_id/description。
- **(B) 在 sidecar 增加 `/graph/export` 端点**：封装 `rag.get_graph()` 返回 `{entities, relations}` 规整 JSON。更稳，但需在 Python 侧加少量 FastAPI 代码（仍属 ingestion/server 层，不污染 TS `KnowledgeBackend`）。

**推荐**：先 (A)，若内置路由字段不足再补 (B)。两种都在 server 侧，TS 侧 `LightRAGHttpClient` 仅做 fetch + 映射，严格守 R6。

---

## 4. Ingestion Pipeline 设计（焦点 2）

### 4.1 三层分离（核心架构约束）
```
┌─────────────────┐   ┌──────────────────────┐   ┌──────────────────────────┐
│ Ingestion Layer │──▶│ LightRAG Client       │──▶│ KnowledgeBackend Adapter │
│ (SourceRef→文本) │   │ (insert/query/graph) │   │ (LightRAGBackend, 5 方法)│
└─────────────────┘   └──────────────────────┘   └──────────────────────────┘
   Scrapling / PDF /        HTTP ↔ lightrag-server       唯一接触核心模型 seam
   GitHub / ASR / chat
```
- **Ingestion Layer 是唯一允许出现 Scrapling 的地方**（用户约束）。它产出规范化 `IngestedDocument = { content: string, meta: { sourceRef, ownerAgent?, fetchedAt } }`。
- `LightRAGBackend.importSource(src)` 内部调用 ingestion 层取 content，再 `client.insert(content, sourceId)`。**Ingestion 不进入 `KnowledgeBackend` 接口签名**——接口仍是 `importSource(src: SourceRef)`，ingestion 是 adapter 内部实现细节。
- 这满足 R6 + 用户「Scrapling 保持在 ingestion layer，不进入 KnowledgeBackend」。

### 4.2 各 SourceRef 类型的 ingestion 组件
| SourceRef.type | Ingestion 组件（生产） | 原型（TS 占位） |
|---|---|---|
| `url` | **Scrapling**（`scrapling extract/fetch`，带 stealthy-fetch 反爬） → markdown/text | `fetch` + 基础正文提取（原型只验证链路） |
| `pdf` | pdfplumber / PyMuPDF 文本抽取（Python） | 原型跳过/占位文本 |
| `video` | 本地 ASR（Whisper/paraformer，后续阶段） → 转写文本 | 原型跳过 |
| `github` | git clone / GitHub API 取文件树文本（Python） | 原型跳过 |
| `chat` | 已是文本，直接透传 | 透传 |

- **生产侧 Scrapling 全在 Python sidecar**（与 LightRAG server 同进程或同服务），TS 前端从不 import Scrapling。
- **原型侧**：为不引入 Python 服务依赖，`InMemoryLightRAGClient` 路径下 ingestion 用确定性 TS 占位（如 Stage 7 既有的 `sourceRefToContent`），仅验证「SourceRef 能流到 importSource」；真实 Scrapling/PDF 采集留待 Stage 8 编码在 sidecar 落地。

---

## 5. `SourceRef → Knowledge Universe` 数据流（焦点 3）

```
SourceRef{type,uri}
   │  (UI/Employee 触发 importSource)
   ▼
LightRAGBackend.importSource(src)                      ← adapter 内
   │
   ├─[ingestion layer] fetch+parse by type
   │      url  → Scrapling → markdown
   │      pdf  → PDF extractor → text
   │      ... → IngestedDocument{content, meta}
   │
   ├─ client.insert(content, sourceId)                 ← LightRAGClient 契约
   │      │  (真实: POST /documents/text → lightrag-server)
   │      ▼
   │   LightRAG 内部 LLM 抽取 → 实体/关系 → NetworkX 图
   │      sourceId 记录为 source 节点 id `src:<hash>`
   │
   └─ return { nodeId: sourceId }

listNodes()    → client.getEntities()   → 映射 KnowledgeNode（entityToNode）
listEdges()    → client.getRelations()  → 映射 KnowledgeEdge（relationToEdge）
getNeighbors() → client.query + getGraphNeighbors → 邻居+score+reason
getMemory()    → memoryProvider 委派（R5，绝不查图）
```
- **ownerAgent 归属**（D3，沿用 Stage 7）：`importSourceAs(src, ownerAgent)` 在 adapter 内 `ownerBySource.set(sourceId, ownerAgent)`，映射时回填 `KnowledgeNode.ownerAgent`；图的 entity meta 也带 `owner_agent`（side-map，不污染接口）。
- **source 血缘**：`src:<hash>` 节点 id 稳定，回读时 `KnowledgeNode.source` 由 `sourceIdAsRef` 重建。
- **SharedKnowledgeSpace 零改动**：上述全部发生在 adapter 之后，UI 只读 `KnowledgeBackend` 5 方法，数据流对前端透明（满足 `sharedKnowledgeSpaceNoRegression`）。

---

## 6. Scrapling 评估（焦点 4）

**结论：推荐作为 `url` 型 SourceRef 的 ingestion 组件加入，置于 ingestion layer。**

| 维度 | 评估 |
|---|---|
| 许可 | **BSD-3-Clause**（PyPI/GitHub 确认）—— 与 LightRAG MIT、NetworkX BSD 同属宽松许可，商业化前置审查无阻碍 |
| 能力 | 自适应网页采集：`scrapling extract/fetch/stealthy-fetch`，支持 CSS selector、浏览器指纹伪装、Cloudflare 绕过（stealthy），单请求到全站爬取 |
| 依赖 | 核心仅解析引擎；fetchers/浏览器需 `scrapling[fetchers]` + `scrapling install`（下载 Chromium 类依赖）。**这是 Python 侧依赖，不影响 TS 打包体积** |
| 隔离性 | 完全在 ingestion layer / Python sidecar，**不 import 到 `KnowledgeBackend`/核心模型/UI**（满足用户硬约束） |
| 风险 | 反爬/指纹能力涉及合规；需遵守目标站 robots.txt 与本地法规（其 LICENSE disclaimer 已声明）。生产需加速率限制与域名白名单 |

- **不进入 KnowledgeBackend**：`KnowledgeBackend` 接口与 `types.ts` 不引用 Scrapling；Ingestion 模块是 adapter 的可选依赖。
- **Feature flag**：ingestion 的 Scrapling 路径默认关闭，经类似 `__KCU_ENABLE_SCRAPING` 或 sidecar 配置开启，避免原型期误触外部网络。

---

## 7. LlamaIndex 抽取层评估（焦点 5）

**结论：Phase 1 不引入 LlamaIndex。仅在「实体质量不足」或「迁 Memgraph/Neo4j 后端」时作为可选抽取增强（R2 既定）。**

| 维度 | 评估 |
|---|---|
| LightRAG 自带抽取 | LightRAG 已用 LLM 做实体/关系抽取（built-in），Phase 1 直接复用，零额外依赖 |
| LlamaIndex PropertyGraph | `PropertyGraphIndex` + `SchemaLLMPathExtractor`（本体约束抽取）/ `GraphRAGExtractor` 是更模块化的抽取层，但**与 LightRAG 抽取重叠** |
| 引入成本 | 额外 Python 依赖树（llama-index 系列较重）；且需决定「用 LightRAG 抽取还是 LlamaIndex 抽取」二选一，增加架构分叉 |
| 何时值得 | (a) 需要 schema-guided 本体约束降低图谱噪声；(b) 迁 Memgraph/Neo4j 时借 LlamaIndex 的 `Neo4jPropertyGraphStore` 做图存储/社区摘要；(c) 需要 VectorContextRetriever + LLMSynonymRetriever 多策略混合检索 |
| 隔离性 | 即便未来引入，也只作 ingestion/client 内部抽取层（R2），**绝不进 `KnowledgeBackend`/UI** |

- **Stage 8 编码范围建议排除 LlamaIndex**；在 Mini Plan 待裁决 D5 留作「否（暂不入）」默认，用户可改。

---

## 8. 边界对照 + 验收规划

### 8.1 守约对照（R6 / R7 / 用户约束）
| 约束 | 本 Plan 如何满足 |
|---|---|
| R6 LightRAG 仅 backend 实现 | `LightRAGClient`/`LightRAGBackend`/`LightRAGHttpClient` 全在 `backends/`，不外泄 `types.ts`；Scrapling/LlamaIndex 只在 ingestion/server 层 |
| R7 MockBackend 默认回退 | `createBackend()` 仍默认 `MockBackend`，新增 `http` 模式经 env/baseURL opt-in |
| 用户：Scrapling 不进 KnowledgeBackend | Scrapling 仅 ingestion layer（Python sidecar），TS `KnowledgeBackend` 不引用 |
| 接口/类型/UI 不改 | Stage 8 编码只新增 `lightragHttpClient.ts` + `ingestion/` + 改 `createBackend()` 一处；不碰 `types.ts`/`SharedKnowledgeSpace` |

### 8.2 提出码阶段的验收断言（供审核参考，本 Plan 不执行）
- `lightRAGHttpAdapterContractPass`：`LightRAGHttpClient implements LightRAGClient` 5 方法齐备，对接真实 server REST。
- `ingestionLayerIsolated`：Scrapling/PDF/GitHub 仅在 ingestion 模块，grep `KnowledgeBackend|types.ts` 不含 scrapling/llama 引用。
- `sourceRefFlowClosed`：真实 `SourceRef(url)` → ingestion → LightRAG 抽取 → `listNodes` 含对应节点。
- `knowledgeBackendInterfaceUnchanged`：接口 5 方法未变、无新增 ingestion 参数。
- `sharedKnowledgeSpaceNoRegression`：UI 只读 5 方法，行为与 Mock 一致。
- `mockFallbackAvailable`：未配置 baseURL 时仍 `MockBackend`。
- `licenseReviewRecorded`：Scrapling BSD-3 / LightRAG MIT 已归档（沿用 `LICENSE_REVIEW_LIGHTRAG.md`，可追加 Scrapling 段）。

> 注：真实 server 集成测试需 WSL/Python 环境起 `lightrag-server` + Ollama + Scrapling（与 Stage 6 lockfile 的 WSL 约束一致）；原型期以 `InMemoryLightRAGClient` 闭环 + `LightRAGHttpClient` 的 mock-server 单测覆盖契约，不强制每次起真实服务。

---

## 9. Scope Freeze + 待裁决 D1–D7

### 9.1 本 Plan 提交 Scope（design only）
- **仅** `docs/STAGE8_LIGHTRAG_PRODUCTION_INGESTION_MINI_PLAN.md`。
- 不编码、不改任何 `.ts`、不碰 UI、不引入依赖。

### 9.2 若审核通过进入编码，预计 Scope（供参考，非本次）
- 新增 `src/knowledge/backends/lightragHttpClient.ts`（`LightRAGClient` HTTP 实现）。
- 新增 `src/knowledge/ingestion/`（TS 原型占位；真实 Scrapling/PDF 在 Python sidecar）。
- 改 `createBackend()`：新增 `http` 模式（env `VITE_LIGHTRAG_BASE_URL` / `globalThis` 开关），`MockBackend` 仍默认。
- 可选：Python `knowledge-ingest` sidecar 规格（Scrapling + PDF + GitHub + LightRAG 对接）。
- **禁止**：改 `KnowledgeBackend` 接口 / `KnowledgeNode`/`KnowledgeEdge` / Employee / Rail / UI / SharedKnowledgeSpace；引入 Neo4j/Memgraph 强制依赖；删 `MockBackend`；Scrapling 进入 `KnowledgeBackend`；引入 LlamaIndex（Phase 1）。

### 9.3 待裁决（D1–D7）
- **D1** 部署拓扑：单 `lightrag-server` 进程（Option A，推荐）vs 独立 ingestion 微服务 vs 同进程扩展端点的 sidecar？
- **D2** `LightRAGHttpClient` baseURL/Auth 来源：构建期 env（`VITE_LIGHTRAG_BASE_URL`）vs 运行时 config vs 沿用 `globalThis` 开关模式？
- **D3** ingestion 归属：编码原型用 TS 占位（不依赖 Python）vs 直接落地 Python sidecar（生产形态）？**推荐原型 TS 占位、生产 Python sidecar 分两步走。**
- **D4** Scrapling 采纳：作为 `url` ingestion 组件加入（推荐 ✓，BSD-3 兼容），默认 feature-flag 关闭？
- **D5** LlamaIndex：`Phase 1 不引入`（推荐 ✓，留作可选增强）；还是现在就并行接抽取层？
- **D6** 实体/关系回读：复用 LightRAG 内置 graph 路由（A）vs 加 `/graph/export` 端点（B）？
- **D7** 存储后端推进时序：P1 锁定 `NetworkXStorage`（文件 graphml）vs 提前评估 Memgraph（P2）？**推荐 P1 锁 NetworkX，守 R3 渐进。**

---

*本 Plan 停在审核节点。确认并裁决 D1–D7 后，再决定是否进入 Stage 8 编码；不自动进入生产 KG 部署。*
