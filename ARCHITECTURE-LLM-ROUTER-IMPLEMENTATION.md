# ARCHITECTURE — LLM Router Implementation (MVP-2 Phase B)

> 状态：**设计文档（待评审）**。本文档仅描述实现方案，**不创建任何源码文件、不修改现有包、不提交**。
> 评审通过后，方进入 `packages/llm/llm-router` 的编码阶段。
> 关联文档：Phase A `ai-provider-manager`（已验收）；MVP-1 cordis source alias 问题列为独立 CI 环境问题，本文不处理。

---

## 0. 范围与决策基线（已确认，落地不变）

| # | 已确认决策 | 对 Phase B 的约束 |
|---|---|---|
| 1 | `ai-provider-manager` 独立包方案接受 | Router 仅依赖其 `detect` / `recommend` / 类型，**不改 manager、不改 adapter** |
| 2 | Manager 只做检测/能力聚合/推荐；不推理、不 SSE、不改 adapter | Router 只做**策略选择**（provider/model 解析），不碰 transport、不碰 adapter |
| 3 | `auto` 策略 = `Cloud → Local → Offline` | Router 的 auto 退化链按此顺序，且仅在**选择期**发生 |
| 4 | 显式 provider 不自动跨 provider fallback；失败返回明确 `LlmError` | Router 显式模式下失败直接抛错，绝不降级到其它 provider |
| 5 | 不改 `Agent Core` / `LlmRuntime` / `llm-deepseek` / `llm-pi-ai` / `tsconfig.host.json` / `pnpm-lock.yaml` | 接线只动 `agent-loop` 的**单一调用入口**；仅在文档确认后、且获明确放行时才碰 lockfile |

**新包**：`packages/llm/llm-router`（包名 `@deepseek-ai/dsh-llm-router`），独立 package，零现有包修改。

---

## 1. RouterService 生命周期与 Cordis 注入方式

### 1.1 类型与注册

Router 是一个 **Cordis `Service`**，与 `LlmRuntime`（`super(ctx, 'llm')`）同构，因此在上下文中以 `ctx.llmRouter` 暴露：

```ts
// packages/llm/llm-router/src/service.ts
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'

export class LlmRouter extends Service {
  constructor(ctx: Context) {
    super(ctx, 'llmRouter') // → ctx.llmRouter
  }
  // …resolve / invalidate / 内部状态
}
```

安装入口沿用仓库既有插件范式（参考 `llm-retry` 的 `export const name / inject / apply`）：

```ts
// packages/llm/llm-router/src/index.ts
import type { Context } from '@deepseek-ai/cordis'
import { LlmRouter } from './service.ts'

export const name = 'llm-router'
export const inject: string[] = ['llm'] // 依赖 LlmRuntime 已就绪（ctx.llm）

export interface RouterConfig {
  /** 检测结果的健康缓存 TTL（毫秒）。默认 60000。 */
  healthCacheTtlMs?: number
}
export const Config = z.object({
  healthCacheTtlMs: z.number().default(60000),
}) as unknown as z<RouterConfig>

/** 测试可注入的非序列化钩子（与 llm-retry 的 RetryInternals 同构）。 */
export interface RouterInternals {
  detect?: typeof detect
  recommend?: typeof recommend
  now?: () => number
}

export function apply(
  ctx: Context,
  config: RouterConfig = {},
  internals: RouterInternals = {},
): void {
  ctx.plugin(LlmRouter, [ctx, config, internals]) // Cordis 实例化服务 → ctx.llmRouter
}
```

### 1.2 生命周期要点

- **惰性解析**：所有环境检测与 provider/model 解析都发生在 `resolve()` 被调用时（即 Agent 发起一次请求时），**不在插件安装/启动期**执行。这避免与 `LlmRuntime`、各 adapter 的启动顺序耦合——只要请求发起时 `ctx.llm` 已就绪（必然成立，agent 运行前 harness 已安装 `LlmRuntime`）。
- **健康缓存**：服务实例持有 `private cache: { report: DetectionReport; expiresAt: number } | null`，TTL 来自 `config.healthCacheTtlMs`。命中则直接复用 `DetectionReport`，避免每个 turn 都探测 Ollama。
- **dispose**：随 fiber 销毁自动清空缓存（Cordis service 生命周期由 context 接管），无独立资源需要手动释放。
- **无后台轮询 / 无定时任务**：缓存按 TTL 惰性失效，不做主动健康检查。

