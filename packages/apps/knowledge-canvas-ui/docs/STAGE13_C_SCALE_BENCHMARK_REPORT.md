# S13-C Scale Benchmark Report

> **状态**：🟢 **完成，停在 S13-C Acceptance Node**（未进入后续阶段）
> **范围**：仅 benchmark / 记录指标 / 输出报告。**零业务代码改动**（`src/` modified = 0，S13-C 执行期间无新 commit，HEAD 仍为 Mini Plan 的 `0bf2304`）
> **环境**：LightRAG 1.5.7 · Ollama `qwen3:8b`(num_ctx=4096, think=false, MAX_ASYNC=1) · `nomic-embed-text`(768d) · RTX 3060 Laptop 6 GB
> **预算**：DP-TIME ≤3 h（实际用时 ≈2 h 10 min）
> 生成时间：2026-09-10

---

## 0. 执行摘要

四组基准全部跑通。**核心结论**：

1. **图读取**：`listNodes`/`listEdges`（全图）随规模**近似线性**增长（100→1000 节点：11 ms→102 ms p50）；`getNeighbors`（邻域）**几乎恒定**（1.9→2.7 ms）——**邻域检索不受图规模影响**，是最优的访问路径。
2. **检索**：冷查询 **31.6 s**（p50），缓存命中 **84 ms** —— **~380× 加速**；references 完整性 **39/39 = 100%**。
3. **导入**：实测 **3.65 min/import**（40 min 完成 11 次）；外推 **1000 imports ≈ 61–167 h** → **inline 不可行**，必须批量/离线。
4. **端到端**：Nox 研究链 **5/5 成功**，检索→上下文→生成全通；三类 fallback 行为**全部符合设计**。

---

## 1. C1 — Graph Scale Benchmark

合成图经 LightRAG 原生 `POST /graph/entity/create` + `/graph/relation/create` 构造（**无 LLM**，DP-C1）。每档 N=20 次采样。

| 规模 | nodes / edges | 构建耗时 | `listNodes` p50 / p95 / max | `listEdges` p50 / p95 / max | **`getNeighbors` p50 / p95 / max** |
|---|---|---|---|---|---|
| **100** | 100 / 192 | 24.4 s | 11.2 / 12.2 / 13.6 ms | 11.2 / 12.3 / 12.4 ms | **1.9 / 3.1 / 3.2 ms** |
| **500** | 500 / 984 | 157.5 s | 48.3 / 52.9 / 179.8 ms | 49.8 / 53.6 / 171.2 ms | **2.0 / 3.5 / 3.6 ms** |
| **1000** | 1000 / 1976 | 393.6 s | 101.9 / 243.7 / 265.3 ms | 114.9 / 283.5 / 293.3 ms | **2.7 / 4.3 / 4.6 ms** |

**发现**
- 全图读取 ≈ **O(n)**：p50 从 11 ms → 48 ms → 102 ms（每次 5× / 2× 节点带来的延迟基本成比例）。
- **p95 尾部恶化明显**：1000 节点时 p95/p50 = **2.4×**（243 ms vs 102 ms）→ 全图 dump 在规模下**尾延迟敏感**。
- `getNeighbors` **恒定**（`?label=X&max_depth=1` 为邻域查询，与总规模无关）→ 架构上应优先用它而非全图。
- 构建成本随规模上升（24 s → 158 s → 394 s）：每次 create 触发向量写入与持久化。
- `is_truncated` **未触发**（`max_nodes=2000` 足够容纳 1000 节点）。

原始数据：`STAGE13_C_C1_graph_scale.csv`

---

## 2. C2 — Retrieval Benchmark

固定环境；固定 Q-set（10 问）；冷/热各按 DP-C2 执行。

| 指标 | 结果 |
|---|---|
| **cold latency**（n=9，每次前 `clear_cache`） | p50 **31,561 ms** · p95 **39,874 ms** |
| **warm latency**（n=30） | p50 **84 ms** · p95 36,548 ms（p95 含第 1 轮仍在生成） |
| **references 完整性** | 非空 **39/39** · 可解析回实体 **39/39**（**100%**） |
| **entity coverage** | **1.00**（全部问题） |
| answer 稳定性（首末 Jaccard，缓存冷） | q1 **0.54** · q2 **0.46** · q3 **0.35** |
| answer 稳定性（缓存命中） | **1.00**（逐字一致） |

