# Stage 14 Ingestion Capability Research（LightRAG 1.5.7 摄入能力盘点）

> **类型**：Design-only 能力盘点（**不编码**、**不安装**、**不调整环境**、**不进入 Stage 14 编码**）
> **Baseline**：`0bf2304`（Stage 13 Closed Node，`src/` modified = 0）
> **被盘点对象**：`lightrag-hku 1.5.7`（已安装在 `F:/dsh-lightrag/venv`）+ 本仓 `lightragHttpClient.ts`
> **核实方法**：全部结论来自**只读**源码/规范读取（venv `site-packages` + 运行期 `openapi.json` 快照），无推测、无环境变更
> **状态**：🟡 停在 **Stage 14 Mini Plan Review Node**
> 生成时间：2026-09-10

---

## 0. 纪律声明与核实边界

**本文件不落地任何代码/环境变更。** 未执行的动作：

| 动作 | 是否执行 |
|---|---|
| 修改 TS / React / LightRAG client / Backend contract / UI | ❌ 未执行 |
| 安装任何组件（含 Scrapling） | ❌ 未执行 |
| 调整环境（含重启服务、改 `.env`、改 Ollama 参数） | ❌ 未执行 |
| 进入 Stage 14 编码 | ❌ 未执行 |

**核实手段**：`Read` / `Grep` / 只读 HTTP `GET`（探测服务在线性）。所有默认值取自 `lightrag/constants.py`，所有环境变量绑定路径取自 `lightrag/api/config.py`，所有消费点取自调用方源码行号。

**⚠️ 核实局限（必须如实声明）**：
- 撰写本文件时 **LightRAG 服务处于停止状态**（`GET /health` → HTTP `000`）。因此 **batch / scan 端点未做运行时实机验证**，其契约来自 `openapi.json` 与路由源码（**规范级**可信，非**运行级**验证）。按「不调整环境」约束，**本次未启动服务**；运行级验证顺延至编码阶段首个子步骤。
- 吞吐倍率类数字凡非实测者，均已显式标注为**估算**。

---

## 1. 问题定义：瓶颈在哪里（回引 S13-C 实测）

Stage 14 的动因来自 S13-C 的实测结论：

| 事实 | 来源 |
|---|---|
| 导入实测 **3.65 min / doc**；1000 docs 外推 **61–167 h** → inline 不可行 | S13-C C3 |
| 期间出现 `failed:3/10`；`ollama ps` 显示 `qwen3:8b`(6.0 GB) + `nomic-embed-text`(0.3 GB) = **6.3 GB > 6 GB** | S13-C C3 |
| 检索链本身健康（冷 31.6 s / 热 84 ms，references 100%） | S13-C C2 |
| 图邻域读取与规模解耦（`getNeighbors` 恒定 1.9–2.7 ms） | S13-C C1 |

**瓶颈定性（关键判断）**：慢的不是「HTTP 往返」或「入队」，而是**每篇文档的 LLM 实体抽取**（`qwen3:8b` 在 6 GB 显存下被迫 CPU offload）。因此：

> **任何只减少 HTTP/入队开销的优化，都拿不到数量级收益。**
> Stage 14 的优化空间只有两条：**(a) 减少每文档的 LLM 调用量**、**(b) 让抽取推理真正跑进显存**。

这条判断贯穿下文所有结论。

---

## 2. 能力盘点 ①：Batch Insert

### 2.1 端点事实（规范级）

| 端点 | 请求体 | 必需 | 语义 |
|---|---|---|---|
| `POST /documents/texts` | `InsertTextsRequest` | `texts` | **单请求批量文本插入** |
| `POST /documents/text` | `InsertTextRequest` | `text` | 单条文本插入（我们当前在用） |
| `POST /documents/upload` | multipart `file` | `file` | 上传文件到 `input_dir` |

`InsertTextsRequest` 字段：

```
texts:        string[]                       (required)
file_sources: string[] | null                (minItems 0, optional)
chunking:     TextChunkingConfig | null      (optional)
```

`InsertTextRequest` 字段：

```
text:        string                          (required)
file_source: string | null                   (minLength 0, optional)
chunking:    TextChunkingConfig | null       (optional)
```

`TextChunkingConfig`：

```
strategy: string   default = "fixed_token"
params:   object   default = null
```

