# STAGE14 P2-5 Route B Implementation Review — Relation Planning

> 阶段：**P2-5 路线 B 实现完成**（D6 冻结 spec 落地）。
> 范围：`src/workflow/knowledgeReadPort.ts`（新）· `src/workflow/planRelations.ts`（新）· `src/workflow/runOutcome.ts`（可选 relation plan 接入）。

---

## 1. 解决的已知边界

**旧行为**：executor 计划的 `knowledge.createEdge` 载荷为 `{ strategy, count }` —— 是**意图**不是数据 ⇒ `relation.create` 无 `from/to/kind` ⇒ Import Rule 合法拒绝 ⇒ **全链永久 `partially_applied`**。

**新行为**：组合根侧 `planRelations` 把意图解析为带端点的计划记录 ⇒ `relation.create` 通过 Import Rule ⇒ **receipt 首次达到 `applied`（0 失败）**。

## 2. 文件清单

| # | 文件 | 动作 | 说明 |
|---|---|---|---|
| 1 | `src/workflow/knowledgeReadPort.ts` | **新增** | 窄只读端口：**仅 `listNodes()`** + InMemory 测试替身。**不含 `getNeighbors`** —— 无消费者的端口方法正是 R-6 陷阱，需要时再走同一纪律加入 |
| 2 | `src/workflow/planRelations.ts` | **新增** | `planRelations(run, readPort)` + `hasUnresolvedEdgeIntent(run)`；冻结 spec 实现 |
| 3 | `src/workflow/runOutcome.ts` | 增补 | `finalizeRun(run, { relationPlan })` / `applyOutcome(..., { relationPlan })`；plan 存在时**取代**占位 `createEdge` 意图 |

**executor · runner · contracts · applier · adapter 零改动。**

## 3. 归属判定（为何属于 planning 而非 execution）

| 理由 | 说明 |
|---|---|
| 端点解析需**读**知识 | executor 被裁定不得接触 store/knowledge（硬约束 1）；给它读端口 = runtime↔knowledge 耦合 |
| 产出的是**数据**不是副作用 | 适合放在组合根（唯一双向知晓点）；applier 仍只认接口 |
| 保持 executor 纯洁 | executor 至今零 knowledge 依赖（grep 证实），本路线未破坏 |

## 4. 冻结 spec（D6）与两处修订

```
anchor      ① 计划 node.create 载荷的 title 命中既有节点（重导入场景）
            ② 否则：既有节点位置质心
candidates  既有节点，排除 anchor 自身
selection   到 anchor 欧氏距离最小 2 个；同距按 nodeId 升序
output      relation.create：from=计划节点 id, to=候选 id, kind='ai-auto', reason 含 rank+distance
degrade     无新建节点 / 无 anchor ⇒ 不产出 relation，记录 skip，仅提交 node
```

| 修订 | 原因 | 处置 |
|---|---|---|
| **anchor 第 ① 步原为 `run.input.anchorNodeId`** | `AgentRun`（**记录**）**无 `input` 字段** —— 只有 `AgentRunRequest` 有；为其加字段会触碰冻结契约（tsc 实证：`Property 'input' does not exist on type 'AgentRun'`） | 删除该步；两步均**可从 run 记录自身推导**。缺口记入第 7 节 R1，作为未来 evolution 候选 |
| **候选排除 anchor 自身** | 探针抓出**自环**：anchor 距离 0 抢占 rank 1（`to = n-existing`，即自己） | 已修（`candidates = existing.filter(n => n.id !== anchor.nodeId)`）；Mini Plan 文档同步（commit `7a90f35`） |

两处修订均先改 **spec 源文档**，再改实现 —— 文档与代码不漂移。

## 5. 探针实证（`bench/p2531_probe.mts` = 35/35 PASS）

| 组 | 项数 | 覆盖 |
|---|---|---|
| A 冻结 spec | 15 | title-match 优先；近邻 2 个 + rank/距离；**4 候选只取 2**；`from/to/kind` 齐备；计划 id 用 `plan-relate` 命名空间 + runId；**同输入逐位一致（确定性）**；质心回退；等距与零距离按 nodeId 升序；空 store → `no-anchor`；无 `node.create` → `no-new-node`；意图检测（无该调用 / 端点已存在 ⇒ false） |
| B 链整合 | 13 | 无 plan ⇒ 2 ops（旧基线）；有 plan ⇒ **3 ops（1 node + 2 relations）**，占位被取代；`finalizeRun` 仍 0 次 adapter 调用；review 通过；**applied=3 / failed=0 / status=applied**；store 落 1 node + 2 relation 且标 `ai-auto`；输入 run 未被改写；`proposals` 回填；receipt 无 `auto_apply` 值 |
| C 降级路径 | 4 | 空 store ⇒ proposal 仅 node op；apply 1/0；store 无 relation；**skip 原因保留在 outcome 上可审计** |
| D 真实端到端 | 3 | 真实 Ollama run → plan → apply：**3 applied / 0 failed / applied** |

**回归**：`p2452_probe`（P2-4.5 全链）**40/40** 仍通过（`finalizeRun` 签名向后兼容）。

## 6. 纯净度 / 依赖 / 基线

| 项 | 结果 |
|---|---|
| executor → knowledge/workflow | **0**（grep clean，硬约束 1 保持） |
| knowledge/write → agent/workflow | **0**（grep clean） |
| `finalizeRun` mutation | **0**（B3：0 次 adapter 调用；plan 由外部先算好，函数内不含 I/O） |
| `planRelations` 写操作 | **0**（只 `listNodes()` 只读） |
| 新依赖 | **0** |
| contracts diff | **空** |
| tsc | **48 = 基线** |

## 7. 风险

| # | 项 | 说明 |
|---|---|---|
| R1 | `AgentRun` 记录不带 request 输入 | `anchorNodeId` 类 hint 无法从记录恢复；若产品需要"导入到指定节点"，须走 contract evolution（需求→字段→review→migration）。**本阶段不改契约** |
| R2 | 质心 anchor 语义较弱 | 无 title 命中时的回退是几何代理，不是语义关系；已用 `reason` 标注 `anchor=centroid` 便于人工识别 |
| R3 | 计划记录由组合根产出 | 与"ToolCall 由 executor 写入"的直觉不同；已用 `plan-relate` 阶段命名空间与 `result.plan=true` 标记区分，且仍经 builder 单一映射路径（未新增映射分支） |
| R4 | 多 node.create 时 relation 数线性增长 | 每个新节点最多 2 条；当前每次 run 仅 1 个新节点，未施加额外上限（若未来批量导入需重新评估） |
| R5 | 写目标仍是内存替身 | relation 落点仍是 InMemory adapter（A1 解决） |

## 8. 禁项核验

❌ 改 contracts ❌ 改 Applier ❌ 改 executor ❌ store 接线 ❌ 引入数据库 ❌ auto_apply ❌ 新依赖 —— 全部未触碰。

---

**状态**：🟡 路线 B 完成。提交纪律：实现（3 文件）与本文档（审计）**分离**。
