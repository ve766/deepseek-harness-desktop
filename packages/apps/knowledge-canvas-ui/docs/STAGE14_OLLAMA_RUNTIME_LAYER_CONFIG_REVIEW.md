# Ollama 运行层配置方案（Review）

> 状态：**设计评审（design-only）→ 2026-09-11 已获批准**。评审阶段未修改任何系统环境、未修改 `.env`、未修改仓库代码。
> 执行记录与验证结果见 **§10**。
> 上游裁决：P1 正式关闭；P1-4B `FA + q8_0 + KEEP_ALIVE` 优化方向**批准保留**，落地前先过本 Review。
> 纪律：本 Review 通过并获明确批准后，才执行环境落地。
> 依据事实：P1-4B Step 1/Step 2 实测 + Ollama 官方 FAQ + 本机配置面实测。

---

## 0. 结论摘要

| 项 | 结论 |
|---|---|
| 推荐方式 | **User 级环境变量**（`HKCU\Environment`），非 Machine、非配置文件 |
| 需写入变量 | `OLLAMA_FLASH_ATTENTION=1`、`OLLAMA_KV_CACHE_TYPE=q8_0`、`OLLAMA_KEEP_ALIVE=-1` |
| 生效条件 | **必须完全重启所有 `ollama.exe` 进程**（环境变量仅在进程启动时读取） |
| 预期收益 | 端到端 **−8% ~ −16%**（**不是 2×**，见 §6） |
| 回滚 | 删除 3 个变量 → 重启。**项目侧零改动，故无需回滚** |
| 主要风险 | `OLLAMA_KV_CACHE_TYPE` 是**全局**选项（官方 FAQ），对所有模型生效，且无法 per-model 回滚 |

---

## 1. 现状事实（本机实测，2026-09-11）

| 事实 | 证据 |
|---|---|
| Ollama 版本 | `GET /api/version` → `0.32.5` |
| **不是 Windows 服务** | `sc query ollama` / `OllamaService` → 错误 1060「指定的服务未安装」 |
| 安装位置（per-user） | `C:\Users\Hasee\AppData\Local\Programs\Ollama\`（含 `ollama.exe`、`ollama app.exe`） |
| **已有 User 级先例** | `HKCU\Environment` → `OLLAMA_MODELS = F:\ollama model` |
| HKLM（系统级）无 OLLAMA 变量 | `HKLM\...\Session Manager\Environment` 查询 → 0 匹配 |
| **无配置文件入口** | `~/.ollama/config.json` 不存在；`%LOCALAPPDATA%\Ollama\` 仅含 `app.log`/`server.log`/`db.sqlite`/`ollama.pid` |
| 当前 11434 由独立进程持有 | `ollama.exe` PID 7620；托盘 `ollama app.exe` **未运行** |
| 历史上出现过端口争用 | `%LOCALAPPDATA%\Ollama\server.log` 含多条 `bind: Only one usage of each socket address ... :11434` |
| 基线环境变量状态 | HKCU 仅有 `OLLAMA_MODELS`，**无** FA / KV / KEEP_ALIVE → 干净起点 |
| GPU / 显存 | RTX 3060 Laptop 6 GB；Ollama 日志：`total_vram="6.0 GiB"`、`total="6.0 GiB" available="5.0 GiB"`、`default_num_ctx=4096` |

> **含义**：Ollama 在此机器上是**用户级进程**，不是系统服务。故配置面是**用户环境变量**，且修改后必须**重启进程**而非「重启服务」。

---

## 2. Windows 推荐配置方式

### 2.1 方案对比

| 方案 | 做法 | 评价 |
|---|---|---|
| **A. User 级环境变量**（推荐） | `HKCU\Environment` 写入 3 个变量 | ✅ 与既有 `OLLAMA_MODELS` 先例一致；无需管理员；单用户 per-user 安装，语义匹配 |
| B. Machine 级环境变量 | `HKLM\...\Environment` | ⚠️ 需管理员；影响所有用户；本机无第二用户，收益为零 → 不采用 |
| C. 配置文件 | — | ❌ **不可用**：Ollama 无 `config.json` 入口（已核实） |
| D. 进程环境变量 / 启动包装器 | 启动时注入 env | ➖ 不持久，但**回滚成本为零** → 保留为验证/临时手段（P1-4B 实验即用此法） |

### 2.2 推荐写法（二选一，等价）

**方式 1 — GUI**：`Win+R` → `sysdm.cpl` → 高级 → 环境变量 → **用户变量** → 新建，逐项添加：

| 变量名 | 值 |
|---|---|
| `OLLAMA_FLASH_ATTENTION` | `1` |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` |
| `OLLAMA_KEEP_ALIVE` | `-1` |

