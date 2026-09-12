# Stage 14 Mini Plan（修订版）— LLM Provider 抽象 + 摄入管线优化 + 视频摄入插件

> **类型**：Mini Plan（**design-only**，不编码）
> **Baseline**：`a685d1a`（S14 能力盘点 Node，`src/` modified = 0）
> **前序**：`STAGE13_MINI_PLAN.md` → S13-A/B/C 全部 Closed；`STAGE14_INGESTION_CAPABILITY_RESEARCH.md`（能力盘点）
> **本次修订动因**：用户裁决 —— ① 不再把 Ollama `qwen3:8b` 作为唯一 LLM，新增 API Provider 抽象；② 优先级重排为 P0/P1/P2；③ 视频下载作为 Ingestion Plugin 设计
> **状态**：🟡 停在 **Review Node**，等待 DP 裁决与明确批准
> 生成时间：2026-09-10

---

## 0. 纪律声明与本版变化

### 0.1 纪律（继承 + 本版加强）

| 项 | 规定 |
|---|---|
| 编码 | **本版不编码**（design-only），批准后才进入编码 |
| `KnowledgeBackend` 5 方法契约 | **不改**（`listNodes/listEdges/importSource/getNeighbors/getMemory`） |
| `ownerAgent` 归因 | **不破坏**（`importSourceAs` + `ownerBySource` 语义保持） |
| Agent Runtime | **不引入** |
| Workflow / Agent Loop | **不引入** |
| 环境变更 | 本版**不执行**；涉及环境的项须单列并获批准 |
| 阶段纪律 | Mini Plan → 架构审核 → 明确批准 → 才编码；**不自动进入编码** |

### 0.2 相对前一版的实质变化

| 维度 | 前一版 | 本版（修订） |
|---|---|---|
| LLM 定位 | Ollama `qwen3:8b` 为唯一 LLM（DP3） | **多 Provider**：DeepSeek API / OpenAI Compatible / 本地 Ollama fallback |
| 优先级 | 未分级（A–D 方案并列） | **P0** Provider 抽象 + 摄入管线优化；**P1** batch insert + 参数调优 + `LLM_TIMEOUT` 修正；**P2** 视频 Ingestion Plugin 设计 |
| 视频 | 未进入范围 | 进入 **P2（仅设计）** |
| 重点裁决项 | DP-1…DP-8 | **DP-API Provider / DP-Ingestion Strategy / DP-Video Skill Boundary** 三项重新评估 |

---

## 1. 现状核实（代码实证，非推测）

### 1.1 推理层现有资产 —— 比预期丰富

| 包 | 定位（`package.json` description） | 对本 Stage 的意义 |
|---|---|---|
| `packages/llm/llm` | LlmRuntime（适配器注册表 + 流式 `prepareCall/stream`） | 运行时底座 |
| `packages/llm/llm-deepseek` | "**DeepSeek chat-completions adapter** for the DeepSeek Harness LLM seam" | ✅ **DeepSeek API 已有原生适配器** |
| `packages/llm/llm-ollama` | Ollama 适配器（`DEFAULT_BASE_URL = http://localhost:11434/v1`） | ✅ 本地 fallback 已有 |
| `packages/llm/llm-pi-ai` | "**pi-ai-backed DeepSeek adapter** (design-verification twin of dsh-llm-deepseek)" | ✅ **多 Provider 载体**（见 1.2） |
| `packages/llm/llm-router` | 决策层：`auto` 回退 cloud→local→offline、failover 码 | ⚠️ 只认 2 个 provider（见 1.3） |
| `packages/llm/ai-provider-manager` | `detect`/`recommend`，**never imports provider adapters** | ⚠️ 只认 2 个 source（见 1.3） |
| `packages/llm/llm-retry` · `token-meter` | 重试包装 / 计量 | 可复用 |

### 1.2 关键发现：`llm-pi-ai` 已内置 20+ Provider 目录

`@earendil-works/pi-ai@0.82.1`（已安装于 pnpm store）的 `dist/providers/` 实测包含：

```
openai.js  openai-codex.js  azure-openai-responses.js  deepseek.js
anthropic.js  google.js  google-vertex.js  groq.js  mistral.js
moonshotai.js  moonshotai-cn.js  qwen-token-plan.js  qwen-token-plan-cn.js
together.js  xai.js  cerebras.js  fireworks.js  openrouter.js
cloudflare-ai-gateway.js  amazon-bedrock.js  ant-ling.js  ...
```

