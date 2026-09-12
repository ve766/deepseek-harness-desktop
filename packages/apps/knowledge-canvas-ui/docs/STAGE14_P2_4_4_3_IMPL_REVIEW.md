# STAGE14 P2-4.4.3 Implementation Review — Applier + Mutation Adapter

> 阶段：**P2-4.4.3 实现完成，停在 Review Node，未提交（本 Review 写就时）**。
> 范围：`src/knowledge/write/mutationAdapter.ts`（机械层）+ `src/knowledge/write/applier.ts`（治理层）。
> 定位：治理链最后一段 —— **Proposal → Validation → Apply**，Applier 是唯一允许把 proposal 变成知识变更的地方。

---

## 1. 文件清单

| # | 文件 | 动作 | 行数 | 说明 |
|---|---|---|---|---|
| 1 | `src/knowledge/write/mutationAdapter.ts` | **新增** | 231 | `KnowledgeMutationAdapter`（唯一方法 `applyOp(op): MutationResult`）+ `createInMemoryMutationAdapter` 测试替身（六种 op type 全支持） |
| 2 | `src/knowledge/write/applier.ts` | **新增** | 416 | `createKnowledgeApplier(adapter): KnowledgeApplier`（`apply` + `undo` 桩） |

**`contracts/` · `store` · `executor.ts` · `runner.ts` · `ActivityBus` · UI 零改动。**

## 2. 分层与依赖方向

```
Agent / Ingestion / User --proposal--> validateProposal（结构）
                                            │
                                            v
                        KnowledgeApplier（治理：准入 / Import Rule / 依赖 / 记账 / 快照）
                                            │  依赖注入，仅 interface
                                            v
                        KnowledgeMutationAdapter（机械：一 op 进，一结果出）
                                            │
                                            v
                        Store（未来：Zustand / SQLite / vector / plugin runtime）
```

| 层 | 允许知道 | 明确不知道 |
|---|---|---|
| Applier | proposal / review / 契约类型 / adapter 事实码 | Agent 编排、LLM、Router、provider、store 实现、UI |
| Adapter | op.type / op.target / op.payload（不透明 record） | confidence、reason、evidence、审批、Import Rule、任何策略 |

失败词表刻意**不复用契约 `ApplyCode`**：`import_rule` / `privacy` / `stale` / `conflict` 是治理裁决，只有 Applier 能推导；adapter 只报**事实**（`MutationFailureCode`），事实 → 裁决的映射权归 Applier。这样 adapter 不被本 Applier 独占，且未来换 store 不影响治理语义。

## 3. 入场三闸（D1，探针 A 组 10 项）

| 闸 | 规则 | 违反结果 |
|---|---|---|
| 1 | `review.proposalId === proposal.id` | `rejected` / `schema` |
| 2 | `decision` 必须**恰好** `needs_approval`；`auto_apply` 视为**非法输入**；`reject` 与未知决策一律拒 | `rejected` / `rejected` |
| 3 | **重跑 `validateProposal`**（ReviewResult 是外部输入，不作可信事实） | `rejected` / 首个失败码（`schema`/`import_rule`/`privacy`）或 `schema` |

- 任一闸失败 ⇒ **零 adapter 调用**（A10 证实），但仍返回 `applied=0 / failed=ops.length` 保持算术不变量。
- **任一决策路径都不产出 `auto_apply`**（G 组 4 项：结果无 decision 字段、序列化无该 token）。

## 4. Import Rule（F1）实例化

规则位置：**Applier，不在 prompt、不在 adapter**。仅作用于 **create 类 op**（update/delete 不引入新 AI 知识，本阶段不改写存量归属）。

| op | AI 源（`agent` / `ingestion`）要求 | 违反码 |
|---|---|---|
| `node.create` | `aiStatus ∈ {draft, auto}`（AI 标记） | `import_rule` |
| `node.create` | `aiStatus='confirmed'` ⇒ **不得冒充用户归属** | `import_rule` |
| `node.create` | `ownerAgent` 必须存在且 `=== proposal.agentId` | `import_rule` |
| `relation.create` | `kind === 'ai-auto'` | `import_rule` |
| `user` 源 | 无标记要求（人工编辑共享同一审计通道，但非 AI 产物） | — |

