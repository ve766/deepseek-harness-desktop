# STAGE14 P2-4.5 Implementation Review — Agent Core Stabilization + Composition Root

> 阶段：**P2-4.5 实现完成，停在 Review Node**。
> 范围：`src/agent/runSpec.ts`（新）· `src/agent/{runner,executor}.ts`（收敛）· `src/workflow/runOutcome.ts`（新，组合根）。
> 目标链：**Run → Turn → ToolCall → Proposal → Review → Apply → Receipt**。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 | 说明 |
|---|---|---|---|---|
| 1 | `src/agent/runSpec.ts` | **新增** | 300 | 唯一阶段规格源 + 唯一身份源（`STAGE_SPECS` / `nextRunId` / `toolCallId` / planned tool-call 工厂 / `createRunRecorder` / `plannedProposalOpCount`） |
| 2 | `src/agent/executor.ts` | 收敛 | 253 → **194** | 纯生命周期驱动：failover、cancel/AbortSignal、routing→guard→capability、run 推进 |
| 3 | `src/agent/runner.ts` | 收敛 | 197 → **77** | 薄驱动，保持 Q-R5 的确定性 test double |
| 4 | `src/workflow/runOutcome.ts` | **新增** | 279 | 唯一组合根：`finalizeRun` / `applyOutcome` / receipt ledger |

**`contracts/` · store · UI · permission · plugin runtime 零改动。**

## 2. Step 1 — 收敛修复的四个结构缺陷

| # | 缺陷（收敛前） | 修复 | 探针 |
|---|---|---|---|
| **F-A** | runner 与 executor **各自**持有 `let runCounter = 0` ⇒ 两个入口都能产出 `run-1` | 统一 `run-${base36 ms}-${counter}`（单一模块级计数器） | A2/A3 |
| **F-B** | toolCall id 规则两处不一致（`tc-${runCounter+1}-${n}` vs `tc-${n}`）；builder 由 `tc.id` 派生 op id（`proposed-node-${tc.id}`）⇒ **幂等键随入口漂移** | 统一 `tc-${runId}-a${attempt}-${stage}-${n}`（attempt+stage 作用域内编号） | A4/A5/A6/A7、D7 |
| **F-C** | 阶段序列 / insight keys / planned tool calls / terminal 构造在 runner 与 executor 各写一份 | 全部收进 `runSpec`，两个入口只保留"阶段如何执行" | E1/E2/E3 |
| **D8** | `plannedProposalOps` 硬编码 `3`（executor）；runner 用另一套过滤计数 | 由 `plannedProposalOpCount(toolCalls)` 派生 ⇒ **2**（`createCluster` 被冻结映射 skip，故 3 本就错误） | B4/B5/D3/D4 |

**行为等价**：两个入口的**阶段序列、insight keys、planned tool-call 集合**逐位一致（E1/E2/E3），唯一差异是"是否发生真实模型调用"（E5）。failover 语义、cancel 边界、routing/guard/capability 分层全部保留。

## 3. Step 2 — 组合根与依赖拓扑

```
workflow  ──▶ agent（contracts）
          └─▶ knowledge/write（runtime）        [唯一允许的双向知晓点]
executor  ──▶ knowledge/write                  ❌ 禁止（grep clean）
executor  ──▶ workflow                         ❌ 禁止（grep clean）
knowledge/write ──▶ agent                      ❌ 禁止（grep clean）
```

| 导出 | 职责 | 硬约束 |
|---|---|---|
| `finalizeRun(run)` | `buildKnowledgeWriteProposal` → `validateProposal` → lifecycle 投影 | **签名不含 adapter ⇒ 结构上无法 mutation**；实测 0 次 adapter 调用（B1） |
| `applyOutcome(run, review, adapter)` | 构造 `ApplyRequest` → 显式调用 Applier → receipt → 回填 `run.proposals` | 唯一触达 store 的路径；**无任何自动触发**；review **原样透传**（准入权归 Applier） |
| `listReceipts` / `findReceipt` / `clearReceipts` | 进程内 ledger（`seq` 单调） | 最小面（裁决 D2：**不加** summarize projection） |

### Lifecycle 投影（D7）

