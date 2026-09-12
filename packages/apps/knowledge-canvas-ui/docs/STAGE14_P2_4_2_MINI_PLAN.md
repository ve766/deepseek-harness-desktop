# STAGE14 P2-4.2 Mini Plan — AgentRun Skeleton

> 阶段：**P2-4.2 设计评审（design-only）**。目标是 **AgentRun skeleton（骨架）**，**不是 Agent**。
> 前置裁决：Q-B（4.4 只关 Agent→Store bypass，legacy path 登记不删）、R-7（执行流禁直写 `store.setXXX()`）、Q-E（demo/sequencer 保留 → Demo Replay Source）。
> **禁止**：LangGraph · 多 Agent · Handoff · LLM Router 实装 · 云 API · 自动规划系统 · 拆 Agent Core · 新依赖。

---

## 0. 本阶段定位

```
目标形态（4.2 只搭骨架，不接 LLM、不写 store）：

Intent
  ↓
AgentRun        ← 契约已有：AgentRunRequest → AgentRun（RunStatus/Turn/ToolCall/RunResult）
  ↓
ActivityEvent   ← 经 ActivityBus 外显（4.1 已接线的通道）
  ↓
(4.4 才接) KnowledgeWriteProposal → Applier → Store
```

**4.2 做三件事**：① run 执行器骨架（结构化 Run/Turn/ToolCall/Result）② 复刻 demo 的阶段时序为 turn 序列 ③ 事件外显机制。**不做**：真实 LLM 调用（4.3）、写入治理（4.4）、UI 订阅切换（见 Q2 分步）。

---

## 1. 现状证据（实测）

| 项 | 事实 |
|---|---|
| 契约就绪 | `contracts/agentRun.ts`：`TaskKind('extract'\|'classify'\|'plan'\|'qa'\|'summarize')` · `RunStatus(6 态)` · `RunTurn(role/index/content/ts)` · `ToolCall(id/name/args/status/result/ts)` · `RunResult(status/output/error/usage)` · `AgentRunRequest(agentId/taskKind/input/needs/privacy/maxTurns)` · `AgentRun(runId/agentId/status/turns/toolCalls/proposals/result)` |
| 隐私就绪 | 契约内建 `Privacy('local-only'\|'any')` + `RouteNeeds` —— 4.3 routing 的输入已预留 |
| 伪 Agent 现状 | `demo/sequencer.ts` `runImportDemo`：`aiState('idle'→'inferring'→'idle')` + 阶段序列 `import→analyze→scan→relate→map→done`（各带 `setInsight`），最后**直写** `setNodes/addEdge/addCluster/setRelationships/...` |
| UI 状态词汇 | `AiState = 'idle'\|'inferring'\|'arrived'\|'clustering'`；`AiStage = 'import'\|'analyze'\|'scan'\|'relate'\|'map'\|'done'\|null` |
| 事件通道 | `src/activity/activityBus.ts`（4.1 已交付），`emitUserActivity`/`emitIngestionActivity` |

---

## 2. Q1 — 第一个 AgentRun consumer 是谁？

**答：`runImportDemo` 的真实化版本** —— 即一个 import 任务的 Run。

理由：它是全库**唯一**已有完整阶段序列（6 阶段）的执行流；其时序、insight 文案、节点/关系产出都已被 UI 验证过。把它从「脚本直写」提升为「结构化 Run」，是最小改动路径。

- **Agent**：现有 `AgentId` 四角色之一（建议 Nox —— sequencer 的 insight 文案即其人设）
- **taskKind**：`'extract'`
- **落点**：新增 `src/agent/runner.ts`（候选名），宿主单例模式与 `src/activity/activityBus.ts` 相同

**不做**：新增第二个 agent、编排、handoff。

## 3. Q2 — 如何替代 sequencer 的直写？

**分四小步，绝不一次改完：**

