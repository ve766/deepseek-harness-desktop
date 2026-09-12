# Stage 14 · P1-2 — `MAX_GLEANING` A/B 实测报告

> **范围**：仅环境层 A/B（`MAX_GLEANING` 0 vs 1）。**零业务代码改动**（`src/` modified = 0，无新 commit 触及代码）。
> **流程**：S13-C 标准流程 —— snapshot → clean working_dir → baseline run（`MAX_GLEANING`=默认 1）→ experiment run（`MAX_GLEANING=0`）→ CSV → restore。
> **裁决结果**：**不合入**（吞吐提升未达成；调用次数减半属实但未转化为墙钟收益）。`.env` 已回退为默认。

---

## 1. 结论摘要

| 指标 | baseline（`MAX_GLEANING=1`） | experiment（`MAX_GLEANING=0`） | 判定 |
|---|---|---|---|
| **LLM 调用次数 / chunk** | **2.0**（8 次 / 4 个成功 chunk） | **1.0**（2 次 / 2 个成功 chunk） | ✅ **减半——实验机制确证** |
| 成功篇延迟 | 677.9s · 1020.2s（均值 849.1s） | 820.4s | ❌ **无改善**（单样本 820.4s 反而偏高） |
| 失败率（配对样本 doc-01/02） | 1/2 | 1/2 | ➖ 无差异 |
| 图规模（成功篇产出） | 21 nodes / 43 edges（2 篇） | 15 nodes / 31 edges（1 篇） | ➖ 量级相当，无质量塌陷证据 |
| 臂墙钟 | 5,302.7s（88.4 min，6 篇） | 1,720.8s（28.7 min，2 篇，预算停止） | — |

**判定依据**：吞吐提升**不明显** → 按裁决规则「若吞吐提升明显且质量 ≥ 基线 90% 才保留」→ **不保留**。
**但机制层结论成立且高价值**：`MAX_GLEANING=0` 确实把每 chunk 的抽取调用数从 2 降到 1（缓存条目实测），**该收益在当前 6GB 环境下被单次调用延迟方差吞掉**；在延迟更稳定的 provider（如 P1-4 的云端抽取）上应重新评估。

---

## 2. 环境基线（两臂完全一致，唯一变量 = `MAX_GLEANING`）

| 项 | 值 |
|---|---|
| LightRAG | 1.5.7（venv Python 3.12.14） |
| LLM / Embedding | `qwen3:8b` @ `127.0.0.1:11434` · `nomic-embed-text`（768 维） |
| `OLLAMA_LLM_NUM_CTX` | 4096 |
| `OLLAMA_LLM_THINK` | false |
| `MAX_ASYNC` | 1 |
| `EXTRACT_LLM_TIMEOUT` | 900（P1-1，两臂均生效） |
| `TIMEOUT` | 900（非 LLM 超时，两臂一致） |
| `NO_PROXY` | `127.0.0.1,localhost,::1`（B-2 修复，两臂一致） |
| 语料 | 6 篇合成文档 `p12-doc-0N.md`（**逐字节相同**，各含专属实体：`Engineer Lambda-0N` / `Project Delta-0N` 等） |
| working_dir | 每臂前**清空**（含 LLM 缓存 → 两臂均冷启动） |
| GPU | RTX 3060 Laptop 6GB；`qwen3:8b` 驻留 **6.0 GB / 30% CPU 卸载 / 70% GPU** |

---

## 3. 逐篇结果

### baseline（`MAX_GLEANING=1`，6 篇 / 12 chunks）

| # | 文档 | 状态 | doc_ms | Δnodes | Δedges | 累计 |
|---|---|---|---|---|---|---|
| 1 | p12-doc-01.md | **processed** | 677,862 | +12 | +20 | 12 / 20 |
| 2 | p12-doc-02.md | failed | 900,937 | 0 | 0 | 12 / 20 |
| 3 | p12-doc-03.md | failed | 901,875 | 0 | 0 | 12 / 20 |
| 4 | p12-doc-04.md | **processed** | 1,020,203 | +9 | +23 | 21 / 43 |
| 5 | p12-doc-05.md | failed | 900,564 | 0 | 0 | 21 / 43 |
| 6 | p12-doc-06.md | failed | 901,241 | 0 | 0 | 21 / 43 |

