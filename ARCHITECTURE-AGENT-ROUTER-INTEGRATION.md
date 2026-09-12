# Architecture · Agent Core ↔ LLM Router Integration

> Phase: MVP-2 · Phase B (Router) 已验收 → 本文件为 **Agent Core 接线设计**（设计阶段，未实现）。
> 约束（本阶段）：只写设计文档；不创建源码；不修改任何已有文件；不改 `tsconfig.host.json`／`pnpm-lock.yaml`；不 commit。
> 实现阶段在文档确认后单独进行，仍保持「单点入口、单 commit」纪律。

---

## 0. 结论速览

- **唯一修改点**：`packages/core/agent-loop/src/agent.ts` 的 `buildRequest()`（约 L407–L495，当前 `llm.prepareCall` 调用在 **L449**）。
- **插入方式**：在 `buildRequest()` 内，用 `ctx.llmRouter` 替代 `ctx.llm` 完成「解析 + 运行时 failover」，再把 `PreparedLlmCall` 交回既有流程。
- **调用链（改造后）**：`Agent → ctx.llmRouter.resolve/prepareCall → ctx.llm.prepareCall → adapter.stream`。
- **零回归面**：Agent Loop 主循环（`step()` L332–L401）、`agent/request` waterfall（L438）、`agent/request-error` waterfall（L355）、`stream` contract（L345）、retry 机制均**不改**。
- **Cordis 依赖**：Router 仅消费 `ctx.llm`（已注入 agent-loop 的 `inject`）与静态导入的 Provider Manager；agent-loop 以**可选**方式读取 `ctx.llmRouter`，不新增硬 `inject`，保持 agent-loop 既有测试独立可跑。

---

## 1. 当前 Agent 调用链审计（只读）

源码事实（来自真实读取，非推断）：

| 位置 | 行为 |
|---|---|
| `agent.ts:340` | `step()` 调 `await this.buildRequest(turn, step, …)` |
| `agent.ts:345` | `const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)` —— **stream 入口，不改** |
| `agent.ts:407` | `private async buildRequest(…)` —— **唯一修改点** |
| `agent.ts:421` | `const route = { provider: this.options.provider ?? '', model: this.options.model ?? '' }` —— 当前直接来自 `AgentOptions` |
| `agent.ts:422–426` | `reasoningEffort` 恢复：比较 `persistedConfig.provider === route.provider` |
| `agent.ts:428–441` | `seedConfig` 由 `route` 构造 → `agent/request` waterfall → `proposedConfig`（**waterfall 语义不改**） |
| `agent.ts:443–445` | 守卫：`if (!proposedConfig.provider || !proposedConfig.model) throw` |
| `agent.ts:449` | `preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal)` —— **改为 router** |
| `agent.ts:451–455` | `catch (NO_ADAPTER)`：中间件可服务未注册路由；否则上抛 |
| `agent.ts:359–361` | `agent/request-error` waterfall 消费 `preparedCall?.retryPolicy`（**retry 机制不改**） |
| `agent.ts:473–477` | `requestContext = { provider: config.provider, model: config.model }` —— 用 `preparedCall.config` |
| `index.ts:297` | `AgentLoop.inject = ['agents','sessions','llm','tools','systemPrompt']` |
| `agent.ts:472` | `const loopCtx = this.runtime.ctx` —— agent-loop 自身 ctx，已挂载 `llm` |

**当前链路**：`Agent → ctx.llm.prepareCall → adapter → ctx.llm.stream`。`provider`/`model` 完全来自 `AgentOptions`（当前要求显式给出，否则 L443 抛错）。Router 的 `auto` 解析与运行时 failover 在此链路上**完全不存在**。

---

## 2. 改造后调用链

```
Agent.step()
  └─ buildRequest()                         [L407] 唯一修改点
       ├─ (NEW) ctx.llmRouter.resolve({provider, model})   →  selection-time 解析 (Cloud→Local→Offline)
       ├─ route = resolved {provider, model}              →  驱动 reasoningEffort 恢复 + seedConfig（不变）
       ├─ agent/request waterfall(seedConfig)            →  proposedConfig（不变）
       ├─ (CHANGED) ctx.llmRouter.prepareCall(req, signal)
       │       ├─ resolve() 再次（30s 缓存命中，零成本）
       │       ├─ auto 模式：按 allowed codes 运行时 failover → ctx.llm.prepareCall(...)
       │       └─ 返回 PreparedLlmCall（与 llm.prepareCall 同构）
       └─ config = preparedCall.config                   →  既有的 header / requestContext 逻辑不变
  └─ stream = preparedCall.stream(request) ?? ctx.llm.stream(request)   [L345] 不变
  └─ agent/request-error waterfall(preparedCall.retryPolicy)            [L355] 不变
```

