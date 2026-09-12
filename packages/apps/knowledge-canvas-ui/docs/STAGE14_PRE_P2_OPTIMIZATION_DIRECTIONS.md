# Stage 14 — P2 前优化方向评估（仅设计分析，Review Node）

> **状态**：🟢 分析完成，停在 **Review Node**，**不自动编码**。
> **范围**：基于 P1 系列 + P1-4A 的**实测证据**重新评估 P2 前的优化方向。
> **暂停**：provider separation 按指示**暂停**。
> **本轮**：零代码、零环境改动、未启模型、未改 `.env`。

---

## 0. 结论摘要（TL;DR）

| 方向 | 判断 | 关键理由 |
|---|---|---|
| **B. 降 KV 显存**（`OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0`） | ⭐ **首选** | 直击唯一实证瓶颈（8B 的 **29.5% CPU 卸载**）。零代码、可秒级回滚。官方文档：FA"faster prompt processing and smaller KV cache"，q8_0"half the VRAM of f16, negligible quality loss" |
| **A. MAX_ASYNC 并发** | ⚠️ **仅可在 B 之后** | 官方明确"**each slot multiplies the KV cache allocation**"。8B 已欠配 ⇒ 直接开并发**很可能加重卸载、拉长单调用、增加 900s 超时** |
| **C. 其它非架构优化** | 多数**无收益或高风险** | `CHUNK_SIZE` / `MAX_EXTRACTION_*` 经实测**非绑定或与已知根因冲突**（见 §4） |
| 云端 provider | ⏸ 暂停 | 按指示 |

**一句话**：**先做单请求调优（B），不要先开并发（A）。** 这也是 Ollama 官方推荐的调优顺序。

---

## 1. 证据基线（全部来自前序实测，非推断）

| 事实 | 值 | 来源 |
|---|---|---|
| GPU 名义 / Ollama 可用 | 6.0 GiB / **5.0 GiB** | `nvidia-smi` + Ollama `server.log` |
| `num_ctx` | **4096**（Ollama 依 VRAM 自动推导） | 同上 |
| `qwen3:8b` | size 5.97 GB，**vram 4.21 GB** ⇒ **GPU 70.5% / CPU 29.5%** | `/api/ps`（P1-4A Step 0） |
| `qwen3:8b` 冷加载+首调用 | **54.0 s** | 同上 |
| `qwen3:4b` | 3.18 GB，**100% GPU**（但输出格式不达标） | P1-4A |
| `nomic-embed-text` | 0.32 GB，100% GPU | P1-4A |
| 两者共存 | ✅ 同时驻留，**无卸载/重载（M2 已被推翻）** | P1-4A |
| 8B 真实 ingestion（单 chunk 文档） | **232.7 / 244.7 / 228.7 / 236.7 s**，4/4 成功，0 格式错误 | P1-4A Arm A |
| 8B 真实 ingestion（P1-2 多 chunk 文档） | 678–1020 s，**4/6 失败**（单调用 >900 s 触顶） | P1-2 |
| 当前并发 | `MAX_ASYNC=1`；`OLLAMA_NUM_PARALLEL` **未设**（默认 1） | `.env` + 环境变量 |
| 固定 prompt 成本 | system prompt **7,019 chars ≈ 1,755 tok**（每次调用都发） | Prompt Cost Analysis |

---

## 2. 方向 A：`MAX_ASYNC` 并发收益与风险

### 2.1 必须分清两个层级

| 层级 | 变量 | 当前值 | 作用 |
|---|---|---|---|
| LightRAG | `MAX_ASYNC`（LLM 角色并发） | **1** | 同时发出多少个抽取请求 |
| Ollama | `OLLAMA_NUM_PARALLEL`（单模型并发槽） | 未设（**默认 1**） | 一个模型实例同时处理几个序列 |

**关键推论**：**只调 `MAX_ASYNC` 无效** —— 请求会在 Ollama 侧排队。**必须两者同时调高**才可能有收益。

### 2.2 风险（官方文档已明确）

> "OLLAMA_NUM_PARALLEL — Concurrent requests per model; **each slot multiplies the key-value cache allocation**."