**方式 2 — PowerShell**（`User` 作用域，无需管理员）：

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", "1",    "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KV_CACHE_TYPE",   "q8_0", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE",      "-1",   "User")
```

### 2.3 生效步骤（关键，易错）

环境变量**只在进程启动时被读取**，故：

1. **先确认端口归属**：`tasklist /FI "IMAGENAME eq ollama.exe"` 与 `/FI "IMAGENAME eq ollama app.exe"`
   — 本机 §1 已记录端口争用史，务必确保**只有一个** server 会去 bind 11434。
2. 退出托盘应用（任务栏 Ollama 图标 → Quit），再结束残留进程：`taskkill /F /IM "ollama app.exe"`、`taskkill /F /IM ollama.exe`
   （Windows 侧须加 `MSYS_NO_PATHCONV=1`，否则 git-bash 会把 `/F` 当路径）
3. 确认 11434 已释放：`GET http://127.0.0.1:11434/api/version` 应**连接失败**
4. 重新启动 Ollama（开始菜单图标，或 `%LOCALAPPDATA%\Programs\Ollama\ollama app.exe`）
5. 按 §5 验证

> ⚠️ 只做「unload 模型」（`keep_alive:0`）**不会**让新环境变量生效 —— 必须重启进程。

---

## 3. 边界说明：Ollama 运行层 vs 项目 `.env`

这是本方案最需要说清的边界。二者都用 `OLLAMA_*` 前缀，但**由不同进程、在不同时机读取**。

| 层 | 读取者 | 存放位置 | 作用范围 | 生效时机 |
|---|---|---|---|---|
| **L1 Ollama 运行层** | `ollama.exe` 自身 | Windows 用户环境变量（`HKCU\Environment`） | **所有模型、所有客户端** | 进程启动时（需重启） |
| **L2 LightRAG 项目层** | `lightrag-server` | `F:/dsh-lightrag/.env` | 仅 LightRAG | 服务启动时（需重启） |
| **L3 请求级** | 无（随请求发送） | Ollama HTTP 请求体 | 单次请求 | 立即 |

### 3.1 ⚠️ 命名碰撞警告（重要）

项目 `.env` 中有两个 `OLLAMA_*` 键，它们**不是 Ollama 服务器变量**，而是 **LightRAG 侧键**，被组装进 HTTP 请求：

| `.env` 键 | 真实归属 | 实际去向 |
|---|---|---|
| `OLLAMA_LLM_NUM_CTX=4096` | LightRAG | 作为请求参数 `num_ctx` 发给 Ollama |
| `OLLAMA_LLM_THINK=false` | LightRAG | 作为**顶层**请求参数 `think` 发给 Ollama（源码 `lightrag/llm/ollama.py:283-289`） |

**推论（必须遵守）**：把 `OLLAMA_KV_CACHE_TYPE` / `OLLAMA_FLASH_ATTENTION` 写进 `.env` **不会有任何效果，且会被静默忽略** —— Ollama 服务器根本不读 `.env`。

> 附带教训（P1-4B Step 1 实证）：`think` 必须放在请求**顶层**，放进 `options` 会被忽略，导致 256 token 全被思考过程吃掉、`response` 变成空字符串。

### 3.2 `.env` 20 个生效键的归属分类