### 2.2 批量上限

- 环境变量 **`MAX_TEXTS_PER_REQUEST`** → `args.max_texts_per_request`
- 默认 **`DEFAULT_MAX_TEXTS_PER_REQUEST = 0`**
- 服务端存在超额拒绝路径（**HTTP 413**，见 `document_routes.py` §3462 附近），**仅当 limit 为真值时触发**
- → **默认 0 表示无上限**（即默认不会因数量被 413 拒绝）

### 2.3 当前 `lightragHttpClient` 是否可复用

| 项 | 现状 |
|---|---|
| 接口 | `LightRAGClient.insert(content: string, sourceId: string): Promise<void>`（**单文档**） |
| 实现 | `lightragHttpClient.ts` → `POST /documents/text`，body `{ text, file_source }` |
| 批量能力 | **未使用**；`/documents/texts` 从未被调用（S13-B B-1 只对齐了单条端点） |

**结论：不可直接复用，需扩展。** 扩展方式（供编码阶段决策，本文件不实现）：
- 在 `LightRAGClient` **接口外**新增可选批量方法（如 `insertMany(docs[])`），**不触碰 5 方法 `KnowledgeBackend` 契约**；
- 与 S13-A 的 `query()`、`retrieve()` 同类：**接口外扩展**，缺失即优雅降级。

### 2.4 批量的真实收益（诚实评估）

**收益（确定）**：
- 把 N 次 HTTP 往返 + N 次「入队/占位/写 `doc_status`」合并为 1 次；
- 让 N 篇文档**同时进入管线的调度窗口** → 可与 `max_parallel_insert` 形成流水线重叠（parse / embed / extract 交叠），而非严格串行。

**无收益（确定）**：
- **不减少 LLM 抽取调用量**。管线仍对每篇文档的每个 chunk 调用抽取 LLM。

**估算**（非实测，标注为估算）：在当前 `MAX_ASYNC=1` 的严格串行 LLM 配置下，批量+流水线预计带来 **约 1.2–2×** 吞吐改善（主要来自解析/嵌入与抽取重叠，以及消除逐条往返），**不足以改变数量级**。

---

## 3. 能力盘点 ②：Directory Scan

### 3.1 端点事实

| 端点 | 方法 | 请求体 | 响应 |
|---|---|---|---|
| `/documents/scan` | `POST` | **无** | `ScanResponse`（含 `status`、`track_id`） |
| `/documents/scan/status/{track_id}` | `GET` | — | 扫描任务状态 |
| `/documents/supported_file_types` | `GET` | — | 支持的文件类型清单 |

### 3.2 扫描语义与服务端队列机制（源码级）

`scan_for_new_documents` 的行为（`document_routes.py` §4410 起，docstring 逐条核实）：

1. **扫描 `input_dir`**（`--input-dir`，我们配置为 `F:/dsh-lightrag/inputs`），发现新文件；
2. **分类阶段 → 入队阶段**，入队按批次进行，批量由 **`SCAN_ENQUEUE_BATCH_SIZE`** 界定（默认 **`DEFAULT_SCAN_ENQUEUE_BATCH_SIZE = 100`**）；
3. **拒绝条件（返回 `scanning_skipped_pipeline_busy`，且不派发后台任务）**：
   - `pipeline_status["busy"]` —— 处理循环或另一破坏性任务在跑
   - `pipeline_status["scanning"]` —— 已有扫描在进行（分类或处理任一阶段）
   - `pipeline_status["pending_enqueues"] > 0` —— `/upload`、`/text`、`/texts` 已订位但尚未落 `doc_status`（避免与分类读竞态）
   - `pipeline_status["manual_freeze_requested"]` —— 手工重试正在排空管线
   - 早前未 ACK 的手工重试仍在入口邮箱排队
4. **错误语义**：job store 满 → **429**；`track_id` 冲突 → **409**；job store 不可用 → **503**；
5. **记录先于响应**：`track_id` 记录在响应前落库，故**立即**查 `/documents/scan/status/{track_id}` 不会 404；
6. 存在 `run_scanning_process` 的**排他 FAILED 重置 + 分类**语义，随后释放 `scanning_exclusive`，允许上传并发落地。

### 3.3 是否适合替代逐文件 insert

