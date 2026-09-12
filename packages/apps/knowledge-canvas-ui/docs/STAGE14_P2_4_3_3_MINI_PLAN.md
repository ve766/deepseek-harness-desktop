# STAGE14 P2-4.3.3 Mini Plan — AgentRun 真实执行入口

> 阶段：**P2-4.3.3 设计评审（design-only）**。目标是真实执行入口 —— 本包**第一次真正调用模型**的路径设计。
> 前置：4.3.1 routing（`a5094ba`）· 4.3.2 localGuard（未提交）· 4.2a skeleton（`aa62ecc`）。
> **禁止**：Plugin Runtime · Renderer/WebGL · LangGraph/handoff · 拆 Agent Core · 新依赖 · 云端默认调用 · 修改 ActivityKind/ActivitySourceId。

---

## 0. Q1 — `getLlmClient()` 是否适合作能力入口？**否，三个理由（含一个守卫绕过）**

实测 `llmContext.ts:85-107` + `:442-455`：

```ts
export interface LlmClient {
  readonly available: boolean
  readonly unavailableReason?: string
  research(req: LlmResearchRequest, signal?): Promise<AsyncIterable<LlmStreamChunk>>
}
// getLlmClient() 内部： loadNodeHost( resolveLlmProviderProfile() )
```

| # | 问题 | 性质 |
|---|---|---|
| 1 | **形状**：`research()` 是**检索问答流**（query + contextNodes → text/thinking 流）。抽取需要的是**单次结构化补全**（system+chunk → 实体/关系文本）。请求无 chunk/system/maxTokens 概念 | 形状不匹配 |
| 2 | **守卫绕过（决定性）**：`getLlmClient()` **内部**用 `resolveLlmProviderProfile()` 决定 provider —— executor **无法注入** routing 决策。若 runner 走 `getLlmClient()`，实际用的 provider 是 seam 自选的，**local-only guard 的批准被完全绕过** | **架构级阻断** |
| 3 | **语义**：`available/unavailableReason` 是 UI 降级概念（浏览器 stub 假诚实），不是执行能力语义 | 语义错位 |

**结论**：按你的目标结构新建**能力接口**，executor **不 import `getLlmClient`**：

```
AgentRun Executor          (src/agent/executor.ts)
      ↓  持有能力实例（不知道 Ollama/OpenAI/qwen/endpoint）
Llm Capability Interface   (src/llm/capability.ts —— 接口 + 工厂)
      ↓  按 chosen profile 选 adapter
Provider Implementation    (capability.ts 内 ollama adapter，4.3.3 仅此一个)
```

## 1. Q2 — 最小真实执行链与每层职责（禁止跨层）

```
src/agent/executor.ts     executeImport(request, signal?) : Promise<AgentRun>
  职责：阶段编排、turn/toolCall 记录、阶段边界 cancel、failover 遍历纪律
  不知道：provider kind、endpoint、模型名（只持有 LlmCapability 实例）
        ↓ 调用（携带 Privacy/TaskKind/needs）
src/llm/routing.ts        decideProviderCandidates(req) → ordered allowed + rejected   [4.3.1 增量]
  职责：谁能用（privacy→capability→credential）、顺序、拒绝理由
        ↓
src/llm/localGuard.ts     filterFailoverCandidates(candidates, ctx)                    [4.3.2 已交付]
  职责：**每次尝试失败后**重验下一候选（旗标不可信）
        ↓
src/llm/capability.ts     createLlmCapability(chosenProfile): LlmCapability
  职责：按 profile 绑定 adapter；暴露 complete(req, signal)
        ↓
ollama adapter            POST {baseURL}/api/chat {stream:false}（fetch，无新依赖）
  职责：HTTP 细节、usage 提取
```

**跨层禁令**：executor 不触碰 HTTP/endpoint/kind；capability 不知道 TaskKind/阶段；routing/localGuard 不发请求。

### 能力接口（最小，非流式 —— 抽取只需一次结构化补全）

```ts
// src/llm/capability.ts
export interface CompletionRequest { system?: string; prompt: string; temperature?: number; maxTokens?: number }
export interface CompletionResult  { text: string; usage?: { inputTokens?: number; outputTokens?: number; ms: number } }
export interface LlmCapability {
  readonly model: string
  readonly local: boolean
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>
}
export function createLlmCapability(profile: LlmProviderProfile): LlmCapability
// 4.3.3 仅实现 ollama adapter；deepseek/openai-compatible → 惰性抛 NO_ADAPTER（诚实失败）
```

## 2. Q3 — executor 是否新增文件？**是：`src/agent/executor.ts`；`runner.ts` 骨架原样保留**

| 理由 | 说明 |
|---|---|
| R-5 保留骨架 | 同步 skeleton 是**测试替身/回归基线**（你已裁决）；异步执行器并行新增 |
| 单一职责 | runner=纯结构复刻（无 LLM）；executor=真实执行（routing+guard+capability+cancel）—— 混在一起会让 4.5 回归对比失去干净参照 |
| 复用不复制 | executor **import** runner 的 `IMPORT_STAGE_SEQUENCE`/`IMPORT_STAGE_INSIGHT_KEYS`（阶段序列单一事实源，回归对比 1:1 成立） |

**依赖方向变化（需明示批准）**：4.2a 时 `agent/` 禁 import `llm/`（当时无 LLM）；4.3.3 起 `agent/executor.ts → ../llm/{routing,localGuard,capability}` 是**设计方向本身**（Executor→Routing→Capability→Adapter）。`runner.ts` 保持零 llm 依赖不变。

## 3. Q4 — cancel 语义：AbortSignal + 阶段边界，无复杂编排

