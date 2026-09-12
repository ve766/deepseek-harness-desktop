# STAGE14 P2-5 Mini Plan — Write Port / Relation Planning / Governance Visibility

> 阶段：**P2-5 架构评审结论 + 实施计划**（Design-only 定稿）。
> 前置：P2-4 写入治理链（builder → validate → applier → adapter → receipt）与 P2-4.5 Agent Core 收敛 + 组合根已提交并冻结。
> 基线：HEAD `4ae9240` · tsc **48** · contracts **零 diff** · 探针 51/51 + 40/40 + 36/36。

---

## 1. 当前架构状态（只读实证）

| 层 | 现状 | 决定性事实 |
|---|---|---|
| UI | 72 组件，手写 SVG/CSS | 依赖仅 `react`/`react-dom`；`sceneGraph` + `renderer` 契约**零消费者**（R-6 未满足）；帧/时间源 `D-P2-3-FRAME` 未决 |
| workflow | `finalizeRun`（纯）+ `applyOutcome`（显式）+ ledger | 唯一组合根 |
| agent | `runSpec` 单源 + 两驱动 | 不接触 store / knowledge |
| knowledge/write | builder → validate → applier → adapter（**InMemory**） | 语义完备；写入目标是测试替身 |
| 持久层 | `CanvasStore`（内存，30+ setter）· `KnowledgeBackend` **只读 5 方法** | **后端无写入能力** ⇒ "换成真实 backend"在字面上不可行 |

**核心判断**：治理语义完备，缺的是「写到哪」与「产出可见」。当前全链在真实运行时写进内存替身 —— 闭环成立但无产品效果。

## 2. 下一阶段目标

1. **B**：关系不再是永久占位（`relation.create` 取得 `from/to/kind`）
2. **A1**：写入通路落地到真实目标（`KnowledgeWritePort` + CanvasStore adapter）
3. **C1**：链的产出可见（Receipt / Proposal / Run Timeline）

目标链不变：`Run → Turn → ToolCall → Proposal → Review → Apply → Receipt →（消费）`

## 3. 已批准裁决（D1–D8）

| # | 裁决 |
|---|---|
| **D1** | 路线顺序 **B → A1 → C1**（C2 延后） |
| **D2** | 允许 **A1-port + CanvasStore adapter** |
| **D3** | CanvasStore **暂作为展示真相源**；**不得称为长期 Knowledge Source** |
| **D4** | 缺省字段策略放在 **adapter**（显式映射表，可测） |
| **D5** | 新建 **`KnowledgeReadPort`**（窄接口，不直接复用 `KnowledgeBackend`） |
| **D6** | `nearest-2-by-layout-distance` **冻结为 spec** |
| **D7** | 先新增**治理侧栏**，不改 Galaxy 主画布 |
| **D8** | **3D 延后** |

## 4. 路线 B — Relation Planning（组合根侧）

**根因**：`createEdge` 载荷是 `{ strategy, count }` —— 是**意图**不是**数据**；Import Rule 要求 `kind:'ai-auto'`，合法拒绝。

**归属判定**：端点解析属于 **planning**，不属于 execution。理由：① 解析需读 KG；② executor 被裁定不得接触 store / knowledge；③ 若让 executor 解析则必须给它读端口 ⇒ runtime↔knowledge 耦合。

**实现形态**：
```
planRelations(run, readPort)   →  { calls: PlannedToolCall[], skipped: PlanSkip[] }   （读端口注入，可测）
finalizeRun(run, relationPlan) →  builder 输入 = 运行期 toolCalls 去掉占位 createEdge + 计划产出的 relation calls
```
- relation 计划调用的 id 复用 **身份规则**：`toolCallId(runId, 1, 'plan-relate', n)` ⇒ 确定性、可重放
- `finalizeRun` 仍是**纯函数**（读端口在 planRelations 侧消耗），且**永不 mutation**

**`nearest-2-by-layout-distance` 冻结 spec**（D6）：

| 步骤 | 规则 |
|---|---|
| anchor 解析 | ① 计划 `node.create` 载荷中的 `title` 与既有节点 title 匹配（重导入场景）→ ② 既有节点位置**质心** |
| 候选 | 既有节点，**排除 anchor 自身**（计划新建节点尚未入库；anchor 不能与自己相连） |
| 选中 | 到 anchor 的欧氏距离最小 2 个；**同距按 nodeId 升序**（确定性） |
| 产出 | `relation.create`：`from = 计划新建节点 id`、`to = 候选 id`、`kind = 'ai-auto'`、`reason` 含 rank 与距离 |
| 降级 | 无 anchor 或无候选 ⇒ **不产出 relation**，记录 skip 原因，仅提交 node（receipt 可见） |