并带 `compat.js` 与类型 **`OpenAICompletionsCompat`** → **OpenAI 兼容端点可作为自定义路由接入**。

`llm-pi-ai` 的配置面（`src/config.ts`）实测支持逐 provider 的：

```
PiAiProviderProfile { apiKeyEnv?, baseURL?, models?, retryPolicy?, displayName?, ... }
resolveProfiles() / assertServiceable()
```

且 `catalog.ts` 明确：*"a route pi-ai has never heard of is fully describable from `settings.yaml`"*。

> ✅ **结论**：用户要求的「OpenAI Compatible API」**无需新建适配器包**，`llm-pi-ai` 的 profile 机制已可承载；`apiKeyEnv` 是**凭据引用**（经 `ctx.credentials` 解析），符合「密钥不落 bundle」的安全惯例。

### 1.3 真实缺口：决策层只认 `deepseek | ollama | none`

`ai-provider-manager/src/types.ts`：

```ts
export type ProviderSource = 'deepseek' | 'ollama' | 'none'
export type ProviderTier   = 'cloud' | 'local' | 'offline'
```

`llm-router/src/types.ts`：

```ts
export const SOURCE_TO_PROVIDER: Readonly<Record<ProviderSource, string>> = {
  deepseek: 'deepseek',
  ollama:   'ollama',
  none:     '',
}
```

→ **「任意 OpenAI 兼容 provider」在决策层无法被命名**。
要让它可命名，必须改 `ai-provider-manager`（`ProviderSource` + `detect` + `recommend`）与 `llm-router`（`SOURCE_TO_PROVIDER`）—— 而这正是 Stage 13 红线「**不修改 `llm-router` / `ai-provider-manager` 内部**」所禁止的。

**这是 DP-API Provider 的核心张力**：运行时**能**服务任意 provider（pi-ai），但决策层**不认**。必须在「改共享包」与「在 seam 内自建 provider 解析」之间裁决。

### 1.4 LLM seam 现状（`src/llm/llmContext.ts`）

| 项 | 现状 |
|---|---|
| 定位 | **唯一 LLM consumption seam**（S13-A 裁决），UI 只依赖 `LlmClient` 抽象 |
| 抽象面 | `LlmClient { available, unavailableReason?, research(req, signal) → AsyncIterable<LlmStreamChunk> }` |
| 浏览器路径 | `createBrowserStubClient()` → `available:false`，`unavailableReason:'browser-runtime-no-node'`（**合法降级**） |
| Node 路径 | `typeof process !== 'undefined'` 门控 + 动态 `import(/* @vite-ignore */)` 字符串 spec |
| **硬编码点** | `NODE_PACKAGES = { cordis, dshLlm, router, ollama }` —— **只挂 ollama 一个 provider** |
| 挂载逻辑 | `loadNodeHost()`：`ctx.plugin(LlmRuntime)` → `ctx.plugin(router)` → `ctx.plugin(ollama, { baseURL, ...config })` |
| 常量 | `DEFAULT_OLLAMA_MODEL = 'qwen3:8b'`、`DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434/v1'` |

→ **Provider 抽象的自然落点就是这个 seam**：把「单 provider 硬编码挂载」升级为「按 profile 解析并挂载」。

### 1.5 摄入层现状（详见 `STAGE14_INGESTION_CAPABILITY_RESEARCH.md`）

- `LightRAGClient.insert(content, sourceId)` → 仅 `POST /documents/text`（**单条**）；`/documents/texts`（批量）**未使用**。
- `LightRAGBackend.importSourceAs()` → `ingestSource()` → `client.insert()`；`ownerAgent` 经 `ownerBySource` side-map 归因。
- ingestion registry（`ingestion.ts`）：`chat` / `url`（Scrapling，flag **OFF**）/ `pdf` `video` `github`（**PlaceholderIngestion**）。
- **瓶颈定性**：C3 实测 **3.65 min/doc**，源头是 **6 GB 显存下 `qwen3:8b` 抽取的 CPU offload**，**不是** HTTP/入队开销。

### 1.6 视频能力现状：**完全为零**（绿地）

