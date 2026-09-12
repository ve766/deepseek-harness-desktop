# STAGE14 P2-2.3 Mini Plan — 知识写入治理契约

> 状态：**待批准，未编码**。本计划先确认数据边界，不创建 Proposal / Reviewer / Applier 文件。
> 上游：`STAGE14_P2_2_ARCHITECTURE_CONTRACTS.md`（`3f07f83`）· `src/contracts/` 五契约（`fdcbc25`）。
> 用户裁决：先输出 Mini Plan，**不**直接创建实现；保持两条链**不合并**。

---

## 1. 为什么先出 Mini Plan

SceneGraph / Activity / AgentRun 三条基础契约刚冻结。在把它们接进写入治理之前，必须先钉死这五级之间的**数据边界**：

```
AgentRun
   ↓
KnowledgeWriteProposal
   ↓
ReviewDecision
   ↓
KnowledgeApplier
   ↓
Knowledge Store
```

边界一旦定错，后面每一步实现都是在错误的地基上加固。

---

## 2. 五级数据边界（本计划的核心交付）

| 边界 | 传递的数据 | 归属 | **不传递什么** |
|---|---|---|---|
| **AgentRun → Proposal** | 仅 `ProposalSource`（`agentId` + `runId` + `turnIndex`）与 ops 内容 | Run 拥有**生命周期**；Proposal 是**不可变值** | Run 不得持有 KG 引用；Proposal 不得回调 Run |
| **Proposal → Reviewer** | 整个 Proposal（**只读**） | Reviewer 拥有**决策**，不拥有数据 | Reviewer 不得修改 Proposal（不得就地打标） |
| **Reviewer → Applier** | `ReviewDecision` + 逐 op 判定 + 拒绝码 | Applier 拥有**写入权** | 不得传递"已修正的 ops"（改写 Proposal 会破坏审计） |
| **Applier → Store** | 经过校验的 ops | Store 是**唯一真相** | Applier 不得缓存 KG 状态 |

**关键不变量**：Proposal 一旦产出即**不可变**。任何"修改"都=产出新 Proposal。这是审计链可信的前提。

---

## 3. 契约草案（示意，待批准后实现）

### 3.1 Operation

```ts
export type ProposalOpType =
  | 'node.create' | 'node.update' | 'node.delete'
  | 'relation.create' | 'relation.update' | 'relation.delete'

/** 稳定标识引用 —— Evidence 只引用，不嵌入数据 */
export type EvidenceRef =
  | { readonly kind: 'node';      readonly id: string }
  | { readonly kind: 'doc';       readonly id: string }
  | { readonly kind: 'chunk';     readonly id: string }
  | { readonly kind: 'event';     readonly seq: number }   // 指向 ActivityBus 的 append-only 游标
  | { readonly kind: 'text';      readonly excerpt: string }

export interface ProposalOp {
  readonly type: ProposalOpType
  readonly target: { readonly nodeId?: string; readonly relationId?: string }
  readonly payload: unknown
  readonly confidence: number                 // 0..1，逐 op
  readonly reason: string                     // 单操作解释
  readonly evidence?: readonly EvidenceRef[]
  readonly undo?: ProposalUndo
}
```

> **Evidence 引用 `event.seq` 是刻意的**：它把「为什么改」锚定到 append-only 的事件游标上，可复查。
> 但这是**引用**，不是类型依赖 —— `knowledgeWrite` 不 import `activityBus`，两链不合并。

### 3.2 Proposal

```ts
export type ProposalSource =
  | { readonly kind: 'agent';     readonly agentId: AgentId; readonly runId: string; readonly turnIndex?: number }
  | { readonly kind: 'ingestion'; readonly docId: string }
  | { readonly kind: 'user' }                 // UI 手工编辑同通道 → 审计一致

export interface KnowledgeWriteProposal {
  readonly id: string                          // 幂等键
  readonly source: ProposalSource
  readonly agentId: AgentId
  readonly timestamp: number
  readonly confidence: number                  // 提案级 0..1
  readonly explanation: string                 // 提案级解释
  readonly ops: readonly ProposalOp[]
}
```

