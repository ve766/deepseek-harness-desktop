# AI Provider 架构设计（多 Provider 自动降级）

> 状态：设计稿（实现前）
> 决策日期：2026-09-05
> 范围：扩展现有 Provider 架构，**不重建 LLM 层**，不修改 Agent Core / Memory / Tool / Plugin 架构。

---

## 0. 设计决策（已确认）

| # | 决策 | 说明 |
|---|------|------|
| 1 | **LlmRouter = 独立 package** `packages/llm/llm-router` | `llm` 包只做 provider registry；router 负责策略，不污染底层；后续可扩展成本/速度/隐私策略 |
| 2 | **Provider 优先级（默认 `auto`）** | Cloud → Local Ollama → Offline；云层含 `deepseek-official` / `openai` / `anthropic` / compatible gateway |
| 3 | **agent-default-model 共存** | 用户手动选择存于 `agent-default-model`；新增 `ai.provider` 策略：`auto` / `cloud` / `local` / `offline` / 显式 provider 名 |
| 4 | **AI Provider Manager = 独立 package** `packages/core/ai-provider-manager` | 首次启动检测、availability、推荐策略、切换；**Agent Core 不感知** |
| 5 | **UI 复用 `ui-settings-models`** | 不新建设置页；`DeepSeekOnboardingDialog` 升级为 `ProviderOnboardingDialog`（Cloud/Local/Offline） |
| 6 | **Ollama = 独立 package** `packages/llm/llm-ollama` | 实现现有 `LlmAdapter`；OpenAI-compatible endpoint；`GET /api/tags` 检测模型；支持 `qwen3` / `qwen2.5-coder` |
| 7 | **首次启动体验** | 无任何 AI 时不报错，显示「选择你的 AI 工作方式」三选项 |
| 8 | **暂不实现** | 自动安装 Ollama、自动下载几十 GB 模型、模型训练（进后续版本） |

---

## 1. 当前架构

现状已通过代码审查确认（排除 `lib/node_modules`）：

- **全仓无 Ollama 引用、无 `11434` 硬编码** —— 当前是 Cloud-API-first，并非"默认依赖 Ollama"。
- **Provider 抽象层已存在**：`LlmRuntime`（`@deepseek-ai/dsh-llm`）即 adapter registry + 流式调用 API。
- **云适配器已就绪**：
  - `llm-deepseek` → 注册路由 `deepseek-official`
  - `llm-pi-ai` → 目录路由 `openai` / `anthropic` 及自定义 OpenAI-compatible gateway
- **缺口**：无本地层（Ollama）、无降级、无首启探测、无 `ai.provider:auto` 策略。

### 1.1 调用链（现状）

```
Agent Core
  └─ ctx.llm.prepareCall({ provider, model })   // provider 由调用方决定
       └─ LlmRuntime.registration(provider)
            ├─ 找到 → adapter.stream()
            └─ 未找到 → 抛 LlmError(NO_ADAPTER)
  └─ ctx.llm.stream() → 'llm/stream' waterfall → adapter.stream()
       └─ 失败 → 终端 finish chunk { kind:'error', failure{LlmFailure.code} }
```

关键代码事实（`packages/llm/llm/src/index.ts`）：

- `prepareCall(config)` → `this.registration(config.provider)` → 无 adapter 时 `throw LlmError('...', 'NO_ADAPTER')`。
- `stream(options)` → `streamWithRegistration` → `ctx.waterfall(this,'llm/stream',...)` → `adapterStream` → `adapter.stream()`。
- `LlmAdapter` 抽象类（需实现）：`providerInfo()` / `providerRetryPolicy()` / `listModels()` / `resolveModel()` / **`stream()`（唯一必须）**。
- 注册入口：`registerAdapter(providers, adapter)`、`registerConfigurableProviders(entries)`、`registerModelDiscovery(ns, discover)`、`listProviders()`、`discoverModels()`。
- `LlmError` 错误码体系：`NO_ADAPTER` / `MISSING_CREDENTIAL` / `AUTH` / `RATE_LIMIT` / `INVALID_*` 等；流失败时以 `LlmFailure.code` 透出。

### 1.2 默认模型（现状）