| 探测 | 结果 |
|---|---|
| `yt-dlp` / `ytdlp` / `whisper` / `ffmpeg` / `speech-to-text` / `transcribe` | 全仓（排除 node_modules）**命中 0** |
| `asr` | 16 处命中**均为误匹配**（`sourceIdAsRef`、base64 串）→ 实为 **0** |
| 知识 app 内 `video` | 仅 **UI 层 SourceRef 类型**（图标/配色/SOURCE_TYPES 列表）+ `PlaceholderIngestion` |

**Skill 子系统的真实性质**（决定 DP-Video Skill Boundary）：

| 包 | description |
|---|---|
| `packages/skill/skill` | "Agent **skill provider registry**" |
| `packages/skill/skill-filesystem` | "Local filesystem **skill provider**" |
| `packages/skill/tool-skill` | "**Model-facing skill loading tool**"（工具名 `skill`，参数 `skills`） |
| `packages/client/ui-skill` | "Web skill references and the dedicated **skill tool row**" |

> ⚠️ **关键**：本 harness 的 Skill 是**面向模型、经工具调用加载**的能力 → 走 **Agent/Tool Runtime** 路径。
> 因此「把视频做成 Skill」与「**不引入 Agent Runtime**」存在**直接冲突**。用户已给出正解（**Ingestion Plugin**），本 Plan 将其形式化。

---

## 2. DP-API Provider（重点重新评估）

### 2.1 目标

在**保持 `llmContext.ts` 为唯一 seam** 的前提下，让推理目标可按配置选择：

```
① DeepSeek API           （cloud）
② OpenAI Compatible API  （cloud，任意兼容端点 / 自建网关）
③ 本地 Ollama fallback   （local）
```

### 2.2 Provider 解析与回退链（设计）

```
UI (NoxResearchPanel / AIInsightPanel)
   ↓  只依赖 LlmClient 抽象（不变）
llmContext.ts  ← 唯一 seam
   ↓  新增：resolveProviderProfile()（按 env / 配置文件解析）
   ↓  新增：mountProvider(profile)（把选中适配器挂进 cordis host）
LLM Provider 抽象层（seam 内，见 2.3 选项）
   ↓
LlmRuntime → (llm-router → ai-provider-manager) → Provider 适配器
```

**回退链（建议）**：`explicit provider` → 失败则 `cloud（DeepSeek → OpenAI 兼容）` → `local Ollama` → `browser/无可用` 降级桩。
> 注：`llm-router` 现有 `ALLOWED_FAILOVER_CODES = [NO_ADAPTER, TRANSPORT, TIMEOUT, SERVER, QUOTA]`，**明确排除 auth/credential 错误**（避免掩盖配置错误）—— 该语义应被尊重。

### 2.3 三个候选方案（**需裁决**）

| 方案 | 做法 | 改共享包？ | 优点 | 代价 |
|---|---|---|---|---|
| **A（推荐）seam 内 profile 注册表 + 分型适配器** | `llmContext` 内新增 provider profile 解析（`kind` / `baseURL` / `model` / `apiKeyEnv`），按 kind 动态挂载对应适配器：`deepseek`→`llm-deepseek`、`openai-compatible`→`llm-pi-ai`（openai/compat 路由）、`ollama`→`llm-ollama` | ❌ **不改** | 尊重 Stage 13 红线；seam 单一；UI 零改动；每类 provider 用其最贴合的适配器 | seam 内需维护 small profile resolver；provider 名不出现在 router 决策层（**显式选择在 seam 完成**） |
| **B 单一 `llm-pi-ai` 承载全部三类** | 三类都用 pi-ai profile（Ollama 走 **OpenAI 兼容** `http://localhost:11434/v1` + 自定义 model 元数据） | ❌ 不改 | 只有 1 个适配器包，配置面统一 | Ollama 需手写 model 元数据（context window 等）；偏离 ollama 原生适配器（`llm-ollama` 已有 `health.ts` 探测） |
| **C 扩展决策层** | 给 `ProviderSource` 增加 `'openai'`（或泛化），同步改 `detect`/`recommend`/`SOURCE_TO_PROVIDER` | ✅ **改** | 决策层语义完整、`auto` 回退可覆盖新 provider | **触碰 Stage 13 红线**；需**显式重新裁决**；影响面扩至共享包与其它消费方 |

> **倾向**：**A**（在 seam 内解决，不动共享包）。若后续需要 `auto` 模式在决策层统一编排，再单列「扩展决策层」子计划（方案 C）。

### 2.4 不可回避的架构约束（硬性）

