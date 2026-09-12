# STAGE14 P2-4.3.1 Implementation Review — Routing Decision Layer

> 阶段：**P2-4.3.1 实现完成，停在 Review Node，未提交**。
> 范围：`src/llm/routing.ts` —— 纯决策层（`TaskRequirement → ProviderCandidate → ProviderDecision`），无 I/O、无模型调用、无事件。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 |
|---|---|---|---|
| 1 | `src/llm/routing.ts` | **新增** | ~140 |

**`contracts/` · `providerConfig.ts` · `agent/` · `activity/` · `demo/` · `store` 全部零改动。**

## 2. 导出 API

| 导出 | 说明 |
|---|---|
| `TaskRequirement` | `{ taskKind, needs: RouteNeeds, privacy: Privacy }` —— 输入归一化（契约类型直用，**契约零改动**） |
| `ProviderCandidate` | `{ profile, local, credentialReady }` —— `local` 为**端点验证结果**，非 kind 自称 |
| `ProviderDecision` | `{ chosen?, rejected[], decision: 'routed'\|'no-provider' }` |
| `isLocalEndpoint(profile)` | URL parser → hostname normalize → **exact match**；kind 先行门控 |
| `decideProvider(req)` | 纯函数决策（同输入同输出） |

**与 Mini Plan 的一处偏差（如实报告）**：`isLocalEndpoint` 签名从 `(baseURL: string|undefined)` 改为 `(profile)` —— kind 门控（deepseek/openai-compatible 天然云端）与 kind 默认端点解析（ollama 无 baseURL → 代码内常量 localhost）必须与解析同处发生，拆开反而制造"半校验"状态。

## 3. 决策规则实现（顺序不可换）

1. **privacy 先过滤**（`privacy-local-only` 拒绝码）—— 候选"不存在"而非"选中后拒绝"
2. **capability**：仅基于 **P1-4A 实测证据**（qwen3:4b 违反抽取输出契约）→ model 级检查，不发明元数据
3. **credential**：`credentialRef` 有名而缺失 → `no-credential`
4. cost/latency 档：仅排序幸存者，保持链的既有优先级（未发明新元数据）
5. `no-provider` → **run 失败，human decides**（Q-R4；无降级、无重试别处）

## 4. 功能探针（仓库外 `bench/p2431_probe.ts`，tsx 直跑）—— **11/11 PASS**

| # | 用例 | 结果 |
|---|---|---|
| 1 | 零配置默认链 + local-only → routed（ollama / qwen3:8b） | ✅ |
| 2 | **负向**：`kind:'ollama'` + `baseURL:'https://api.example.com'` → **no-provider** + `privacy-local-only` | ✅（Q-D 核心案例） |
| 3 | `privacy:'any'` → 同一 profile 放行（guard 按 privacy 作用域生效） | ✅ |
| 4 | hostname 陷阱 ×4：`127.0.0.1.evil.com` ❌ 非本地 · `[::1]` ✅ · 大小写不敏感 ✅ · 不可解析 ❌ 非本地 | ✅ ×4 |
| 5 | ollama 无 baseURL → 默认本地 | ✅ |
| 6 | **capability**：qwen3:4b + extract → 拒绝；+ classify → 放行（4b 保持 Agent 候选） | ✅ ×2 |
| 7 | **credential**：有名缺失 → `no-credential` | ✅ |

**探针自身的一个缺陷（已修，非 routing 缺陷）**：`setLlmProviderProfile` 是 Partial 合并 —— Case 2 注入的云 URL 残留在后续用例中，导致 3 个用例先被 privacy 层拒绝（**行为正确**）。修正：后续用例显式重置 `baseURL`。**教训：跨用例的全局状态污染会让"正确的拒绝"掩盖被测路径** —— 已记入记忆。

## 5. 静态验收

| # | 标准 | 结果 |
|---|---|---|
| 1 | tsc 基线不增 | ✅ **48 = 基线**；`routing.ts` 错误 NONE；改动行 0 |
| 2 | oxlint 预检 | ✅ **0 errors**（4.1 教训流程化） |
| 3 | 依赖方向 | ✅ 仅 `./providerConfig`（同层 runtime）+ `../contracts/agentRun`（type）；**无** store/knowledge/mock/demo/components/react/agent |
| 4 | 纯决策无 I/O | ✅ 无 fetch/事件/LLM 调用；cycles 不受影响（新叶节点） |
| 5 | contracts 零改动 | ✅ git status 干净 |
| 6 | package/lockfile | ✅ 未触碰 |
| 7 | 白名单精确匹配（Q-R2） | ✅ 无 `includes/startsWith`；URL parser + normalize + Set 精确匹配；大小写不敏感；IPv6 括号剥离 |

## 6. 风险与边界

| # | 项 | 说明 |
|---|---|---|
| R1 | 云端 profile 本阶段未配置 | routing 多候选能力就绪，但 `'any'` 隐私下也**只有测试注入**过云 profile —— 多候选实航留 4.4 后 |
| R2 | capability 证据仅 1 条 | 只有 qwen3:4b+extract 有实测依据；其余组合不发明元数据（capabilityRejection 返回 null） |
| R3 | failover 重过 guard 未实现 | **属 4.3.2**（`filterFailoverCandidates`）；当前 runner 无 failover 循环，故暂无暴露面 —— 4.3.3 引入调用循环时必须先落地 |
| R4 | 决策不进 Proposal | Q-C 裁决：`ProviderDecision` 留 runtime 层，契约演进独立步骤 |

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `b8fe8cd`（本轮未产生 commit） |
| staged | **0**（未提交） |
| 新增 | `src/llm/routing.ts`（未跟踪）+ 本文档；探针在仓库外 `bench/` |
| 全仓 | 99 M / 145 ?? / **0 D** · 根 `src ' M'=0` |
| contracts / package / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停）· 未调用任何模型 |

**禁项核验**：Plugin runtime ❌ 未做 · WebGL/Renderer ❌ · LangGraph ❌ · Agent Core 拆包 ❌ · 云端默认调用 ❌（零配置默认仍全本地）· 新依赖 ❌。

---

**状态**：🟡 停在 **P2-4.3.1 Review Node，未提交**。待裁决：① 是否提交 `src/llm/routing.ts`（单文件）② 本 Review 是否提交 ③ 是否进入 **4.3.2**（guard 固化：`filterFailoverCandidates` + 负向测试扩充）。