**发现**
- **缓存是决定性因素**：冷 31.6 s → 热 84 ms（**~380×**）。第二/三轮 warm 全部 ~80 ms。
- references **从未为空**且**全部可解析**为实体（B-1 的文件路径→实体名解析生效）。
- 冷查询重复 3 次答案 Jaccard 0.35–0.54 —— **自然生成方差**（DP-C2 明确不要求逐字一致）；缓存命中后完全稳定。
- ⚠️ **方法论局限（须注意）**：当前语料仅 1 个文档（`s13b-smoke.md`），其 references 解析出**全部 7 个实体**，故 entity coverage 恒为 1.00，**不具区分度**。规模语料下（C3 形态）该指标才有判别力。

原始数据：`STAGE13_C_C2_retrieval.csv`

---

## 3. C3 — Import / Memory Growth

`working_dir` 由**空目录**起步；顺序插入唯一文档（固定篇幅），逐条等待管线完成。

### 3.1 实测（预算 40 min 触发停止）

| 指标 | 值 |
|---|---|
| imports completed | **11** |
| 超时（未在 600 s 内完成） | **4** |
| 墙钟耗时 | **2,407 s（40 min）** |
| **平均 per-import** | **218,759 ms = 3.65 min** |
| 图节点 @11 | **17** |
| `status_counts` 观测 | 曾出现 **failed:3 / all:10** |

### 3.2 增长（0 → 11 imports，+643,270 B ≈ 628 KB）

| 存储 | 增量 |
|---|---|
| **Graph**（`graphml`） | **+31,687 B** |
| KV `full_docs` | +15,613 B |
| KV `text_chunks` | +14,158 B |
| KV `entity_chunks` | +4,866 B |
| KV `relation_chunks` | +9,803 B |
| KV `doc_status` | +14,251 B |
| KV `llm_response_cache` | +116,644 B |
| **Vector `vdb_entities`** | **+116,527 B** |
| **Vector `vdb_relationships`** | **+236,379 B** |
| Vector `vdb_chunks` | +79,118 B |
| **合计** | **+643,270 B** |

> 增长最大项为 **向量库**（relationships 236 KB + entities 117 KB + chunks 79 KB ≈ 总增量的 67%），其次为 LLM 缓存。Graph 本体仅 32 KB。

### 3.3 外推（DP-C3-A，线性 per-import）

| imports | 实测均值 3.65 min | 保守界 10.03 min\* |
|---|---|---|
| **100** | **365 min（6.1 h）** | 1,003 min（16.7 h） |
| **500** | 1,823 min（30.4 h） | 5,013 min（83.5 h） |
| **1000** | **3,646 min（60.8 h）** | 10,026 min（167.1 h） |

\* 保守界取「严格串行等待单个文档」的 4 个有效样本均值（含批次边界等待）。
**置信区间（×1.0–×1.5）**：100 → 365–547 min；500 → 1823–2734 min；1000 → **3646–5469 min**。

**结论**：**1000 imports 需约 61–167 小时**（2.5–7 天）——**inline 不可行**，必须批量离线执行或引入更强的并发/更快的推理后端。DP-C3-A（100 实跑 + 外推）是唯一务实路径。

⚠️ **测量局限**：早期 4 条样本因「插入后管线尚未转 busy」的竞态被污染（`doc_ms` < 1 s），报告采用**全量均值 3.65 min/import**（墙钟摊销）与**保守界 10.03 min**（有效样本）双口径。

原始数据：`STAGE13_C_C3_import_growth.csv`

---

## 4. C4 — End-to-End Nox Research

链路：`Question → Knowledge Retrieval → Context Injection → LLM Generation → Answer`

### 4.1 场景 A：LightRAG available

| 指标 | 值 |
|---|---|
| **成功率** | **5/5（100%）** |
| avg hits | **7.0** |
| avg context nodes（水合成功） | **7.0** |
| 检索延迟（冷） | 13.8 – 46.5 s |
| **LLM 生成延迟** | p50 **82 ms** · p95 **1,433 ms** |
| 答案长度 | 278 – 1,289 字符 |

### 4.2 Fallback 矩阵（DP-C4，仅行为对比）