| # | 约束 | 说明 |
|---|---|---|
| C1 | **Node-only** | API Provider 需 `process.env`（密钥）与 Node 网络栈 → Provider 抽象**只存在于 seam 的 Node 分支**；浏览器路径**仍走降级桩**（`browser-runtime-no-node`），UI 行为不变 |
| C2 | **密钥不落 bundle** | 仅以**环境变量名**（`apiKeyEnv` 式引用）传递，运行时解析；**禁止**把 key 写入前端可见配置。沿用 `llm-pi-ai` 的 `CredentialRef` 模式 |
| C3 | **零静态导入** | 新增适配器必须沿用既有「`@vite-ignore` + 字符串 spec + 动态 `import()`」范式，保持 **browser bundle 无 Node LLM 包泄漏**（S13-A 验收项，须回归） |
| C4 | **UI 契约不变** | `LlmClient` 抽象形状不变（或仅**向后兼容**扩展），`NoxResearchPanel`/`useNoxResearch` 不改 |
| C5 | **读语义不变** | 仍为**只读推理**：不写回知识图、不触发工具、不引入 Runtime（见 §5） |

### 2.5 Provider 抽象的设计要点（供编码阶段落地）

1. **ProviderProfile**：`{ kind: 'deepseek' | 'openai-compatible' | 'ollama'; baseURL?; model?; apiKeyEnv?; displayName? }`
2. **解析优先级**（建议，沿用 LightRAG 配置的三层范式）：显式 `setLlmProviderProfile()` → 环境变量 → 默认（`ollama` + `qwen3:8b`）。**默认必须回落到当前行为**，保证零配置不回归。
3. **可探测性**：暴露 `getProviderStatus()`（`kind` / `available` / `reason`），供 UI 诚实显示（与 `LlmClient.available` 一致）。
4. **失败不静默**：auth/credential 错误**不得**被 provider 切换掩盖（对齐 `ALLOWED_FAILOVER_CODES` 语义）。
5. **可替换性**：seam 之外不得出现任何 provider 分支判断（保持「唯一 seam」）。

### 2.6 验收（DP-API Provider）

| # | 断言 |
|---|---|
| P-1 | 仅 seam 相关文件被改；`types.ts` 五方法 diff = 0 |
| P-2 | `NoxResearchPanel` / `useNoxResearch` / `AIInsightPanel` **零改动** |
| P-3 | 未修改 `llm-router` / `ai-provider-manager` / `llm-deepseek` / `llm-ollama` / `llm-pi-ai` 的内部实现 |
| P-4 | browser bundle **无** `createRequire` / `node:module` / `process.env` / 新增 Node provider 包泄漏 |
| P-5 | 零配置时行为与 S13-A **完全一致**（回落 ollama / 浏览器降级桩） |
| P-6 | 三类 provider 各有一条可验证路径（含失败路径的 `reason` 可读） |
| P-7 | 未引入 Runtime / Workflow / Agent Loop；未装新组件 |

---

## 3. DP-Ingestion Strategy（重点重新评估）

### 3.1 事实基线（回引能力盘点）

| 项 | 结论 |
|---|---|
| 瓶颈 | **每文档的 LLM 抽取**（3.65 min/doc），非 HTTP/入队 |
| 批量 | `/documents/texts` 存在但**未使用**；**不减少 LLM 工作量**（估算 1.2–2×） |
| 目录扫描 | `/documents/scan` 存在，服务端批入队（100/批）；**但不经 `ownerBySource` → 丢归属** |
| 参数 | 全部真实生效；**`MAX_GLEANING=0`** 与 merge 阈值是**最大杠杆**；`WORKERS` 对我们**不生效**（uvicorn 单进程） |
| 显存 | 6 GB 硬约束；**并发只降不升**（C3 已现 `failed:3`） |
| 超时键 | **`LLM_TIMEOUT`**（默认 240）才是 LLM 超时；`TIMEOUT`（300）不是 → 我们此前的 `TIMEOUT=900` **未生效** |

### 3.2 🔑 本版最重要的新洞察：Provider 抽象**改变了**摄入瓶颈的结论

**关键解耦（S13-B 已确认，本版必须显式纳入决策）**：

> **App seam 的推理 provider ≠ LightRAG 的抽取 provider。**
> LightRAG 的实体抽取发生在 **`lightrag-server` 内部**，由其**自身** `.env` 的 `LLM_BINDING` / `LLM_MODEL` / `LLM_BINDING_HOST` 决定；
> 而 `llmContext.ts` 服务的是 **app 侧 Nox 研究**。**两者是两套独立配置。**

