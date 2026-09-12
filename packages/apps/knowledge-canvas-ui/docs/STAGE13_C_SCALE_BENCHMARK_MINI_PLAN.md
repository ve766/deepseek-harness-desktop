# S13-C Scale Benchmark — Mini Plan（仅设计，待审核）

> **状态**：🟡 独立 Mini Plan，提交 **S13-C Mini Plan Review Node**。**本文档不执行任何 benchmark、不编码。**
> **父文档**：`STAGE13_C_SCALE_BENCHMARK.md`（D6 高层设计，commit `e6d02bd`）。
> **前置**：S13-B 已 Closed（B-1 `14340ce` / B-2 零代码改动），链路端到端跑通。
> **纪律**：Mini Plan → 审核 → 明确批准 → 执行。审核前不跑、不编码。

---

## 1. 目标与红线

### 1.1 目标
在**已就绪的真实链路**上量化规模表现，产出可复核的指标报告：

```
Knowledge OS → LightRAGBackend → LightRAG 1.5.7 → Ollama qwen3:8b → nomic-embed-text → Graph + Vector + LLM Answer
```

### 1.2 允许（S13-C 只能做这三件事）
- ✅ benchmark（跑测量）
- ✅ 记录指标
- ✅ 输出报告

### 1.3 禁止
- ❌ 新功能 / 新接口 / 新依赖
- ❌ UI 修改
- ❌ Backend contract 修改（`KnowledgeBackend` 五方法 + `LightRAGClient`）
- ❌ Runtime / Workflow / Agent Loop 引入
- ❌ 数据库替换
- ❌ Scrapling 安装
- ❌ 自动进入后续阶段

---

## 2. 已核实事实（决定方案可行性）

### 2.1 造数端点（OpenAPI 实测）
| 端点 | 契约 | 用途 |
|---|---|---|
| `POST /graph/entity/create` | `{entity_name, entity_data}` | **无 LLM** 构造合成实体 → **C1 关键** |
| `POST /graph/relation/create` | `{source_entity, target_entity, relation_data}` | **无 LLM** 构造合成关系 |
| `POST /documents/texts` | `{texts[], file_sources[], chunking?}` | 批量插入（**C3**） |
| `POST /documents/text` | `{text, file_source}` | 单条插入 |
| `POST /documents/clear_cache` | `{}` | 清 LLM 缓存（**C2 一致性关键**） |
| `GET /documents/status_counts` · `/documents/pipeline_status` | — | 进度监控 |

### 2.2 环境约束（实测）
- GPU **RTX 3060 Laptop 6 GB**；`qwen3:8b` @ `num_ctx=4096` / `think=false` 时占 **6.0 GB、30% CPU / 70% GPU**（非全 GPU）。
- 单文档抽取实测 **分钟级**；已装 `cache`（`kv_store_llm_response_cache.json` 28 KB）。
- `working_dir` 基线 = **161 KB**：`graphml` 6.2 KB · `vdb_entities` 45 KB · `vdb_relationships` 39 KB · `vdb_chunks` 6.6 KB · `kv_store_*` 合计 ~9 KB。

### 2.3 现有工具（复用，不新增依赖）
- 真实客户端 `LightRAGHttpClient` / `LightRAGBackend`（S13-A/B 产物）
- 验证法：`tsx` + **`.mts`**（top-level await）+ **`file:///F:/...`** import（B-2 已验证）
- 计时：`performance.now()`

---

## 3. C1 — Graph Scale Benchmark

### 3.1 设计
在**隔离的 benchmark workspace** 上用 `entity/create` + `relation/create` 构造三档合成图，然后用真实客户端测量读延迟。

| 档位 | 实体 | 关系（每节点 2 条，链+随机长边） |
|---|---|---|
| S1 | **100** | 200 |
| S2 | **500** | 1000 |
| S3 | **1000** | 2000 |