| 维度 | 结论 |
|---|---|
| 吞吐 | **不改变 LLM 抽取总量** → 无数量级收益（同 2.4 判断） |
| 工程性 | **明显更优**：服务端批量入队（100/批）、服务端持有 job 记录、`track_id` 可查、天然可断点/可观测 |
| 可恢复性 | **优于**客户端逐条循环（客户端可只做「投递 + 轮询」） |
| 适用场景 | **长时离线 ingestion**（正是 S13-C 指出的 61–167 h 场景） |
| 不适合 | 需要**客户端逐条确认/计费/归属**的细粒度场景（我们的 `ownerAgent` 归因在客户端 `ownerBySource` side-map，scan 路径**不携带 owner 归因**） |

> ⚠️ **架构注意点**：`ownerAgent` 归因由 `LightRAGBackend.ownerBySource`（客户端 side-map）承担，**scan 路径不经该映射** → 若改用 scan，**员工归属信息会丢失**。这是 scan 与我们当前贡献闭环（Stage 11/12）的**语义冲突**，必须在编码阶段显式处理（或仅将 scan 用于「无归属的批量语料预载」）。

---

## 4. 能力盘点 ③：并发/吞吐参数生效性矩阵

全部取自 `lightrag/api/config.py`（绑定）+ `lightrag/constants.py`（默认）+ 调用点源码。

### 4.1 用户点名的 5 个参数 —— **全部真实存在**

| 用户所列 | 真实环境变量 | 绑定属性 | 默认值 | 消费点（源码） | 判定 |
|---|---|---|---|---|---|
| `MAX_PARALLEL_INSERT` | `MAX_PARALLEL_INSERT` | `args.max_parallel_insert` | **3** (`DEFAULT_MAX_PARALLEL_INSERT`) | `pipeline.py:2573` `asyncio.Semaphore(self.max_parallel_insert)`；`pipeline.py:2672` worker 循环 | ✅ **真实生效** |
| `MAX_ASYNC_LLM` / `MAX_ASYNC` | `MAX_ASYNC_LLM`，**回退** `MAX_ASYNC` | `args.max_async` | **4** (`DEFAULT_MAX_ASYNC`) | 基础 LLM 并发上限 | ✅ **真实生效**（两者都有效，前者优先） |
| `EMBEDDING_BATCH_NUM` | `EMBEDDING_BATCH_NUM` | `args.embedding_batch_num` | **10** (`DEFAULT_EMBEDDING_BATCH_NUM`) | 向量库 `_max_batch_size`（`kg/nano_vector_db_impl.py:310` 等） | ✅ **真实生效** |
| `EMBEDDING_FUNC_MAX_ASYNC` | `EMBEDDING_FUNC_MAX_ASYNC` | `args.embedding_func_max_async` | **8** (`DEFAULT_EMBEDDING_FUNC_MAX_ASYNC`) | `api/run_with_gunicorn.py:53`（embedding limit） | ✅ **真实生效**（见下方 WORKERS 注） |
| `WORKERS` | `WORKERS` | `args.workers` | **2** (`DEFAULT_WOKERS`，LightRAG 自身拼写如此) | **仅 gunicorn 入口** | ⚠️ **对 `lightrag-server` 不生效** |

**⚠️ `WORKERS` 的生效性判定（重要）**：
`lightrag/api/lightrag_server.py` 主入口显式注释并调用：

```python
# Start Uvicorn in single process mode. ...
uvicorn_config = { "app": app, "host": ..., "port": ..., "log_config": None }
print("Starting Uvicorn server in single process mode ...")
uvicorn.run(**uvicorn_config)
```

→ **`lightrag-server` 是单进程 uvicorn**，`workers` 仅出现在配置回显（`"workers": getattr(args, "workers", 1)`）与排空判定中，**不参与进程数**。
多进程需改用 **`lightrag-gunicorn`**（venv 中存在 `lightrag-gunicorn.exe`）。
**对我们的场景不建议**：单 GPU 6 GB，多 worker = 多进程争抢同一 Ollama → 显存竞争加剧、失败率上升。

### 4.2 额外发现的高价值参数（用户未列出但决定吞吐）

