# Stage 14 · P0 — LLM Provider Abstraction Mini Implementation Plan

> **类型**：Mini **Implementation** Plan（**design-only**，本文件不含代码变更）
> **Baseline**：`65f84c1`（S14 修订版 Mini Plan，`src/` modified = 0）
> **上级**：`STAGE14_MINI_PLAN.md`（已批准）· `STAGE14_INGESTION_CAPABILITY_RESEARCH.md`
> **范围**：**仅 P0-1 Provider abstraction**（不含 P1 ingestion / P2 cloud extraction test / P3 video）
> **状态**：🟡 停在 **Review Node**，等待批准后才编码
> 生成时间：2026-09-10

---

## 0. 纪律声明

| 项 | 规定 |
|---|---|
| 本文件 | **不含代码变更**（design-only）；批准后才进入编码 |
| 唯一消费入口 | `llmContext.ts` 保持**唯一 LLM consumption seam** |
| UI | **不感知 provider**（provider 切换纯配置驱动，UI 零改动） |
| 共享包 | **不修改** `packages/llm/*`（`llm` / `llm-router` / `ai-provider-manager` / `llm-deepseek` / `llm-ollama` / `llm-pi-ai`）任何内部实现 |
| `KnowledgeBackend` 5 方法 | **不改** |
| Agent Runtime | **不引入** |
| 阶段纪律 | Mini Plan → Review → Approval → 才编码；**不自动进入下一阶段** |

---

## 1. 目标（对齐已批准的 DP-API 裁决）

**方案 A 批准**：在 **app seam 内**建立 provider profile 注册表，不扩展共享决策层。

| 要求 | 落实点 |
|---|---|
| 优先接入 API Provider | provider 优先序：**DeepSeek API → OpenAI-compatible → Ollama local** |
| Ollama 保留为 fallback | 保留 `llm-ollama` 为本地/离线/隐私模式路径 |
| UI 不感知 provider | `LlmClient` 抽象形状不变；provider 语义**不出 seam** |
| 配置驱动切换 | profile 解析（三层优先级，见 §3.3） |
| 唯一消费入口 | `llmContext.ts`；配置模块只存放**惰性数据**，不持 LLM 逻辑 |

---

## 2. 现状事实（代码实证）

### 2.1 `llmContext.ts` 结构（本次改造对象）

| 位置 | 事实 |
|---|---|
| `LlmClient` 抽象 | `{ available, unavailableReason?, research(req, signal) → AsyncIterable<LlmStreamChunk> }` |
| 浏览器路径 | `createBrowserStubClient()` → `available:false`，`unavailableReason:'browser-runtime-no-node'` |
| Node 门控 | `getLlmClient()`：`typeof process !== 'undefined'` → `loadNodeHost()`；**异常则静默回落 stub** |
| 包清单 | `NODE_PACKAGES = { cordis, dshLlm, router, ollama }` —— **只挂 ollama** |
| 挂载 | `loadNodeHost()`：`plugin(LlmRuntime)` → `plugin(router)` → `plugin(ollama, { baseURL, ...config })` |
| **硬编码点 ①** | `NodeLlmClient.research()` 内 **`router.prepareCall({ provider: 'ollama', model, messages }, signal)`**（provider 写死） |
| **硬编码点 ②** | `DEFAULT_OLLAMA_MODEL = 'qwen3:8b'` 为隐式默认模型 |
| **硬编码点 ③** | 客户端**单例缓存** `let _client: LlmClient \| null`，构造后不再变更 |
| 探针 | `window.__kcuLlmHost = { getLlmClient, DEFAULT_OLLAMA_MODEL }` |

### 2.2 可用适配器与**路由 id**（关键）