---

## 2. 与 `ctx.llm`、`ai-provider-manager` 的依赖关系

### 2.1 对 `ctx.llm`（`LlmRuntime`）的依赖 — **只读查询**

Router **不调用 `prepareCall` / `stream` / `registerAdapter`**，只用其**查询能力**把 `ProviderSource` 映射成运行时真实 `provider` / `model`：

| 用途 | `ctx.llm` API | 说明 |
|---|---|---|
| 把 source 映射到已注册 provider id | `listProviders(): LlmProviderInfo[]` | 取 `info.id` 与 source 对应（deepseek→`deepseek`，ollama→`ollama`） |
| 选取具体 model | `listModels(provider): LlmModelInfo[]` | 优先沿用 `declaredModel`，否则取默认（见 §3） |
| 校验 provider 是否真的注册 | `listProviders()` 结果集 | 防止「manager 检测到凭证存在、但对应 adapter 插件未加载」的错位 |

> 这是 §6 边界的关键：`ctx.llm` 仅作为**目录/查询**被使用，Router 不介入其执行层。

### 2.2 对 `ai-provider-manager` 的依赖 — **纯模块导入**

```ts
import { detect, recommend } from '@deepseek-ai/dsh-ai-provider-manager'
import type { DetectionReport, ProviderSource, RecommendMode } from '@deepseek-ai/dsh-ai-provider-manager'
```

- 直接调用 `detect(options)` 得到 `DetectionReport`，`recommend(report, mode)` 得到 `ProviderSource`。
- **零修改 manager**：不要求 manager 增加 `health()`，也不要求任何 adapter 改动。检测的自包含性由 Phase A 保证。
- 测试通过 §1.1 的 `RouterInternals.detect / recommend` 注入桩函数，完全隔离网络与环境变量。

### 2.3 不依赖项（明确边界）

- 不依赖 `llm-deepseek` / `llm-pi-ai` / `llm-ollama` 任何 adapter 源码。
- 不依赖 `Agent Core` / `agent-loop` 源码（仅在其调用入口消费 `ctx.llmRouter`）。
- 不依赖 `llm-retry`（retry/熔断属于下层，见 §6）。

---

## 3. `resolve()` 调用链设计

### 3.1 契约

```ts
export interface RouterRequest {
  /** Agent 声明的 provider；空串或 'auto' → 走自动链；'deepseek' | 'ollama' → 显式。 */
  preference: RecommendMode // 'auto' | 'deepseek' | 'ollama'
  /** Agent 声明的 model（用户显式指定）；缺省时由 Router 选默认。 */
  declaredModel?: string
  /** 调用方透传的取消信号。 */
  signal?: AbortSignal
}

export interface ResolvedCall {
  /** 运行时真实 provider id（来自 ctx.llm.listProviders 的 info.id）。 */
  provider: string
  /** 真实 model id。 */
  model: string
  /** 选择来源，可观测。 */
  source: ProviderSource // 'deepseek' | 'ollama' | 'none'
  tier: ProviderTier // 'cloud' | 'local' | 'offline'
  /** 人类可读选择理由（含失败原因），供日志/调试。 */
  reason: string
}

export function resolve(request: RouterRequest, opts?: { signal?: AbortSignal }): Promise<ResolvedCall>
```

### 3.2 调用链（伪代码）

```
resolve(req):
  report = getCachedOrDetect(req.signal)        // §1.2 健康缓存
  chosen: ProviderSource = recommend(report, req.preference)

  if req.preference !== 'auto':
      // —— 显式模式（见 §5）——
      cap = report.providers[chosen]
      registered = isProviderRegistered(ctx.llm, chosen)   // §2.1
      if !cap.available || !registered:
          throw LlmError('EXPLICIT_PROVIDER_UNAVAILABLE',
              { provider: chosen, reason: cap.reason ?? 'provider adapter not registered' })
      // 显式命中：不退化
  else:
      // —— auto 模式（见 §4 状态机）——
      if chosen === 'none':
          throw LlmError('NO_PROVIDER_AVAILABLE', { reason: report.offline.reason })
      registered = isProviderRegistered(ctx.llm, chosen)
      if !registered:
          // 检测到的 source 没有对应已注册 adapter → 视为不可用，继续退化
          throw LlmError('NO_PROVIDER_AVAILABLE',
              { reason: `provider for '${chosen}' is not registered` })

  providerId = mapSourceToProviderId(ctx.llm, chosen)   // listProviders 匹配
  model      = selectModel(ctx.llm, providerId, req.declaredModel)
  return { provider: providerId, model, source: chosen, tier: cap.tier, reason: ... }

getCachedOrDetect(signal):
  if cache && now() < cache.expiresAt: return cache.report
  report = (internals.detect ?? detect)({ signal, ...detectOpts })
  cache = { report, expiresAt: (internals.now ?? Date.now)() + ttl }
  return report

selectModel(ctx.llm, providerId, declared?):
  models = await ctx.llm.listModels(providerId)
  if declared && models.some(m => m.id === declared): return declared
  return defaultModel(models)   // 取首个，或按 provider 约定（deepseek 取默认聊天模型）
```