| 环境变量 | 属性 | 默认 | 含义 | 对吞吐的影响 |
|---|---|---|---|---|
| **`MAX_GLEANING`** | `entity_extract_max_gleaning` | **1** (`DEFAULT_MAX_GLEANING`) | 每 chunk 抽取的**额外 LLM 轮次** | **设为 0 → 每 chunk 抽取调用约减半**（估算 1.5–2× 吞吐） |
| **`FORCE_LLM_SUMMARY_ON_MERGE`** | `force_llm_summary_on_merge` | **8** (`DEFAULT_FORCE_LLM_SUMMARY_ON_MERGE`) | 合并实体/关系达阈值时触发 LLM 摘要 | 调高 → 合并期 LLM 调用减少（代价：摘要更粗）。源码要求 **≥3**（<3 会告警） |
| `ENABLE_LLM_CACHE_FOR_EXTRACT` | — | **True** | 抽取 LLM 响应缓存 | 重跑/重建时省调用 |
| `CHUNK_SIZE` | `args.chunk_size` | **1200** | 分块 token 尺寸 | 调大 → 每文档 chunk 数减少 → LLM 调用数减少（但单次输入变大，受上下文约束） |
| `CHUNK_OVERLAP_SIZE` | `args.chunk_overlap_size` | **100** | 分块重叠 | 调小 → 减少重复处理 |
| `LLM_TIMEOUT` | `args.llm_timeout` | **240** (`DEFAULT_LLM_TIMEOUT`) | **基础 LLM 超时** | 慢速推理下过小 → 抽取超时失败 |
| `TIMEOUT` | `args.timeout` | **300** (`DEFAULT_TIMEOUT`) | 通用超时（**≠ LLM 超时**） | — |
| `MAX_PENDING_DOCUMENTS` | — | **0** | 待处理文档上限 | 0 = 不限 |
| `PIPELINE_SCHEDULING_PAGE_SIZE` | — | **500** | 调度分页 | 大库调度 |
| `SCAN_ENQUEUE_BATCH_SIZE` | — | **100** | scan 入队批量 | scan 形态吞吐 |
| `MAX_TEXTS_PER_REQUEST` | — | **0**（无上限） | 批量插入上限 | 413 阈值 |

### 4.3 角色级 LLM 覆盖（决定「抽取」这类角色的并发与超时）

`lightrag/llm_roles.py` 的 `ROLES` 注册表（**已核实**）：

```
RoleSpec("extract", "EXTRACT", "extract LLM func")
RoleSpec("keyword", "KEYWORD", "keyword LLM func")
RoleSpec("query",   "QUERY",   "query LLM func")
RoleSpec("vlm",     "VLM",     "vlm LLM func")
```

每个角色支持独立覆盖（`config.py` §757 循环）：

```
{ROLE}_LLM_BINDING / {ROLE}_LLM_MODEL / {ROLE}_LLM_BINDING_HOST /
{ROLE}_LLM_BINDING_API_KEY / {ROLE}_MAX_ASYNC_LLM / {ROLE}_LLM_TIMEOUT
```

→ 即 **`EXTRACT_MAX_ASYNC_LLM`**、**`EXTRACT_LLM_TIMEOUT`**、**`KEYWORD_MAX_ASYNC_LLM`** 等均**真实生效**。
未设置的角色项回退到基础 LLM 配置（`lightrag.py` 的 `RoleLLMConfig` 文档明确：`timeout` 未设则回退 `default_llm_timeout`）。

> 🔎 **对 S13-B 观察的解释（重要修正）**：S13-B 曾记录「`TIMEOUT=900` 未覆盖每角色 240 s 超时」。
> 本次源码核实**解释了原因**：**`TIMEOUT` 与 `LLM_TIMEOUT` 是两个不同参数**（`args.timeout` vs `args.llm_timeout`，默认 300 / 240）。延长 LLM（含抽取角色）超时的**正确键是 `LLM_TIMEOUT`**，或对抽取单独用 `EXTRACT_LLM_TIMEOUT`。我们 `.env` 中的 `TIMEOUT=900` 并未触及 LLM 超时。

---

## 5. RTX 3060 6 GB + `qwen3:8b` 环境下的参数建议

**前提**：实测 `qwen3:8b` 在 `num_ctx=4096` 下占 **6.0 GB**、30% CPU offload；`nomic-embed-text` 占 **0.3 GB**；二者共存 **6.3 GB > 6 GB**。