### 3.3 Reviewer 输出

```ts
export type ReviewDecision = 'auto_apply' | 'needs_approval' | 'reject'
export type ReviewCode = 'ok' | 'schema' | 'import_rule' | 'privacy' | 'stale' | 'low_confidence' | 'destructive'

export interface ReviewVerdict {
  readonly index: number
  readonly ok: boolean
  readonly code?: ReviewCode
  readonly reason?: string
}
export interface ReviewResult {
  readonly proposalId: string
  readonly decision: ReviewDecision
  readonly verdicts: readonly ReviewVerdict[]
}
```

判定顺序（短路）：`schema` → `import_rule`（F1）→ `privacy`（local-only）→ `low_confidence` / `destructive` → 出 `needs_approval`。

### 3.4 Applier 输入输出

```ts
export interface ApplyResult {
  readonly proposalId: string
  readonly applied: number
  readonly failed: number
  readonly verdicts: readonly ReviewVerdict[]   // 落盘期的逐 op 结果（可能与 review 不同）
  readonly undoToken?: string
}
export interface KnowledgeApplier {
  apply(proposal: KnowledgeWriteProposal, review: ReviewResult): Promise<ApplyResult>
  undo(undoToken: string): Promise<UndoResult>
}
export interface UndoResult { readonly ok: boolean; readonly restored: number; readonly reason?: string }
```

---

## 4. 关键设计决策（含取舍）

| # | 决策 | 取舍 |
|---|---|---|
| D1 | **ID 由 Proposal 侧预分配**（非 Applier 生成） | 优点：同批 ops 可互相引用、天然幂等。代价：需要 id 生成约定 |
| D2 | **`proposal.id` 即幂等键**，Applier 必须幂等 | 重放同一 Proposal 不得产生二次变更 —— 这是 Agent 重试场景的刚需 |
| D3 | **逐 op 结果，而非整批失败** | 一个 op 被拒不影响其它；代价是调用方必须处理"部分成功" |
| D4 | **Confidence 只描述，不决策** | 阈值判定在 Reviewer；Proposal 不带"我应该通过吗"字段 |
| D5 | **Evidence 只存引用** | 不把文档片段塞进 Proposal（体积 + 一致性）；用 `event.seq` / `chunk.id` 复查 |
| D6 | **Undo 形态：待定**（见 Q1） | before-state 快照（稳但占空间）vs 逆操作（省但依赖顺序） |

---

## 5. 与既有契约的接缝

| 既有 | 关系 |
|---|---|
| `agentRun.ts` 的 `proposals: readonly string[]` | **已预留** —— 本阶段正好接上（Run 只持有 id） |
| Import Rule（F1） | Applier 强制：外部输入只入 Space，Growth 只经 Relationship 派生 |
| `local-only`（R-3） | Reviewer 判 `privacy` + Applier **二次校验**（纵深防御） |
| `activityBus.ts` | **仅被引用**（`EvidenceRef { kind:'event', seq }`），**不 import** |
| `sceneGraph.ts` / `renderer.ts` | **完全无关** —— 两链不合并 |

> 按你的提醒：**不为了"完整"提前合并两条链**。可视化链与写入治理链各自独立演进。

---

## 6. 禁止项对照

| 禁止 | 本计划中的体现 |
|---|---|
| 审批 UI | 只定义 `needs_approval` 决策值，无 UI |
| 权限系统 · 用户角色系统 | 不定义任何 role / permission 类型 |
| 数据库迁移 | 不涉及 |
| 真正写入逻辑 | 只有 Applier 的**接口**签名，无实现 |
| Agent 编排 · 多 Agent handoff | 不涉及（P2-4 / P3） |

---

## 7. 文件布局（建议）

```
src/contracts/knowledgeWrite.ts      ← 单文件：Proposal + Reviewer 输出 + Applier IO
```

三者互相引用极密（Review 依赖 Proposal，Apply 同时依赖两者），单文件可避免碎裂。
若你偏好按阶段拆为 `proposal.ts` / `review.ts` / `applier.ts`，我照办（见 Q2）。