### 3.3 关键不变量

- `resolve()` **永远在调用 `ctx.llm.prepareCall` 之前**完成；它只产出 `{ provider, model }` 与可观测元数据。
- 显式模式下，只要 `chosen` 是合法 source，就**不再调用 `recommend` 的退化逻辑**——`recommend(report, 'deepseek')` 直接返回 `'deepseek'`（`recommend` 对显式值原样透传，Phase A 已保证）。
- 失败一律通过 `LlmError` 上浮，错误码语义清晰，便于上层区分「显式不可用」与「整体离线」。

---

## 4. auto fallback 状态机（选择期退化）

退化**仅在 `resolve()` 的选择期发生**，基于 `DetectionReport` + `ctx.llm` 注册表；**不响应运行时 transport 失败**（见 §6）。

```
                 ┌─────────────────────────────┐
                 │          START             │
                 └───────────────┬─────────────┘
                                 │
              preference === 'auto' ? ── no ──▶ EXPLICIT 分支（见 §5）
                                 │ yes
                                 ▼
                 cloud.available && deepseekRegistered ?
                    ├── yes ─▶ SELECTED('deepseek')  [tier=cloud]
                    └── no ──▶ local.available && ollamaRegistered ?
                                  ├── yes ─▶ SELECTED('ollama')  [tier=local]
                                  └── no ──▶ FAIL_OFFLINE
                                               └─▶ throw LlmError('NO_PROVIDER_AVAILABLE')
```

- **退化顺序严格 `cloud → local → offline`**，与决策 #3 一致。
- `registered` 检查把「manager 检测到凭证/端点、但对应 adapter 未加载」的情况也纳入退化，避免选中一个无法 `prepareCall` 的 provider。
- `FAIL_OFFLINE` 抛出 `NO_PROVIDER_AVAILABLE`，reason 携带 `report.offline.reason`（如 `no provider detected in the environment`）。

---

## 5. explicit provider failure 行为

当 `preference` 为具体 source（`'deepseek'` 或 `'ollama'`）时：

```
   preference = 'deepseek'
          │
          ▼
   detect → cap = report.providers['deepseek']
          │
    available && registered ?
       ├── yes ─▶ SELECTED('deepseek')   // 原样命中，不退化
       └── no  ─▶ FAIL_EXPLICIT
                     └─▶ throw LlmError('EXPLICIT_PROVIDER_UNAVAILABLE',
                            { provider: 'deepseek',
                              reason: cap.reason ?? 'provider adapter not registered' })
```

**核心纪律（决策 #4）**：
- 显式模式下**绝不跨 provider 退化**。即便 `deepseek` 不可用、`ollama` 可用，也**不**回退到 ollama，直接抛错。
- 错误码 `EXPLICIT_PROVIDER_UNAVAILABLE`（区别于 auto 的 `NO_PROVIDER_AVAILABLE`），message 明确如：
  `Explicit provider 'deepseek' is unavailable: missing DEEPSEEK_API_KEY credential. No cross-provider fallback is performed.`
- 该错误**不被** `agent.ts` 现有 `catch (NO_ADAPTER)` 吞掉（码不同），因此自然上浮到 Agent Loop 的 step 错误处理——**Agent Loop 逻辑零改动**。

---

## 6. 熔断 / retry 边界

**Router 不做熔断、不做 retry。** 这是与 `llm-retry` 的清晰职责切分：