### 5.1 ✅ 可安全提升吞吐（建议方向）

| 参数 | 建议方向 | 理由 | 风险 |
|---|---|---|---|
| **`MAX_GLEANING`** | **1 → 0** | 直接削减每 chunk 的抽取 LLM 轮次，**最高性价比** | 抽取召回可能略降（需以 C2 类指标复核） |
| **`FORCE_LLM_SUMMARY_ON_MERGE`** | **8 → 20~50**（或按需调高） | 减少合并期 LLM 调用 | 实体描述更粗；**不得 <3** |
| **`ENABLE_LLM_CACHE_FOR_EXTRACT`** | 保持 **true** | 重跑/重建零成本复用 | 无 |
| `MAX_TEXTS_PER_REQUEST` | 保持 0（或设为明确上限） | 0 = 无上限；设上限可防误投 | 无 |
| `SCAN_ENQUEUE_BATCH_SIZE` | 保持 100 | 服务端批入队已足够 | 无 |
| `LLM_TIMEOUT` / `EXTRACT_LLM_TIMEOUT` | **按需上调**（如 600–900） | 修正 S13-B 的键名误解，避免慢推理下**假失败** | 无（仅延长等待） |
| `EMBEDDING_BATCH_NUM` | 10 → **16~32** | 嵌入模型仅 0.3 GB，批量提升几乎无风险 | 并发与 qwen 共存时可能触发换入换出 |

### 5.2 ⛔ 会导致显存爆炸 / 稳定性下降（**禁止**）

| 参数 | 危险方向 | 已观测证据 |
|---|---|---|
| **`OLLAMA_LLM_NUM_CTX`** | **4096 → 8192+** | 实测 6.0 GB → **6.6 GB**，GPU 占比 70% → **36%**，抽取 `ReadTimeout` **失败**（S13-B） |
| **`MAX_PARALLEL_INSERT`** | **3 → 更高** | N 个并发抽取 → 并发 LLM 请求 → 显存压力上升。C3 已观测 `failed:3/10` 与 6.3 GB 双模型驻留 → **提高并发是本环境头号 OOM 风险** |
| **`MAX_ASYNC_LLM` / `EXTRACT_MAX_ASYNC_LLM`** | **1 → 4+** | 同上；GPU 算力不因并发增加，只增加排队与交换 |
| `WORKERS` / `lightrag-gunicorn` | 启用多进程 | 多进程争抢同一 Ollama → 显存竞争加剧 |
| `EMBEDDING_FUNC_MAX_ASYNC` | 8 → 更大 | 并发嵌入与抽取抢显存，可能把 qwen 挤出显存（→ 重新加载，更慢） |

> **核心原则**：在**单 GPU + 显存不足**的场景，**并发不产生吞吐，只产生排队与 OOM**。真正的杠杆是**减少 LLM 调用量**与**让模型跑进显存**。

### 5.3 关键取舍（必须实测确认）

- **`CHUNK_SIZE` 1200 → 更大**：减少 chunk 数 → 减少 LLM 调用；但 `num_ctx=4096` 下过大输入会压缩有效上下文。**方向可行，幅度需实测**。
- **`CHUNK_OVERLAP_SIZE` 100 → 更小**：减少重复内容处理，代价是跨块实体可能漏抽。
- **降并发换取稳定性**：把 `MAX_PARALLEL_INSERT` 显式设为 **1**（而非默认 3）+ `MAX_ASYNC=1`，可**提高成功率**（消除 C3 的 `failed:3`），但**降低名义吞吐**。这是「稳定性 vs 速度」的显式取舍，**建议作为 S14 的实测对照项**。

---

## 6. 四个候选方案（A / B / C / D）评估