| 归属 | 键 |
|---|---|
| 服务本体 | `HOST` `PORT` `WORKING_DIR` `INPUT_DIR` |
| LLM 绑定 | `LLM_BINDING` `LLM_BINDING_HOST` `LLM_MODEL` |
| LLM 请求参数（L3） | `OLLAMA_LLM_NUM_CTX` `OLLAMA_LLM_THINK` |
| Embedding 绑定 | `EMBEDDING_BINDING` `EMBEDDING_BINDING_HOST` `EMBEDDING_MODEL` `EMBEDDING_DIM` |
| 鉴权 | `LIGHTRAG_API_KEY` `TOKEN_SECRET` |
| 并发 / 超时 | `MAX_ASYNC` `TIMEOUT` `EXTRACT_LLM_TIMEOUT` |
| 代理旁路 | `NO_PROXY` `no_proxy` |

**结论：`.env` 中没有任何一个键属于 L1（Ollama 运行层）。** 本次要落地的 3 个变量全部属于 L1，因此**不进入 `.env`**。

> 备注：LightRAG 用 `load_dotenv(override=False)`（`lightrag.py:217`），故**操作系统环境变量优先于 `.env`**。这既是 P1-4A/B 能做到「`.env` 逐字节不改」的原因，也意味着 —— 若误把 L1 变量写进 `.env`，它反而会被 OS 环境变量覆盖。

---

## 4. 回滚方式

| 级别 | 手段 | 影响面 | 耗时 |
|---|---|---|---|
| **R1 完整回滚**（推荐） | 删除 3 个用户变量 → 重启 Ollama → 回到 f16 / 无 FA / 5m | 全部模型 | ~1 min |
| **R2 零持久验证态** | 不写用户变量；改用独立实例 + 进程 env（P1-4B 已验证可行） | 仅该实例 | 即时 |
| **R3 项目侧** | **不需要** —— `.env`、仓库、LightRAG 均零改动 | — | — |

```powershell
# R1 删除
[Environment]::SetEnvironmentVariable("OLLAMA_FLASH_ATTENTION", $null, "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KV_CACHE_TYPE",   $null, "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE",      $null, "User")
# 之后重启全部 ollama 进程
```

⚠️ **回滚粒度限制**：`OLLAMA_KV_CACHE_TYPE` 是**全局**选项（官方 FAQ 明示 *"this is a global option — meaning all models will run with the specified quantization type"*），**无法 per-model 回滚**，只能整体回滚。`KEEP_ALIVE` 与 `FLASH_ATTENTION` 同理为进程级。

---

## 5. 验证方法

| # | 验证项 | 方法 | 通过判据 | 本机实测值（P1-4B） |
|---|---|---|---|---|
| V1 | 进程已读到新配置 | 手工启动的实例会在自身日志回显 `OLLAMA_FLASH_ATTENTION:true` / `OLLAMA_KV_CACHE_TYPE:q8_0` | 三项均出现在日志 | ✅ 已观测 |
| V2 | KV 量化生效 | `GET /api/ps` → 比较 `size` 字段 | `size` 下降（KV 占用减半） | `5.97 GB → 5.67 GB` ✅ |
| V3 | **GPU offload 改善** | `GET /api/ps` → `size_vram / size` 百分比 | CPU 占比下降 | `CPU 29.5% → 25.1%` ✅ |
| V4 | 显存占用 | `nvidia-smi --query-gpu=memory.used --format=csv` | 合理下降、无 OOM | — |
| V5 | `KEEP_ALIVE` 生效 | 加载模型 → **空闲 >5 分钟** → 再查 `/api/ps` | 模型**仍驻留**（默认 5m 会卸载） | ✅ 已对照验证（6m40s） |
| V6 | **抽取质量** | 配对 A/B（同语料/同 embedding/`MAX_ASYNC=1`/`MAX_GLEANING=1`/`num_ctx 4096`） | nodes ≥90%、edges ≥90%、failed 不增、格式错误=0 | nodes 103.6% / edges 107.5% / failed 0 / 格式错误 0 ✅ |
| V7 | 回归 | 抽取日志 | `LLM output format error` = 0 | ✅ 0（对照默认臂亦为 0） |