- 8B 现状：vram 4.21 GB / 可用 5.0 GiB，**已经 29.5% 卸载**
- `NUM_PARALLEL=2` ⇒ KV 缓存分配约 ×2 ⇒ **更严重的卸载**
- ⇒ 每个请求的 prefill 更慢 ⇒ **900 s 超时更易触发**（P1-2 的失败模式会恶化）

### 2.3 可能的收益

- Ollama（llama.cpp）的连续批处理在一趟前向里处理多序列，**理论 tokens/s 吞吐可提升**
- 但该收益**以 VRAM 能容纳多份 KV 为前提** —— 在本卡上不成立（除非先做方向 B）

### 2.4 判定

**⚠️ 有条件可行，但必须排在方向 B 之后**，且需按官方方法逐步验证：
每提高一档都要用 `ollama ps` 确认**仍是 100% GPU**；一旦出现混合切分或排队 503，立即回退一档。

---

## 3. 方向 B：`qwen3:8b` 在 6 GB VRAM 下的最优运行参数

### 3.1 最高价值杠杆：降低 KV 缓存显存

| 变量 | 作用（官方文档） | 预期 |
|---|---|---|
| `OLLAMA_FLASH_ATTENTION=1` | "**Faster prompt processing and smaller key-value cache**"；且是 KV 量化的**前置条件** | 直接加速 prefill + 省 KV |
| `OLLAMA_KV_CACHE_TYPE=q8_0` | "**half the VRAM of f16, negligible quality loss**" | KV 减半 ⇒ **有望让 29.5% 卸载落到 0%** |

**为什么这是首选**：8B 的 29.5% CPU 卸载是**已被实测确认的唯一瓶颈**（P1-2/P1-3/P1-4A 三次收敛）。
砍掉 KV 占用 ⇒ 更多层可驻 GPU ⇒ prefill 变快。**且完全不需要改代码**（Ollama 服务端环境变量，移除即回滚）。

**风险与诚实边界**：
1. 官方提示 **q8_0 的质量损失与模型结构相关**："具有高 GQA 计数的模型（例如 Qwen2）可能比低 GQA 计数的模型受到更明显的量化精度影响"。
   ⚠️ **`qwen3` 正是 GQA 结构** ⇒ **必须做质量 A/B（nodes/edges ≥ 基线 90%）**，不能默认通过。
2. **收益幅度不可先验断言**。P1-4A 的"4B 加载快 2.9×"**混淆了模型规模与卸载比例**两个因素，不能直接外推。
   ⇒ 必须按 Step 0 的方法**实测**（成本：分钟级）。
3. KV 量化是**全局选项**，对所有已加载模型生效。

### 3.2 次要但低风险：消除 54 s 冷加载

| 变量 | 作用 |
|---|---|
| `OLLAMA_KEEP_ALIVE=-1`（或长值，如 `30m`） | 官方默认 5m；冷加载 8B 需 **54 s**。pipeline 空闲超过 keep-alive 就会付一次冷启动 |

零质量风险、零代码，属纯粹的时间省下。

### 3.3 不建议动的

| 变量 | 原因 |
|---|---|
| `num_ctx` 上调 | 已由 Ollama 依 5.0 GiB 自动定为 4096；上调必爆 |
| `num_ctx` 下调到 3072 | prompt(≈1,755) + chunk(1,200) ≈ 2,955，**已几乎贴住** ⇒ 会截断 |
| 换更低比特量化模型（如 Q3） | 需重新下载 + 质量下降，且**不如先试 KV 量化**（后者不动权重） |

---

## 4. 方向 C：不改核心架构的 ingestion 优化点