→ 若把 **LightRAG 的抽取 LLM 也切到云端 API**（`LLM_BINDING=openai` + 兼容 baseURL + key），则：

| 维度 | 本地 `qwen3:8b`（现状） | 云端 API 抽取（可选） |
|---|---|---|
| 6 GB 显存约束 | **硬约束**，抽发失败 | **消失**（显存无关） |
| 每文档吞吐 | 3.65 min | 取决于 API 速率（**可显著提升**，须实测） |
| 并发 | 只降不升（怕 OOM） | 可谨慎提升（`MAX_PARALLEL_INSERT`/`MAX_ASYNC_LLM` 不再受显存限制） |
| 成本 | 0（本地） | **按 token 计费**（1000 docs 的抽取 token 量不小，须先估算） |
| 隐私 | 数据不出本机 | 文档内容**出本机** |

> **这使 DP3（S13-B「复用 Ollama `qwen3:8b`」）需要被重新裁决**：若 Stage 14 引入云端 provider，**抽取侧也应一并评估切换**，否则「Provider 抽象」只惠及 app 侧问答，而**真正的瓶颈（抽取）原封不动**。
> 这是本次修订**最重要的架构判断**，列为 **DP-Ingestion-1**。

### 3.3 摄入策略候选（组合，非单选）

| 策略 | 归属优先级 | 说明 |
|---|---|---|
| **I-1 参数调优** | **P1** | `MAX_GLEANING` 1→0（最大杠杆）· `FORCE_LLM_SUMMARY_ON_MERGE` 8→较高 · **`LLM_TIMEOUT` 修正**（或 `EXTRACT_LLM_TIMEOUT`）· `CHUNK_SIZE`/`CHUNK_OVERLAP_SIZE` 实测调优。**纯环境层，零代码** |
| **I-2 批量插入接入** | **P1** | `lightragHttpClient` **接口外**新增批量方法（`/documents/texts`），`LightRAGClient` 5 方法不变；降低往返、提升流水线重叠 |
| **I-3 抽取 provider 切换** | **待裁决（DP-Ingestion-1）** | LightRAG 侧 `LLM_BINDING` 切云端/兼容端点 → 解除显存瓶颈 |
| **I-4 离线作业外壳** | P1（配套） | 仓库外脚本：队列 + 重试 + 断点续传 + 进度；**不产生算力，但把 61–167 h 变成可恢复作业** |
| **I-5 稳定性对照** | P1 | 显式对照 `MAX_PARALLEL_INSERT=1`（保稳定）vs 默认 3，以 **failed=0** 为目标 |
| ❌ **不建议纳入本 Stage** | — | **C 方案（预处理/embedding 分离的自建侧车管线）**：触碰红线、等同重造 ingestion 层 |
| ❌ **不使用** | — | **`/documents/scan` 承载有归属的贡献**（丢 `ownerAgent`） |

### 3.4 验收（DP-Ingestion）

| # | 断言 |
|---|---|
| I-1 | 与 C3 **同口径**的 per-import 均值 + 外推 + 置信区间 |
| I-2 | `failed` 计数 = **0**（对照 C3 的 3/10） |
| I-3 | 抽取质量未退化（实体/关系计数 ≥ 基线；`MAX_GLEANING=0` 前后对照） |
| I-4 | `ownerAgent` 归因**可验证保持** |
| I-5 | 批量插入路径经**运行级**验证（S14 盘点未做运行时验证，因服务当时停止） |
| I-6 | 零业务代码污染：`src/` 仅含声明的目标文件改动 |

---

## 4. DP-Video Skill Boundary（重点重新评估）

### 4.1 目标管线（用户给定）

```
下载（视频）→ ASR（转写）→ 切片 → Embedding → LightRAG
```

### 4.2 边界三选（**需裁决**）