| 方案 | 本质 | 吞吐收益 | 工程收益 | 是否触碰红线 | 评估 |
|---|---|---|---|---|---|
| **A. LightRAG 原生批处理增强**<br/>(`/documents/texts` + `/documents/scan` + 参数调优) | 用足上游既有能力 | **有限**：批端点不减少 LLM 工作量（估算 1.2–2×）；**参数调优（`MAX_GLEANING=0` 等）才是真收益来源**（估算 1.5–2×） | 服务端批量入队、`track_id` 可观测、可断点 | 需扩展 `LightRAGClient`（**接口外**，与既有 seam 范式一致）；**不改 5 方法契约** | ✅ **推荐作为第一步**（低成本、低风险、可即时验证） |
| **B. 外部 queue + worker** | 客户端侧持久队列 + 重试 + 断点续传 | **0**（编排不产生算力） | **高**：把 61–167 h 的离线任务变成可恢复、可观测、可中断的作业 | 纯外部脚本/harness（**不进 `src/`**）；不引入 Runtime/Workflow | ✅ **推荐作为长时离线运行的外壳**，与 A/D **并行**，不可单独作为吞吐方案 |
| **C. 文档预处理 / embedding 分离** | 把「慢的实体抽取」与「快的嵌入」在管线层解耦（自建 Python 侧车） | **潜在高**（可让抽取独占 GPU、嵌入批量化） | 中 | ⚠️ **触碰红线风险最高**：LightRAG 内部管线强耦合二者；自建侧车 ≈ 重造 ingestion 层，等同于 ROADMAP 的 Document Intelligence Agent 输入层，且易被解读为「引入 Runtime/Workflow」 | ⚠️ **不建议纳入 Stage 14**；应作为**独立 Stage**（需先有 Mini Plan + 架构审核） |
| **D. 延后换模型** | 换更小、可**全量驻显存**的抽取模型 | **潜在最高**（估算 3–5×：全 GPU 驻留 + 与 embedding 共存） | 低（仅配置） | **不触碰代码红线**，但**推翻 DP3 裁决**（S13-B 已定「复用 qwen3:8b」）→ 需**重新裁决** | ⚠️ **列为 S14 的核心决策点**，非默认动作；须同时评估抽取质量下降 |

### 6.1 推荐路径（组合，非单选）

```
Step 1  A（批端点 + 参数调优：MAX_GLEANING=0、merge 阈值、LLM_TIMEOUT 修正）
          ↓ 实测（复用 S13-C 的 C3 harness 口径，保证可比）
Step 2  若仍不达标 →  D 裁决（换可全驻显存的小抽取模型）
          ↓
Step 3  C 独立 Stage（侧车管线 / Document Intelligence Agent 输入层）
          ↓ 全程
        B 作为离线运行的工程外壳（队列 + 重试 + 断点续传 + 进度）
```

**预期量化（全部为估算，须实测校正）**：
| 组合 | 1000 docs 外推 | 相对 C3 基线（61–167 h） |
|---|---|---|
| 基线（C3 实测） | 61–167 h | 1× |
| + A（批端点） | ~50–100 h | ~1.2–2× |
| + A（参数削减 LLM 调用） | ~30–80 h | ~1.5–2× |
| + D（全驻显存小模型） | **~10–30 h** | **~3–5×** |

> 即便全部生效，**1000 docs 仍是「小时~天」级离线作业**——这印证 S13-C 的判断：**必须走离线 ingestion，而非 inline**。Stage 14 的目标应是**把不可行变为可行（可编排、可恢复、可观测）**，而非追求交互级吞吐。

---

## 7. 对 Stage 14 Mini Plan 的输入（草案，待裁决）

> 本节为 **Mini Plan 的输入材料**，非 Mini Plan 本身。

### 7.1 建议目标

**把 LightRAG 摄入从「逐条 inline、不可恢复、无观测」提升为「可批量、可恢复、可观测、且参数经实测调优的离线 ingestion 通道」**，并在 6 GB 显存约束下给出经实测的吞吐/稳定性基线。

### 7.2 建议范围

**IN**：① 批量插入能力（接口外扩展）；② 参数调优实测矩阵（A 组）；③ 离线作业外壳（B 组：队列/重试/断点/进度，**仓库外**）；④ 更新后的吞吐基线报告。
**OUT**：C（侧车管线/分离式预处理）、任何 UI/契约/Runtime 变更、Scrapling、Docker、数据库替换。

### 7.3 架构边界