`packages/core/agent-default-model`：

- settings 命名空间 `agent-default-model`，存静态 `{ provider, model, reasoningEffort? }`。
- `AgentDefaultModelConfig.currentSelection()` 返回 `ModelSelection`；`saveSelection()` 持久化。
- **不探测、不降级** —— 只是"用户上次选了什么"的存储。

### 1.3 UI（现状）

`packages/client/ui-settings-models` 已有通用脚手架：

- `ProviderEditor` / `CustomProviderCard` / `OnboardingModal` / `welcome-store` / `WelcomeNotice` / `ModelsSection`。
- 唯一 DeepSeek 硬编码点：`DeepSeekOnboardingDialog.tsx`（硬编码 `provider==='deepseek-official'`、`settingsNs==='llm-deepseek'`、文案仅谈 DeepSeek key）。

---

## 2. 新架构

### 2.1 分层

```
┌─────────────────────────────────────────────────────────────┐
│  UI 层  ui-settings-models                                  │
│   ProviderOnboardingDialog (Cloud/Local/Offline)            │
│   ModelsSection (通用 provider 管理)                         │
└───────────────┬───────────────────────────┬─────────────────┘
                │ API remote                 │ API remote
                ▼                            ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│ AI Provider Manager       │   │ Agent Core (不变)             │
│ packages/core/            │   │ 调用 ctx.llmRouter.route()    │
│   ai-provider-manager     │   └──────────────┬───────────────┘
│  - 首次启动检测            │                  │
│  - availability 探测       │                  ▼
│  - recommendStrategy      │   ┌──────────────────────────────┐
│  - switchStrategy         │   │ LlmRouter                    │
│  (写 ai.provider 设置)     │   │ packages/llm/llm-router      │
└───────────────┬──────────┘   │  - 策略解析                    │
                │ 读 availability│  - 候选排序 + 预检             │
                │               │  - 降级（pre-flight + 流内）   │
                │               │  - route() → PreparedLlmCall  │
                │               └──────────────┬───────────────┘
                │                               │ 准备调用
                │                               ▼
                │               ┌──────────────────────────────┐
                │               │ LlmRuntime (现有, 不改)        │
                │               │  adapter registry + stream    │
                │               └───┬──────┬──────┬─────────────┘
                │                   │      │      │
                ▼                   ▼      ▼      ▼
         ┌──────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────────┐
         │ Ollama   │  │ DeepSeek      │ │ pi-ai    │ │ Offline(后续) │
         │(新)      │  │(现有)         │ │(现有)    │ │(新, 延后)     │
         │ ollama   │  │deepseek-      │ │openai/   │ │ offline       │
         │ route    │  │ official      │ │anthropic │ │ route         │
         └──────────┘  └──────────────┘ └──────────┘ └──────────────┘
```

要点：

- **`llm` 包零改动**：继续做 registry，不知道"策略"。
- **router 在 `llm` 之上**：把"选哪个 provider"从 Agent Core 剥离到 `ctx.llmRouter`。
- **Manager 在 router 之下/之侧**：只负责"环境里有哪些 provider 可用"以及"用户策略是什么"，写进 `ai.provider` 设置；Agent Core 完全不感知 Manager。
- **Agent Core 调用点极小改动**：把 `ctx.llm.prepareCall({provider,model})` 换成 `ctx.llmRouter.route(selection, strategy)`；返回同样是 `PreparedLlmCall`，后续 `call.stream(req)` 不变。

### 2.2 `ai.provider` 策略语义

| 值 | 候选集 | 降级 |
|----|--------|------|
| `auto`（默认） | Cloud → Ollama → Offline，依次 | 允许级联 |
| `cloud` | 仅 Cloud（deepseek/oepnai/anthropic/gateway） | 禁止 fallback 到 local/offline |
| `local` | 仅 `ollama` | 禁止 fallback 到 cloud/offline |
| `offline` | 仅 `offline` | 禁止 fallback |
| `<显式 provider 名>`（如 `deepseek-official`） | 仅该 provider | 按 `allowFallback` 策略决定 |

与 `agent-default-model` 共存规则：

