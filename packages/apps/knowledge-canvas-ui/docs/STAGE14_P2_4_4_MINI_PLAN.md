# STAGE14 P2-4.4 Mini Plan — Proposal Builder（治理链最后一段 · 第一阶段）

> 阶段：**P2-4.4.1 设计评审（design-only）**。按裁决**只做 ToolCall → ProposalBuilder → KnowledgeWriteProposal**，**本阶段不写 Applier**。
> 硬限制（裁决）：❌ UI 审批界面 · ❌ 权限系统 · ❌ 数据库迁移 · ❌ 自动审批 · ❌ Agent 自 apply · ❌ **修改 knowledgeWrite contract** · ❌ LangGraph · ❌ plugin runtime。
> 前置事实：`AgentRun → executor → planned ToolCall → (结束)` —— 缺口 = 治理链最后一段。

---

## 0. ⚠️ 契约缺口先报告（影响 4.4 范围）

实测 `contracts/knowledgeWrite.ts:53`：

```ts
export type ProposalOpType =
  | 'node.create' | 'node.update' | 'node.delete'
  | 'relation.create' | 'relation.update' | 'relation.delete'
```

**只有 6 种 —— 没有 cluster 类 op**。而 executor 规划的写入含 `knowledge.createCluster`，你要求验证的四个 mutation 中 **createCluster 无法映射到冻结契约**。

**处理（遵循"不为完整提前设计"与 Q-C 先例）**：

| mutation | 映射 | 4.4.1 可验证？ |
|---|---|---|
| `knowledge.createNode` | `node.create` | ✅ |
| `knowledge.createEdge` | `relation.create` | ✅ |
| `updateAttribute` | `node.update`（payload 携带属性 patch） | ✅（builder 支持映射；executor 当前无此 ToolCall，以探针构造验证） |
| `knowledge.createCluster` | **无对应 op** | ❌ **登记缺口，走独立 evolution**（`cluster.create` 或改走 recommendation 通道 —— 需你后续裁决），本阶段不映射 |

这与你"先验证 createNode/createEdge/createCluster/updateAttribute"的指示有出入 —— **诚实划界**：本阶段验证其中 3 种；cluster 需求真实但契约缺位，不偷偷用 relation.create 顶替。

## 1. Q — 4.4.1 设计：`src/knowledge/write/proposalBuilder.ts`

### 职责（纯函数，无副作用）

```
输入：planned ToolCall[]（来自 executor 的 AgentRun.toolCalls）+ ProposalSource
输出：KnowledgeWriteProposal（契约 7 字段齐 + 逐 op confidence/evidence/reason/undo）
禁止：写 store · 改 node · 调 LLM · 修改契约
```

### 映射表（ToolCall → ProposalOp）

| ToolCall | ProposalOp | payload（形状先行，schema 由 4.4.3 Applier 前定稿） | evidence |
|---|---|---|---|
| `knowledge.createNode` | `node.create` | `{ kind, title, ownerAgent, aiStatus }`（镜像 sequencer 形状） | `{kind:'text', excerpt}` ← 源 LLM 输出预览 |
| `knowledge.createEdge` | `relation.create` | `{ from, to, kind:'ai-auto', reason }` | 同上 |
| `updateAttribute`（探针构造） | `node.update` | `{ patch: {...} }` | `{kind:'node', id}` |
| `llm.complete`（成功） | **不产生 op** —— 是 **evidence 来源**（textPreview 进 excerpt） | — | — |
| `knowledge.deriveClusters` | **不产生 op**（Q-G4 派生语义） | — | — |
| 错误/`simulated:true` 的 ToolCall | **跳过并计数**（builder 输出 `skipped` 清单，可审计） | — | — |

### 契约字段落实

| 契约要求 | builder 行为 |
|---|---|
| 七字段 source/agentId/timestamp/confidence/operation/target/explanation | 全部落位；`source = { kind:'agent', agentId }`（`user` 通道后续） |
| **id 预分配 + 幂等** | `proposal.id = propose-{ts}-{counter}`；op 间互引用用预分配 nodeId |
| **逐 op confidence** | 首版取 run 级常数（如 0.5）——**仅描述不决策**（Q4），阈值永远不在契约 |
| **evidence 引用** | 只存引用（text excerpt / node id），不拷贝内容 |
| **undo = unknown** | Q5 裁决：语义锁定、形状开放；before-state 快照在 **4.4.3 Applier** 采集（builder 无 store 访问，采不到前态 —— 这正是分层） |
| Proposal 不可变 | builder 返回 `Readonly` 深结构；后续 Review 产生新对象 |