**关键不变量**：Router 只是「解析 + failover 调度器」。它最终仍调用 `ctx.llm.prepareCall()` 并返回**原生的 `PreparedLlmCall`**。因此 `preparedCall.config` / `preparedCall.retryPolicy` / `preparedCall.adapterDefaults` 全部原样透传 → `stream`、retry、error contract 与改造前**逐字节等价**。

---

## 3. 唯一修改点设计：`buildRequest()`

### 3.1 推荐实现草图（实现阶段使用，本阶段不落地）

```ts
// buildRequest() 内，替换原 L421 的 route 构造与 L449 的调用

// (1) 可选读取 router；未安装时完全回退到既有行为（保证 agent-loop 既有测试不受影响）
const router = this.loopCtx.llmRouter // 由 dsh-llm-router 的 Context 增强声明类型；未安装时运行时为 undefined

// (2) selection-time 解析：填充 route，供 reasoningEffort 恢复 + seedConfig 使用
let route: { provider: string; model: string }
if (router !== undefined) {
  const resolved = await router.resolve({
    provider: this.options.provider, // '' | 'auto' | 具体 provider
    model: this.options.model,
  })
  route = { provider: resolved.provider, model: resolved.model }
} else {
  route = { provider: this.options.provider ?? '', model: this.options.model ?? '' }
}
//     ↑ 以下 reasoningEffort 恢复 (L422) / seedConfig (L428) / agent/request waterfall (L438) 逐字不变

// (3) 执行调用：用 router.prepareCall 取代 llm.prepareCall
//     - 传「原始 provider 信号」(this.options.provider)，使 auto 模式保留运行时 failover；
//     - route（已解析）仅用于上方 reasoningEffort / header 展示，不参与 failover 判定。
let preparedCall: PreparedLlmCall | undefined
try {
  if (router !== undefined) {
    preparedCall = await router.prepareCall({
      provider: this.options.provider,
      model: this.options.model,
      reasoningEffort: proposedConfig.reasoningEffort,
      temperature: proposedConfig.temperature,
      maxTokens: proposedConfig.maxTokens,
      stop: proposedConfig.stop,
    }, signal)
  } else {
    preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal)
  }
  config = preparedCall.config
} catch (error: unknown) {
  // L451–455 原 NO_ADAPTER 守卫保留不变（router 路径下基本不可达，但无害）
  if (!(error instanceof LlmError) || error.code !== 'NO_ADAPTER') throw error
  config = proposedConfig
}
```

### 3.2 为什么这样改

- **单点入口**：仅 `buildRequest()` 内部变化；`step()` 主循环、`stream` 调用（L345）、两个 waterfall、retry 全部不动。
- **auto 信号守恒**：`router.prepareCall` 的 `resolveMode` 由 `request.provider` 决定。`this.options.provider` 为 `''`/`'auto'` 时进入 auto（含运行时 failover）；为具体值时进入 explicit（不 fallback）。若把已解析的 `route.provider` 传给 `prepareCall`，会被误判为 explicit 而**关闭 failover**——故执行调用须传原始信号，解析仅用于 `route` 展示。
- **零重复探测成本**：`resolve` 与 `prepareCall` 内各解析一次，但 `resolve` 命中 30s 缓存（见 §5），第二次为 O(1)。
- **向后兼容**：`router === undefined` 分支完整保留 `llm.prepareCall` 旧路径，未安装 Router 的环境行为不变。

### 3.3 类型接入（实现阶段需要，属「单点修改」的一部分）

`agent-loop` 需 `import type { LlmRouter } from '@deepseek-ai/dsh-llm-router'`（仅类型，触发 `declare module '@deepseek-ai/cordis' { interface Context { llmRouter: LlmRouter } }` 增强），使 `this.loopCtx.llmRouter` 在编译期可识别。运行期用可选访问，**不新增 `inject`**。

---

## 4. Cordis：注入顺序与生命周期

### 4.1 三方依赖关系

```
llm (LlmRuntime)          ── 核心执行层，独立存在
ai-provider-manager        ── 纯模块（detect/recommend 静态函数，无 cordis service 依赖）
llm-router (LlmRouter)    ── inject:['llm']；detect/recommend 静态导入 manager
agent-loop (AgentLoop)    ── inject:['agents','sessions','llm','tools','systemPrompt']；运行时读取 llmRouter（可选）
```