| 适配器包 | 注册的 provider route | 凭据/端点配置 |
|---|---|---|
| `llm-ollama` | **`'ollama'`**（`ctx.llm.registerAdapter(['ollama'], adapter)`） | `baseURL` 等 |
| `llm-deepseek` | **`'deepseek-official'`**（`const PROVIDER = 'deepseek-official'`） | `apiKeyEnv`（默认 **`DEEPSEEK_API_KEY`**，类型 `credential-ref`）· `baseURL` · `models` · maxTokens/context/timeout/retry |
| `llm-pi-ai` | **动态**：`routes` 由 profile 推导（`registerAdapter(routes, adapter)` + `registerConfigurableProviders(entries)`） | 逐 profile：`apiKeyEnv`（CredentialRef）· `baseURL` · `models` · `retryPolicy` · `displayName` |

### 2.3 🔴 风险 R1：router 期望的 provider id 与适配器注册名**不一致**

`llm-router/src/resolve.ts`：

```ts
export function sourceOf(provider: string | undefined): ProviderSource {
  if (provider === 'deepseek') return 'deepseek'
  if (provider === 'ollama')   return 'ollama'
  return 'none'                      // ← 未知一律 none
}
export const SOURCE_TO_PROVIDER = { deepseek: 'deepseek', ollama: 'ollama', none: '' }
```

`service.ts::resolveUncached()` 在**显式模式**下使用 `[sourceOf(request.provider)]`。

| 传入的 provider 串 | `sourceOf` 结果 | `SOURCE_TO_PROVIDER` | 后果 |
|---|---|---|---|
| `'ollama'` | `'ollama'` | `'ollama'` | ✅ 匹配 `llm-ollama` 注册名（**这解释了 S13-A 硬编码 `'ollama'` 可用**） |
| `'deepseek-official'`（`llm-deepseek` 真实注册名） | **`'none'`** | **`''`**（空） | ❌ 路由不到 |
| `'deepseek'`（router 期望值） | `'deepseek'` | `'deepseek'` | ⚠️ 但 `llm-deepseek` 并未注册该名 → 需**运行时验证** |

> **结论**：DeepSeek 接线**不能靠假设 provider 串**。必须在实现首步做**运行时 route id 发现**（`ctx.llm.listProviders()` 已存在于 router 依赖面）并据此选择，或采用**我们可控 route id** 的承载方式（见 §3.5）。

### 2.4 🔴 风险 R2：Node host 包**当前完全不可解析**

| 探测 | 结果 |
|---|---|
| `node_modules/@deepseek-ai/dsh-llm` · `dsh-llm-router` · `dsh-llm-ollama` · `dsh-llm-deepseek` · `dsh-llm-pi-ai` · `dsh-ai-provider-manager` · `cordis` | **全部 MISSING** |
| `knowledge-canvas-ui/package.json` 依赖 | 仅 `react` / `react-dom` + devDeps（vite/typescript）—— **零 `@deepseek-ai` 依赖** |
| 后果 | `loadNodeHost()` 的动态 import **必然抛错** → `getLlmClient()` 静默回落浏览器 stub → **Node 路径当前实际不可运行** |

> 认知校正：S13-A 交付的 Node 路径是**结构性就绪、运行时不可达**。这不是缺陷（当时裁决不引依赖），但 **P0 的验收若包含"真实推理可用"，就必须先解决依赖可解析性**（见 **DP-IMPL-1**）。

### 2.5 既有配置范式（本 app 已确立，应当同构复用）

`src/knowledge/backends/lightragConfig.ts`：

```
优先级：runtimeConfig（host 注入）> import.meta.env.VITE_*（构建期）> globalThis.__KCU_*（原型开关）> 默认
未配置 → resolveLightRAGConfig() 返回 null → 调用方回落（MockBackend）
resolveFeatureFlag(name, envName, fallback) 用于特性开关
readEnv() 安全包装（tsx 下无 Vite 也不崩）
```

> **Provider profile 解析应与之同构**：降低认知成本、保持仓库一致性。

---

## 3. 设计

### 3.1 模块划分