## 2. 4.4 全景（后续阶段预告，本阶段不做）

```
4.4.1  ProposalBuilder（本阶段）     ToolCall → Proposal，纯函数
4.4.2  Proposal Validation           id/target/evidence/source 校验（Reviewer 前置）
4.4.3  Applier                       ApplyRequest → KnowledgeApplier → store mutation
                                       + before-state 快照（Q1 裁决）+ local-only 二次校验（层③）
       executor 集成                  run.proposals 填充 + builder 接线（4.4.1 验收后）
```

**诚实披露**：4.4.1 完成后治理链**仍未闭合**（Applier 未存在，proposal 无消费者）；但「Agent 意图 → 审计 Proposal」的**稳定性**正是你要先验证的 —— 顺序正确。

## 3. 文件影响范围

| # | 文件 | 动作 |
|---|---|---|
| 1 | `src/knowledge/write/proposalBuilder.ts` | 新增（纯函数） |
| 2 | `bench/p2441_probe.mts`（仓库外） | 新增：用 executor 真实 run 的 toolCalls 喂 builder，断言 proposal 结构 |
| 3 | `contracts/` · `executor.ts` · `runner.ts` · `store` | **零改动** |

## 4. 依赖方向

```
knowledge/write/proposalBuilder ──type──> contracts/knowledgeWrite (+ ../types)
知识写层禁止 import：store · llm · agent · mock · demo · components
（builder 消费的是 toolCalls **数据**，不是 executor —— 依赖倒置保持）
```

## 5. 验收标准（预览）

| # | 标准 |
|---|---|
| V1 | builder 输出满足 `KnowledgeWriteProposal` 全部必填字段（tsc 保证）+ 七字段语义齐 |
| V2 | op id 预分配、批内互引用成立、同输入同输出（幂等） |
| V3 | 真实 run 的 toolCalls → 3 条 op（createNode/createEdge/createCluster→**跳过并登记**）+ skipped 清单 |
| V4 | 纯净度：零 store/llm/agent import；`knowledge/` 不反向依赖 agent |
| V5 | tsc 48 · oxlint 0 · contracts/executor/runner/store 零改动 |
| V6 | 不可变：返回结构 readonly；无任何副作用 |

## 6. 明确不做

Applier（4.4.3）· Validation（4.4.2）· executor 集成（run.proposals 填充）· UI 审批 · 权限 · 自动审批 · Agent 自 apply · DB 迁移 · **契约修改（含 cluster op —— 走 evolution）** · undo 实现 · LangGraph/plugin runtime · 新依赖

## 7. 风险

| # | 风险 | 缓解 |
|---|---|---|
| R1 | cluster 无 op type → agent 建议的聚类丢失 | skipped 清单可审计 + evolution proposal 登记；不静默丢弃 |
| R2 | payload 形状 `unknown` → 4.4.3 前无 schema | 本阶段只锁 op 类型映射；payload schema 与 Applier 一起定（避免两次返工） |
| R3 | builder 被误当"写入器" | 命名/注释/纯函数签名三重声明；无 store import 可 grep 验证 |
| R4 | 与 4.4.3 的 before-state 快照衔接 | 快照在 Applier 采集（有 store 访问的一方），builder 明确不采 —— 分层已在注释固化 |

## 8. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `38b80be`（本轮未产生 commit） |
| 本轮改动 | **0**（仅新增 1 个未跟踪文档） |
| 根 `src ' M'` | 0 |
| 全仓 | 99 M / 146 ?? / **0 D** |
| contracts / package / lockfile | 未触碰 |
| 服务 | Ollama 11434 常驻（未调用）、LightRAG 9621 停 |

---

**状态**：🟡 停在 **P2-4.4.1 Mini Plan Review Node**，未编码。**待裁决**：① cluster 缺口处置（evolution 登记 + 4.4.1 跳过映射，是否接受）② 4.4.1 范围与验收 ③ Mini Plan 是否提交。