| lifecycle | 条件 | 含义 |
|---|---|---|
| `awaiting_approval` | run completed + 有 ops + review `needs_approval` | **状态**，不是审批系统：seam 只报告，谁批准未定义 |
| `nothing_to_apply` | 无可映射 op | 无需决策 |
| `rejected` | 结构校验失败 | proposal 存在但不合法 |
| `not_applicable` | run 未完成（failed/cancelled） | **不咨询 Applier**，adapter 零调用（C8） |

### Receipt 语义

`applied` / `partially_applied` / `rejected` / `not_applicable`；`applied + failed` 与 op 数一致；`undoToken` 透传（快照载体，**无 restore**）。Applier 实例按 adapter 用 `WeakMap` 缓存——否则每次调用重建会丢掉 Applier 的进程内快照 Map（P2-4.4.3 D2）。

**不可变性**：`run.proposals` 是契约中的 `readonly` 字段 ⇒ 回填返回**新 run 对象**，输入 run 永不被改写（B10 实测原 run 仍为空）。

## 4. 探针实证

| 探针 | 结果 | 覆盖 |
|---|---|---|
| `bench/p2451_probe.mts`（Step 1） | **36/36 PASS** | A 身份 7 · B skeleton 形状 10 · C 生命周期 6 · **D 真实 Ollama 端到端 8** · E 行为等价 5 |
| `bench/p2452_probe.mts`（Step 2） | **40/40 PASS** | A finalize 纯投影 9 · B 全链+回填 14 · C 防伪/auto_apply 9 · **D 真实 Ollama 全链 8** |

**真实链实测**：`executeImport` → `completed`（2 次真实模型调用，`simulated:false`）→ `finalizeRun` → `awaiting_approval`（2 ops，target id 内嵌 runId）→ `applyOutcome` → **1 applied（node）+ 1 `import_rule`（relation）** → `partially_applied` → `run.proposals` 回填 → ledger seq 记录。

## 5. 纯净度 / 依赖 / 基线

| 项 | 结果 |
|---|---|
| executor 是否 import knowledge/write 或 workflow | **0**（grep） |
| knowledge/write 是否 import agent | **0**（grep） |
| workflow 是否 mutation（finalize 路径） | **0**（B1：0 次 adapter 调用） |
| `auto_apply` 产出 | **0**。C4：作为**值**零出现（无 decision 字段、无该 status/code）；C5：仅作为**被拒输入名**出现在拒绝理由中（审计证据） |
| `src/agent` · `src/workflow` 的 llm/store/mock 违规引用 | **0**（executor 经 capability 抽象，不见 provider kind/model/endpoint） |
| tsc | **48 = 基线**（过程中 1 处 `AgentId` 误从 `contracts/agentRun` 导入，已改为 `../types`） |
| contracts diff | **空** |

## 6. 风险与已知边界

| # | 项 | 说明 |
|---|---|---|
| R1 | 全链**常态为 `partially_applied`** | skeleton/executor 的 `createEdge` 占位载荷缺 `from`/`to`/`kind` ⇒ 被 Import Rule 合法拒绝。裁决 D3：**不作为本阶段任务**，记录为已知边界 |
| R2 | ledger 不持久化 | 进程内；跨进程重复 apply 未防护（延续 P2-4.4.3 R3） |
| R3 | `awaiting_approval` 无审批主体 | 权限系统为明确禁项；本阶段只定义状态 |
| R4 | store 未接线 | `applyOutcome` 的 adapter 仍是 in-memory 替身；接真 store 前不得声称端到端可写 |
| R5 | 预取消信号仍先走完 routing | 取消边界在阶段循环（P2-4.3.3 原有行为，本阶段仅收敛未改）；微优化留待后续 |
| R6 | 组合根是新的双向知晓点 | 由 grep 断言守护；未来新增层必须沿用同一规则（仅 workflow 可双向） |

## 7. 禁项核验

❌ contracts 改动 · ❌ store 接线 · ❌ UI · ❌ 权限系统 · ❌ Plugin runtime · ❌ ActivityBus `run.*` migration · ❌ executor 直调 Applier · ❌ executor 自建 Proposal · ❌ 自动 apply / `auto_apply` · ❌ undo restore · ❌ sequencer 删除 —— 全部未触碰。

---

**状态**：🟡 停在 **P2-4.5 Review Node**。提交纪律：① Step 1 实现 ② Step 2 实现 ③ 本文档（审计），**实现/审计分离**。