- `ai.provider` 为策略值（`auto/cloud/local/offline`）时，router **忽略** `agent-default-model` 的 provider 字段，按策略跑；但 model id 若在所选层兼容，仍沿用该 model 偏好。
- `ai.provider` 为显式 provider 名（或用户未设策略、退化为 `agent-default-model` 选择）时，直接走该 provider；`allowFallback` 决定是否在失败时跳候选。

### 2.3 降级策略（两段式）

**主路径 — pre-flight 预检**（首选，避免半路失败）：

router 在 `route()` 内对每个候选做轻量就绪探测：

- Cloud：`credentials.resolve(ref)` 有值（且可选 reachability 探测）。
- Ollama：`GET http://localhost:11434/api/tags` 可达且返回模型列表。
- Offline：离线包已加载（后续版本）。

选第一个 ready 的；若无 ready 且策略允许，按级联顺序 fallback。

**副路径 — 流内错误兜底**（安全网）：

`adapter.stream()` 失败以终端 `error` chunk（`LlmFailure.code ∈ {NO_ADAPTER, AUTH, RATE_LIMIT, TIMEOUT, ...}`）返回。router 包裹消费：

- 若请求为可重建（非 agent-loop 冻结请求），在首个 error chunk 出现且候选尚有剩余、策略允许 fallback 时，用下一候选重新 `prepareCall` 并重放。
- agent-loop 请求携带 `markAgentLoopRequest` 冻结标记，内容为 session log 的纯函数 —— **不在 router 内改写**；若失败，按策略决定是否整轮重试（由 Agent Core 决定），router 仅上报失败原因。

> 设计约束：router **不**注册 `llm/stream` waterfall 监听器去拦截所有调用（那会把路由耦合进每条流、且破坏冻结 loop 语义）。router 只在"调用点"层工作。

---

## 3. 数据流

### 3.1 首启检测流（Manager）

```
App 启动
  └─ ai-provider-manager.detect()
       ├─ 读 settings: ai.provider 是否已设？ → 已设则直接采用，跳过引导
       ├─ 探测 Cloud: 各云 provider 是否有 credential？（ctx.credentials / env）
       ├─ 探测 Ollama: GET localhost:11434/api/tags
       ├─ 探测 Offline: 离线包是否已安装（后续）
       └─ availability: Map<provider, 'ready'|'no-credential'|'unreachable'|'not-installed'>
            └─ recommendStrategy(availability)
                 ├─ 有 cloud key → 推荐 cloud（默认🚀云端 AI 推荐）
                 ├─ 无 key 但 ollama 在跑 → 推荐 local
                 ├─ 都无 → 推荐 cloud（引导用户填 key），offline 作为兜底说明
                 └─ 写回首启状态（welcome-store 风格 ack）
```

### 3.2 推理请求流（Router）

```
Agent Core
  └─ selection = ctx.agentDefaultModel.currentSelection()  // 用户偏好(可能为空)
  └─ strategy  = ctx.aiProviderManager.currentStrategy()     // auto/cloud/local/offline/<name>
  └─ call = await ctx.llmRouter.route(selection, strategy, signal)
  │      ├─ 解析候选集（按 strategy + registry + availability）
  │      ├─ pre-flight 预检每个候选
  │      ├─ 选首个 ready → ctx.llm.prepareCall({provider,model})
  │      └─ 返回 PreparedLlmCall
  └─ for await (const chunk of call.stream(req)) {
  │      if (chunk 为 error finish && 可 fallback && 候选剩余)
  │           → 用下一候选重 route（仅非冻结请求）
  │      else 消费 chunk
  │  }
```

### 3.3 设置持久化

| 命名空间 | 拥有者 | 内容 |
|----------|--------|------|
| `agent-default-model` | agent-default-model（现有） | `{provider, model, reasoningEffort?}` 用户上次选择 |
| `ai.provider` | ai-provider-manager（新） | `{ mode: 'auto'|'cloud'|'local'|'offline'|'explicit', explicitProvider?, allowFallback? }` |
| `llm-ollama` | llm-ollama（新） | `{ baseURL, models? }` Ollama 连接配置 |
| `llm-deepseek` / `llm-pi-ai` | 现有 | 不变 |

---

## 4. Package 影响范围

