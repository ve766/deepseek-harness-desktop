# STAGE14 P2-4.3 Mini Plan — Routing + Local-only Guard + 真实执行入口

> 阶段：**P2-4.3 设计评审（design-only）**。按裁决拆三个子步，**4.3.1/4.3.2 为纯决策层（不连模型），4.3.3 才接真实执行入口**。
> 前置裁决：Q-C（routing 决策进 Proposal 须走契约演进，本阶段不改契约）、Q-D（local-only 校验 kind+endpoint+network target）、R-6、R-7。
> **禁止**：LangGraph · 多 Agent · Handoff · 云 provider 实装（本阶段 routing 只**决策**，云端 profile 在 local-only 下被过滤；`'any'` 隐私模式留 4.4 后）· 拆 Agent Core · 新依赖。

---

## 0. 为什么分三步

| 子步 | 产出 | 可独立验收？ |
|---|---|---|
| **4.3.1** | `src/llm/routing.ts`：`TaskRequirement → ProviderCandidate → ProviderDecision`（纯函数决策） | ✅ 无 I/O，单测级 |
| **4.3.2** | local-only guard：`isLocalEndpoint()` + 决策前置过滤 + failover 过滤 | ✅ 纯函数 + 安全断言 |
| **4.3.3** | AgentRun 真实执行入口：异步执行器 + `getLlmClient()`（F4）+ cancel 阶段边界响应 | ✅ 冒烟（1 run） |

顺序不可换：**先有正确的决策与红线，才有资格连模型** —— 否则等于先联网再加锁。

---

## 1. 现状证据（实测）

| 项 | 位置 | 事实 |
|---|---|---|
| Profile 形状 | `providerConfig.ts:36` | `{ providerKind, providerRoute?, credentialRef?（名非值）, baseURL?, model?, displayName? }` —— **baseURL 可被 profile 覆写** ⇒ kind 自称不可信的根源 |
| 候选链 | `resolveLlmProviderChain():224` | 四层优先级解析（显式 profile → build env → globalThis → 默认） |
| Failover | `FAILOVER_ELIGIBLE_CODES:259` | `NO_ADAPTER/TRANSPORT/TIMEOUT/SERVER/QUOTA` |
| 凭据探测 | `isCredentialPresent:238` | 只探测存在性 |
| LLM 出口 | `llmContext.ts:442 getLlmClient()` | F4 唯一出口；`LlmClient` 接口已定义 |
| 需求侧 | `contracts/agentRun.ts:35` | `RouteNeeds{structuredJson?,longContext?,costTier?,latencyTier?}` + `Privacy('local-only'\|'any')` —— **契约已备好输入，routing 无需改契约** |
| 骨架现状 | `src/agent/runner.ts` | 同步、无 LLM；`cancel()` 为 no-op，等待 4.3.3 异步化 |

**关键安全事实**：`LlmProviderProfile.baseURL` 是**自由覆写字段** —— `providerKind:'ollama'` + `baseURL:'https://api.xxx.com'` 在现有类型下**完全合法**。这就是 Q-D 裁决"配置声明不是事实"的类型层证据。

---

## 2. 4.3.1 — `src/llm/routing.ts`（纯决策）

### 数据流

```
AgentRunRequest { taskKind, needs?, privacy? }
        ↓  TaskRequirement（归一化：taskKind → 默认需求 + needs 覆盖）
ProviderCandidate[]（resolveLlmProviderChain() 展开 + 本地性标注）
        ↓  过滤（privacy → 能力 → 凭据存在性）+ 排序（costTier/latencyTier）
ProviderDecision
```

### 类型（runtime 层，非契约；**不进 contracts/**）

```ts
// src/llm/routing.ts
export interface TaskRequirement { taskKind: TaskKind; needs: RouteNeeds; privacy: Privacy }
export interface ProviderCandidate { profile: LlmProviderProfile; local: boolean; credentialReady: boolean; reason: string }
export interface ProviderDecision {
  readonly chosen?: LlmProviderProfile
  readonly rejected: readonly { profile; code: 'privacy-local-only'|'capability'|'no-credential'; reason: string }[]
  readonly decision: 'routed' | 'no-provider'
}
export function decideProvider(req: TaskRequirement): ProviderDecision
```