```
src/llm/
  ├── providerConfig.ts   ← 新增：provider profile 类型 + 三层解析 + 密钥引用（惰性数据，无 LLM 逻辑）
  └── llmContext.ts       ← 改造：按 profile 挂载适配器 + per-call provider 选择 + 状态探测
                              （仍是唯一 LLM consumption seam）
```

**为什么新增文件不破坏「唯一 seam」**：seam 的语义是「**谁消费 LLM**」。`providerConfig.ts` 只提供**惰性配置数据**（纯函数 + 模块级 store），不创建客户端、不发起调用、不被 UI 导入 —— 与 `lightragConfig.ts` 之于 `lightragHttpClient.ts` 的关系完全一致。

### 3.2 `ProviderProfile` 形状（设计）

```ts
export type LlmProviderKind = 'deepseek' | 'openai-compatible' | 'ollama'

export interface LlmProviderProfile {
  kind: LlmProviderKind
  /** 端点（openai-compatible / ollama 必填；deepseek 缺省用官方端点） */
  baseURL?: string
  /** 默认模型 id（省略时回落 kind 内置默认） */
  model?: string
  /** ⚠️ 凭据的**环境变量名**，不是密钥本身（见 §3.4） */
  apiKeyEnv?: string
  /** 仅用于状态展示，不影响路由 */
  displayName?: string
}
```

**优先序与回退链（设计）**：`首选 profile` → 失败则 `cloud 另一 provider` → `ollama` → `浏览器/不可用降级桩`。
> 尊重 `llm-router.ALLOWED_FAILOVER_CODES = [NO_ADAPTER, TRANSPORT, TIMEOUT, SERVER, QUOTA]` —— **auth / credential 错误不参与回退**（避免掩盖配置错误）。

### 3.3 解析优先级（与 `lightragConfig.ts` 同构）

| 层 | 来源 | 用途 |
|---|---|---|
| 1（最高） | `setLlmProviderProfile(cfg)` runtime 注入（host 启动时） | Electron / 桌面壳注入 |
| 2 | `import.meta.env.VITE_KCU_LLM_PROVIDER` / `..._BASE_URL` / `..._MODEL` | 构建期默认（**非密钥**，见 §3.4） |
| 3 | `globalThis.__KCU_LLM_PROVIDER` / `..._BASE_URL` | 原型期临时切换 |
| 4（默认） | **`ollama` + `qwen3:8b` + `http://localhost:11434/v1`** | **保证零配置零回归**（= S13-A 现状） |

`resolveLlmProviderChain(): LlmProviderProfile[]` —— 返回**有序**候选列表（首选 + 回退），供 seam 逐个尝试。

### 3.4 ⚠️ 密钥策略（硬性安全约束）

| 规则 | 理由 |
|---|---|
| **密钥只经 `process.env` 在 Node 运行时读取** | Node-only 路径，不入 bundle |
| **禁止把密钥放进 `VITE_*`** | `VITE_*` 是**构建期注入、会进前端 bundle** → 等于泄漏（这是与 `lightragConfig.ts` 的关键差异，`providerConfig.ts` 必须显式注释此点） |
| profile 只携带 **`apiKeyEnv`（变量名）** | 对齐 `llm-deepseek` 的 `credential-ref` / `llm-pi-ai` 的 `CredentialRef` 官方范式 |
| 密钥**绝不写入**仓库文件、日志、错误消息 | 错误消息只报**变量名缺失**，不回显值 |

### 3.5 挂载策略与 route id 发现

```
loadNodeHost(profile):
  1. plugin(LlmRuntime)                      // 不变
  2. plugin(router)                          // 不变
  3. 按 profile.kind 动态 import 并 plugin 对应适配器：
       'ollama'            → llm-ollama      { baseURL }
       'deepseek'          → llm-deepseek    { apiKeyEnv, baseURL?, models? }
       'openai-compatible' → 见 DP-IMPL-2（llm-pi-ai profile 或 llm-deepseek 的 baseURL 复用）
  4. **route id 发现**：读取 `ctx.llm.listProviders()` → 取实际已注册的 provider id
       （不假设 'deepseek' / 'deepseek-official'；消除 R1）
  5. 返回 { ctx, routeId, profile }
```