| Package | 变更类型 | 改动点 | 风险 |
|---------|----------|--------|------|
| `packages/llm/llm` | **不改** | 复用 `prepareCall` / `stream` / `registerAdapter` / `LlmAdapter` | 无 |
| `packages/llm/llm-deepseek` | **不改** | 现有 `deepseek-official` 路由 | 无 |
| `packages/llm/llm-pi-ai` | **不改** | 现有 `openai`/`anthropic`/gateway 路由 | 无 |
| `packages/llm/llm-ollama` | **新增** | 实现 `LlmAdapter`；注册 `ollama` 路由；`GET /api/tags` 模型发现 | 低（纯 HTTP，无原生依赖） |
| `packages/llm/llm-router` | **新增** | `ctx.llmRouter`：策略解析 + 预检 + 降级 + `route()` | 低 |
| `packages/core/ai-provider-manager` | **新增** | 首启检测、availability、recommend、switch；写 `ai.provider` | 低 |
| `packages/core/agent-default-model` | **不改** | 仅作为"用户偏好"被 router 读取 | 无 |
| Agent Core（`packages/core/agent-loop` 等调用点） | **极小改** | `ctx.llm.prepareCall(...)` → `ctx.llmRouter.route(...)`（实现时定位精确调用点） | 中（需回归） |
| `packages/client/ui-settings-models` | **扩展** | `DeepSeekOnboardingDialog` → `ProviderOnboardingDialog`；`ModelsSection` 通用化 | 中 |
| 离线模型包（如 `packages/llm/llm-offline`） | **新增（延后）** | 本地推理运行时 + 模型包发行通道 | — |

约束提醒（来自打包门禁）：`llm-ollama` / `llm-router` 为服务端（host）包，纯度门禁主要约束 client 包；但 `llm-ollama` 若需 OpenAI 流式解析，应自带最小 parser，**不要跨包 import `llm-pi-ai` 的值**（类型可跨包，值不行）。

---

## 5. Migration Plan

目标：**零破坏性**。现有 `ctx.llm.prepareCall` / `ctx.llm.stream` 直接调用方继续工作（显式 provider 时行为不变）。仅 Agent Core 调用点切到 router。

1. **新增 `llm-ollama`**
   - 实现 `LlmAdapter`（`stream` 走 Ollama OpenAI-compatible `/v1/chat/completions`）。
   - `apply(ctx)` 内 `ctx.llm.registerAdapter(['ollama'], adapter)` + `registerConfigurableProviders([{provider:'ollama', displayName:'Ollama', settingsNs:'llm-ollama', settingsPath:[]}])`。
   - `listModels()` 调 `GET {baseURL}/api/tags`，映射 `qwen3` / `qwen2.5-coder` 等。
   - 在 `cordis.yml` 增加 `- id: llm-ollama`（默认 enabled，但无模型时自然 `not-installed`）。

2. **新增 `ai-provider-manager`**
   - 提供 `ctx.aiProviderManager`：
     - `detect(): Promise<Availability>`
     - `recommendStrategy(avail): Strategy`
     - `currentStrategy(): Strategy`（读 `ai.provider` 设置，缺省 `auto`）
     - `switchStrategy(s: Strategy): Promise<void>`（写 `ai.provider`）
   - 不接触 Agent Core、不注册 `llm` adapter。
   - `cordis.yml` 增加 `- id: ai-provider-manager`。

3. **新增 `llm-router`**
   - 提供 `ctx.llmRouter.route(selection, strategy, signal)`。
   - 预检 + 降级逻辑（见 §2.3）。
   - `cordis.yml` 增加 `- id: llm-router`（依赖 `llm` + `ai-provider-manager`）。

4. **Agent Core 接线（最小改动）**
   - 定位当前 `ctx.llm.prepareCall({provider, model})` 调用点（在 `packages/core/agent-loop` 或 agent 包内）。
   - 改为 `ctx.llmRouter.route(selection, strategy, signal)`，其余 `call.stream(req)` 消费代码不变。
   - 保留旧调用作为 `explicit` 模式的内部直通路径，避免行为回归。