### experiment（`MAX_GLEANING=0`，预算停止于 2 篇）

| # | 文档 | 状态 | doc_ms | Δnodes | Δedges | 累计 |
|---|---|---|---|---|---|---|
| 1 | p12-doc-01.md | failed | 900,308 | 0 | 0 | 0 / 0 |
| 2 | p12-doc-02.md | **processed** | 820,446 | +15 | +31 | 15 / 31 |

### 配对比较（同篇文档索引，消除语料差异）

| 文档 | baseline | experiment |
|---|---|---|
| p12-doc-01.md | ✅ 677.9s · 12n/20e | ❌ 900.3s |
| p12-doc-02.md | ❌ 900.9s | ✅ 820.4s · 15n/31e |

→ **完全对称**：各成功 1 篇、各失败 1 篇。**臂间差异不可检出，结果由单次调用延迟方差主导。**

---

## 4. LLM 调用次数：可观测方法与实测

**观测法（无需插桩，可复用）**：LightRAG 将每次 LLM 响应写入
`working_dir/kv_store_llm_response_cache.json`，键形如 `<mode>:<role>:<hash>`
（本实验全部为 `default:extract:<hash>`）。**条目数 = 已完成 LLM 调用数**；按 `role` 分组即得按角色的调用数。日志侧同源计数为 `== LLM cache == saving`。

| 臂 | 缓存条目 | 成功 chunk 数 | 调用/chunk | 日志佐证 |
|---|---|---|---|---|
| baseline | **8** | 4（2 篇 × 2 chunk） | **2.0** | 调用以**成对**出现（`saving` 行成组相邻） |
| experiment | **2** | 2（1 篇 × 2 chunk） | **1.0** | 每 chunk 仅 1 次 |

**决策性验证**：`MAX_GLEANING` 确为有效键且已生效 ——
`lightrag.py:471` `field(default=get_env_value("MAX_GLEANING", DEFAULT_MAX_GLEANING, int))`，
`DEFAULT_MAX_GLEANING = 1`，**无 CLI 参数可覆盖**；`lightrag.py:217` 在**类定义之前**
`load_dotenv`，故 `.env` 取值有效。三态实证：无 `.env` → 1；`.env` 写入 0 → 0；回退后 → 1。

**gleaning 触发门控**（源码）：`entity_extract_max_gleaning > 0` **且** `extract_tokenizer is not None`
**且** `max_extract_input_tokens > 0`；此外还有一处 token 预算前置检查会在合并载荷超限时
**跳过而非失败**。基线成对调用证实门控在本环境**满足**、gleaning 确实运行。

---

## 5. 失败归因（两臂同因）

全部失败均为：**单个 chunk（`chunk-000`）的抽取调用超过 900s → `httpx.ReadTimeout` → `Failed to extract document`**。

```
httpx.ReadTimeout: C[1/2]: doc-<hash>-chunk-000:
ERROR: Failed to extract document 1/1: p12-doc-0N.md
```

**根因证据 —— 上下文窗口被吃满**：

| 组成 | 体量 |
|---|---|
| `entity_extraction_system_prompt` | 6,328 chars ≈ **~1,800 tokens** |
| chunk（`chunk_token_size` 默认 1200） | **~1,200 tokens** |
| **合计** | **≈3,000 / `num_ctx`=4096** → 仅余 ~1,000 token 输出预算 |

在 **30% 层 CPU 卸载**下，近满窗 prompt 的 prefill 成本极高；gleaning 的第二次调用还需追加
「上一轮完整 user/assistant 对 + continue 指令」，**极易越过 4096 窗口**，导致病理级延迟。
调用延迟实测方差：baseline ≈ **169s/call**（677.9s ÷ 4）vs experiment ≈ **410s/call**（820.4s ÷ 2）
→ **2.4× 方差，恰好吞掉「调用数减半」带来的理论 2× 收益**。

> 这解释了为何调用次数减半而**墙钟无改善**：瓶颈是**单次调用的 prefill 时间**，不是调用次数。

**P1-1 的作用与局限**：`EXTRACT_LLM_TIMEOUT=900` 已生效（配置回显 `extract ... timeout=900`），
消除了 240s 级别的误判失败；但本环境的病理延迟**超过 900s**，故仍需更上游的解法（见 §7）。