| 选项 | 落点 | 是否引入 Agent Runtime | 浏览器可承载 | 判定 |
|---|---|---|---|---|
| **V-A 做成 harness Skill** | `packages/skill/*`（面向模型的 `skill` 工具） | ✅ **引入**（经 Tool/Agent 循环） | — | ❌ **触碰红线**，与「不引入 Agent Runtime」直接冲突 |
| **V-B 直接在 TS `IngestionComponent` 内做** | `knowledge-canvas-ui/src/knowledge/ingestion/` | ❌ | ❌ **不可**（下载/ASR/ffmpeg 无法在浏览器跑） | ❌ 技术不可行 |
| **V-C（推荐）Ingestion Plugin + 本地 sidecar** | 新 `IngestionComponent`（`type:'video'`）**委托**本地 sidecar HTTP 服务做重活；文本回流既有摄入链 | ❌ **不引入** | ✅（浏览器只发 HTTP + 拿文本） | ✅ **推荐** |

### 4.3 推荐边界的形态（V-C 细化）

```
SourceRef(type:'video', uri)
   ↓  getIngestionComponent('video')        ← 既有 registry（零新抽象）
   ↓  VideoIngestionComponent.fetch()       ← 新增：单个 IngestionComponent 实现
   ↓  HTTP → 本地 video sidecar（仓库外，类似 lightrag-server 的部署形态）
   │     ├─ Download   （yt-dlp 等，sidecar 内）
   │     ├─ ASR        （whisper 等，sidecar 内）
   │     └─ Segment/Chunk（切片）
   ↓  返回 IngestedDocument { content, meta }
   ↓  ingestSource() → LightRAGBackend.importSourceAs(src, ownerAgent)
   ↓  client.insert() → LightRAG（其内部完成 Embedding + 抽取 → 图谱）
   ↓  ownerBySource 归因保持 ✅
```

**关键设计判断**：

1. **切片与 Embedding 的归属**：**切片可在 sidecar**（产出带时间戳的文本段），但 **Embedding 与图谱写入应交给 LightRAG 自身**（`POST /documents/texts`）—— 避免自建向量化管线（那是 C 方案的红线）。
2. **`IngestionComponent` 契约不变**：`fetch(src, opts) → Promise<IngestedDocument>`，**只是多一个实现**，registry 换掉 `PlaceholderIngestion('video')`。
3. **归因天然保持**：走 `importSourceAs` → `ownerBySource` 全链路，**不触碰归属语义**。
4. **与 Scrapling 的同构性**：`ScraplingUrlAdapter` 已是「TS 适配器 → 外部抓取」的先例（flag gated）。视频插件应当是**同构的第二例**，并由**独立 flag 门控**（默认 **OFF**）。
5. **可降级**：sidecar 不可达时，`fetch()` 返回明确的 unsupported/error，**不抛穿 UI**（对齐 S13-A 的优雅降级范式）。

### 4.4 本 Stage 对 P2 的范围限制

| 允许 | 禁止 |
|---|---|
| **仅设计**：边界、契约、sidecar 接口草图、flag、风险 | 实际安装 yt-dlp/whisper/ffmpeg；实际写 sidecar；实际接线 |

> P2 交付物 = **设计章节**（本 §4）+ 明确的「延后理由与前置条件」。**不产生代码。**

### 4.5 验收（DP-Video，本 Stage 仅设计）

| # | 断言 |
|---|---|
| V-1 | 边界结论明确写出「**不做成 harness Skill**」及其 Runtime 冲突理由 |
| V-2 | `IngestionComponent` 契约**零改动**（仅新增实现） |
| V-3 | `ownerAgent` 归因路径在设计上**闭合可验证** |
| V-4 | **未装**任何视频/ASR 组件；**未新增**任何运行时依赖 |
| V-5 | 明确列出 P2 编码阶段的前置条件（sidecar 部署形态、flag、失败降级） |

---

## 5. 架构边界（全 Stage 统一）

| 边界 | 规定 |
|---|---|
| `KnowledgeBackend` 5 方法 | **不变** |
| `LightRAGClient` | **接口外扩展**（批量插入为可选方法；5 方法不变） |
| `LightRAGBackend` / `lightragMapping` | **不改**（除非批量路径被证实必须接线 → 单列裁决） |
| `llmContext.ts` | **唯一 LLM seam**；Provider 抽象在此之内，**不新增第二个 seam** |
| `LlmClient` 抽象 | **向后兼容**（UI 零改动） |
| `ingestion.ts` registry | registry 可**新增实现**；`IngestionComponent` 契约不变 |
| `types.ts`（核心知识模型） | **不改** |
| UI 组件 | **不改**（`NoxResearchPanel` / `useNoxResearch` / `AIInsightPanel` / `EmployeeKnowledge*`） |
| 共享 LLM 包 | `llm-router` / `ai-provider-manager` / `llm-deepseek` / `llm-ollama` / `llm-pi-ai` **内部实现不改** |
| 环境 | LightRAG/`Ollama` 环境变更**单列**并获批准后执行 |
| 仓库外资产 | 离线外壳、video sidecar、benchmark harness → **不入 git** |