> ⚠️ **V1 的注意点**：本机默认实例的 `server.log` **未**回显这些配置项（实测 grep 为空）。故对默认实例应以 **V2/V3 的行为证据**为主判据，而非日志文本。

### 5.1 从「配置」到「效果」的因果链（供核查）

```
OLLAMA_FLASH_ATTENTION=1 ─┬─> 启用 FA（KV 量化的前置条件）
OLLAMA_KV_CACHE_TYPE=q8_0 ┘        ↓
                              KV cache 显存减半（f16 → q8_0）
                                       ↓
                              可用显存相对宽松 → CPU offload 减少（29.5% → 25.1%）
                                       ↓
                              decode 吞吐提升（4.7 → 5.7 tok/s，+21.3%）
                                       ↓
                              端到端摄取耗时下降（−8.1% ~ −16.4%）
```

---

## 6. 预期收益与风险

### 6.1 收益预期（必须先校准）

| 指标 | 实测 |
|---|---|
| Step 1（分钟级探针，真实抽取 prompt） | 端到端 `86.56s → 79.57s` = **−8.1%** |
| Step 2（配对 A/B，4 篇） | 总墙钟 `1075.5s → 899.1s` = **−16.4%** |
| decode 吞吐 | `4.7 → 5.7 tok/s` = **+21.3%** |
| CPU offload | `29.5% → 25.1%` = **−4.4pp** |
| 冷加载节省（KEEP_ALIVE） | 约 **29.6 s / 次** |

**⚠️ 这不是 2× 级优化。** 结构性上限来自显存算术：

| VRAM 组成 | 体量 | 受 KV 量化影响 |
|---|---|---|
| **模型权重**（qwen3:8b Q4） | **≈4.87 GiB** | ❌ 不受影响 |
| KV cache @ 4096 ctx | 0.5 → 0.25 GiB | ✅ 减半 |
| Ollama 报告可用 | **5.0 GiB** | — |

权重 4.87 GiB 已逼近可用 5.0 GiB，KV 只占一小部分 ⇒ **offload 无法清零**，本杠杆上界约 **−8% ~ −15%**。

**关于 −16.4% 的诚实说明**：同配置的 A 臂两次运行相差 **+14.1%**（P1-4A 235.7s vs Step 2 268.9s），故 −16.4% **仅略高于运行间噪声**（n=1/臂）。**质量结论与机制是确定的，速度幅度不是。**

### 6.2 风险登记

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| 1 | **KV 量化是全局的**：影响所有模型（含 `qwen2.5-coder:7b`、`qwen3:4b`） | 中 | 已知代价；若未来需 per-model 策略，只能起**第二个 Ollama 实例**（P1-4B 已验证该手法） |
| 2 | 官方警告：**高 GQA 模型（Qwen 族）对量化更敏感** | 中 | V6 配对 A/B 已通过质量门槛；**但仅覆盖 ingestion 抽取，未覆盖检索问答质量** ← 诚实缺口 |
| 3 | `KEEP_ALIVE=-1` 使模型**永久驻留显存** | 低 | 单用户本机场景可接受；若需游玩/其他 GPU 任务，可临时 unload 或回滚为 `30m` |
| 4 | FA 需硬件/模型支持 | 低 | RTX 3060（Ampere）支持；不支持时按 §5 V2 `size` 未下降即可判定 |
| 5 | 端口争用（本机历史存在） | 中 | §2.3 Step 1/3 强校验「只有一个 server」 |
| 6 | 误将 L1 变量写入 `.env` | 中 | §3.1 已明确警告；`.env` **不做任何改动** |

### 6.3 本方案**不含**的项目