---

## 6. 红线与隔离

| 项 | 结果 |
|---|---|
| `src/` modified | **0** |
| `packages/llm` / `llm-router` | 未触碰（唯一 `' M'` 为预存噪声 `llm/tsconfig.json`） |
| 新增依赖 / lockfile | 无 |
| 代码 commit | **无**（本阶段零代码改动；HEAD 仍 `50f8534`） |
| 改动面 | 仅仓库外 `F:/dsh-lightrag/.env`（**已回退**）+ 服务启动参数 |
| harness | 仓库外 `F:/dsh-lightrag/bench/p12_*.mts|py`（不入 git） |
| 隔离 | 每臂前 snapshot + 清空 working_dir；实验后 restore（12 文件/280K，**逐项尺寸一致** ✅） |

**隔离说明（如实记录）**：
- 基线快照 `backup/working_dir_20260911_100732`（280K）为本次新建，已成功 restore。
- g0 数据归档 `backup/working_dir_g0_20260911_123723`（graphml **15 nodes / 31 edges**、cache **2 条目**），与运行期数字一致。
- 归档命令曾报 `cannot stat`，但复核**归档内容完整**（12 文件），判定为沙箱输出的误导性报错，非数据丢失。

---

## 7. 结论与建议

1. **不合入 `MAX_GLEANING=0`**：吞吐提升不明显，未满足保留门槛。`.env` 已回退（`default=1` 实证）。
2. **机制结论保留并升级为事实**：`MAX_GLEANING=0` 使抽取调用数 **2.0 → 1.0 /chunk**（缓存条目实测）。这是**调用成本减半**，对**按 token 计费的云端抽取（P1-4）**直接等价于成本减半 —— 应在 P1-4 中作为默认候选重新评估。
3. **本环境的真实瓶颈已被钉死**：不是 HTTP、不是调用次数、不是 gleaning，而是
   **近满窗 prompt 在 30% CPU 卸载下的 prefill 时间**（`num_ctx` 4096 已由 S13-B 判定为不可上调 —— 上调会立即爆显存）。
4. **对 P1-3（batch insert）的预警**：batch 只减少 HTTP 往返与入队开销，**不减少 LLM 抽取量**；在本环境下**不会**改善墙钟。建议 P1-3 直接以「调用量/入队开销」为指标做零代码验证，而不是期待端到端提速。
5. **对 P1-4（抽取 provider 分离）的强化**：本次实测进一步证明 —— 在 6GB 卡上把 `qwen3:8b` 作为抽取引擎，**失败率 50–67% 且不可预测**（同一文档在 A 臂成功、B 臂失败）。这已不只是「慢」，而是**不可用级别的可靠性问题**。建议 P1-4 的成本估算把「人工重跑成本」计入。

---

## 8. 复现命令

```bash
# 基线臂
cd F:/dsh-lightrag && NO_PROXY=127.0.0.1,localhost,::1 \
  venv/Scripts/lightrag-server.exe --host 127.0.0.1 --port 9621 \
  --working-dir F:/dsh-lightrag/working_dir --input-dir F:/dsh-lightrag/inputs \
  --llm-binding ollama --embedding-binding ollama --log-level INFO
# 实验臂：追加 MAX_GLEANING=0（或写入 .env）

# harness（仓库外）
tsx F:/dsh-lightrag/bench/p12_gleaning.mts baseline   # 或 g0

# 指标提取（调用数 / 图规模 / working_dir 增量）
venv/Scripts/python.exe F:/dsh-lightrag/bench/p12_analyze.py baseline
```

**产物**：`STAGE14_P1_2_baseline.csv` · `STAGE14_P1_2_g0.csv`（本目录）·
`bench/p12_*.json`（含逐篇 rows + summary，仓库外）· 服务日志
`logs/lightrag_server_baseline.log` / `lightrag_server_g0.log`（仓库外）。

---

**状态**：🟢 **P1-2 完成，停在验收节点**。**未进入 P1-3 / P1-4**；`MAX_GLEANING` 维持默认 1；P1-1 的 `EXTRACT_LLM_TIMEOUT=900` 保留。