字段名取自**现有数据层**（`KnowledgeNode.aiStatus` / `ownerAgent`、`KnowledgeEdge.kind`），**不升级 contract**（裁决 1/2）。

## 5. 失败一致性与记账（D3 冻结）

逐 op 顺序执行，**失败不终止后续**（非 fail-fast，无 rollback，无自动补偿）：

```
for each op:
  Import Rule（策略先行，违规 op 永不触达 store）
  批内依赖短路（D1a）
  adapter.applyOp(op)  ← try/catch → engine-error
  成功 → applied++；失败 → failed++ + 记账
```

- **不变量 `applied + failed === ops.length`** 在每条返回路径成立（入场拒绝 0+n、抛错 0+n、部分成功 a+f）——探针 A2/B2/D4/D8/F3 逐一断言。
- `ApplyStatus.skipped` **刻意未使用**（任何 skip 都会破坏上述算术）；词汇保留给未来裁决。

**批内依赖短路（D1a，零 store 读取）**：Applier 唯一的端点知识来自**本批执行上下文**。

| 情形 | 结果 | 可达性 |
|---|---|---|
| op.target ∈ 本批失败 id | `conflict` | 防御（validate 已先拦批内重复 id 与 update 指向预分配 id）—— 裁决 4 接受 |
| `relation.create` 的 `from`/`to` ∈ 本批失败 id | `conflict`（不调用 adapter） | **可达主路径**（端点不在 op.target 中，validator 看不见） |
| 端点属本批**新建成功**的节点 | 正常应用 | D6 证实不误伤 |

## 6. 事实 → 裁决映射（D2 冻结在 Applier）

| adapter 事实 | `ApplyCode` | 语义 |
|---|---|---|
| `duplicate-target` | `conflict` | id 已被占用：两个写入者争夺同一实体 |
| `missing-target` | `stale` | **存量**目标在 validation 与 apply 之间消失 |
| `unsupported-op` | `schema` | 契约词汇外（经 Applier 不可达，防御保留） |
| `invalid-payload` | `schema` | 载荷无法落盘 |
| `engine-error` | `rejected` | store 抛错，对该 op 本身无法给出判断 |

## 7. 快照载体（D2）与 undo 边界

- **B5 真实缺口（已修，用户确认）**：adapter 的 `MutationResult` 增加 **`existed?: boolean` 事实**——create 成功 → `existed:false`（无 `before` 载荷，因"此前不存在"），update/delete 成功 → `true` + `before`，`duplicate` → `true`，`missing` → `false`，`invalid-payload` / 无 target id → **省略**（存在性未被观测，不编造）。
- Applier 对**每个 applied op** 记一个快照槽 `{ index, existed, before }` ⇒ **纯 create 批次同样产生 `undoToken`**（D7 证实）。
- 载体：**进程内 `Map<undoToken, SnapshotRecord>`**，不进 KnowledgeBackend、不持久化、不扩 contract。
- `undo()` 为**诚实桩**：`{ ok:false, restored:0, reason:'... capture only' }` —— 静默"成功"的桩与可用的 restore 无法区分，因此必须显式失败。
- `before` 为**浅拷贝**（D3 接受），**不引入 `structuredClone`**。
- 全层**无** undo / rollback / inverse / recover / delete-on-undo / reclaim（H7 断言 adapter 面只有 `applyOp`/`dump`/`has`）。

## 8. 探针实证

**Step 2 主矩阵 `bench/p2443s2_probe.mts` = 51/51 PASS**

