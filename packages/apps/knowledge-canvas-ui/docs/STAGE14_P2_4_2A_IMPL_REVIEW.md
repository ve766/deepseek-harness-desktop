# STAGE14 P2-4.2a Implementation Review — AgentRun Skeleton

> 阶段：**P2-4.2a 实现完成，停在 Review Node，未提交**。
> 范围：import 任务的 AgentRun 骨架 —— 无 LLM、无 store 写、无 UI 依赖、无事件发射（Q-G1 选项 C）。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 |
|---|---|---|---|
| 1 | `src/agent/runner.ts` | **新增** | ~160 |
| 2 | `docs/STAGE14_ACTIVITY_RUN_EVOLUTION_PROPOSAL.md` | **新增**（Q-G5，design-only） | ~90 |

**`demo/sequencer.ts` 零改动**（裁决 3：保留，降级为 event replay fixture）。

## 2. 导出 API

| 导出 | 说明 |
|---|---|
| `IMPORT_STAGE_SEQUENCE` | 六阶段常量（与 sequencer 1:1：import→analyze→scan→relate→map→done） |
| `IMPORT_STAGE_INSIGHT_KEYS` | 各阶段 insight key（数据 key，非文案 —— 渲染留 UI） |
| `runImportSkeleton(request): AgentRun` | 同步执行；`taskKind !== 'extract'` → 诚实失败（`unsupported-task-kind`） |

**Run 结构**：1 个 system turn（任务简报）+ 6 个 assistant turn（每阶段，带 insightKey）。

**relate 阶段**（sequencer 在此写 store）→ 3 条 **planned** ToolCall：
`knowledge.createNode` / `knowledge.createEdge`（nearest-2 策略，需 store 读 → 明示 deferred to Proposal stage）/ `knowledge.createCluster` —— 全部 `result: { simulated: true }`。

**done 阶段** → `knowledge.deriveClusters`：`ruling: 'derived operation (Q-G4): never a proposal itself'`。

**Result**：`status:'completed'`，`output.plannedProposalOps = 3`，`usage.ms` 实测；`proposals: []`（id 随 4.4 到来）。

## 3. 裁决落实

| 裁决 | 落实 |
|---|---|
| 4.2a 禁真实 LLM | ✅ 无 `callModel/streamTokens/provider/getLlmClient`（grep = 0）；连 `llm/` 都不 import |
| 4.2a 禁直写 store | ✅ 无 `store.` / `setAiState` / `setAiStage` / `setNodes` / `addEdge`（grep = 0）；写入只以 planned ToolCall 形式**计划** |
| 允许 `emitActivity()` | ⚠️ **未使用** —— 按 Q-G1 选项 C，`run.*` 不在冻结 ActivityKind 内，骨架**不发事件**（发了就得用错误语义的 kind 或偷改契约）。事件外显等 evolution 批准后接线（提案已备好，见 Q-G5 文档） |
| sequencer 不删 | ✅ 零改动 |
| Q-G3 | ✅ `updateNodePosition` 不出现在任何 planned op |
| Q-G4 | ✅ `autoClusterIfNeeded` 语义 = `knowledge.deriveClusters` 记录，产品走 `addCluster` proposal |
| Q-G1 | ✅ Run 状态在结构化 `AgentRun` 内（`status/turns/toolCalls/result`），ActivityKind 未扩 |

## 4. 验收结果

| # | 标准 | 结果 |
|---|---|---|
| 1 | runner 不 import components/i18n/store/react | ✅ 全部 `import type`，仅 `../contracts/agentRun`（**无任何运行时 import**，无 react） |
| 2 | 满足契约、无 `as any` | ✅（途中 tsc 抓到缺 `cancel()` —— 契约的协作式取消成员；骨架同步已终态，cancel 为注释化 no-op，真实异步执行器 4.3 在阶段边界响应） |
| 3 | 六阶段与 `runImportDemo` 一致 | ✅ 序列与 insight key 1:1（回归对比表见 §5） |
| 4 | `contracts/` 零改动 | ✅ git status 干净 |
| 5 | tsc 48 不增 + oxlint 通过 | ✅ **48 = 基线**、`agent/` 内 0、改动行 0；oxlint 预检 **0 errors**（4.1 教训已吸收：提交前主动预检） |
| 6 | bus 创建仍唯一 | ✅ runner 无第二个 bus、无 emit 调用 |
| 7 | `demo/sequencer.ts` 零改动 | ✅ |
| — | 依赖方向 | ✅ `agent → contracts`（type only）；cycles = 0 |

## 5. 回归对比表（切换验收的基线，4.5 用）

| 阶段 | sequencer（legacy 直写） | runner（本骨架） | 一致性 |
|---|---|---|---|
| import | `setAiStage('import')` + insight.seqImport | turn{stage:'import', insightKey:'insight.seqImport'} | ✅ 序列/key 一致 |
| analyze | setAiStage + insight.seqAnalyze | turn{analyze, seqAnalyze} | ✅ |
| scan | setAiStage + insight.seqScan | turn{scan, seqScan} | ✅ |
| relate | setAiStage + **addNode/addEdge/addCluster** + insight.seqNode | turn + 3 条 planned ToolCall（createNode/createEdge/createCluster） | ✅ 产出物对齐（写入方式不同：直写 vs 计划） |
| map | setAiStage + insight.seqMap | turn{map, seqMap} | ✅ |
| done | setAiStage('done') + **autoClusterIfNeeded** + insight.seqDoneMap | turn + knowledge.deriveClusters 记录 | ✅（派生语义按 Q-G4 固化） |

**节奏差异（有意）**：sequencer 用 `setTimeout` 做演示节奏；runner 无定时器（同步、无人工延迟）—— 节奏是呈现关切，将来由事件消费端决定，不属于执行流。

## 6. 风险

| # | 项 | 说明 |
|---|---|---|
| R1 | 骨架"哑火" | 无事件、无写入，输出只是数据 —— 这正是本阶段目的（结构先行）；activation 依赖 run.* evolution 批准 |
| R2 | `simulated` 标记可能被误当真实产出 | 全部 planned ToolCall 带 `simulated: true` + 注释三重声明 |
| R3 | cancel no-op | 契约要求成员存在；同步终态下无安全停止点，语义已注释，4.3 异步执行器接管 |
| R4 | input 只读 `title` | 契约 input 为 unknown；骨架最小消费，更多字段等真实 ingestion 输入定义（4.3/4.4） |

## 7. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `6378ba3`（本轮未产生 commit） |
| staged | **0** |
| 新增 | `src/agent/runner.ts`（未跟踪）+ 2 个文档（未跟踪） |
| `contracts/` / `activity/` / `demo/` / `store` | **零改动** |
| 全仓 | 99 M / 147 ?? / **0 D** · 根 `src ' M'=0` |
| package.json / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

**三条 4.2a 限制逐条核验**：① 无真实 LLM ✅ ② 不直写 store ✅（连 emitActivity 都未用 —— 事件留给正确的 kind）③ sequencer 未删 ✅。

---

**状态**：🟡 停在 **P2-4.2a Review Node，未提交**。待裁决：① 是否提交（建议两笔：runner 实现 + Q-G5 evolution proposal 文档；或合并为一笔 design+impl，遵从既往 Implementation/Review 分离惯例则 Review 单独第三笔）② evolution proposal 是否提交 ③ 是否进入 4.2b（UI 改事件投影 —— **注意被 run.* evolution 阻塞**，或先行 4.3 routing）。