**关于 `openai-compatible` 的两种承载（DP-IMPL-2）**：
- **(a) `llm-pi-ai` profile**：pi-ai 内置 `openai` / `azure-openai-responses` 等路由且支持自定义 `baseURL`；`routes` 由我们配置 → **route id 可控**（可与 router 期望值对齐）。
- **(b) 复用 `llm-deepseek` 的 `baseURL`**：DeepSeek 官方 API 本身即 OpenAI 兼容，把 `baseURL` 指向任意兼容端点（如本机网关 / vLLM / 第三方聚合）→ 最省事，但可能受 DeepSeek 专有字段（thinking 等）影响 → **须实测**。

### 3.6 客户端 provider 感知（消除硬编码点 ①②）

| 项 | 现状 | 设计 |
|---|---|---|
| provider | `prepareCall({ provider: 'ollama', ... })` 写死 | 改为使用 `loadNodeHost` 返回的 **`routeId`** |
| model | `req.model ?? DEFAULT_OLLAMA_MODEL` | `req.model ?? profile.model ?? kind 内置默认` |
| 默认行为 | ollama + qwen3:8b | **保持不变**（零配置 = 现状） |

### 3.7 单例与切换语义（消除硬编码点 ③）

现状 `_client` 单例在**首次构造后固定**。设计（**DP-IMPL-3**，二选一）：

- **(a) per-call 解析（推荐）**：`NodeLlmClient` 持有 **profile 引用**，每次 `research()` 读取当前 profile 并挂载/复用对应 host（host 可按 profile key 缓存）。→ 运行期可切换 provider，无需重启。
- **(b) 单例 + 显式失效**：保留单例，新增 `resetLlmClient()`；配置变更后由 host 调用。→ 更简单，但切换需显式触发。

> 两者都不改变 `LlmClient` 抽象 —— UI 完全无感。

### 3.8 状态可探测

新增 `getLlmProviderStatus(): Promise<{ kind; available; reason?; routeId?; model? }>`，并扩展 window 探针（`window.__kcuLlmHost`）以便验证脚本使用。
**作用**：让「配置了一个 provider 但不可用」可被诚实诊断（对齐 `LlmClient.available` 的既有语义）。

### 3.9 失败语义

- `research()` 内**任何**异常 → 返回 **error chunk**（不抛穿 UI，保持 S13-A 既有范式）。
- `loadNodeHost()` 失败 → 回落降级桩（保持现状），但**原因可读**（经 §3.8 状态接口）。
- provider 回退时**不掩盖 auth/credential 错误**。

---

## 4. 边界与禁止项

| 允许 | 禁止 |
|---|---|
| 新增 `src/llm/providerConfig.ts` | 新增第二个 LLM consumption seam |
| 改造 `src/llm/llmContext.ts` | 修改 `packages/llm/*` 任何内部实现 |
| 扩展 window 探针（验证用） | 修改 UI 组件（`NoxResearchPanel` / `useNoxResearch` / `AIInsightPanel`） |
| 扩展 `NODE_PACKAGES` 常量与挂载逻辑 | 修改 `Types.ts` 五方法契约 / `LightRAG*` |
| 引入 provider 相关的**惰性配置** | 引入 Runtime / Workflow / Agent Loop / Tool |
| 视 DP-IMPL-1 结论声明 workspace 依赖 | 把密钥写入 `VITE_*` / 仓库 / 日志 |

---

## 5. 分步实施计划（批准后执行；每步可独立验证）

