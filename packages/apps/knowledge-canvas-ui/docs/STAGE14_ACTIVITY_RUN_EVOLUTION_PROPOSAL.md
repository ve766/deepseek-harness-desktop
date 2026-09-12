# STAGE14 ActivityKind Evolution Proposal — `run.*` 生命周期事件

> 状态：**Proposal（未批准、未实施）**。本文件**只提案，不改任何契约**。`contracts/activityEvent.ts` 保持冻结。
> 依裁决：Q-G1（选项 C —— ActivityBus 只承载外部可观察事实，Agent 执行状态留在结构化 `AgentRun`）、Q7 先例（契约演进 = 独立步骤：evolution proposal → compatibility review → migration）。

---

## 1. 为什么需要

P2-4.2a 的 AgentRun skeleton 已能把 import 任务结构化为 `AgentRun`（`status/turns/toolCalls/result`），但其状态目前**无法外显**：

- UI 短期仍直读 `aiState/aiStage`（双轨）
- 4.2b（UI 改事件投影）被阻塞：执行流若要把"阶段推进"告知 UI，只能直写 `setAiState/setAiStage` —— **这正是 R-7 禁止、也是 sequencer 的病灶**
- 没有事件，`Agent → Activity → Proposal → Applier` 主链的证据链（`EvidenceRef{kind:'event', seq}`）就无法把"为什么改知识"锚定到 run 行为上

## 2. 当前缺口

冻结的 `ActivityKind` 12 种：

```
galaxy.opened · node.clicked · node.selected · node.dragEnd · search.performed ·
task.created · knowledge.viewed · document.imported · extraction.completed ·
extraction.failed · entity.discovered · relation.created
```

全部是**外部可观察事实**（用户做了什么 / 知识发生了什么），**没有一条**表达"Agent 执行过程"（run 开始/阶段推进/结束/失败/取消）。这是 P2-3 冻结时的**有意设计**（当时无 runtime），不是遗漏 —— 现在有了 runner，缺口才成为真实需求。

## 3. kind 增量方案（最小集，5 个）

```ts
export type ActivityKind =
  | /* …既有 12 种，不动… */
  | 'run.started'      // run 进入 running（payload: { runId, agentId, taskKind }）
  | 'run.stage'        // 阶段推进（payload: { runId, stage }；高频 → 订阅层合并）
  | 'run.completed'    // 终态（payload: { runId, ms, plannedProposalOps }）
  | 'run.failed'       // 终态（severity: 'error'；payload: { runId, code, message }）
  | 'run.cancelled'    // 终态（payload: { runId, atStage }）
```

**设计原则**：

- `source` 语义注意：这些事件的发起者是 **Agent 执行**，不是用户也不是 ingestion。`ActivitySourceId` 目前只有 `'user' | 'ingestion'` —— 因此本提案**必须与 ActivitySourceId 扩展联动**（新增 `'agent'`，或 `` `agent:${AgentId}` ``）。**两选一需再裁决**；建议最小改动为字面量 `'agent'`（agentId 已在 `ActivityEvent.actor` 字段承载，不必编码进 source）。
- 只加 **终态 + 阶段** 两类，不加 `run.turn` / `run.toolcall` 级别的事件（turn/toolCall 属 run 内部结构，经 `AgentRun` 查询，不进总线 —— 否则背压失控）。
- `payload` 只携带数据（runId/stage/key），**不带 i18n 文案**（渲染留 UI）。

## 4. Backward Compatibility

| 项 | 影响 | 结论 |
|---|---|---|
| 既有 12 种 kind | 不动 | ✅ 零影响 |
| `ActivityKind` 消费者的穷举 switch | TS 会对未覆盖分支报错（**编译期暴露**，是保护不是破坏） | 迁移 = 各消费者补 `run.*` 分支或 default |
| `contracts/activityEvent.ts` 纯净度 | 仅扩联合，无 runtime import | ✅ 不破坏 ABI 门禁 |
| `ActivitySourceId` 扩展 `'agent'` | 同为加法；`ActivityFilter.sources` 过滤逻辑天然兼容 | ✅ |
| 回滚 | 删除 5 个 kind + 'agent' 源，恢复原联合 | ✅（无持久化依赖，方案 A 丢弃式） |

## 5. 迁移步骤（批准后执行）

1. `contracts/activityEvent.ts`：扩 `ActivitySourceId`（+`'agent'`）与 `ActivityKind`（+5）—— 单 commit
2. `src/activity/activityBus.ts`：新增 `emitAgentActivity` helper —— 单 commit
3. `src/agent/runner.ts`：骨架在阶段边界发 `run.started/run.stage/run.completed|failed` —— 单 commit
4. 回归：事件序列与 `AgentRun` 结构对照（turn ↔ run.stage 一一对应）

## 6. 时机建议

不阻塞 4.2b/4.3/4.4 的**实现**（它们以 AgentRun 结构为输入），但必须先于 **4.2b（UI 改事件投影）** —— 否则投影无源。建议在 4.3 收尾、4.4 启动前评审本提案。

---

**状态**：⚪ 待评审。未动任何契约文件。