---

## 6. 是否涉及 Runtime / Workflow / Agent Loop

> **结论：Stage 14 不涉及、不引入 Runtime、Workflow、Agent Loop。**

| 子项 | 判定 | 理由 |
|---|---|---|
| LLM Provider 抽象 | ❌ 不涉及 | 仅**替换推理目标**；复用既有 `LlmRuntime`（已在 S13-A 使用）；不新增执行引擎 |
| 摄入管线优化 | ❌ 不涉及 | **纯数据通道**（HTTP 端点 + 环境参数）；无执行引擎 |
| 批量插入 | ❌ 不涉及 | 客户端接口扩展 + 一个既有端点 |
| 离线作业外壳 | ❌ 不涉及 | **仓库外脚本**，不在 app 内运行、不注册进 app 运行时 |
| 视频 Ingestion Plugin | ❌ 不涉及 | 走 `IngestionComponent` **数据路径**；**明确否决** harness Skill 路径（§4.2 V-A） |

**升级触发条件（须停下重新裁决）**：任一子项若被判定需要
① 在 app 内嵌入调度/执行引擎，或
② 经 harness `skill` 工具 / Tool 循环 / Agent Loop 提供能力，
**必须立即停止本 Stage 并回到 Mini Plan 重新审核。**

---

## 7. 优先级与工作分解

### P0（本 Stage 核心，须先完成）

| ID | 工作 | 类型 | 依赖 |
|---|---|---|---|
| **P0-1** | **LLM Provider 抽象**（seam 内 profile 解析 + 分型挂载 + 状态可探测 + 回退链） | 代码（仅 seam 相关文件） | 无 |
| **P0-2** | **摄入管线优化**：瓶颈复测 + 抽取 provider 裁决落地（DP-Ingestion-1） | 环境 + 可能少量代码 | P0-1（若抽取走兼容 API） |

### P1

| ID | 工作 | 类型 |
|---|---|---|
| **P1-1** | **batch insert 接入**（`/documents/texts`，接口外扩展） | 代码（1 文件级） |
| **P1-2** | **参数调优**：`MAX_GLEANING=0`、merge 阈值、chunk 参数 | 环境 |
| **P1-3** | **`LLM_TIMEOUT` 修正**（纠正 `TIMEOUT` 误用） | 环境 |
| **P1-4** | 离线作业外壳（队列/重试/断点/进度） | 仓库外脚本 |
| **P1-5** | 稳定性与吞吐对照实测（failed=0 目标） | 实测 |

### P2

| ID | 工作 | 类型 |
|---|---|---|
| **P2-1** | **视频 Ingestion Plugin 设计**（边界/契约/sidecar 接口/flag/降级） | **仅设计** |

> **执行顺序（建议）**：`P0-1 → P1-3 → P1-2 → P1-1 → P1-5 → P0-2 → P1-4 → P2-1`
> 理由：先建 Provider 抽象（决定后续推理目标）→ 先修超时键与参数（**零代码、最高性价比**）→ 再动代码（批量）→ 实测对照 → 最后处理摄入 provider 裁决与视频设计。

---

## 8. 风险

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | Provider 抽象**破坏 browser bundle 纯净度**（引入 Node 包） | **高** | 强制沿用 `@vite-ignore` + 字符串 spec + `typeof process` 门控；每次提交回归 bundle 泄漏扫描（S13-A 验收项） |
| R2 | **密钥泄漏**进 bundle / 前端配置 | **高** | 仅传 env **变量名**（`apiKeyEnv` 式引用）；禁止明文 key 入仓/入 bundle |
| R3 | 云 API 切换后**成本/隐私**失控（尤其抽取侧） | **高** | DP-Ingestion-1 裁决前先做 **token 量估算 + 成本/隐私评估**；提供「仅 app 侧切云、抽取仍本地」的保守选项 |
| R4 | 修改共享 LLM 包（方案 C）违反红线 | 中 | 默认走方案 A；方案 C **必须显式重新裁决** |
| R5 | 提高并发触发 OOM（6 GB） | **高** | **并发只降不升**；以 `failed=0` 优先；显式对照 `MAX_PARALLEL_INSERT=1` |
| R6 | `MAX_GLEANING=0` 降低抽取质量 | 中 | 实体/关系计数 + C2 类检索指标**前后对照**（不通过则回退） |
| R7 | 批量插入契约仅**规范级**核实（S14 未做运行级验证） | 中 | 编码首步做运行级验证；不通过即回退单条路径 |
| R8 | 视频 sidecar 被误做成 harness Skill → 引入 Runtime | 中 | §4.2 已明确否决；升级触发条件（§6）强制停下裁决 |
| R9 | 吞吐提升被外推夸大 | 中 | 沿用 S13-C 双口径（实测均值 + 保守界）+ 置信区间 + 标注估算 |