**沿用 P2-2.1 规则**：`export type` 优先、禁 default export、禁 barrel、`import type` 仅指向 `../types`（`AgentId`）与同目录文件。

---

## 8. 验收标准

| # | 标准 |
|---|---|
| 1 | 新增 1 个 type-only 文件（或 3 个，取决于 Q2） |
| 2 | **contracts 纯净度**：runtime import 0 · 运行时导出 0 · 外部依赖 0 · 副作用 0 · 禁用路径命中 0 |
| 3 | 必须包含：Proposal 数据结构 · Operation 类型 · Evidence 引用 · Confidence · Reason/Explanation · Undo 信息 · Reviewer 输出类型 · Applier 输入输出契约 |
| 4 | `tsc --noEmit` 错误数**不变**（当前基线 48），`contracts/` 内错误 0 |
| 5 | `package.json` / lockfile 未改；业务代码零改动；不修旧 TS error |
| 6 | 不 import `activityBus` / `sceneGraph` / `renderer`（两链不合并） |

---

## 9. 开放问题

| # | 问题 | 建议 |
|---|---|---|
| **Q1** | **Undo 形态**：before-state 快照 vs 逆操作？ | 建议 **before-state 快照**（按 op 携带最小前态，如 `undo?: { before?: unknown }`）。理由：不依赖 op 执行顺序，回滚更稳；代价是体积。逆操作在 delete/create 互换时易错 |
| **Q2** | 单文件 `knowledgeWrite.ts` vs 三文件 `proposal/review/applier` | 建议**单文件** |
| **Q3** | 并发/陈旧性：是否加乐观锁（`expectedVersion`）？ | 建议 **P2-2.3 不加**，先用 `stale` 拒绝码 + 逐 op 校验兜底；真实并发场景出现后再加 |
| **Q4** | Confidence 阈值放哪 —— Reviewer 内部常量，还是契约里可配置字段？ | 建议**不进契约**（避免变成配置项膨胀），由 Reviewer 实现持有 |
| **Q5** | `ProposalUndo` 是否现在就定型？ | 建议先留 `unknown` 形状 + 注释标注 Q1 结论，避免二次冻结 |

---

## 10. 步骤（批准后）

1. 按 Q1/Q2 结论写 `src/contracts/knowledgeWrite.ts`（type-only）
2. 复跑 contracts 纯净度 + tsc 对比（错误数不变）
3. git diff 审查（仅新增）
4. 输出 P2-2.3 Review Report
5. 停 Review Node，等你裁决是否提交

---

---

## 11. 架构判定（2026-09-12 已确认，随本文冻结）

**KnowledgeWrite 链路在契约层闭合。** 五级链路最终冻结：

```
AgentRun
   ↓
KnowledgeWriteProposal      （不可变；id 即幂等键）
   ↓
ReviewDecision              （auto_apply / needs_approval / reject + 逐 op 判定）
   ↓
KnowledgeApplier            （不理解 Agent/LLM/Router）
   ↓
Knowledge Store
```

同时保持可视化链独立：

```
ActivityBus → SceneGraph IR → Renderer
```

### 两链关系（长期约束）

| 项 | 规则 |
|---|---|
| 关联方式 | **仅通过 `EvidenceRef`**（可引用 `event.seq` 锚定到 append-only 游标） |
| 类型耦合 | **不允许** |
| import 依赖 | **不允许** —— `knowledgeWrite.ts` 不 import `activityBus` / `sceneGraph` / `renderer`，反之亦然 |

> 这条边界持续有效：`EvidenceRef` 是**引用**（一个数字/字符串），不是类型依赖。任何一方都不得为「方便」而互相 import。

### 由此形成的两条架构护栏

1. 未来做粒子银河 / 3D 城市 / WebGL Renderer 时，**不需要碰业务层**。
2. 未来 AI Employee 写知识时，**不允许绕过审计链**（Proposal → Review → Applier 是唯一写入通道；UI 手工编辑也走同一通道）。

---

**状态**：✅ P2-2.3 Review 通过，契约已冻结并落盘。下一节点：**P2-3 typed bridge**（仅设计）。