| 关注点 | 归属 | 说明 |
|---|---|---|
| provider/model **选择** | **Router（本文）** | 选择期退化，见 §4/§5 |
| 单次调用失败的**重试/退避** | `llm-retry` | 通过 `agent/request` 恢复扩展点，按 provider 的 `retryPolicy` 执行 |
| 传输层**熔断** | adapter / `LlmRuntime.providerRetryPolicy` | 由 adapter 注册时自带，Router 不介入 |
| **健康缓存（TTL）** | **Router** | 仅缓存 `DetectionReport`，是*缓存*不是*熔断*；miss 即重新 `detect`，不屏蔽错误 |

**明确排除（MVP 不做）**：
- Router **不会**捕获 `prepareCall` 抛出的 `LlmError` 去改选另一个 provider（那属于运行时 failover，会越过决策 #4 的显式保护，也会与 `llm-retry` 职责重叠）。
- 若未来需要「auto 运行时按 cloud→local 故障转移」，作为**高级用户能力 `fallbackPolicy`** 单独设计，默认关闭（与 MVP 决策一致）。

---

## 7. Agent Core 接线方案（只改调用入口，不改 Agent Loop 逻辑）

### 7.1 改动定位

唯一改动点：`packages/core/agent-loop/src/agent.ts` 的 `buildRequest()` 中计算 `route` 的两行（当前第 421 行附近）：

```ts
// —— BEFORE ——
const route = { provider: this.options.provider ?? '', model: this.options.model ?? '' }
```

```ts
// —— AFTER（唯一改动）——
const router = this.loopCtx.llmRouter
const resolved = await router.resolve(
  {
    preference: (this.options.provider || 'auto') as RecommendMode,
    declaredModel: this.options.model || undefined,
    signal,
  },
  { signal },
)
const route = { provider: resolved.provider, model: resolved.model }
```

### 7.2 不变的部分（证明「逻辑未改」）

以下代码**逐字节不变**：
- `seedConfig` 的构建（`deepFreeze(structuredClone(...))`）
- `this.dispatch.waterfall('agent/request', ...)` 调用
- `if (!proposedConfig.provider || !proposedConfig.model)` 守卫
- `preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal)` ← **仍由 `ctx.llm` 执行**
- `catch (error) { if (NO_ADAPTER) ... }` 分支（本 Router 错误码不在此列，自然上浮）

> 即：Router 只决定 `route` 的 `provider`/`model` 从何而来；`prepareCall`、waterfall、重试、流式、NO_ADAPTER 兜底全部原样保留。这满足决策 #5「只改调用入口，不改 Agent Loop 逻辑」。

### 7.3 显式/auto 的入口语义

- `this.options.provider` 为空 → `preference='auto'`（走 §4 退化链）。
- `this.options.provider='deepseek'` → `preference='deepseek'`（走 §5 显式保护）。
- **不修改 `AgentOptions` 类型**：直接透传既有 `this.options.provider`，Router 内部把空串归一为 `'auto'`。

### 7.4 被否决的替代方案（记录，避免范围蔓延）

- ❌ 「Router 解析结果写入 `agent-default-model` / `ai.provider` settings ns，Agent Core 读取」：会改动更多入口与 settings 契约，超出「只改调用入口」；**不采用**。
- ❌ 「Router 暴露 `prepareResolvedCall` 替代 `llm.prepareCall`」：会把 `prepareCall` 语义迁到 Router，增加耦合；**不采用**（除非后续评审要求统一 seam）。

---

## 8. 测试计划与覆盖范围

### 8.1 测试形态

- 独立 `vitest.config.ts`（**`root` 钉到 `packages/llm/llm-router`**，避免从仓库根跑时 `include` 错位，Phase A 已踩坑）。
- **不挂仓库根 `scripts/test-invariants.ts`**（Router 是 Cordis 服务，但用最小 `new Context()` + `ctx.plugin(LlmRouter, [ctx, config, internals])` 构造，注入 `internals.detect/recommend/now` 桩；不强制要求 `src/invariant.ts` companion，与 Phase A 一致）。
- 覆盖率门槛：**per-file 100%**（与仓库门禁、Phase A 标准一致）；仅对**真正不可达**分支用 `/* v8 ignore next N -- 理由 */` 标注。

### 8.2 用例矩阵（覆盖 5 个必需场景 + 边界/负向）