| # | 杠杆 | 机制 | 判定 |
|---|---|---|---|
| **C1** | **FA + KV 量化**（同 §3.1） | 降低卸载 ⇒ prefill 加速 | ⭐ **采纳为首选** |
| **C2** | `OLLAMA_KEEP_ALIVE=-1` | 免受 54 s 冷加载 | ✅ 低风险，建议一并做 |
| **C3** | `MAX_ASYNC` + `NUM_PARALLEL` | 吞吐 | ⚠️ 仅 C1 之后 |
| C4 | `CHUNK_SIZE`（默认 1200） | 调大 chunk → 调用数减少（少付 1,755 tok 固定 prompt） | ❌ **不做**。会在 4,096 窗口里**挤压输出余量**，而 P1-2 已证"近满窗"正是病理级延迟的根因；调小则调用数增多，更差 |
| C5 | `MAX_EXTRACTION_RECORDS=100` / `MAX_EXTRACTION_ENTITIES=40` | 响应记录上限（会注入 prompt） | ❌ **不做**。P1-4A 实测 8B 每篇仅产出 **7–9 个实体**，**上限远未绑定** ⇒ 下调只会截断输出、损质量、无速度收益 |
| C6 | `MAX_GLEANING=0` | 减半调用数 | ❌ **已证无效**（P1-2，墙钟未改善） |
| C7 | batch insert | 合并请求 | ❌ **已证无效**（P1-3，收益 0.0045%） |
| C8 | prompt 裁剪 | 降固定 prompt | ❌ **已证上限 6.5%**（Prompt Cost Analysis 修订版） |
| C9 | `EMBEDDING_FUNC_MAX_ASYNC` / `EMBEDDING_BATCH_NUM` | 嵌入并发/批 | ➖ **边际**：embedder 已 100% GPU 且首调用 3.3 s |
| C10 | LLM 缓存复用（重复 ingest） | 命中缓存免调用 | ➖ 对**重复导入**有效，对首次导入无效 |
| C11 | `EXTRACT_LLM_TIMEOUT` | 已由 P1-1 提到 900 | ➖ 属**症状缓解**；C1 才治因 |

---

## 5. 推荐顺序（含验证方法）

```
Step 1（分钟级，只读式实测）
  └─ 用 P1-4A Step 0 的方法，对比加载 qwen3:8b：
       (a) 现状            → 期望 GPU 70.5%
       (b) +FA +q8_0      → 看 ollama ps 是否变成 100% GPU
     判据：GPU% 上升到 ~100% 才值得进入 Step 2

Step 2（配对 A/B，质量门槛）
  └─ 同语料 / 同 embedding / 同 MAX_ASYNC=1 / 同 MAX_GLEANING=1
     仅变量 = Ollama 的 FA+q8_0
     判据：延迟改善 **且** nodes/edges ≥ 基线 90%（同 P1-2 口径）
     不达标 → 立即回滚（移除环境变量）

Step 3（仅在 Step 2 通过后）
  └─ MAX_ASYNC 1→2 且 OLLAMA_NUM_PARALLEL 1→2
     每档用 ollama ps 确认仍 100% GPU；出现混合切分/503 立即回退

Step 4（低风险收尾）
  └─ OLLAMA_KEEP_ALIVE=-1，消除 54 s 冷加载
```

**为什么不先做 Step 3**：官方调优顺序即"**先单请求调优（规格、量化、FA 与 KV 缓存）确认单路速度，再逐步调大 NUM_PARALLEL**"。
在 8B 已欠配的前提下先开并发，等于把 KV 需求翻倍压在已经溢出的显存上。

---

## 6. 明确不建议（避免重复投入）

- 云端 provider 分离（**按指示暂停**）
- 换 `qwen3:4b`（**已证输出格式不可用**，P1-4A）
- gleaning / batch insert / prompt 裁剪（**均已实测排除**）
- 调整 chunk size / extraction caps（**非绑定或与已知根因冲突**）
- 改任何 `src/`、`packages/llm/`、恢复 `llm-router`（红线）

---

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `d1130cb`（P1-4A 报告），本轮**无 commit** |
| 本轮改动 | **0**（只读读取 library 源码 / Ollama 日志 / 文档检索） |
| `src ' M'` / 全仓 | 0 / 99 M、143 ??、0 D |
| `.env` | 未改 |
| 服务 / 模型 | 未启用（`/api/ps` 空） |
| UI / P2 / router / `packages/llm` / 依赖 / lockfile | 均未触碰 |

---

## 8. 待裁决

1. 是否批准 **Step 1**（分钟级实测 FA+q8_0 对卸载的影响）？
2. 若 Step 1 显示卸载消失，是否批准 **Step 2 配对 A/B**（含质量门槛）？
3. 是否接受「**先单请求调优、后并发**」的推荐顺序（即暂不单独批准 Step 3）？
4. 本报告是否提交（单文件、kcu 惯例路径）？
5. 遗留：P1-3 根 `docs/` 重份按指示**未处理**。

---

**状态**：🟢 停在 **Review Node**，不自动编码。