> **⚠️ Spec 修订（2026-09-12，实现期发现）**：初稿的 anchor 第 ① 步为 `run.input.anchorNodeId`，但 `AgentRun`（**记录**）**无 `input` 字段**——只有 `AgentRunRequest`（请求）有。完成的 run 无法恢复该 hint，而为其加字段会触碰冻结契约。故修订为上述两步（均**可从 run 记录自身推导**）。该契约缺口记入 P2-5 Review 作为**未来 contract evolution 候选**，本阶段不打补丁。

**依赖**：workflow → `KnowledgeReadPort`（窄，仅 `listNodes()`）；executor **零改动**。
**新增文件**：`src/workflow/knowledgeReadPort.ts`（接口 + InMemory 测试替身）、`src/workflow/planRelations.ts`。

## 5. 路线 A1 — Write Port + CanvasStore Adapter

**形态**：
```
Applier（不变）
  ↓ 仅依赖接口
KnowledgeWritePort（新，knowledge/write 之外的 workflow 侧定义）  ← 本阶段仅接口 + 缺省映射表
  ↓
CanvasStore adapter（唯一接触 store 者）
```
**缺省字段显式映射表**（D4，op payload ≠ 领域实体）：

| op | 领域必填 | 缺省来源 |
|---|---|---|
| `node.create` | `id` / `kind` / `title` / `meta` / `position` | id = op target；kind/title 来自 payload；`meta = {}`；`position` 由**确定性布局函数**给出 |
| `node.update` | — | 浅合并 payload |
| `relation.create` | `id` / `from` / `to` / `kind` | 全部来自 payload（B 落地后齐备） |

**禁止**：修改 contracts、修改 Applier、修改 executor、引入数据库。
**D3 记录**：CanvasStore 仅为**展示真相源**，长期 Knowledge Source 未定（与 A3/持久化一并评估）。

## 6. 路线 C1 — 治理侧栏（SVG/CSS，零依赖）

**消费面**（全部为既有出口，只读）：

| 消费对象 | 出口 | 展示 |
|---|---|---|
| Receipt | `listReceipts()` | 每次 apply 的 applied/failed/verdict 时间线 |
| Proposal | `finalizeRun().proposal` + `skipped` | 待批卡片（ops 摘要 + 被 skip 的 tool call 审计） |
| Run | `AgentRun.status/turns/toolCalls` | 阶段时间轴（`insightKey` 已备） |

**禁止**：three.js / R3F / WebGL / 任何新依赖 / 改 Galaxy 主画布（D7：新增侧栏）。

## 7. Scope Out

❌ 3D 库与 shader / WebGL 实现 ❌ `KnowledgeBackend` 写方法（F2 冻结） ❌ SQLite / DB migration ❌ receipt 持久化 ❌ undo restore ❌ UI 审批与权限 ❌ Plugin runtime ❌ ActivityBus `run.*` migration ❌ sequencer 删除。

## 8. 禁止修改项（硬约束延续）

1. executor 不得 import `knowledge/write` / `workflow`
2. `knowledge/write` 不得 import `agent`
3. `workflow` 是唯一 Agent + Knowledge 组合根（新 adapter 目录不得成为第二个双向点）
4. `finalizeRun` 永不 mutation；`applyOutcome` 必须显式调用
5. `auto_apply` 永不产生
6. `contracts/` 零 diff
7. 不新增依赖
8. `Contract Freeze → Runtime → Consumer Wiring` 顺序不变

## 9. 验收标准

| 路线 | 验收 |
|---|---|
| **B** | 端点解析**确定性**（同输入同输出）；`from/to/kind` 齐备 ⇒ `relation.create` **applied**；无 anchor/无候选 ⇒ 降级为仅 node 且 receipt 记录原因；executor 依赖 grep 仍 clean；`finalizeRun` 仍无 mutation |
| **A1** | op → 领域实体**字段齐全性**（每个缺省值有显式来源）；写入后 `store.state` 可见；partial apply + receipt 正确；adapter **不在** `knowledge/write` 内 |
| **C1** | receipt / proposal / run 三面各至少一处渲染；**零新增依赖**；治理链 diff 为空 |
| 全局 | tsc = **48**；contracts **零 diff**；`auto_apply` 零产出；每笔 staged 清单 + HEAD 回读 |

## 10. Commit 拆分策略

| # | Commit | 内容 |
|---|---|---|
| 0 | Mini Plan | 本文档 |
| 1 | B 实现 | `knowledgeReadPort.ts` + `planRelations.ts` + `finalizeRun` 可选 relation plan |
| 2 | B Review | 审计文档 |
| 3 | A1 端口 | `KnowledgeWritePort` + 缺省映射表（纯逻辑） |
| 4 | A1 适配 | CanvasStore adapter（唯一接触 store 者） |
| 5 | A1 Review | 审计文档 |
| 6 | C1 消费 | 治理侧栏（零依赖） |
| 7 | C1 Review | 审计文档 |

每笔：staged 清单恰好目标文件 → oxlint(staged) → commit → HEAD 回读；**实现与审计分离**。