- Router 对 Manager **无 service 依赖**：`service.ts` 直接 `import { detect, recommend } from '@deepseek-ai/dsh-ai-provider-manager'`（静态导入）。因此 Manager 不需要作为 cordis service 被注入 Router。
- Router 对 `llm` 是**硬依赖**（`inject:['llm']`），故 `llm` 必须在 Router 激活前安装——与现有 `llm` 先于 `agent-loop` 的安装顺序一致。
- `agent-loop` 对 `llmRouter` 是**可选读取**：不在 `inject` 中，故不强制 Router 先于 `agent-loop` 激活；运行期 `ctx.llmRouter` 只要在同棵 context 树（根 context 已装 Router）即可在请求时命中。

### 4.2 安装位置（host 组合根）

Router 是一个 cordis 插件（`apply(ctx, config)`），须在 host 组合清单中注册（与 `llm`、`agent-loop` 并列），例如声明式 `cordis.yml` 的 plugins 数组或 app 的插件注册表。该注册是 **host/bootstrap 关注点，不在 `agent-loop` 包内**，不触及 `agent-loop` 源码（除 §3.3 的类型 import）。

> 组合根现状为声明式 manifest（如 `examples/*/cordis.yml`、`apps/cli` 的插件清单）。Router 的接入 = 在其插件清单追加 `llm-router` 条目；无需改动 `agent-loop` 的 `index.ts` `apply`/`inject`。

### 4.3 生命周期

- Router 作为 `Service` 随其插件 `apply` 实例化（`super(ctx,'llmRouter')`），随根 context 卸载而销毁。
- `invalidate()`（缓存清理）由 Router 自身在 env 变化时调用；agent-loop 不感知。
- agent-loop 在 `buildRequest()` 内**惰性**读取 `ctx.llmRouter`，不持有引用、不影响自身激活/卸载时序。

---

## 5. 错误传播

| 场景 | Router 行为 | 在 Agent 侧的落点 | 兼容性 |
|---|---|---|---|
| **explicit provider 失败** | `resolve/prepareCall` 抛 `LlmError(EXPLICIT_PROVIDER_UNAVAILABLE)` | 透传出自 `buildRequest()` → `step()` → Agent 机器以 terminal error 呈现 | 与现有 L443 `throw`（无 provider/model）同类「明确配置错误」，无静默 fallback |
| **auto 候选耗尽** | 抛 `lastError`（末层真实 error，如 `TRANSPORT`）或 `NO_ADAPTER` | 同上 | 真实根因可见，不掩盖 |
| **auto 运行时 failover** | `NO_ADAPTER/TRANSPORT/TIMEOUT/SERVER/QUOTA` → 切下一候选；`AUTH/INVALID_CREDENTIAL`/非 LlmError → 直接上抛 | 对用户透明；最终成功或抛末层 error | 不触发 retry 机制（retry 属 `llm-retry`/`adapter`，Router 不介入） |
| **terminal LlmFailure** | Router 透传 `PreparedLlmCall`，其 `.config/.retryPolicy/.adapterDefaults` 原样 | `stream`/`agent/request-error` waterfall/finish 处理**逐字不变** | ✅ 完全兼容 |

**显式约束重申**：`AUTH`/`INVALID_CREDENTIAL` 与用户显式 provider 失败**绝不**自动 fallback；二者都返回明确 `LlmError`（`EXPLICIT_PROVIDER_UNAVAILABLE` 或原 `AUTH`），避免掩盖用户配置错误（与 Phase B 验收一致）。

---

## 6. 修改范围评估

| 文件 | 改动 | 性质 |
|---|---|---|
| `packages/core/agent-loop/src/agent.ts` | `buildRequest()` 内 2 处：route 构造 + `prepareCall` 调用；+1 个 `import type` | **唯一功能改动点** |
| `packages/core/agent-loop/src/index.ts` | **不改** `inject`（保持 `llmRouter` 可选） | — |
| `packages/llm/llm-router/*` | **不改**（Phase B 已完成验收） | — |
| `packages/llm/llm/*`、`ai-provider-manager/*`、任何 adapter | **不改** | — |
| `tsconfig.host.json` / `pnpm-lock.yaml` | **不改** | — |
| host 组合清单（如 `cordis.yml`/插件注册表） | 追加 `llm-router` 条目（实现阶段，host 关注点） | 非 agent-loop 源码 |

**净改动面**：1 个文件、约 15–25 行、1 个 `import type`。无新包、无新 service 注入、无架构变动。

---