### 决策规则（优先级不可换）

1. **privacy='local-only' → 候选集里只留本地**（见 §3 判定），云端 profile 进入 `rejected` 并带 `privacy-local-only` 码 —— **先过滤后选择，不是"选中后拒绝"**
2. **能力匹配**：`needs.structuredJson` / `longContext` 为硬约束
3. **凭据存在性**：`credentialRef` 有而 `isCredentialPresent` 为假 → 剔除（`no-credential`）
4. **成本/延迟档**：偏好排序（`costTier`/`latencyTier`）
5. **failover 兜底**：`decision='no-provider'` 时**不自动换云**（见 §3）

**单 provider 现实**：当前全本地默认链只有 ollama/qwen3:8b ⇒ 4.3.1 的可观察行为是「决策确定 + rejected 记录完整」。**云端 profile 本阶段不配置** —— routing 的多候选能力就绪但不上云（禁止项）。

**落点纪律**：`src/llm/routing.ts` import 仅 `providerConfig`（同层）+ `contracts/agentRun`（type）+ `../types`。**不 import** `agent/` `store` `knowledge` `mock` `demo` `react`。

**当前模型映射（来自 P1 实测，非猜测）**：extract → `qwen3:8b`（P1-4A 证 4b 违反输出契约）；classify/简单 plan → `qwen3:4b` 候选（**需单独验证，不默认启用** —— 4.3.1 只把它列为候选，不启用）。

---

## 3. 4.3.2 — local-only guard（三层，缺一不可）

### 层 ①：决策前过滤（4.3.1 内实现）

### 层 ②：failover 过滤

failover 候选必须**重新过 guard**，而非沿用初始决策 —— 否则"本地失败 → 自动漂到云"直接击穿红线。实现为 `filterFailoverCandidates(candidates, privacy)`。

### 层 ③：**`isLocalEndpoint()` —— 本题核心**

```ts
// 判定"本地"不看 providerKind，只看网络事实：
export function isLocalEndpoint(baseURL: string | undefined): boolean
```

- 解析 `baseURL`（无则用该 kind 的默认端点）为 `URL`，取 `hostname`
- 本地 = `localhost` | `127.0.0.1` | `::1` | `::ffff:127.0.0.1`（**白名单制**，不是"非 https 即本地"）
- 解析失败 / 非白名单 → **非本地**
- **kind 与 endpoint 双重校验**：`providerKind !== 'ollama'` → 非本地（deepseek/openai-compatible 天然云端）；`kind === 'ollama'` 但 endpoint 非回环 → **仍非本地**（Q-D 核心案例）
- 攻击面说明：`https://ollama.local.example.com` 这类"伪装域名"被白名单排除；`http://127.0.0.1.evil.com` 被 hostname **精确匹配**排除（只比较 hostname 本身，不做后缀/子串判断）

### 层 ③'（纵深）：Applier 二次校验

需要 routing 决策随 Proposal 传递 —— **属 `knowledgeWrite.ts` 契约演进，按 Q-C 裁决独立步骤**，本阶段**不改契约**。落点：4.4 实现时把 `ProviderDecision` 快照随 run 上下文传递（先在 runtime 层持有，进 Proposal 待演进）。

**失败语义**：`local-only` 且决策为 `no-provider` → run **立即失败**（`error.code='no-local-provider'`），**不降级、不重试云端、不静默**。

---

## 4. 4.3.3 — 真实执行入口（runner 异步化）

### 改动（**扩展** `src/agent/runner.ts`，不重写 4.2a 骨架）

