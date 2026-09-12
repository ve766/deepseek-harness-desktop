# Stage 14 — P1-3：batch insert 零代码验证实测报告

> **状态**：🟢 **完成，停在 P1-3 Acceptance Node**。
> **结论**：**batch insert 不值得合入（NOT ADOPTED）** —— 收益 0.0045%，低于 5% 门槛约 1100 倍。
> **范围**：仅验证 `POST /documents/texts`（批量）相对 `POST /documents/text`（逐篇）的**真实收益**。
> **红线**：零代码改动 —— 未改 lightrag-server / app `src` / `packages/llm`；未调 `MAX_ASYNC`；未进 P1-4。

---

## 1. 目标与方法

P1-2 已证：ingestion 瓶颈是**单次 LLM 调用延迟**，不是 gleaning 续抽次数。
P1-3 要回答：**把「逐篇 POST」换成「批量 POST」能否提升吞吐？**

方法（按 Mini Plan Phase B）：

- **不碰真实语料**：用**一次性临时 working_dir**，每臂一个、各为冷启动（0 records）。
  → 主语料 `F:/dsh-lightrag/working_dir` 全程未被读写，**无需 snapshot / restore**，规避 P1-2 中 restore 覆盖导致证据丢失的坑。
- **working_dir 隔离方式**：仅用 `lightrag-server --working-dir <tmp>` CLI 覆盖，**`.env` 一字未改**。
- **零代码**：测量只用 HTTP API；harness 为仓库外 `bench/p13_batch_ab.py`（不入 git）。
- **N = 6 篇极小文档**（每篇 1 句、约 80 字符，含专属实体 李明N / 王芳N / P13-N / EQ-100N），两臂**逐字节相同**。

---

## 2. 环境（两臂完全一致，唯一差异 = 调用哪个端点）

| 项 | 值 |
|---|---|
| LightRAG | 1.5.7，`127.0.0.1:9621` |
| LLM | `qwen3:8b` @ Ollama 11434（5.23 GB） |
| Embedding | `nomic-embed-text`（768 维） |
| `OLLAMA_LLM_NUM_CTX` | 4096 |
| `OLLAMA_LLM_THINK` | false |
| **`MAX_ASYNC`** | **1**（未改动 → LLM 抽取严格串行） |
| **`MAX_GLEANING`** | **1**（默认，未改动） |
| provider / model | Ollama / qwen3:8b（未改动） |
| working_dir | 一次性临时目录，每臂**冷启动**（`wd_p13_seq` / `wd_p13_batch`） |
| GPU | RTX 3060 Laptop 6GB |

> 注：两臂**未复用同一 working_dir**，故不存在 LLM 缓存跨臂命中，两臂 LLM 工作量真实相同。

---

## 3. 实测数据

### Arm A — sequential（`POST /documents/text` × 6）

| 指标 | 值 |
|---|---|
| HTTP 调用数 | 6 |
| **HTTP 总耗时** | **172.2 ms**（单次均值 28.7 ms） |
| **总墙钟** | **768,066 ms ≈ 12.80 min** |
| 单篇平均耗时 | 128,011 ms ≈ 2.13 min |
| processed / failed | **6 / 0** |
| 超时 | 否 |

### Arm B — batch（`POST /documents/texts` × 1，含同 6 篇）

| 指标 | 值 |
|---|---|
| HTTP 调用数 | 1 |
| **HTTP 总耗时** | **137.4 ms**（单次） |
| **总墙钟** | **876,714 ms ≈ 14.61 min** |
| 单篇平均耗时 | 146,119 ms ≈ 2.44 min |
| processed / failed | **6 / 0** |
| 超时 | 否 |

### 对比

| 指标 | sequential | batch | Δ | 结论 |
|---|---|---|---|---|
| HTTP 调用数 | 6 | **1** | **−5** | 批量合并生效 |
| **HTTP 总耗时** | 172.2 ms | **137.4 ms** | **−34.8 ms** | 批量确实省了入队/往返开销 |
| 单次 HTTP 均值 | 28.7 ms | 137.4 ms | +108.7 ms | 批量单次更重（承载 6 篇） |
| **总墙钟** | 768,066 ms | 876,714 ms | **+108,648 ms（+14.1%，batch 更慢）** | 见 §4 归因 |
| 单篇平均 | 128,011 ms | 146,119 ms | +18,108 ms（+14.1%） | 同上 |
| processed / failed | 6 / 0 | 6 / 0 | 0 | 无差异 |

---

## 4. 门槛判定

预设门槛：**收益 ≥ 5%**。以总墙钟为分母：

```
实际节省 = 34.8 ms（HTTP 层）
需求门槛 = 5% × 768,066 ms = 38,403 ms
达成率   = 34.8 / 38,403 ≈ 0.09%   →  差约 1,100 倍
占墙钟比 = 34.8 / 768,066 ≈ 0.0045%
```

**判定：❌ 未达门槛（决定性）**

**归因（为何必然如此）**：

- 批量的**唯一**作用是合并入队/往返开销：6 次 → 1 次，共省 34.8 ms。
- 墙钟中 LLM 抽取占 `768,066 − 172 ≈ 767,894 ms`，即 **99.98%**。
- `MAX_ASYNC=1` 下 LLM 抽取严格串行，且**每 chunk 的抽取工作量与端点无关** → 批量**在原理上无法**减少这部分。
- 因此 batch 的收益上界 ≈ 入队开销占比，与文档大小/数量无关地**恒定在毫秒量级**。