| 步 | 动作 | store 直写 |
|---|---|---|
| **4.2a** | Run 骨架：复刻 demo 六阶段时序为 `RunTurn[]`，每阶段发事件；**不写 store、不接 LLM** | 无 |
| **4.2b** | UI 状态改由事件投影（`aiState/aiStage` 改为订阅方 setState，执行流不再直接调 setter） | sequencer 保留直写（legacy 豁免） |
| **4.2c** | 阶段产物改经 Proposal（4.4 之后） | sequencer 退化为 replay 源 |
| **4.5** | sequencer → 事件回放源 | 删除直写 |

**关键原则**：任何时刻 UI 都有完整可用的时序 —— 4.2a/b 期间新旧两条路径并存，切换以「事件投影产出与直写产出一致」为验收（回归对比）。

## 4. Q3 — 哪些 store mutation 允许进入 Proposal？

以「是否属于**知识真相**」划线（对应 4.4 Applier 白名单，此处先冻结分类）：

| 分类 | store API | 进 Proposal？ |
|---|---|---|
| **知识 — 节点** | `addNode` `setNodes` `removeNode` `updateNodePosition*` | ✅（position 属布局派生，待 4.4 定夺：建议**不进**，视为 renderer 关切） |
| **知识 — 关系** | `addEdge` `setEdges` `removeEdge` `addRelationship` `setRelationships` | ✅ |
| **知识 — 聚类** | `addCluster` `setClusters` `removeCluster` | ✅（AI 产出的 cluster 是知识） |
| **知识 — 学习/进度/推荐** | `setLearningPaths` `addLearningPath` `setProgress` `setMastery` `setRecommendations` `addRecommendations` | ✅ |
| **撤销** | `clearAiGenerated` | ⚠️ 特殊：未来由 `ProposalUndo`/undoToken 驱动，不作为普通 mutation |
| **视图/选择** | `setView` `setSelection` `toggleSelection` `clearSelection` `setConnectFrom` | ❌ **永不**（用户意图，非知识） |
| **外观/模式** | `setAppearance` `setMode` `setActivePath` `fitToContent` | ❌ **永不** |
| **派生** | `autoClusterIfNeeded`（内部调 `addCluster`） | ❌ 直接调用禁止；其产物经 `addCluster` 走 Proposal |

## 5. Q4 — Run 状态如何映射 ActivityEvent？

### ⚠️ 契约缺口（本轮最重要的发现）

冻结的 `ActivityKind` 12 种（`galaxy.opened` … `relation.created`）中**没有任何 run 生命周期事件**（无 `run.started` / `run.stage` / `run.completed` 等）。而 P2-4.2 的核心恰恰是把 run 状态外显为事件。

**三个选项**：

| 选项 | 做法 | 评价 |
|---|---|---|
| A | 现在扩展 `ActivityKind`（加 `run.*`） | ❌ 违反纪律：Q7 先例已确立**契约演进必须独立步骤**；且 Q-A 冻结了事件系统范围 |
| B | 用现有 kind + payload 承载（如塞进 `task.created`） | ❌ 语义扭曲，污染冻结词汇 |
| **C（建议）** | **4.2 内 Run 状态只存在于结构化 `AgentRun` 对象**（`status/turns/toolCalls` 本身就是状态机），UI 短期仍读 `aiState/aiStage`（双轨）；`run.*` 事件作为 **ActivityKind evolution proposal** 单独立项 | ✅ 不偷渡契约；骨架与外显解耦 |

**映射表（留待 evolution 通过后实施）**：

| RunStatus / 阶段 | 拟发事件（未来） | 现 `AiState/AiStage` 对应 |
|---|---|---|
| `pending → running` | `run.started` | `aiState: 'inferring'` |
| turn 阶段推进 | `run.stage`（payload: stage） | `aiStage: import→analyze→scan→relate→map` |
| `completed` | `run.completed` | `aiStage: 'done'` → `aiState: 'idle'` |
| `failed` | `run.failed`（severity: error） | `aiState: 'idle'` + insight error |
| `cancelled` | `run.cancelled` | `aiState: 'idle'` |

