# Stage 14 — P1-4B Step 2：`FLASH_ATTENTION` + `KV_CACHE_TYPE=q8_0` 配对 A/B 报告

> **状态**：🟢 Step 2 完成，停在 **P1 收尾前的 Review Node**。
> **判定**：✅ **质量门槛全部通过 ⇒ 保留该优化方向**（"稳定低风险优化"成立）。
> **边界**：未改代码、未改 `.env`、未改 LightRAG、未进 provider separation / UI / P2。

---

## 1. 方法（严格配对）

| 项 | 设计 |
|---|---|
| 语料 | **与 P1-4A 同一份确定性语料**（4 篇，每篇 1 chunk，逐字节相同） |
| 模型 | `qwen3:8b`（两臂相同） |
| 环境 | 同 `nomic-embed-text`｜`MAX_ASYNC=1`｜`MAX_GLEANING=1`｜`num_ctx=4096`｜`think=False` |
| 隔离 | 各自**一次性临时 working_dir**（`wd_p14b_a` / `wd_p14b_b`），主语料未触碰 |
| **A 臂** | 现有 Ollama `127.0.0.1:11434`，**默认设置** |
| **B 臂** | **第二个 Ollama 实例 `127.0.0.1:11435`**，`OLLAMA_FLASH_ATTENTION=1` + `OLLAMA_KV_CACHE_TYPE=q8_0` + `OLLAMA_KEEP_ALIVE=-1` |
| LightRAG 指向 | 用**进程环境变量**覆写 `LLM_BINDING_HOST` / `EMBEDDING_BINDING_HOST`（`load_dotenv(override=False)` ⇒ OS env 优先）⇒ **`.env` 逐字节未改** |
| 配置生效确认 | B 实例自身日志回显：`OLLAMA_FLASH_ATTENTION:true`、`OLLAMA_KV_CACHE_TYPE:q8_0`、`OLLAMA_KEEP_ALIVE:2562047h…`（即 -1 → 无限） |
| 不干扰你的服务 | A 臂全程使用你现有 11434；实验结束时 11434 `/api/version` 正常应答 ✅ |

---

## 2. 结果

### 2.1 质量与可靠性（验收项）

| 验收门槛 | A 默认 | **B FA+q8_0** | 判定 |
|---|---|---|---|
| **nodes ≥ 90%** | 28 | **29** | **103.6%** ✅ |
| **edges ≥ 90%** | 53 | **57** | **107.5%** ✅ |
| **failed 不增加** | **0** | **0** | ✅ |
| **`LLM output format error` = 0** | **0** | **0** | ✅ |
| labels | 28 | 29 | — |

**四条门槛全部通过，且质量指标（nodes/edges）不降反升。**

### 2.2 速度（参考项，非门槛）

| 指标 | A 默认 | **B FA+q8_0** | Δ |
|---|---|---|---|
| 单篇耗时 | 256.8 / 192.6 / 272.9 / **353.1** s | 252.8 / 236.7 / 208.8 / **200.7** s | — |
| 单篇均值 | **268.9 s** | **224.8 s** | −16.4% |
| 总墙钟 | **1,075.5 s**（17.9 min） | **899.1 s**（15.0 min） | **−16.4%** |
| processed | 4/4 | 4/4 | — |

### 2.3 KEEP_ALIVE 验证（单独对照，已通过）

在同一时点、同一极小模型（`nomic-embed-text`）、同一空闲时长下对照：

| 实例 | 配置 | 空闲 **~6 分 40 秒** 后 `/api/ps` |
|---|---|---|
| 11434 | `KEEP_ALIVE` 默认 5m | **模型已被自动卸载** |
| 11435 | `KEEP_ALIVE=-1` | **模型仍驻留** ✅ |

⇒ **`OLLAMA_KEEP_ALIVE=-1` 确实阻止空闲卸载**，可省下 8B **≈29.6 s/次**的冷加载（Step 1 实测）。
零质量风险（不参与推理计算）。

---

## 3. ⚠️ 必须声明的两点不确定性（诚实披露）

### 3.1 速度增益的量级**处于噪声边缘**

与 **P1-4A Arm A（同语料、同默认配置）** 对照：

