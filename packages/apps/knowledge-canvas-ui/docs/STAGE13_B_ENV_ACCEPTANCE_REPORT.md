# S13-B Environment Acceptance Report

> **状态**：🔴 **停止于 S13-B Acceptance Node**（未进入 S13-C）
> **执行范围**：环境准备 → 服务启动 → 连通性验证 → 本报告
> **红线核查**：未改任何代码 / 未改 `KnowledgeBackend` 五方法接口 / 未改 UI / 未引入 Runtime·Workflow / 未装 Scrapling / 未 Docker 化
> 生成时间：2026-09-10

---

## 1. 执行摘要

S13-B 环境已在**本地 venv**形态下建成并跑通**真实 RAG 端到端**：LightRAG 1.5.7 服务在 `127.0.0.1:9621` 运行，LLM 走 Ollama `qwen3:8b`、嵌入走 `nomic-embed-text`，实测完成 1 篇文档摄取（**7 实体 / 6 关系**）且 `POST /query` 返回连贯答案。

同时暴露 **1 个阻塞级阻塞**（app 客户端与 LightRAG 1.5.7 API 契约漂移）与 **3 个重要环境发现**（VRAM 不足、代理截断、auth 模式）。**V6–V8 因此未通过**，需后续单独批准的**客户端适配**任务解决。

---

## 2. 环境清单（实测）

| 项 | 值 |
|---|---|
| 部署形态 | 本地 Python venv（**DP1**；未用 Docker） |
| venv 基座 | Python **3.12.14**（Astral/CPython，经 `py -V:Astral/CPython3.12.14`） |
| lightrag-hku | **1.5.7**（`pip install "lightrag-hku[api]"`） |
| venv 包数 | 142 |
| 数据根 | `F:/dsh-lightrag/` |
| 目录 | `venv/` `working_dir/` `inputs/` `logs/` `backup/`（**DP5** 已按 Mini Plan 执行） |
| 端口 | LightRAG `127.0.0.1:9621`（**DP6**）；Ollama `127.0.0.1:11434` |
| LLM | Ollama `qwen3:8b`（**DP3**），`num_ctx=4096`、`think=false` |
| Embedding | Ollama `nomic-embed-text`（**DP2**），768 维 |
| 存储后端 | KV=JsonKV · Vector=**NanoVectorDB** · Graph=**NetworkX** |
| Scrapling | **未安装**（**DP4**，flag 默认 OFF） |

**实测 server 配置回显**：`extract/keyword/query/vlm: Ollama {'num_ctx': 4096, 'think': False}`

**working_dir 落盘证据**：`graph_chunk_entity_relation.graphml` + `kv_store_*.json`（8 个）+ `vdb_*.json`（3 个）

---

## 3. V1–V8 验证结果

| # | 断言 | 结果 | 证据 |
|---|---|---|---|
| **V1** | Ollama 在线含 `qwen3:8b` | ✅ **PASS** | `/v1/models` → `nomic-embed-text` `gpt-oss:20b` `qwen3:8b` `qwen2.5-coder:7b` |
| **V2** | `nomic-embed-text` 可用 | ✅ **PASS** | 同上（拉取后 17s 内完成） |
| **V3** | LightRAG 在线 | ✅ **PASS** | `/health` 200 `{"status":"healthy","core_version":"1.5.7"}`；`/graph/label/list` 200 |
| **V4** | 写入可用 | ✅ **PASS（调优后）** | `POST /documents/text` 200 → 抽取完成 `Writing graph with 7 nodes, 6 edges`，`processed:1` |
| **V5** | 检索可用 | ✅ **PASS** | `POST /query` 返回连贯答案（含 LightRAG / qwen3:8b / nomic-embed-text） |
| **V6** | app 切后端选 `LightRAGBackend` | ⚠️ **BLOCKED** | `createBackend()` 逻辑可选中，但客户端 wire format 与 1.5.7 不符 → 见 §4.1 |
| **V7** | 五方法可用 | ⚠️ **BLOCKED** | `listNodes`/`getNeighbors` 依赖 `GET /graphs`（无参）→ 422 → 见 §4.1 |
| **V8** | 只读语义保持 | ⚠️ **未测** | 依赖 V6/V7 通过 |

**V4/V5 日志实证**：
```
Chunking F: size=1200, overlap=100
Writing graph with 7 nodes, 6 edges
Completed processing file 1/1: s13b-smoke.md
```
抽取实体：`AI Employee OS`, `Knowledge Canvas`, `Knowledge Graph`, `LightRAG`, `Nox`, `Ollama qwen3:8b`, `nomic-embed-text`

---

## 4. 关键发现

### 4.1 🔴 阻塞级：app 客户端与 LightRAG 1.5.7 API 契约漂移

`lightragHttpClient.ts` 按**旧版** LightRAG API 编写，与 1.5.7 实测契约不符：

| 客户端实现 | 1.5.7 实际 | 后果 |
|---|---|---|
| `insert()` 发 `{text, source}` | `InsertTextRequest` 需 **`file_source`** | 400 `A valid file_source is required` |
| `getEntities()`/`getRelations()` → `GET /graphs` **无参** | `GET /graphs` **必填 `label`**（返回该实体邻域，非全图 dump） | 422 `missing query.label` |
| `getGraphNeighbors()` 由 `getRelations()` 推导 | 应直接用 `GET /graphs?label=X&max_depth=N` | 连带失败 |