| 边界 | 规定 |
|---|---|
| `KnowledgeBackend` 5 方法契约 | **不变**（`listNodes/listEdges/importSource/getNeighbors/getMemory`） |
| 批量插入 | **`LightRAGClient` 接口外扩展**（可选方法），与 `importSourceAs` / `query()` / `retrieve()` 同范式 |
| `LightRAGBackend` / `lightragMapping` / UI | **不改**（除非批量路径被证实必须接线，届时单独裁决） |
| Ingestion Layer (`ingestion.ts`) | **不改**（`SourceRef → text` 契约保持） |
| `ownerAgent` 归因 | **必须保持**（若采用 scan 形态，需显式解决 3.3 所述语义冲突） |
| 离线外壳 | **仓库外**（`F:/dsh-lightrag/…`），**不入 git** |

### 7.4 Runtime / Workflow / Agent Loop 声明

> **本 Stage 不涉及、不引入 Runtime、Workflow、Agent Loop。**
> 理由：批量插入是**纯数据通道能力**；离线外壳是**仓库外脚本**（非 app 内运行时）；不新增任何执行引擎、不订阅 agent 事件、不做任务编排抽象。
> 若任一子项被判定需要 Runtime/Workflow（例如作业调度器嵌入 app），**必须停止并回到 Mini Plan 重新裁决**。

### 7.5 风险

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | 批量/scan 端点**仅规范级核实**，运行时行为未验证 | 中 | 编码首步做**运行级契约验证**，不通过即回退单条路径 |
| R2 | 提高并发触发 **OOM / 抽取失败**（C3 已现 `failed:3`） | **高** | 并发参数**只降不升**；以成功率优先，显式对照 `MAX_PARALLEL_INSERT=1` |
| R3 | `MAX_GLEANING=0` 等参数**降低抽取质量** | 中 | 以实体/关系计数 + C2 类检索指标**前后对照** |
| R4 | scan 形态**丢失 `ownerAgent` 归因**（破坏 Stage 11/12 闭环） | **高** | 默认**不使用 scan 承载有归属的贡献**；仅用于无归属语料预载，或不做 |
| R5 | 吞吐提升被外推夸大 | 中 | **以实测样本 + 外推双口径**报告（沿用 S13-C 纪律），标注置信区间 |
| R6 | 长时任务跨会话中断 | 中 | B 组外壳提供断点续传 + 幂等（以 `file_source` 去重，注意 409） |

### 7.6 建议验收标准（草案）

| # | 断言 | 通过条件 |
|---|---|---|
| A-1 | 单文件 diff 纪律 | 每次提交仅含声明的目标文件 |
| A-2 | 5 方法契约零改动 | `types.ts` 五方法签名 diff = 0 |
| A-3 | oxlint | 严格配置 + staged 配置 **0 warnings / 0 errors** |
| A-4 | MockBackend 行为不变 | 无配置时仍回落 Mock，语义一致 |
| A-5 | 批量端点运行级验证 | `/documents/texts` 实际受理 N 篇并全部进入管线 |
| A-6 | 吞吐实测 | 产出与 C3 **同口径**的 per-import 均值 + 外推 + CI |
| A-7 | 稳定性 | 记录 `failed` 计数；目标 **failed = 0**（对照 C3 的 3/10） |
| A-8 | 抽取质量未退化 | 实体/关系计数 ≥ 基线（`MAX_GLEANING=0` 前后对照） |
| A-9 | 归因完整性 | `ownerAgent` 归因在所选通道中**可验证保持** |
| A-10 | 红线 | 未引入 Runtime/Workflow；未改 UI/契约；未装 Scrapling；未换 DB |

---

## 8. 待裁决决策点（DP）

| # | 决策 | 选项 | 倾向 |
|---|---|---|---|
| **DP-1** | Stage 14 是否以「批量 + 参数调优 + 离线外壳」为范围（排除 C）？ | (a) 是（推荐）(b) 含 C（需独立架构审核） | **(a)** |
| **DP-2** | 是否接受「批端点仅带来 1.2–2×，真收益来自参数削减 LLM 调用」的判断？ | (a) 接受 (b) 先实测再定 | **(a)** |
| **DP-3** | `MAX_GLEANING` 是否允许由 1 → 0？ | (a) 允许（须质量对照）(b) 保持 1 | **(a)**，前提 A-8 通过 |
| **DP-4** | 并发参数策略？ | (a) **只降不升**（保稳定）(b) 小幅提升并实测 | **(a)**（6 GB 硬约束） |
| **DP-5** | 是否采用 `/documents/scan`？ | (a) 不用（保 `ownerAgent` 归因）(b) 仅用于无归属语料 (c) 全面采用 | **(b)** 或 **(a)** |
| **DP-6** | 是否重新评估抽取模型（原 DP3 为 `qwen3:8b`）？ | (a) 不换 (b) 允许单独 Mini Plan 评估小模型 | 取决于 DP-1 实测结果 |
| **DP-7** | 离线外壳归属？ | (a) 仓库外脚本（推荐）(b) 进仓 | **(a)** |
| **DP-8** | 墙钟预算与规模档位？ | 建议沿用 S13-C 纪律（≤3 h，超时即停并外推） | **沿用** |