| 运行 | 配置 | 单篇均值 | 总墙钟 |
|---|---|---|---|
| P1-4A Arm A | 8b 默认 | 235.7 s | 942.7 s |
| **本次 Step2 Arm A** | **8b 默认（完全相同）** | **268.9 s** | **1,075.5 s** |
| 本次 Step2 Arm B | 8b + FA+q8_0 | 224.8 s | 899.1 s |

**同一配置的两次运行相差 +14.1%** ⇒ 本次测得的 **−16.4% 仅略高于配置完全相同情况下的运行间波动**。

**结论（严谨表述）**：
- ✅ **质量门槛通过是确定的**（nodes/edges/failed/format 四项，非速度指标）
- ✅ **机制有效是确定的**（Step 1 直接实测：卸载 29.5%→25.1%、decode 4.7→5.7 tok/s = +21.3%）
- ⚠️ **速度增益的具体幅度不确定**：n=1/臂，幅度与运行间方差同量级；要精确量化需多轮配对

⇒ 但按你的验收标准（**质量通过即保留**），**判定为保留**；只是**不要把 −16.4% 当作稳定可复现的准确数字**。

### 3.2 Harnes 遥测缺口

B 臂的 `llm_gpu_pct` 为 `null` —— 因为既有 harness 把 `/api/ps` **硬编码到 11434**，而 B 臂模型在 11435。
故 B 臂运行期的 GPU% 由**事后**读取 11435 补齐：`qwen3:8b size=5.67GB vram=4.25GB → GPU 74.9% / CPU 25.1%`（与 Step 1 一致）。
不影响速度/质量结论（二者来自 LightRAG 侧计时与图规模）。

---

## 4. 结论

### ✅ 保留该优化方向：`FLASH_ATTENTION=1` + `KV_CACHE_TYPE=q8_0`

判据：
1. **质量零损失** —— nodes 103.6%、edges 107.5%、failed 0→0、格式错误 0→0
2. **机制确证** —— 层卸载下降、decode 提速 21.3%（Step 1 直接实测）
3. **稳定性良好** —— 4/4 成功，无失败、无格式错误，与默认臂一致
4. **零代码、可秒级回滚** —— 仅 Ollama 服务端环境变量；移除即恢复

**同时建议保留**：`OLLAMA_KEEP_ALIVE=-1`（已验证阻止空闲卸载，省 ~29.6 s/次冷加载，零质量风险）。

**落地形式（供后续 P1 收尾时确认）**：这两项是 **Ollama 服务端配置**，不属于 `.env`、不属于仓库代码。
需确定你的长期设置方式（系统环境变量 / Ollama 服务配置），并在其中写入：
`OLLAMA_FLASH_ATTENTION=1`、`OLLAMA_KV_CACHE_TYPE=q8_0`、`OLLAMA_KEEP_ALIVE=-1`。

---

## 5. 红线与状态

| 项 | 状态 |
|---|---|
| 仓库 HEAD | `d1130cb`（本 Step **无 commit**） |
| `src ' M'` | **0** |
| `.env` | **未改**（`LLM_MODEL=qwen3:8b` / `LLM_BINDING_HOST=…11434` / `MAX_ASYNC=1`） |
| LightRAG 代码 | 未改（仅用进程 env 覆写 host） |
| 主语料 | 未触碰（mtime 仍 `Sep 11 12:39`） |
| **你的 Ollama（11434）** | **未被干扰**（实验结束仍正常应答） |
| 第二实例（11435） | 已停止 |
| 显存 | 已回落 29 MiB / 5968 MiB free；`/api/ps` 为空 |
| provider separation / UI / P2 | 均未进入 |

**证据**：`bench/p14a_step2_a.{json,csv}`、`bench/p14a_step2_b.{json,csv}`、
`logs/p14b_armA_server.log`、`logs/p14b_armB_server.log`、`logs/ollama_B2.log`（含 B 实例配置回显）、
`wd_p14b_a/`、`wd_p14b_b/`。

---

## 6. 待办（按你给的优先级）

```
FA/q8_0 质量验证 ✅ 完成（本报告）
        ↓
KEEP_ALIVE ✅ 已验证
        ↓
P1 收尾（含 P1 汇总报告 Errata 提交）
        ↓
进入 P2
```

---

**状态**：🟢 停在 **Review Node**。