| Step | 内容 | 验证 | 产出文件 |
|---|---|---|---|
| **S0** | **前置探测**（不写产品代码）：① 运行时枚举已注册 provider route id（消除 R1）；② 确认 `@deepseek-ai/*` 可解析性（R2 / DP-IMPL-1）；③ 决定 `openai-compatible` 承载（DP-IMPL-2） | 只读脚本输出 | 仓库外 harness |
| **S1** | 新增 `providerConfig.ts`：类型 + 三层解析 + 密钥引用 + 回退链 | tsx 自检：零配置 → ollama/qwen3:8b；配置 → 对应 profile | `src/llm/providerConfig.ts` |
| **S2** | 改造 `loadNodeHost(profile)`：按 kind 挂载适配器 + **route id 发现** | Node 环境下 `listProviders()` 返回预期 route | `src/llm/llmContext.ts` |
| **S3** | 消除硬编码点 ①②：`research()` 使用发现到的 `routeId` 与 `profile.model` | per-call 选择生效 | 同上 |
| **S4** | 切换语义（DP-IMPL-3）+ `getLlmProviderStatus()` + 探针扩展 | 运行时可切换；状态可读 | 同上 |
| **S5** | **回归验证** | ① **零配置行为与 S13-A 完全一致**；② **browser bundle 无 Node LLM 包泄漏**（`createRequire`/`node:module`/`process.env` 全 0）；③ 三类 provider 路径各一条；④ oxlint 严格 + staged 双配置 0/0 | 验证报告 |
| **S6** | 文档 + 提交（scope freeze：仅声明文件） | `git show --stat` 精确 | 提交 |

**每步之后停下汇报**（沿用 D1–D5 决策门控模式）。

---

## 6. 验收标准

### 静态

| # | 断言 |
|---|---|
| A-1 | 仅 `src/llm/providerConfig.ts` + `src/llm/llmContext.ts` 两个文件被改（+ 可选 `package.json`，视 DP-IMPL-1） |
| A-2 | `packages/llm/*` 六个包 **零 diff** |
| A-3 | UI 组件 **零 diff**；`types.ts` 五方法 **零 diff** |
| A-4 | oxlint 严格配置 + staged 配置均 **0 warnings / 0 errors**（无 ignore 注释） |
| A-5 | browser bundle **无** `createRequire` / `node:module` / `process.env` / 新增 Node 包特征串 |
| A-6 | 密钥未出现在任何提交内容中 |

### 运行时

| # | 断言 |
|---|---|
| B-1 | **零配置** → 行为与 S13-A 完全一致（ollama / qwen3:8b；浏览器 → 降级桩） |
| B-2 | 显式配置 DeepSeek profile → 路由到**实际注册的** route id（S0 探测结论），调用链可达 |
| B-3 | OpenAI-compatible profile → 同上（端点可配置） |
| B-4 | Ollama fallback 路径可用 |
| B-5 | `getLlmProviderStatus()` 对「未配置 / 不可达 / 无凭据」给出**可读 reason** |
| B-6 | auth 错误**不被** provider 回退掩盖 |
| B-7 | UI 仍只依赖 `LlmClient`；provider 语义无泄漏 |

---