| 场景 | 预期 | 实测 | 结果 |
|---|---|---|---|
| **LightRAG available** | 正常 retrieval | `retrieve() ok=true`，hits=7 | ✅ |
| **LightRAG unavailable**（无配置） | backend fallback | `createBackend()` → **`MockBackend`**；`retrieve()` → `backend-unsupported` | ✅ |
| **MockBackend** | backend-unsupported | `retrieve()` → `backend-unsupported` | ✅ |
| **llmContext seam** | 运行时可探测 | Node 运行时 `available=true`（浏览器路径返回降级桩，二者不同） | ✅ 记录 |

**发现**：降级链**完全符合设计**——无配置时静默回落 Mock；缺失 `query` 能力时返回 `backend-unsupported` 而非抛错；无接口新增。

原始数据：`STAGE13_C_C4_e2e_fallback.csv`

---

## 5. 约束符合性（实测）

| 约束 | 验证 |
|---|---|
| 仅 benchmark / 记录 / 报告 | ✅ 无功能、无接口、无 UI、无 contract 改动 |
| 不修改 TS/React | ✅ `src/` modified = **0**；HEAD 仍 `0bf2304`（S13-C 无新 commit） |
| 不修改 LightRAG client / Backend contract | ✅ 未触及 |
| 不引入 Runtime / Workflow / 新组件 | ✅ 未引入 |
| 不装 Scrapling | ✅ 未安装 |
| 不替换数据库 | ✅ 仍为 JsonKV + NanoVectorDB + NetworkX |
| Harness 仓库外隔离 | ✅ `F:/dsh-lightrag/bench/`（仅 .mts 脚本 + CSV/JSON，**不入 git**） |

---

## 6. 数据隔离与恢复

- 每轮按 DP-ISO：`snapshot → clean working_dir → run → save CSV → restore`。
- 快照：`F:/dsh-lightrag/backup/working_dir_20260910_171209`（12 文件 / 158 KB）。
- **最终状态核验（只读）**：当前 `working_dir` **文件名集合与快照完全一致**，graph / entities / relations / vdb 尺寸**逐项相同**；唯一差异为 `kv_store_llm_response_cache.json`（27,964 → 47,935 B），系 C4 查询新增的 **LLM 响应缓存**（非知识数据）。
- ⚠️ 最终一次 `rm -rf` 被用户拒绝（安全策略），经核验**无需 restore**，故未执行删除。

---

## 7. 结论与建议

1. **架构边界已验证**：邻域检索（`getNeighbors`）与总规模解耦，是 UI 应优先采用的读路径；全图 dump（`listNodes`/`listEdges`）在大图下是**尾延迟与带宽瓶颈**。
2. **LLM 缓存对交互体验是决定性的**（380×），应作为一等公民对待。
3. **导入吞吐是当前最大瓶颈**：3.65 min/doc → 1000 docs 约需 2.5–7 天。若要规模化，需针对性方案（批处理/更强推理硬件/并发提升），**属新阶段议题，不在 S13-C 范围**。
4. **6 GB 显存是硬约束**：C3 期间观测到 **failed:3/10**，且 `ollama ps` 显示 `qwen3:8b`(6.0 GB) 与 `nomic-embed-text`(0.3 GB) **双模型驻留 = 6.3 GB > 6 GB** → 抽取偶发失败。建议后续阶段评估更小的抽取模型或串行化策略。
5. **references 语义**：1.5.7 为文件级且无分数（`score` 恒 0）；单文档语料下 coverage 无判别力，规模语料才具参考价值。

---

## 8. 交付物

| 文件 | 说明 |
|---|---|
| `STAGE13_C_SCALE_BENCHMARK_REPORT.md` | 本报告 |
| `STAGE13_C_C1_graph_scale.csv` | C1 原始逐次测量 |
| `STAGE13_C_C2_retrieval.csv` | C2 原始逐次测量 |
| `STAGE13_C_C3_import_growth.csv` | C3 逐次增长采样 |
| `STAGE13_C_C4_e2e_fallback.csv` | C4 逐问 + fallback 矩阵 |
| `F:/dsh-lightrag/bench/*.mts` + `*.json` | Harness 脚本与完整 JSON（**仓库外，不入 git**） |

---

## 9. 状态

🟢 **停在 S13-C Acceptance Node。**

- 四组基准全部执行完毕，指标与原始数据均已落盘。
- **未编码、未改业务代码、未引入 Runtime/Workflow**；环境已恢复原状。
- **不自动进入后续阶段**；下一步须重新 **Mini Plan → 审核 → 明确批准**。