| 组 | 项数 | 覆盖 |
|---|---|---|
| A 入场三闸 | 10 | 伪 proposalId / `auto_apply` / `reject` / 未知决策 / **伪造 review + 结构非法 proposal 被重校验拦下** / 未知 op type / 拒绝时零 adapter 调用 |
| B builder 端到端 | 8 | 真 builder 产物（cluster 已 skip）；node.create 应用；**未标记 createEdge → `import_rule`**；create-only 批次得 undoToken；策略违规不触达 adapter |
| C Import Rule 矩阵 | 7 | confirmed 冒充 / 缺 ownerAgent / ownerAgent 不匹配 / user 源免检 / relation `manual` 拒 / relation `ai-auto` 过 / update 不检查归属 |
| D 批内依赖 | 8 | store 重复 → `conflict`；**失败端点短路 `conflict` 且不调用 adapter**；端点为新建成功节点不误伤；记账不变量 |
| E 映射 | 3 | `missing→stale` / `invalid-payload→schema` / 预分配 id 上 update-delete |
| F engine-error | 4 | **throwing adapter**（D4 要求）：异常不外泄 → `rejected` + 原错误信息 + 记账不变量 + applied 保持 0 |
| H `existed` 事实 | 7 | create/update/delete/duplicate/missing/relation/不观测即省略/无 undo 面 |
| G `auto_apply` 禁令 | 4 | 结果无 decision 字段、序列化无 token、verdict 仅 applied/rejected、一 op 一 verdict |

**Step 1 回归**（adapter 改动后）：`bench/p2443s1_probe.mts` **27/27 PASS**。

## 9. 纯净度

| 项 | 结果 |
|---|---|
| adapter runtime import | **0**（仅 `import type { ProposalOp }`） |
| applier runtime import | **1**（同级 `./validate` 的 `validateProposal`，治理必需） |
| type imports | 仅 `contracts/knowledgeWrite` + 同级 `./mutationAdapter` 类型 |
| store / llm / agent / activity / mock / demo / components / react | **0**（grep 命中项全为注释中的禁令说明） |
| transaction / batch API / rollback / undo restore / 网络 | **0** |
| `auto_apply` 产出 | **0** |

## 10. tsc / lint 基线

**48 = 基线** · `knowledge/write` 错误 **NONE** · contracts diff **空** · oxlint（staged）**0 errors**。

## 11. 风险

| # | 项 | 说明 |
|---|---|---|
| R1 | Import Rule 为**实例化**非冻结文档 | 字段映射（`aiStatus`/`ownerAgent`/`edge.kind`）来自现有数据层；裁决 1/2 已接受为实例化，**若数据层字段更名须同步本文件与 Applier** |
| R2 | createEdge 载荷缺 `from`/`to`/`kind` | executor planned tool call 仍是占位 ⇒ 其 relation 提案会被合法拒绝；已裁决为 **executor enrich 后续任务**（裁决 3），本阶段不改 executor |
| R3 | 幂等键未跨实例强制 | `undo-${proposal.id}` 与 adapter 内幂等由单线程串行保证；**无持久化 ⇒ 跨进程重复 apply 未防护**，属已知限制（契约 Q3 无乐观锁） |
| R4 | partial apply 留孤儿节点 | relation 失败不回收已建 node；靠 receipt/verdict 可审计，tidy 流程属后续阶段 |
| R5 | 浅拷贝快照 | 嵌套对象与 store 共享引用（裁决 D3 接受）；因无 restore，本阶段无实际风险 |
| R6 | Store 接线缺席 | `apply` 现有真实调用者侧仍是 in-memory 替身；接真 store 前不得声称端到端可写 |

## 12. 禁项核验

❌ UI Reviewer · ❌ 权限系统 · ❌ DB migration · ❌ Plugin runtime · ❌ LangGraph · ❌ 新依赖 · ❌ 自动审批 / `auto_apply` · ❌ undo restore · ❌ contract 改动 · ❌ store 接线 · ❌ Agent 直调 store —— 全部未触碰。

---

**状态**：🟡 停在 **P2-4.4.3 Review Node**。提交纪律：**implementation commit（adapter + applier）与 review commit（本文档）分离**。