## 7. 风险

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| **R1** | router 期望 provider id（`'deepseek'`）≠ 适配器注册名（`'deepseek-official'`）→ 静默路由失败 | **高** | **S0 先做运行时 route id 发现**；优先选 route id 可控的承载（`llm-pi-ai`） |
| **R2** | `@deepseek-ai/*` **全部未安装** → Node 路径运行时不可达，验收 B-2/B-3 无法执行 | **高** | DP-IMPL-1 裁决：声明 workspace 依赖（**触及 lockfile，须按既定流程在 WSL 生成**）或改用仓库外 harness 验证 |
| R3 | 密钥泄漏进 bundle | **高** | 硬性规则：密钥仅 `process.env`；**禁止 `VITE_*`**；profile 只存变量名；A-6 断言 |
| R4 | 新增依赖触发 bundle 纯净度门禁 / 体积膨胀 | 中 | 沿用 `@vite-ignore` + 字符串 spec + `typeof process` 门控；A-5 回归 |
| R5 | `openai-compatible` 复用 `llm-deepseek` 时受 DeepSeek 专有字段影响 | 中 | DP-IMPL-2 实测；不通过则改用 `llm-pi-ai` profile |
| R6 | per-call 解析引入重复挂载/性能开销 | 中 | host 按 profile key 缓存；仅切换时重建 |
| R7 | 默认值变更导致**现有行为回归** | 中 | 强制默认 = `ollama` + `qwen3:8b`（B-1 断言） |
| R8 | 依赖声明触碰 lockfile（CI `--frozen-lockfile` 失败） | 中 | lockfile 变更**独立提交**；沿用既有约定（勿与代码混提） |

---

## 8. 待裁决决策点

| # | 决策 | 选项 | 倾向 |
|---|---|---|---|
| **DP-IMPL-1** | 是否在 `knowledge-canvas-ui/package.json` **声明 `@deepseek-ai/*` workspace 依赖**（使 Node 路径真可运行） | (a) **声明**（并生成 lockfile，独立提交）→ 可做真实运行时验收 (b) 不声明，仅用**仓库外 harness** 验证（`file:///` + tsx，B-1 已有先例） | **(a)** —— 否则 P0 交付物在生产中仍不可运行；但会引入 lockfile 工作量 |
| **DP-IMPL-2** | `openai-compatible` 承载方式 | (a) `llm-pi-ai` profile（route id 可控）(b) 复用 `llm-deepseek` 的 `baseURL`（最省事，须实测） | **(a)** 优先（route 可控、pi-ai 已内置 `openai` 系列）；(b) 作为简化选项实测对比 |
| **DP-IMPL-3** | 切换语义 | (a) **per-call 解析**（运行期可切换）(b) 单例 + `resetLlmClient()` | **(a)** |
| **DP-IMPL-4** | DeepSeek 官方承载 | (a) `llm-deepseek`（原生、`DEEPSEEK_API_KEY` 默认）(b) `llm-pi-ai` | 取决于 **S0 route id 探测**结果 |
| **DP-IMPL-5** | 默认模型/端点在 profile 缺省时的取值 | (a) 沿用 `qwen3:8b` + `localhost:11434/v1`（零回归）(b) 改为云端默认 | **(a)** |
| **DP-IMPL-6** | `getLlmProviderStatus()` 是否暴露给 UI（本轮） | (a) **不暴露**（仅 seam/探针，UI 零改动）(b) 暴露（改 UI，需另行裁决） | **(a)** |
| **DP-IMPL-7** | 验证 harness 归属 | (a) 仓库外（`F:/dsh-lightrag/` 同级，不入 git）(b) 进仓 | **(a)**，沿用 B-1/S13-C 先例 |

---

## 9. 状态

🟡 **停在 Review Node。**

- 本文件为 **P0 Provider Abstraction 的 Mini Implementation Plan**（design-only），**未编码、未装依赖、未改共享包、未改 UI**；基线 `65f84c1`，`src/` 零改动。
- 核实中暴露**两个高等级前置风险**：
  - **R1** router 期望 provider id 与适配器注册名不一致（`'deepseek'` vs `'deepseek-official'`；未知 id → `sourceOf` 归 `'none'` → 空 provider）→ **必须运行时发现，不能假设**。
  - **R2** `@deepseek-ai/*` 在 `node_modules` **全部缺失**，app 无相关依赖 → **Node 路径当前运行时不可达**。
- 待裁决：**DP-IMPL-1 … DP-IMPL-7**。批准并裁决后，自 **S0 前置探测** 开始逐步执行；**不自动进入 P1 / P2 / P3**。