- ❌ `OLLAMA_NUM_PARALLEL` / `MAX_ASYNC` 并发调整 —— 按既定顺序「先单请求调优，再考虑并发」，**本轮不解锁**
- ❌ `OLLAMA_GPU_OVERHEAD` —— 仅见于社区文章，**未在官方 FAQ 核实**，不纳入
- ❌ 云端 provider —— provider separation 已暂停

---

## 7. 执行清单（已批准）

本次实际执行范围 = 下表第 1–4 项（**不含**第 5 项「1 篇抽取冒烟」与第 6 项回滚，原因见 §10）。

| # | 动作 | 是否改动系统 | 是否可回滚 |
|---|---|---|---|
| 1 | 记录基线：`ollama ps` / `nvidia-smi` / `HKCU\Environment` 快照 | 否 | — |
| 2 | 写入 3 个 User 级变量 | ✅ 是 | R1 一键 |
| 3 | 完全重启 Ollama 进程（§2.3） | ✅ 是 | — |
| 4 | 执行 §5 V2/V3/V5 行为验证 | 否 | — |
| 5 | 加载 qwen3:8b，做 1 篇抽取冒烟（确认格式错误=0） | 否 | — |
| 6 | 若任一验证不过 → 立即执行 R1 回滚 | ✅ 是 | — |

---

## 8. 裁决结果（2026-09-11 用户已裁决）

| # | 问题 | 裁决 |
|---|---|---|
| Q1 | 是否批准写入 User 级变量并重启 Ollama | ✅ **批准**。理由：属**运行层优化，非应用配置** |
| Q2 | `OLLAMA_KEEP_ALIVE` 取 `-1` 还是 `30m` | ✅ **`-1`**（永久驻留） |
| Q3 | 是否接受「质量验证仅覆盖 ingestion、未覆盖检索问答」缺口 | ✅ **接受**；检索问答质量**后续补测** |
| Q4 | 是否先做 R2 零持久预演 | ➖ 未要求（Step 1/2 已等效做过） |

**落地边界（用户明确）**：

- 三项变量属 **Ollama runtime 层** —— **禁止写入** 项目 `.env`、LightRAG 配置、frontend config。
- 验收目标**不是**追求 2×；只验证：**配置生效 · 模型稳定运行 · 不增加失败率 · 后续 P2 环境保持可重复**。
- **不进入并发优化**（`MAX_ASYNC` / `OLLAMA_NUM_PARALLEL` 不动）。
- 通过后记录为 **P1 收尾优化**。

---

## 9. 红线自检（**评审阶段**快照）

| 项 | 状态 |
|---|---|
| 系统环境变量 | **未修改**（HKCU 仅 `OLLAMA_MODELS`） |
| `F:/dsh-lightrag/.env` | **未修改** |
| 仓库代码 / `src` | **未修改**（`src ' M' = 0`） |
| packages/llm · router · UI · 依赖 · lockfile | 均未触碰 |
| 服务 | 未启动 LightRAG；评审期仅只读查询 `/api/version` 与注册表 |
| 本 Review 性质 | design-only，**评审阶段未产生任何配置落地**（执行结果见 §10） |

---

## 10. 执行记录与验证结果（2026-09-11 已执行）

### 10.1 已落地配置（User 级，持久）

| 变量 | 值 | 作用域 | 写入方式 |
|---|---|---|---|
| `OLLAMA_FLASH_ATTENTION` | `1` | User（`HKCU\Environment`） | `setx` |
| `OLLAMA_KV_CACHE_TYPE` | `q8_0` | User | `setx` |
| `OLLAMA_KEEP_ALIVE` | `-1` | User | `setx` |

注册表读回验证（4 项 = 既有 `OLLAMA_MODELS` + 3 项新增）：

```
OLLAMA_MODELS            REG_SZ    F:\ollama model
OLLAMA_FLASH_ATTENTION   REG_SZ    1
OLLAMA_KV_CACHE_TYPE     REG_SZ    q8_0
OLLAMA_KEEP_ALIVE        REG_SZ    -1
```

**边界遵守**：`.env` 中 runtime 层键计数保持 **0**；LightRAG 配置、frontend config 均未修改。