| # | 场景 | 期望 |
|---|---|---|
| 1 | **Ollama 存在**（auto） | 解析为 `ollama` provider + 真实 model |
| 2 | **Ollama 不存在**（auto，cloud 可用） | 解析为 `deepseek` |
| 3 | **DeepSeek key 存在**（auto） | 解析为 `deepseek` |
| 4 | **无任何 provider**（auto） | 抛 `NO_PROVIDER_AVAILABLE`，reason 含离线原因 |
| 5 | **auto 推荐顺序** | cloud→local→offline 退化顺序正确；中间档缺失正确跳过 |
| 6 | 显式 `deepseek` 可用 | 解析为 `deepseek`，**不退化** |
| 7 | 显式 `deepseek` 不可用（无 key） | 抛 `EXPLICIT_PROVIDER_UNAVAILABLE`，**断言未选 ollama** |
| 8 | 显式 `deepseek` 检测到但 adapter 未注册 | 抛 `EXPLICIT_PROVIDER_UNAVAILABLE` |
| 9 | 显式 `ollama` 不可用 | 抛 `EXPLICIT_PROVIDER_UNAVAILABLE` |
| 10 | 健康缓存命中 | 同 TTL 内第二次 `resolve` 复用 `DetectionReport`（spy `detect` 仅调用 1 次） |
| 11 | 缓存过期 | 超过 TTL 后 `detect` 再次被调用 |
| 12 | `detect` 抛错 | 被包装为 `LlmError` 上浮，不静默吞掉 |
| 13 | model 选择 | `declaredModel` 合法时沿用；缺失时从 `listModels` 选默认 |
| 14 | 可观测元数据 | `ResolvedCall` 含 `source`/`tier`/`reason`，供日志断言 |
| 15 | auto 选中 source 但 `ctx.llm` 未注册该 provider | 继续退化到下一档（验证 §4 `registered` 分支） |

### 8.3 隔离策略

- `ctx.llm` 用**轻量桩**：仅实现 `listProviders()` / `listModels()` 返回预设 id，无真实 adapter。
- `internals.detect` / `internals.recommend` 注入确定性桩（覆盖正常/抛错/未注册等分支）。
- `internals.now` 注入可控时钟以稳定 TTL 用例。
- 不触及 `llm-deepseek` / `llm-ollama` / `agent-loop` 真实实现。

---

## 9. 实现阶段将创建的文件（本文档确认后才创建，当前不创建）

```
packages/llm/llm-router/
├── package.json                 # @deepseek-ai/dsh-llm-router，peerDep @deepseek-ai/dsh-llm + @deepseek-ai/dsh-ai-provider-manager
├── tsconfig.json                # extends tsconfig.base.json
├── vitest.config.ts             # root 钉本包，独立 coverage 配置
├── src/
│   ├── types.ts                 # RouterRequest / ResolvedCall / RouterConfig / RouterInternals
│   ├── service.ts               # LlmRouter extends Service（resolve / invalidate / 缓存）
│   ├── resolve.ts               # resolve() 调用链 + source→provider/model 映射 + 状态机
│   └── index.ts                 # name/inject/apply + 桶导出
└── tests/
    └── router.spec.ts           # §8.2 用例矩阵
```

> 不修改：`packages/core/agent-loop`、`packages/llm/llm`、`ai-provider-manager`、任何 adapter、`tsconfig.host.json`、`pnpm-lock.yaml`。

---

## 10. 开放决策点（评审时确认）

1. `EXPLICIT_PROVIDER_UNAVAILABLE` 是否与仓库既有 `LlmError` code 体系复用某码（如 `PROVIDER_UNAVAILABLE`），还是新增独立码——倾向新增以区分显式/auto。
2. `selectModel` 的默认模型策略：deepseek 是否固定默认聊天模型，还是取 `listModels` 首个——倾向「`declaredModel` 优先，否则首个」。
3. 健康缓存 TTL 默认值（默认 60000ms 是否合适）。
4. 是否需要在 Router 暴露 `invalidate()` 供 settings 变更时强制重探——倾向提供（廉价、利于后续 UI onboarding）。

---

## 11. 与已知问题/后续的关系

- **MVP-1 cordis source alias 问题**：按决策单独列为 CI 环境问题，本文档及实现**不处理**。
- **Phase C（延后）**：UI onboarding、商业套餐、云端模型池、企业 provider——不在本文范围。
- **`fallbackPolicy` 高级能力**：仅在用户明确开启时设计，MVP 默认关闭（见 §6）。