| 项 | 4.2a（现） | 4.3.3（后） |
|---|---|---|
| 执行 | 同步，无 LLM | **异步**：`runImport(request): Promise<AgentRun>` |
| cancel | no-op | **阶段边界响应**：每阶段前检查 cancel flag |
| LLM | 无 | **仅 analyze/scan 阶段**经 `getLlmClient()`（F4）调用；调用前先 `decideProvider()` |
| relate/done | planned ToolCall | **仍为 planned**（Proposal 在 4.4 —— 本阶段不写 store） |
| 事件 | 无 | 仍无（run.* evolution 未批准，**不改 ActivityKind**） |
| 骨架语义 | `simulated: true` | analyze/scan 的 ToolCall 变**真实调用记录**；relate/done 保持 planned |

**llmContext 兼容性风险（需 4.3.3 实施前确认）**：`getLlmClient()` 返回的 `LlmClient` 面向**节点研究流**（`LlmResearchRequest/LlmStreamChunk`）—— 抽取式调用（输入 chunk、输出结构化实体/关系）是否能用现有 client 方法表达，需在 4.3.3 实施第一步核实；若不能，**只扩展 `src/llm/` 的调用封装，不改五方法契约、不改 `llmContext` 对外接口**。

### 验收（4.3.3）

1. 冒烟：1 次真实 run → `analyze/scan` 两个 ToolCall 为真实调用（记录 `usage`），relate/done 仍 planned
2. local-only 违规注入测试：临时 profile `kind:'ollama'` + `baseURL:'https://api.example.com'` → 决策 `no-provider` + run 失败 `no-local-provider`（**负向测试**，测完即删）
3. cancel：run 进行中调 `cancel()` → 下阶段边界停止，`RunStatus='cancelled'`
4. tsc 48 不增 · oxlint 预检过 · contracts 零改动 · 无新依赖

---

## 5. P2-4.3 范围冻结

**做**：routing 纯决策 · local-only guard 三层 · runner 异步化 + 真实 LLM 入口（仅 analyze/scan）· 负向安全测试

**不做**：云端 profile 配置 · `'any'` 隐私实航 · Proposal/Applier（4.4）· ActivityKind 扩展（evolution 独立评审）· routing 决策进 Proposal（Q-C：独立演进）· UI 投影（4.2b，等 evolution）· 重试策略/遥测（runtime 层后续）· 新依赖

---

## 6. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | hostname 白名单遗漏合法本地形态（如 `[::1]:11434`） | 用 WHATWG URL 解析 + 显式集合；负向测试覆盖伪装域名 |
| R2 | `getLlmClient()` 与抽取式调用不匹配 | 4.3.3 第一步 = 接口核实；只加封装不改契约 |
| R3 | routing 决策被误当审计记录 | `ProviderDecision` 留在 runtime；进 Proposal 须走 Q-C 演进 |
| R4 | 异步化破坏 4.2a 回归对比 | `runImportSkeleton`（同步版）**保留**，异步版并行新增，对比后决定替换 |
| R5 | 范围膨胀（重试/遥测/多候选实航） | 冻结在 §5 |

## 7. 待裁决

| # | 问题 | 建议 |
|---|---|---|
| **Q-R1** | 三子步顺序与范围是否照 §0 执行？ | 建议是 |
| **Q-R2** | `isLocalEndpoint` 采用**白名单精确 hostname 匹配**？ | 建议是（Q-D 核心） |
| **Q-R3** | failover 候选**重新过 guard**？ | 建议是（否则红线可被 failover 击穿） |
| **Q-R4** | 本地-only 无 provider → run 失败 `no-local-provider`，不降级？ | 建议是 |
| **Q-R5** | 4.2a 同步骨架**保留**，异步执行器并行新增？ | 建议是（保护回归基线） |
| **Q-R6** | `run.*` evolution 与 `ActivitySourceId` 扩展的联动裁决（`'agent'` 字面量）何时批？ | 建议 4.3 收尾时随 evolution 一起 |
| **Q-R7** | 本 Mini Plan 是否提交？ | 建议提交（单文件） |

## 8. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `5641a36`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 144 ?? / **0 D** |
| contracts / package / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

---

**状态**：🟡 停在 **P2-4.3 Mini Plan Review Node**，未编码，等待 Q-R1 ~ Q-R7 裁决。