**关于 batch 墙钟反而慢 108.6 s（+14.1%）**：这**不是**批量引入的惩罚 —— 批量没有拖慢抽取的机制。两臂为两次独立运行，差异来自**单次调用延迟方差**（P1-2 已实测 169–410 s/call 的方差）。两臂结构完全相同（各 6 篇、各 1 chunk/篇、6/6 成功），故该差值应判为**运行间噪声**，不构成对 batch 的负面证据，但同样也说明**batch 未带来任何可检出收益**。

---

## 5. 决策：**batch insert 不值得合入**

- 收益 **0.0045%** ≪ **5%** 门槛；批量在此环境**无实际价值**（亦无副作用）。
- **不建议**将 ingestion 从 `/documents/text` 切换到 `/documents/texts`。
- 真正的提速杠杆仍是**单次调用延迟**（缩短抽取 prompt / 提高 `num_ctx`）或**并发**（`MAX_ASYNC > 1`）——后者受 6GB 显存约束，属 **P1-4（ingestion provider separation）**，按指示**暂不启动**。

---

## 6. 附带的结构性发现（独立于本结论，但价值高）

**极小文档的成本几乎没降**：

| 实验 | 文档体量 | 单篇墙钟 |
|---|---|---|
| P1-2 | 约 345K–783K bytes | 677.9 s / 1020.2 s |
| P1-3 | **约 80 字符**（≈ 体量的 1/4000） | **128.0 s / 146.1 s** |

文档体量缩小约 **4000 倍**，单篇耗时仅降到 **1/5**。

→ **强证据**：ingestion 单篇成本由**固定开销**主导（抽取 system prompt ≈1800 tokens 的 prefill），而**非文档内容量**。这与 P1-2 的根因分析一致，并**独立复现**了该结论。

**推论**：任何「减少文档数/合并请求」类的优化（含 batch insert）都**打不到这个固定成本**；只有缩短 prompt 或提高算力/并发才有效。

---

## 7. 红线与隔离

| 项 | 结果 |
|---|---|
| `src/` modified | **0** |
| `packages/llm` | 未触碰（唯一 `' M'` 为预存噪声 `llm/llm/tsconfig.json`；3 个未跟踪目录为既有废弃包） |
| 新增依赖 / lockfile | 无 |
| 代码 commit | **无** |
| HEAD | `1804388`（= P1-2 报告提交，未变） |
| 仓库文件改动 | **0**（`find -newermt 18:20` 扫描为空） |
| 全仓 modified / untracked | 99 / 144（与实验前一致） |
| 改动面 | 仅仓库外：2 个一次性临时 working_dir、`bench/p13_batch_ab.py`、`logs/p13_*_server.log`、`bench/p13_{seq,batch}.{json,csv}` |
| 主语料 | `F:/dsh-lightrag/working_dir` **未被读写**（mtime 仍 12:39） |
| `.env` | **一字未改**（`MAX_ASYNC=1` / `MAX_GLEANING=1` / qwen3:8b 保持） |
| 服务 | 两臂结束后已 `taskkill`，9621 已停 |

---

## 8. 复现命令

```bash
# 臂 A：sequential（临时 dir，.env 不动）
cd F:/dsh-lightrag && venv/Scripts/lightrag-server.exe --host 127.0.0.1 --port 9621 \
  --working-dir F:/dsh-lightrag/wd_p13_seq
python3 F:/dsh-lightrag/bench/p13_batch_ab.py seq 6

# 臂 B：batch（换临时 dir + 重启，保证冷启动对等）
MSYS_NO_PATHCONV=1 taskkill /F /IM lightrag-server.exe
cd F:/dsh-lightrag && venv/Scripts/lightrag-server.exe --host 127.0.0.1 --port 9621 \
  --working-dir F:/dsh-lightrag/wd_p13_batch
python3 F:/dsh-lightrag/bench/p13_batch_ab.py batch 6
```

**证据**：`bench/p13_seq.{json,csv}`、`bench/p13_batch.{json,csv}`（含逐次 HTTP 耗时与 track 状态）、
`logs/p13_seq_server.log`、`logs/p13_batch_server.log`；临时 working_dir `wd_p13_seq/`、`wd_p13_batch/`（保留供审计）。

---

## 9. 局限（如实声明）

1. **N=6**，非 Mini Plan 建议的 8–10。原因：单篇 LLM 抽取约 2.1–2.4 min，两臂各耗时约 13–15 min，已触及 ≤15 min 预算上限。因核心指标（HTTP 开销）与 N 无关地呈**毫秒量级**，N 的减少**不影响结论方向**。
2. 墙钟对比受**运行间 LLM 延迟方差**污染（两臂相差 +14.1%），已在 §4 说明并将其判定为噪声，未据此指控 batch。
3. 极小文档测出的是**固定开销**；该结论**不能**外推到「大文档下 batch 会有收益」——恰恰相反，大文档 LLM 占比更高，batch 收益占比**更低**。
4. 两臂各自冷启动，未测「同一 working_dir 已有数据」时的增量插入表现（不影响本结论量级）。

---

**状态**：🟢 P1-3 完成，停在 Acceptance Node。**未进入 P1-4**；`MAX_ASYNC` / `MAX_GLEANING` / provider / model 全部保持原值。