5. **UI 升级**
   - `DeepSeekOnboardingDialog.tsx` → `ProviderOnboardingDialog.tsx`：去掉 `deepseek-official` 硬编码，改读 `ai-provider-manager` 的 availability / recommend，渲染三选项（🚀云端 / 🔒本地 / 📦离线）。
   - 仍复用 `OnboardingModal` / `ProviderEditor` / `welcome-store`；"稍后设置"按钮确保**不报错**。
   - `ModelsSection` 通用化：除 DeepSeek 外也能显示/编辑 Ollama、云 gateway。

6. **离线包（延后）**
   - 设计 `offline` 路由 + 本地推理运行时（wasm/ort）+ 模型包发行通道；本期仅留接口与 `not-installed` 状态，引导文案指向"下载模型包"。

---

## 6. MVP 实现顺序

> 每步保持 scope 冻结、独立 commit、可回滚。

### MVP-1：本地层 + 检测底座（无 UI 变更，可服务端验证）
1. `packages/llm/llm-ollama`（adapter + `/api/tags` 发现 + qwen3/qwen2.5-coder）。
2. `packages/core/ai-provider-manager`（detect / availability / recommend / switch；写 `ai.provider`）。
3. `packages/llm/llm-router`（策略解析 + pre-flight 预检 + 降级 + `route()`）。
4. Agent Core 调用点切到 `ctx.llmRouter`（保留 explicit 直通）。
   - **验证**：无 Ollama 时设 `ai.provider:auto`，cloud key 缺失 → 不崩溃、按可用性选；手动设 `ollama` 且 Ollama 在跑 → 走本地；Ollama 宕机 → 按策略 fallback 或明确错误。

### MVP-2：首启体验 + 通用设置
5. `ProviderOnboardingDialog` 三选项 + "稍后设置"（不报错）。
6. `ModelsSection` 通用 provider 管理（Ollama / 云 gateway 可视化）。
   - **验证**：首次启动出现「选择你的 AI 工作方式」；选云端填 key 后可对话；选本地显示安装引导；全空也不报错。

### MVP-3：离线模式（延后）
7. `offline` 路由 + 本地推理运行时 + 模型包发行通道（接口先行，`not-installed` 引导）。

### 暂不实现（明确划出，进后续版本）
- 自动安装 Ollama（仅给引导/下载链接）。
- 自动下载几十 GB 模型（仅给下载入口 + 进度说明）。
- 模型训练 / 微调。

---

## 附录 A：router 接口草图（仅供参考，实现时定稿）

```ts
// packages/llm/llm-router/src/index.ts
export type ProviderStrategyMode = 'auto' | 'cloud' | 'local' | 'offline' | 'explicit'

export interface ProviderStrategy {
  mode: ProviderStrategyMode
  explicitProvider?: string   // mode==='explicit' 时必填
  allowFallback?: boolean     // mode==='explicit' 时决定是否失败跳候选
}

export interface RouteResult {
  provider: string
  model: string
  reasoningEffort?: string
}

export class LlmRouter extends Service {
  // 解析候选 → 预检 → 选首个 ready → 返回 ctx.llm.prepareCall 结果
  route(selection: ModelSelection, strategy: ProviderStrategy, signal?: AbortSignal): Promise<PreparedLlmCall>
}
```

## 附录 B：关键文件索引

| 文件 | 角色 |
|------|------|
| `packages/llm/llm/src/index.ts` | `LlmRuntime` / `LlmAdapter` / `LlmError`（**不改**） |
| `packages/llm/llm-deepseek/src/index.ts` | `deepseek-official` 路由注册范式（llm-ollama 仿此） |
| `packages/llm/llm-pi-ai/src/index.ts` | `openai`/`anthropic`/gateway 目录路由（**不改**） |
| `packages/core/agent-default-model/src/index.ts` | 用户偏好存储（**不改**，被 router 读取） |
| `packages/client/ui-settings-models/src/client/DeepSeekOnboardingDialog.tsx` | 升级为 `ProviderOnboardingDialog` |
| `packages/client/ui-settings-models/src/client/OnboardingModal.tsx` | 通用弹窗 chrome（复用） |
| `packages/client/ui-settings-models/src/client/ProviderEditor.tsx` | 通用 provider 编辑器（复用） |