## 6. Q5 — 如何保证 AgentRun 不依赖 UI？

**四重保障（写入验收）**：

1. **落点隔离**：runner 在 `src/agent/`，与 `src/activity/` 同范式 —— **只 import type** `contracts/agentRun` + `contracts/activityEvent` + `../types`(AgentId)
2. **禁止导入**：`components/` · `i18n` · `store/canvasStore` · react —— grep 断言为 0
3. **数据进出**：输入 `AgentRunRequest`（纯数据），输出 `AgentRun`（纯数据）+ 经 emitter 发事件；**无回调注入 UI、无 DOM、无 hook**
4. **tsc 门**：若 runner 误触 UI 层，import graph 检查立即报红（沿用 4.1 的检查脚本）

**LLM 依赖**：4.2 骨架**零 LLM 调用**（连 `getLlmClient` 都不 import）—— 4.3 才引入，且经 F4 唯一出口 + routing.ts + local-only 强制。

---

## 7. P2-4.2 范围冻结

**做**：① `src/agent/` run 执行器骨架（六阶段 turn 序列，数据驱动）② 宿主单例 + `dispose()` ③ 事件发射**挂点预留**（等 ActivityKind evolution 通过即插即用）④ 与 demo 时序的回归对比清单

**不做**：真实 LLM · UI 订阅切换（4.2b 另批）· Proposal/Applier（4.4）· `run.*` ActivityKind（独立演进步骤）· 删 sequencer · LangGraph/handoff/编排 · 新依赖

## 8. 验收标准（预览）

| # | 标准 |
|---|---|
| 1 | runner 不 import components/i18n/store/react（grep = 0） |
| 2 | `implements`/结构满足 `AgentRunRequest → AgentRun` 契约，无 `as any` |
| 3 | 六阶段 turn 序列与 `runImportDemo` 时序一致（回归对比表） |
| 4 | `contracts/` 零改动（ActivityKind 演进**不在本阶段**） |
| 5 | tsc 基线 48 不增；oxlint 通过（4.1 教训：unused import 会被 lint 卡） |
| 6 | bus 创建仍唯一；runner 无第二个 bus 实例（经 emit helper 发事件） |
| 7 | `demo/sequencer.ts` 零改动 |

## 9. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | run.* 事件迟迟不演进 → 骨架长期"哑火" | evolution proposal 作为 4.2 收尾交付物之一（只加 3–4 个 kind，走独立评审） |
| R2 | 双轨期 UI 状态漂移 | 4.2b 切换前以回归对比表锁定一致性 |
| R3 | runner 被误当成"真 Agent" | 命名与注释明确 skeleton；无 LLM、无写入 |
| R4 | InsightMessage 文案属 i18n | runner 不碰文案 —— 事件 payload 只带 key，渲染留在 UI（防 UI 依赖倒灌） |

## 10. 待裁决

| # | 问题 | 建议 |
|---|---|---|
| **Q-G1** | Run 状态外显采用**选项 C**（骨架内结构化 + `run.*` ActivityKind 走独立 evolution）？ | 建议是 |
| **Q-G2** | 第一个 consumer = import 任务的 Run（Agent=Nox，taskKind='extract'）？ | 建议是 |
| **Q-G3** | `updateNodePosition` 是否**永不**进 Proposal（位置=renderer 关切）？ | 建议是（拖拽是用户意图，非知识变更） |
| **Q-G4** | `autoClusterIfNeeded` 归为派生操作、其产物经 `addCluster` 走 Proposal？ | 建议是 |
| **Q-G5** | 4.2a 骨架是否含 `run.*` evolution proposal 文档（只写不改契约）？ | 建议含（避免 4.3 时阻塞） |
| **Q-G6** | 本 Mini Plan 是否提交？ | 建议提交（单文件） |

## 11. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `904663f`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 144 ?? / **0 D** |
| contracts / package / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

---

**状态**：🟡 停在 **P2-4.2 Mini Plan Review Node**，未编码，等待 Q-G1 ~ Q-G6 裁决。
