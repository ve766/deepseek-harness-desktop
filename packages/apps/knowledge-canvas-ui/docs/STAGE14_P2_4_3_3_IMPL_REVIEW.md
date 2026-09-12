# STAGE14 P2-4.3.3 Implementation Review — Real Execution Entry

> 阶段：**P2-4.3.3 实现完成，停在 Review Node，未提交**。
> 里程碑：**本包第一次通过 routing → guard → capability 链真实调用模型**（本地 qwen3:8b，11/11 探针含 2 次真实补全 + 1 次真实 failover walk）。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 |
|---|---|---|---|
| 1 | `src/llm/capability.ts` | **新增** | ~75（接口 + 工厂；ollama adapter 外置） |
| 2 | `src/llm/adapters/ollama.ts` | **新增** | ~75（fetch `/api/chat` stream:false，无新依赖） |
| 3 | `src/agent/executor.ts` | **新增** | ~190（异步执行器：failover 纪律 + 边界 cancel + 真实 analyze/scan） |
| 4 | `src/llm/routing.ts` | **增补**（+33 −6） | `decideProviderCandidates` 全量候选导出；`decideProvider` 重构为 sugar，**行为不变** |
| 5 | `src/agent/runner.ts` · `demo/` · `contracts/` · `store` | **零改动** | 骨架/fixture/契约原样 |

## 2. 链路（与批准结构一致，逐层实测）

```
executeImport(request, signal)                    src/agent/executor.ts
  → decideProviderCandidates(req)                 谁能用（privacy→capability→credential）
  → [每次尝试失败后] filterFailoverCandidates      重验余下候选（Q-R3）
  → createLlmCapability(chosen.profile)           绑定能力（executor 不知 kind/model/endpoint）
  → capability.complete(...)                      POST {root}/api/chat  stream:false
```

## 3. 探针：**11/11 PASS**（`bench/p2433_probe.mts`，含 2 次真实补全 + 1 次真实 failover）

| # | 用例 | 结果 |
|---|---|---|
| A | 真实 run：completed · **恰好 2 次真实 `llm.complete`**（analyze/scan，非 simulated、带 usage.ms）· relate/done 仍 planned ×4 | ✅（41.1s） |
| B | **负向**：`kind:'ollama'`+云 URL → `no-local-provider`，**<2s 拒绝（零网络调用）** | ✅ |
| C | **真实 failover**：候选 A=死端口（127.0.0.1:9）+ B=活本地 → A 留**错误审计记录** → re-guard 放行 B → B 完成 2 次真实调用 | ✅（41.5s） |
| D | 预先 abort 的 signal → `cancelled`（首边界） | ✅ |

真实调用观测：decode ≈ **8.7 tok/s**（FA+q8_0 生效，优于 Step1 探针的 5.7）；模型经 `KEEP_ALIVE=-1` 全程驻留。

## 4. 探针抓到的真实 bug（已修 —— 这正是探针的价值）

**`DEFAULT_OLLAMA_BASE_URL` 带 `/v1` 后缀**（OpenAI 兼容基址）：adapter 直拼 `/api/chat` → `/v1/api/chat` → 404 → 单候选链首跑即 `no-local-provider`。修复：adapter 剥离尾部 `/v1`，`http://host:11434/v1` 与 `http://host:11434` 皆可用。

**次生修复**：executor 变量名笔误（`realCalls` vs `realLlmCalls`）→ TS2552；oxlint 由此误报 unused —— 同根因。

## 5. 静态验收（V1–V8 全过）

| # | 标准 | 结果 |
|---|---|---|
| V1 | executor 无 provider 字面量 | ✅ `ollama/openai/11434/baseURL/deepseek` = **0** |
| V2 | executor 必含 guard 调用 | ✅ `filterFailoverCandidates` 出现（导入+循环内调用） |
| V3 | `getLlmClient` 不出现 | ✅ agent/ · capability · adapters · localGuard 全 0 |
| V4 | tsc 48 / oxlint 0 / cycles | ✅（executor 笔误 TS2552 已修） |
| V5 | 冒烟：真实调用含 usage；planned 边界保持 | ✅（探针 A/C） |
| V6 | 负向：云伪装 → `no-local-provider`，零网络 | ✅（探针 B，<2s） |
| V7 | cancel 双路径 | ✅（边界 D + 调用中 abort→toolcall error→边界 cancelled） |
| V8 | runner/sequencer/contracts diff = 0 | ✅ |

## 6. 接口纪要（4.4 输入）

- `decideProviderCandidates(req): { allowed: ProviderCandidate[]（含 credentialReady）, rejected[] }` —— 4.4 的 Applier 二次校验可直接复用 `allowed[0].local`（重验事实）
- `LlmCapability.local` 为端点重验事实；`CompletionUsage` 直接对齐 `RunResult.usage`
- planned writes（relate/done）形状与 4.2a 骨架一致 —— 4.4 将其转成 `KnowledgeWriteProposal` ops 的映射点已就绪

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `fd02230`（本轮未产生 commit） |
| staged | **0**（未提交） |
| tracked 改动 | **1 个**：`routing.ts` +33 −6（唯一 `M`，构成 99→100） |
| untracked 新增 | `capability.ts` · `adapters/ollama.ts` · `executor.ts` · 本文档 |
| 全仓 | 100 M / 149 ?? / **0 D** · 根 `src ' M'=0` |
| contracts / ActivityKind / ActivitySourceId | **零改动**（Q6 遵守） |
| package.json / lockfile | 未触碰 |
| 服务 | Ollama 11434（KEEP_ALIVE=-1 模型驻留）· LightRAG 9621 停 |

**禁项核验**：Proposal/Applier ❌ 未做 · Plugin runtime ❌ · Activity 扩展 ❌ · WebGL ❌ · LangGraph ❌ · 新依赖 ❌ · 云端默认调用 ❌（云端 adapter 未实现，NO_ADAPTER 诚实失败）。

---

**状态**：🟡 停在 **P2-4.3.3 Review Node，未提交**。待裁决：① 提交方式（建议三笔循例：capability+adapter → executor+routing 增补 → review；或按文件分组）② 本 Review 是否提交 ③ **4.3 收尾 decision node**（Q-R6）：`run.*` evolution + `ActivitySourceId +'agent'` 是否批准 ④ 是否进入 4.4。