## 7. 风险列表

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | `reasoningEffort` 恢复在 auto 模式下依赖 `route.provider`；若早期不 `resolve()` 而直接传 `''` 信号，会丢失该恢复（persisted `'deepseek'` ≠ `''`） | 中 | §3.1 草图已用早期 `router.resolve()` 填充 `route`，恢复逻辑不变 |
| R2 | 若把已解析 `route.provider` 传给 `prepareCall`，auto 被误判 explicit → **关闭运行时 failover** | 高 | 执行调用传**原始信号** `this.options.provider`（见 §3.1/§3.2） |
| R3 | agent-loop 既有测试未安装 Router，读取 `ctx.llmRouter` 报类型/运行错误 | 低 | 可选访问 + `router === undefined` 回退分支；不新增硬 `inject` |
| R4 | Router 插件未在 host 组合注册 → 运行期 `ctx.llmRouter` 为 `undefined`，走回退分支（无 router 功能） | 低 | 实现阶段在组合清单显式注册；加一个「router 已挂载」冒烟测试 |
| R5 | `LlmCallConfig` 与 `RouterRequest` 字段不完全对齐（如未来新增可选字段未透传） | 低 | 实现阶段对齐字段；测试覆盖 `reasoningEffort/temperature/maxTokens/stop` 透传 |
| R6 | 同一 session 多 step 内环境变化导致 `resolve` 结果漂移 → 频繁 `request/header` change 事件 | 低 | capability 60s / resolve 30s 缓存稳定单 turn；属预期行为（env 变化即重解析） |

---

## 8. 实施步骤（实现阶段，待确认后执行）

1. **注册 Router 插件**：在 host 组合清单追加 `llm-router`（与 `llm`/`agent-loop` 并列）。
2. **类型接入**：`agent-loop/src/agent.ts` 增加 `import type { LlmRouter } from '@deepseek-ai/dsh-llm-router'`（触发 Context 增强）。
3. **改 `buildRequest()`**：按 §3.1 草图替换 `route` 构造与 `prepareCall` 调用，保留 `NO_ADAPTER` 守卫与两个 waterfall。
4. **类型检查**：`tsc --noEmit` 通过（确认 `ctx.llmRouter` 类型可见、`RouterRequest`↔`LlmCallConfig` 字段对齐）。
5. **单测**：新增/复用 `agent-loop` 测试覆盖 §9 场景；确认既有测试（无 Router）仍绿。
6. **集成冒烟**：在 headless example 组合中启动，验证 Cloud→Local→Offline 与显式 provider 行为。
7. **独立 commit**：仅含上述改动 + 组合清单条目；不混入 env-debt。

---

## 9. 测试计划

| 场景 | 验证点 | 类型 |
|---|---|---|
| **Router 注入成功** | host 组合挂载 Router 后 `ctx.llmRouter` 为 `LlmRouter` 实例；`resolve`/`prepareCall` 可调用 | 集成冒烟 |
| **Agent 使用 Router resolve** | auto 模式下 Agent 实际走的 provider/model == Router 解析结果（Cloud→Local→Offline） | 集成 |
| **显式 provider（可用）** | `AgentOptions.provider='deepseek'` 时直接走该 provider，不经 fallback | 单测 |
| **显式 provider（不可用）** | 抛 `EXPLICIT_PROVIDER_UNAVAILABLE`，Agent 以 terminal error 呈现，无静默切换 | 单测 |
| **auto fallback** | Cloud 不可用时自动切 Local，再 Offline；allowed codes 触发、forbidden codes 不触发 | 单测 + 集成 |
| **stream 行为不变** | `preparedCall.stream(request)` 输出序列、`finish` 处理、`agent/request-error` retry 与改造前一致 | 单测（对比 fixture） |
| **无 Router 回退** | 未安装 Router 时 `buildRequest` 行为与改造前逐字等价（既有测试全绿） | 回归 |
| **字段透传** | `reasoningEffort/temperature/maxTokens/stop` 经 Router 透传到 `llm.prepareCall` | 单测 |
| **reasoningEffort 恢复** | auto 模式下多 step 内 `persistedConfig.provider===route.provider` 比较仍正确 | 单测 |

---

## 10. 验收门（进入实现前确认）

- [ ] 设计单点入口（`buildRequest()`）被认可，主循环/waterfall/retry/stream 不改
- [ ] `ctx.llm → ctx.llmRouter` 迁移方式（可选读取 + 原始信号传 prepareCall）被认可
- [ ] `reasoningEffort` 恢复与 failover 信号守恒（R1/R2）方案被认可
- [ ] 不新增 `inject`、host 组合注册方式被认可
- [ ] 测试计划覆盖 §9 全部场景

> 文档确认后，进入 **Agent Core 接线实现**（独立 commit，不 commit 直至验收）。
