# STAGE14 P2-4.4.1 Implementation Review — ProposalBuilder

> 阶段：**P2-4.4.1 实现完成，停在 Review Node，未提交**。
> 范围：`src/knowledge/write/proposalBuilder.ts` —— 纯函数：planned ToolCalls + ProposalSource → KnowledgeWriteProposal。**无 Applier / Validation / executor 集成**（4.4.2/4.4.3 及后续）。

---

## 1. 文件结构

`src/knowledge/write/proposalBuilder.ts`（~220 行）：

```
BuildProposalInput      { toolCalls, source, agentId, confidence?, timestamp? }
SkippedToolCall         { toolCallId, name, code, reason }   ← 永远可审计，绝不静默
BuildProposalResult     { proposal, skipped }
buildKnowledgeWriteProposal(input): BuildProposalResult   ← 唯一导出函数
maxTs()                 内部 helper（默认时间戳 = 最新 toolCall ts，保纯度）
```

## 2. 输入/输出类型（契约对齐核实）

| 契约要求 | builder 行为 |
|---|---|
| 七字段齐 | `id`（由 runId 派生=幂等键）/ `source`（verbatim）/ `agentId`（契约独立字段，镜像填充）/ `timestamp` / `confidence` / `explanation` / `ops` |
| ops 不可变 | 全 `readonly` —— `ops.push()`/`ops[0].type=`/`source=` 赋值**均为 TS 编译错**（用户验收点） |
| id 预分配 | `target.nodeId = proposed-node-{tc.id}`、`target.relationId = proposed-rel-{tc.id}` —— 由 toolCall id 派生：批内互引用 + 同输入同输出（幂等） |
| confidence 仅描述 | 每 op `0.5` 默认（输入可覆写），注释明示阈值永不在 builder |
| evidence 仅引用 | `{kind:'text', excerpt}` ← 真实 `llm.complete` 的 textPreview；不嵌实体快照 |
| undo 不生成 | op 均无 `undo` 字段（契约"Absent ⇒ not undoable"）；快照归 4.4.3 Applier |
| source 支持 agent | `source` verbatim 透传（agent 变体含 runId）；user/ingestion 亦可 |

## 3. 三类 op 映射结果（探针实证）

| ToolCall | → ProposalOp | 验证 |
|---|---|---|
| `knowledge.createNode` | `node.create`（target 预分配 `proposed-node-tc-3`） | ✅ |
| `knowledge.createEdge` | `relation.create`（`proposed-rel-tc-4`） | ✅ |
| `knowledge.updateAttribute`（args.nodeId='node-existing-1'） | `node.update`（target.nodeId='node-existing-1'） | ✅ |
| 同调用**缺 nodeId** | 无 op + `missing-target` skip（**不伪造 target**） | ✅ |

## 4. skipped audit 结果

| ToolCall | code | reason |
|---|---|---|
| `knowledge.createCluster` | `unsupported-operation` | **`unsupported-operation: cluster.create`**（冻结 ProposalOpType 无 cluster kind；独立 evolution）—— 绝不伪装 relation.create |
| `knowledge.deriveClusters` | `derived-operation` | Q-G4 派生语义 |
| status='error' 的调用 | `failed-call` | 无可提议意图 |
| 未知名 | `unsupported-operation` | `no mapping for tool call '...'` |

`llm.complete`（成功）**不在 skipped** —— 作为 evidence 来源被消费（设计如此）。

## 5. purity check

| 项 | 结果 |
|---|---|
| runtime import | **0**（全部 `import type`：contracts/agentRun · contracts/knowledgeWrite · ../types） |
| external dependency | **0** |
| store / llm / agent / activity / mock / demo import | **0**（旗标命中均为子串误报：`agentRun` 含 'agent'、`'llm.complete'` 字面量含 'llm' —— 已逐行核实） |
| class / side effect / fetch / setTimeout | **0** |
| `let` 计数 | 1 —— `maxTs()` 内合法局部累加器（纯度=无外部副作用，非无局部变量；检查器预期过严） |
| 副作用 | 0（无输出参数、无模块级可变状态、无 Date.now 依赖 —— timestamp 缺省取 max(toolCall.ts) 保确定性） |

## 6. tsc baseline 对比

**48 = 基线** · `proposalBuilder.ts` 错误 NONE · `TS2307 = 0` · oxlint 预检 **0 errors**。

## 7. 功能探针：**17/17 PASS**（`bench/p2441_probe.mts`）

幂等（同输入 JSON 逐字节一致）· id 派生（agent→runId / user→maxTs）· 3 op 映射 · target 预分配 · evidence 引用 · undo 缺省 · skipped 3 条（cluster/derive/errored）· missing-target 不伪造 · user source 支持。

（首轮 2 个 FAIL 均为**探针预期错误**：fixture 含 tc-7 updateAttribute 故 ops=3 才正确 —— 修正预期后全过，builder 零改动。）

## 8. git 状态

| 项 | 状态 |
|---|---|
| HEAD | `8363c71`（本轮未产生 commit） |
| staged | **0** |
| untracked 新增 | `src/knowledge/write/proposalBuilder.ts` + 本文档 |
| 全仓 | 99 M / **147 ??** / **0 D** · 根 `src ' M'=0` |
| contracts / executor / runner / store / demo | **零改动** |
| package / lockfile | 未触碰 |

**禁项核验**：proposalBuilder.ts 创建 ✅（唯一代码产物）· knowledgeWrite.ts 未改 ✅ · ProposalOpType 未增 ✅ · 无 Applier ✅ · 无 store 访问 ✅ · 无 LLM 调用 ✅ · 无 ActivityBus 接线 ✅ · 无 UI 审批/权限/DB migration ✅ · 无新依赖 ✅。

---

**状态**：🟡 停在 **P2-4.4.1 Review Node，未提交**。待裁决：① 是否提交 `proposalBuilder.ts`（单文件）② 本 Review 是否提交 ③ 是否进入 **4.4.2 Validation**（id/target/evidence/source 校验 —— Reviewer 前置）。