**1.5.7 可用替代端点**：`GET /graph/label/list`（全实体标签）、`GET /graphs?label=X&max_depth=N`（邻域）、`POST /query/data`（结构化检索）

**结论**：V6–V8 无法在**不改代码**前提下通过。修复属**客户端适配（代码变更）**，超出 S13-B「环境准备」范围，**需单独 Mini Plan → 审核 → 批准**。本报告不擅自修改。

### 4.2 🟠 重要：6GB VRAM 不足导致抽取超时（已缓解，未根治）

- 首次配置（`num_ctx=8192`）：`qwen3:8b` 占 **6.6 GB**，运行 **36% CPU / 64% GPU**，抽取 `httpx.ReadTimeout` 失败（LLM 角色超时 240s）。
- 调优后（`num_ctx=4096` + `think=false`）：**6.0 GB / 30% CPU / 70% GPU**，抽取成功。
- **仍非全 GPU**（6.0GB 恰在 6GB 边界）→ S13-C 大规模基准（100 PDF）耗时将显著。缓解选项：更小 ctx、换更小模型、或接受慢速。

### 4.3 🟠 重要：本地代理导致大文件下载截断/挂起

- **pip**：`HTTP_PROXY=127.0.0.1:12334` 下解析 PyPI 索引 → `JSONDecodeError: Unterminated string at char 2947828`（响应被截断）。**解决**：改 `-i https://pypi.tuna.tsinghua.edu.cn/simple` → 成功。
- **ollama pull**：同代理下 250MB/274MB 处 `unexpected EOF`（多次）。**解决**：**重启 ollama 守护进程并清空其代理变量**（下载由 daemon 执行，CLI env 无效）→ 剩余 17MB **17 秒**完成。
- **经验**：`ollama pull` 的下载由 `ollama serve` 执行；要改网络行为必须重启 daemon。

### 4.4 🟡 次要：`auth_mode` 报告为 `disabled`

`/health` 返回 `"auth_mode":"disabled"`（首启日志曾打印 "API Key authentication is enabled"）。当前带 `X-API-Key` 的请求均成功。仅绑 `127.0.0.1` 单机自用，风险低；建议后续确认 `LIGHTRAG_API_KEY` 是否被 `.env` 正确加载。

### 4.5 与 Mini Plan 的偏离（透明记录）

| 项 | Mini Plan | 实际 | 原因 |
|---|---|---|---|
| `num_ctx` | 8192 | **4096** | 6GB 显存下 8192 致 CPU 卸载 + 抽取超时 |
| `think` | 未指定 | **false** | qwen3 冗长推理拖垮抽取 |
| `MAX_ASYNC` | 未指定 | **1** | 避免慢速推理下并发争抢 |
| venv Python | 未指定版本 | **3.12.14** | 3.13/3.14 的 wheel 生态支持薄弱 |

以上均为**环境参数调优**，未改变 DP1–DP6 裁决与方案结构。

---

## 5. 回滚状态（§9 分层，全部可执行）

| 级别 | 动作 | 当前可用性 |
|---|---|---|
| **L0 瞬时** | 不设 `__KCU_LIGHTRAG_BASE_URL` / 删 `.env.local` → 刷新 → 回落 `MockBackend` | ✅ 可用（`resolveLightRAGConfig()` 返 null 即回落 + `createBackend()` try/catch） |
| **L1 停服** | 停 `lightrag-server` | ✅ 已实测（Stop-Process 后 0 进程） |
| **L2 卸载** | 删 `F:/dsh-lightrag/venv/` | ✅ 就绪（系统 Python 未受影响） |
| **L3 清数据** | 归档 `backup/` 后删 `F:/dsh-lightrag/` | ✅ 就绪 |

**无需 git revert**（本轮零代码改动）。

---

## 6. 红线符合性（全部通过）

- ✅ 未修改任何代码（`git status` 无源码改动）
- ✅ 未修改 `KnowledgeBackend` 五方法接口
- ✅ 未修改 UI
- ✅ 未引入 Runtime / Workflow
- ✅ 未安装 Scrapling（flag 保持 OFF）
- ✅ 未 Docker 化
- ✅ 未进入 S13-C

---

## 7. 待决事项（需明确批准）

| # | 事项 | 说明 |
|---|---|---|
| **B-1** | **客户端契约适配**（阻塞 V6–V8） | 改 `lightragHttpClient.ts`：`source`→`file_source`；`/graphs`→`/graph/label/list` + `/graphs?label=`。**属代码变更，须单独批准** |
| **B-2** | VRAM 策略 | 是否接受当前「慢但可用」，或另定模型/ctx 策略 |
| **B-3** | `auth_mode` | 是否要求强制 API Key |
| **B-4** | S13-C 可行性 | 规模基准依赖 B-1 与 B-2 先解决 |

---

## 8. 状态

🔴 **停止于 S13-B Acceptance Node。** 环境已建成并跑通真实 RAG（V1–V5 PASS），但因**客户端契约漂移**（B-1，属代码变更、超出本阶段范围），V6–V8 未通过。**不进入 S13-C**；B-1 须重新走 Mini Plan → 审核 → 明确批准。