---

## 9. 待裁决决策点

| # | 决策 | 选项 | 倾向 |
|---|---|---|---|
| **DP-API-1** | Provider 抽象落点 | **A** seam 内 profile 注册表 + 分型适配器 / B 单一 `llm-pi-ai` 承载三类 / C 扩展 `ai-provider-manager` + `llm-router`（改共享包） | **A**（不改共享包） |
| **DP-API-2** | OpenAI 兼容的承载方式 | (a) 用 `llm-pi-ai` 的 `openai` / `openai-completions-compat` 路由 (b) 其它 | **(a)** |
| **DP-API-3** | 默认 provider（零配置时） | (a) **保持 Ollama `qwen3:8b`**（零回归）(b) 改默认 | **(a)** |
| **DP-API-4** | 回退链语义 | (a) 显式 → cloud → local → 降级桩 (b) 仅显式，不自动回退 | **(a)**（尊重 `ALLOWED_FAILOVER_CODES`，**auth 错误不回退**） |
| **DP-API-5** | 是否接受「密钥仅经 env 变量名引用」 | (a) 接受 (b) 引入凭据存储方案（需单列） | **(a)** |
| **DP-ING-1** | **LightRAG 抽取 LLM 是否也切云端/兼容 API**（决定 6 GB 瓶颈是否真正解除） | (a) 切（先做成本/隐私评估）(b) **不切**，抽取仍本地（则 Provider 抽象只惠及 app 侧）(c) 双配置并存（可切换） | **(c)** → 视 (a) 评估结果 |
| **DP-ING-2** | 输入策略 | (a) **不使用 `/documents/scan`**（保归因）(b) 仅无归属语料 | **(a)** |
| **DP-ING-3** | `MAX_GLEANING` 1→0 | (a) 允许（须质量对照）(b) 保持 | **(a)** |
| **DP-ING-4** | 并发参数 | (a) **只降不升** (b) 小幅提升实测 | **(a)** |
| **DP-ING-5** | 是否纳入 C 方案（分离式侧车管线） | (a) **不纳入**（列独立 Stage）(b) 纳入 | **(a)** |
| **DP-VID-1** | 视频边界 | **V-C Ingestion Plugin + 本地 sidecar** / V-A harness Skill（**否决**）/ V-B 纯 TS（不可行） | **V-C** |
| **DP-VID-2** | P2 是否**仅设计**（不装、不写 sidecar） | (a) **仅设计** (b) 本 Stage 内落地 | **(a)** |
| **DP-VID-3** | sidecar 部署形态（P2 编码阶段） | 本地 Python sidecar / Node sidecar / 复用已有服务 | 待 P2 细化 |
| **DP-PRIO** | P0/P1/P2 执行顺序与墙钟预算 | 建议 §7 顺序 + ≤3 h/子步（沿用 S13-C 纪律） | **沿用** |

---

## 10. 状态

🟡 **停在 Review Node。**

- 本节交付：修订版 Stage 14 Mini Plan（P0/P1/P2 + 三大 DP 重新评估 + 边界 + Runtime 声明 + 风险 + 验收 + DP 清单）。
- **未编码、未安装、未调整环境**；`src/` 零改动；基线 `a685d1a`。
- **本 Stage 不涉及 Runtime / Workflow / Agent Loop**（§6），并**明确否决**把视频做成 harness Skill。
- **本版最重要的判断**：Provider 抽象**必须**同时评估「LightRAG 抽取侧」的 provider 切换（DP-ING-1），否则真正瓶颈（3.65 min/doc）原封不动。
- 裁决 **DP-API-1…DP-VID-3** 并**明确批准**后方可进入 Stage 14 编码；**不自动进入**。