- `executeImport(request, signal?: AbortSignal)`；**每个阶段开始前**检查 `signal.aborted` → 立即返回 `status:'cancelled'` 的 AgentRun（已完成的 turns/toolCalls 保留 —— 可审计）
- 阶段内（模型调用中）取消：signal 透传给 `capability.complete()` → adapter 传给 fetch AbortSignal → 抛出 → 记为该阶段 ToolCall `status:'error'`（code `aborted`）→ 下一边界返回 cancelled
- 契约 `AgentRun.cancel()`：对**已返回**的 run 保持 no-op（终态）；**进行中**取消的唯一机制是外部 signal —— 映射关系写入注释（契约不变）
- 不做：阶段内多点取消、子任务树取消、跨 run 取消

## 4. Q5 — failover 调用约束（Q-R3 的执行器侧落地）

```
decideProviderCandidates(req) → { allowed: ProviderCandidate[]（已过 guard），rejected }
attempt = 0
loop:
  capability = createLlmCapability(allowed[attempt].profile)
  try 阶段执行 …（真实 LLM 调用失败 → 本候选出局）
  失败 → rest = allowed.slice(attempt+1)
         reGuarded = filterFailoverCandidates(rest, { privacy })   ← 每次重新过 guard
         reGuarded.allowed 为空 → run 失败 no-local-provider
         否则 attempt 指向 reGuarded.allowed[0]，继续
```

- **禁止**：失败直接遍历 provider；捕获旗标跳过重验；任何"先试再验"
- 初始 allowed 已过 guard（decide 时），但**重验成本纳秒级**且防御姿态一致 —— 循环内统一走 guard，无例外
- 为支撑此循环，4.3.1 `routing.ts` **增补一个导出**：`decideProviderCandidates(req)`（返回**全部**通过者 + rejected；`decideProvider` 保留为取首个的糖）—— 纯加法，非契约变更

## 5. Q6 — 本阶段是否改 Activity？**否**

- `run.*` evolution 保持 proposal 状态（`bfa703c`），**不改** `ActivityKind/ActivitySourceId`
- executor **不发事件**（同 4.2a 理由）；run 状态在结构化 AgentRun 内
- `+ActivitySourceId 'agent'` 联动裁决留 4.3 收尾（Q-R6）—— 即本阶段完成后的 decision node

## 6. Q7 — 输出

### 6.1 文件影响范围

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `src/llm/capability.ts` | 新增 | LlmCapability 接口 + 工厂 + ollama adapter（fetch，无新依赖） |
| 2 | `src/llm/routing.ts` | 增补 | `decideProviderCandidates` 导出（加法；`decideProvider` 保留） |
| 3 | `src/agent/executor.ts` | 新增 | 异步执行器（failover 纪律 + 阶段边界 cancel + 真实 analyze/scan） |
| 4 | `src/agent/runner.ts` | **零改动** | 骨架/测试替身保留 |
| 5 | `bench/p2433_probe.ts`（仓库外） | 新增 | 冒烟 + 负向注入测试 |

### 6.2 依赖方向

```
agent/executor ──type──> contracts/agentRun
       │ runtime            （agent → llm 方向为本阶段批准的变化）
       ├──> llm/routing · llm/localGuard · llm/capability
llm/capability ──> providerConfig（profile 形状）
llm/* ──X──> store/knowledge/mock/demo/components/react
```

### 6.3 验收标准

| # | 标准 |
|---|---|
| V1 | executor 不含 `ollama/openai/11434/baseURL` 字面量（grep=0）—— runner 不知道 provider |
| V2 | executor 内存在 `filterFailoverCandidates` 调用（grep 断言）；失败遍历绕过 guard = 0 |
| V3 | `getLlmClient` 在 agent/ 与 capability.ts 中均**不出现** |
| V4 | tsc 48 不增 · oxlint 预检 0 · cycles=0 · contracts 零改动 |
| V5 | 冒烟：1 次真实 run（本地 qwen3:8b）→ analyze/scan ToolCall 为真实调用（含 usage.ms），relate/done 仍 planned |
| V6 | 负向：注入 `kind:'ollama'+云URL` → 决策 no-provider → run 失败 `no-local-provider`（测完即删） |
| V7 | cancel：阶段边界 + 调用中两种取消均 → `status:'cancelled'` |
| V8 | runner.ts / sequencer / contracts diff = 0 |

### 6.4 明确不做

Proposal/Applier（4.4）· UI 投影（4.2b）· ActivityKind 扩展 · routing 决策进 Proposal（Q-C 演进）· 云端 profile 配置 · `'any'` 隐私实航 · 重试策略/遥测/超时调优（仅 AbortSignal 透传）· 流式输出 · 新依赖 · runner 改动

## 7. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | ollama `/api/chat` 响应字段与假设不符 | 4.3.3 实施第一步 = 单次 curl 冒烟核实响应形状，再写 adapter |
| R2 | 首次真实调用延迟（8B decode 4.7→5.7 tok/s，抽取消耗数百输出 token ⇒ 分钟级） | 冒烟用**极小 prompt**（非完整抽取 prompt）；完整抽取压力验证留 4.4 后 |
| R3 | failover 循环引入意外多候选 | 本地-only 下默认链仅 1 候选 —— 循环实际单飞；多候选能力就绪但不上云 |
| R4 | capability 工厂被绕过直接构造 adapter | 工厂不导出 adapter 构造器；adapter 内部化 |

## 8. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `07d9246`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 146 ?? / **0 D** |
| contracts / package / lockfile | 未触碰 |
| 服务 | Ollama 11434 常驻（未调用）、LightRAG 9621 停 |

---

**状态**：🟡 停在 **P2-4.3.3 Mini Plan Review Node**，未编码，等待批准（尤其 Q1 结论、agent→llm 依赖方向、`decideProviderCandidates` 增补、V5-V7 验收口径）。