- **不使用 LLM** → 构造快、确定、可重复。
- 隔离：用 LightRAG `--workspace` 或在评测前清空（见 §6 隔离策略），避免污染既有 `s13b-smoke` 数据。

### 3.2 指标（每档各测 N=20 次，报 p50 / p95 / max，单位 ms）
| 指标 | 测量方式 |
|---|---|
| `listNodes latency` | `LightRAGBackend.listNodes()`（= `getEntities()`，`label=*` 全图） |
| `listEdges latency` | `LightRAGBackend.listEdges()`（= `getRelations()`） |
| `getNeighbors latency` | `getNeighbors(<seed>, '')`（`?label=<id>&max_depth=1`） |

### 3.3 附带观察
- 全图请求的实际传输体量（`label=*` 的响应字节数）随规模的线性度。
- `is_truncated` 是否在 1000 节点时触发（当前 `max_nodes=2000`）。

---

## 4. C2 — Retrieval Benchmark

### 4.1 固定环境（不可变）
`Ollama qwen3:8b` · `nomic-embed-text` · `LightRAG 1.5.7` · `num_ctx=4096` · `think=false` · `MAX_ASYNC=1`

### 4.2 查询集
- **Q-set（固定 10 问）**：覆盖实体型 / 关系型 / 跨实体聚合型问题，针对 C1 构造的合成图 + 既有 `s13b-smoke` 图。

### 4.3 指标
| 指标 | 定义 | 测量方式 |
|---|---|---|
| **query latency** | 端到端 `/query` 耗时 | **缓存冷**（每轮前 `clear_cache`）与**缓存热**分别记录 p50/p95；明确区分 LLM 生成耗时与检索耗时（`response_time` 字段） |
| **references 返回完整性** | 1.5.7 `references[]` 是否为非空、`file_path` 是否可解析回实体 | 统计 `refs>0` 的比例 + `file_path→entity` 解析成功率（B-1 的解析逻辑） |
| **answer consistency** | 同一问在**缓存冷**下重复 3 次的答案一致性 | 归一化后比对（长度/关键实体覆盖率/逐字相同率）；缓存热亦记录（应完全一致） |

### 4.4 已知语义限制（须在报告中明示）
1.5.7 `references` 为**文件级**（无实体名/分数），故 `LightRAGQueryHit.score` 恒为 **0**（B-1 已记录）——「references 完整性」按**可解析性**而非分数评测。

---

## 5. C3 — Import / Memory Growth

### 5.1 ⚠️ 可行性风险（必须先裁决）
逐条插入需 **LLM 抽取**（分钟级/文档）。按实测 ~1–3 min/doc：
- 100 imports ≈ **1.7–5 h**
- 500 imports ≈ **8–25 h**
- 1000 imports ≈ **17–50 h** ← **不可inline完成**

→ 因此本 Plan 提出**分层执行策略（DP-C3 待裁决）**：
- **A（推荐）**：**100 imports 全量实跑** + 500/1000 **外推**（以实测 per-doc 成本线性建模，标注置信区间与偏差来源）。
- **B**：三档全量实跑（需接受数十小时机器时间，建议后台/分夜执行）。
- **C**：降规模（如 25/50/100）全量实跑 + 曲线外推。
- 无论哪种：**每档前记录基线快照**，失败即停并记录（不重试掩盖）。

### 5.2 设计
| 档位 | imports |
|---|---|
| I1 | 100 |
| I2 | 500 |
| I3 | 1000 |

- 用 `POST /documents/texts`（批量）降低 HTTP 开销；文档为**可控合成长文**（固定 token 量，消除输入方差）。
- 监控 `pipeline_status` / `track_status` 判定完成；记录成功/失败分类。