---

## 9. 附录：速查表

### 9.1 端点速查

| 端点 | 方法 | 用途 | 关键字段 |
|---|---|---|---|
| `/documents/text` | POST | 单条文本插入 | `text`(必), `file_source`, `chunking` |
| `/documents/texts` | POST | **批量文本插入** | `texts`(必), `file_sources`, `chunking` |
| `/documents/upload` | POST | 文件上传至 input_dir | `file`(必) |
| `/documents/scan` | POST | **扫描 input_dir 入队** | 无 body → `{status, track_id}` |
| `/documents/scan/status/{track_id}` | GET | 扫描进度 | — |
| `/documents/pipeline_status` | GET | 管线忙闲 | `busy` |
| `/documents/track_status/{track_id}` | GET | 单次插入进度 | — |
| `/documents/status_counts` | GET | 文档状态计数 | `failed/all/processed` |
| `/documents/reprocess_failed` | POST | 重跑失败文档 | — |
| `/documents/cancel_pipeline` | POST | 取消管线 | — |
| `/documents/supported_file_types` | GET | 支持的文件类型 | — |
| `/documents/paginated` | POST | 分页列出文档 | `page`, `page_size`, `status_filter` |

### 9.2 参数速查（含默认值与生效性）

| 环境变量 | 默认 | 生效 | 建议方向 |
|---|---|---|---|
| `MAX_ASYNC_LLM` (→`MAX_ASYNC`) | 4 | ✅ | 当前 1，**保持低位** |
| `MAX_PARALLEL_INSERT` | 3 | ✅ | **只降不升**（建议对照 1） |
| `EMBEDDING_BATCH_NUM` | 10 | ✅ | 可小幅升（16–32） |
| `EMBEDDING_FUNC_MAX_ASYNC` | 8 | ✅ | 保守 |
| `WORKERS` | 2 | ❌（uvicorn 单进程） | **不使用** |
| `MAX_GLEANING` | 1 | ✅ | **→ 0**（最大收益） |
| `FORCE_LLM_SUMMARY_ON_MERGE` | 8（须 ≥3） | ✅ | **→ 20–50** |
| `LLM_TIMEOUT` | 240 | ✅ | **按需上调**（S13-B 误用 `TIMEOUT`） |
| `TIMEOUT` | 300 | ✅（通用，非 LLM） | — |
| `EXTRACT_LLM_TIMEOUT` / `EXTRACT_MAX_ASYNC_LLM` | 回退基础值 | ✅ | 精确控制抽取角色 |
| `CHUNK_SIZE` / `CHUNK_OVERLAP_SIZE` | 1200 / 100 | ✅ | 方向可调，**须实测** |
| `SCAN_ENQUEUE_BATCH_SIZE` | 100 | ✅ | 保持 |
| `MAX_TEXTS_PER_REQUEST` | 0（无上限） | ✅ | 保持 |
| `OLLAMA_LLM_NUM_CTX` | 我们设为 4096 | ✅ | ⛔ **禁止上调** |

---

## 10. 状态

🟡 **停在 Stage 14 Mini Plan Review Node。**

- 已完成：Batch Insert / Directory Scan / 并发参数生效性 / 6 GB 显存约束建议 / A–D 方案评估 / Mini Plan 输入草案（含边界、Runtime 声明、风险、验收标准）。
- **未编码、未安装、未调整环境、未进入 Stage 14 编码**；`src/` 零改动。
- **本 Stage 不涉及 Runtime / Workflow / Agent Loop**（§7.4）。
- 待裁决：**DP-1 … DP-8**。裁决并**明确批准**后方可进入 Stage 14 编码。