### 10.2 重启与配置生效

- **完全退出**：`ollama app.exe`（未运行）+ `ollama.exe` PID 7620 → 已终止；11434 释放（`000`）；GPU 回落 29 MiB。
- **重启后服务端自身日志回显**（证明变量已进入进程）：

```
OLLAMA_FLASH_ATTENTION:true
OLLAMA_KV_CACHE_TYPE:q8_0
OLLAMA_KEEP_ALIVE:2562047h47m16.854775807s      (= -1 → 无限)
```

### 10.3 验收结果

| 验收项 | 目标 | 实测 | 判定 |
|---|---|---|---|
| 配置生效 — KV cache 类型 | `size` 下降 | **5.97 → 5.67 GB** | ✅ |
| 配置生效 — GPU/CPU offload | CPU 占比下降 | **29.5% → 25.1%**（GPU 70.5% → **74.9%**） | ✅ |
| 配置生效 — resident | 不因空闲卸载 | `expires_at = 2318-12-22`（无限） | ✅ |
| 模型稳定运行 | 无异常、无卸载/重载 | 全程 `llm_resident=true`；`distinct_ps_states` **仅 1 种** | ✅ |
| **不增加失败率** | 无新增失败 | 1 篇摄取：`processed=1 / failed=0 / timeout=0 / insert_failed=0`；**`LLM output format error` = 0**；日志 error = 0 | ✅ |
| 环境可重复 | 可复现 | 与 Step 2 B 臂同配置，指标逐位吻合（5.67 GB / 74.9%） | ✅ |

**摄取冒烟（1 篇，独立一次性 `--working-dir`）**：`156.5 s`，**9 nodes / 13 edges**，GPU 74.9%，模型全程常驻。

> **速度观察（非验收项）**：同篇文档对比 P1-4A 默认臂 `232.7 s` → `156.5 s`。但 n=1，且已知同配置运行间方差可达 **±14.1%**，故**不作为幅度结论**；方向与 Step 2 的 −16.4% 一致。

**一个测量陷阱（值得记录）**：`grep -c timeout` 在本例返回 **7**，但全部命中都是**配置行**（`timeout=900` / `240` / worker timeouts），并非真实超时 —— harness 权威值为 `timeout=0`。**不要用通用词 grep 计失败数**，配置转储里就有这些词。

### 10.4 执行方式说明（诚实披露）

本机 Ollama 由**用户会话进程**承载（非服务），且我所在的 shell 环境创建早于 `setx` ⇒ 由该 shell 启动的子进程**不会**继承新变量。因此：

- **持久化**由**注册表读回**验证 —— 这正是未来登录 / 开始菜单启动所继承的状态；
- **运行时生效**由本次以**注册表取回值显式启动**的实例验证 —— 等价于一次全新登录所提供的环境。

下次登录或经开始菜单启动托盘应用时，会**原生**继承这三项变量，**无需重复操作**。

> ⚠️ **附带影响**：`KEEP_ALIVE=-1` 使模型**永久驻留**。冒烟结束后 `qwen3:8b`(4.25 GB) 与 `nomic-embed-text`(0.32 GB) **同时驻留**，`nvidia-smi` 占用 **4,766 MiB**。需要让出显存时执行 §4 的 R1 回滚，或临时 unload。

### 10.5 未做项（边界内）

- ❌ 未启动并发优化（`MAX_ASYNC` / `OLLAMA_NUM_PARALLEL` 未动）
- ❌ 未改 `.env` / LightRAG 配置 / frontend config
- ❌ 未碰仓库生产代码，未改 lockfile
- ➖ 未做检索问答（QA）质量补测 —— 按裁决留待后续

### 10.6 结论

**通过 —— 记录为 P1 收尾优化。** 三项 Ollama 运行层配置已持久化并验证生效；收益预期 **−8% ~ −16%（非 2×）** 与 P1-4B 结论一致。进入 **P2-1（UI / mock 解耦）**。