### 5.3 观察指标（每档前后各采样一次）
| 指标 | 观测对象 |
|---|---|
| **KV store 增长** | `kv_store_*.json` 各文件字节数（`full_docs`/`text_chunks`/`entity_chunks`/`relation_chunks`/`doc_status`/`llm_response_cache`） |
| **Vector DB 增长** | `vdb_entities.json` / `vdb_relationships.json` / `vdb_chunks.json` 字节数 |
| **Graph 增长** | `graph_chunk_entity_relation.graphml` 字节数 + `label/list` 实体数 + `edges` 数 |
| 过程指标 | ingest 成功率、per-doc 平均耗时（用于外推） |

基线已固定（§2.2），报告以「相对基线增量 + 增长率」呈现。

---

## 6. C4 — End-to-End Nox Research

### 6.1 链路验证
```
Question → Knowledge Retrieval → Context Injection → LLM Generation → Answer
```
逐环节打点：`retrieve()`（`KnowledgeQueryCapable` seam）→ 上下文节点数 → `getLlmClient()` → 生成 → 答案。

### 6.2 指标
| 指标 | 定义 |
|---|---|
| **成功率** | Q-set 中「检索有 hits 且生成非空答案」的比例 |
| **延迟** | 各环节分段时间 + 端到端总计（p50/p95） |
| **fallback 行为** | 逐项验证优雅降级：① 检索 `backend-unsupported`（Mock 后端）② 检索空 hits ③ LLM `available:false`（浏览器降级桩）④ 生成错误/超时 —— 各自的可观测表现与是否崩溃 |

### 6.3 隔离性
C4 只经 `llmContext.ts` seam + `employeeKnowledgeAccess`，**不直连 providers**（延续 S13-A 约束）。

---

## 7. Harness 与隔离策略

- **Harness 位置**：仓库外 `F:/dsh-lightrag/bench/`（`*.mts`），**不进入 git**（沿用 B-2 验证法），避免污染工作树。
- **数据隔离**：C1/C3 使用**独立 workspace 或在评测前快照 + 清空**，避免与既有 `s13b-smoke` 数据混淆；评测后按需恢复。
- **可重复性**：固定随机种子、固定文档 token 量、固定 Q-set、固定环境参数；每档记录环境指纹（版本、num_ctx、显存占用）。
- **产出**：Markdown 报告 + **CSV**（逐次原始值，供复核）。
- **中止条件**：任何环节出现环境级故障（embedding/代理/显存）→ 停止并如实记录，不用重试掩盖。

---

## 8. 交付物

1. `docs/STAGE13_C_SCALE_BENCHMARK_REPORT.md`（结论 + 指标表 + 瓶颈定位）
2. `docs/STAGE13_C_METRICS.csv`（原始逐次测量值）
3. Harness 脚本（仓库外 `F:/dsh-lightrag/bench/`，**不入 commit**）
4. 环境指纹 + 基线快照对照（§2.2）

---

## 9. 决策点（待裁决）

| # | 决策 | 建议 |
|---|---|---|
| **DP-C1** | C1 造图方式：合成图（`entity/create`，无 LLM） vs 真实文档导入 | **合成图**（快、确定、可控规模） |
| **DP-C3** | C3 执行策略：A 100 全量+外推 / B 三档全量 / C 降规模 | **A**（时间可控，偏差已标注） |
| **DP-C2** | answer consistency 判定口径（逐字 vs 实体覆盖） | **实体覆盖率 + 逐字率双记** |
| **DP-C4** | fallback 覆盖范围（是否含 Mock 后端对照） | **纳入**（Mock `backend-unsupported` 对照） |
| **DP-ISO** | 数据隔离：独立 workspace vs 快照清空 | **快照清空**（复用现有实例，改动最小） |
| **DP-TIME** | 本轮执行的墙钟预算上限 | 建议 **≤ 3 h**，超时即停并按 §5.1-A 外推 |

---

## 10. 状态

🟡 **停在 S13-C Mini Plan Review Node。**
未跑任何 benchmark、未编码、未改业务代码、未引入 Runtime/Workflow。等 DP-C1..DP-TIME 裁决 + 明确批准后方可执行。
**执行完成后停在 S13-C Acceptance Node，不自动进入后续阶段。**
