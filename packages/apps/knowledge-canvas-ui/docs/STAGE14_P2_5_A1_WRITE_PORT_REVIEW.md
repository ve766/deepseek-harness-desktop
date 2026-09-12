# STAGE14 P2-5 Route A1 Implementation Review — Write Port + CanvasStore Adapter

> 阶段：**P2-5 路线 A1 实现完成**（D2/D3/D4 落地）。
> 范围：`src/workflow/knowledgeWritePort.ts`（新）· `src/workflow/adapters/storeMutationAdapter.ts`（新）· `src/workflow/adapters/canvasStoreWritePort.ts`（新）。

---

## 1. 分层（D2）

```
Applier
  │ 仅依赖接口（未改动）
  ▼
KnowledgeMutationAdapter          knowledge/write（P2-4.4.3，未改动）
  ▲ 实现
storeMutationAdapter              op → 领域实体映射 + D4 缺省表
  │ 写入
KnowledgeWritePort                持久化缝（本阶段定义）
  ▲ 实现
canvasStoreWritePort              **全仓唯一**接触 CanvasStore 的文件
  ▼
CanvasStore（展示真相源，D3）
```

**只新增，不修改**：`contracts` · `Applier` · `executor` · `KnowledgeBackend`（F2）零改动（git diff 证实）。

## 2. 端口设计要点

| 决定 | 理由 |
|---|---|
| 不复用 `KnowledgeBackend` | 它是**只读**接口（F2 冻结），扩写方法=触碰契约；独立写缝让两个方向独立演进 |
| 写方法**回报 pre-state 事实** `{ existed, before? }` | Applier 需要 `before` 做快照槽，但它不得查 store ⇒ 由端口在写入时顺便回报；端口因此保持"只写 + 事实"（唯一读方法是 `nodeCount()`，仅用于确定性布局） |
| **同步**接口 | `KnowledgeMutationAdapter.applyOp` 是同步的（P2-4.4.3），Applier 的循环按它写成；异步端口今天插不进来 |
| 不做"看起来同步"的异步包装 | 那会是一个谎：读旧值、后台写，receipt 会先于落盘返回 |

## 3. D4 缺省字段显式表（无盲目 spread）

| 字段 | 来源 |
|---|---|
| `node.id` | op target id（builder 预分配） |
| `node.kind` / `node.title` | payload（**缺失即 `invalid-payload`**） |
| `node.meta` | payload.meta（string map）否则 `{}` |
| `node.position` | **placement 策略**（默认 golden-angle 螺旋；确定性、无 RNG/时钟） |
| `node.aiStatus` / `ownerAgent` | payload 透传（AI 标记已由 Import Rule 保证） |
| `edge.kind` | payload.kind，否则领域默认 `'manual'` |
| `edge.reason` | payload.reason（可解释边） |

`kind` 不做值域白名单：**kind 的合法性属于实体契约**，在写链里再造一个更弱的校验器只会产生第二个真源。

## 4. 探针实证（`bench/p2532_probe.mts` = 36/36 PASS）

| 组 | 项数 | 覆盖 |
|---|---|---|
| A 端口语义 | 9 | create/update/delete 的 `existed`/`before` 事实；**重复 create 不覆盖**；缺目标为事实非异常；**删节点级联删边**（store 领域规则） |
| B 映射与缺省 | 15 | meta `{}`；placement 确定性；缺 title/kind ⇒ `invalid-payload`；重复 ⇒ `duplicate-target`；update 带 before；缺目标 ⇒ `missing-target`；relation 缺端点 ⇒ `invalid-payload`；无 kind ⇒ 领域默认；未知 op ⇒ `unsupported-op`；非 record ⇒ `invalid-payload`；端口抛错 ⇒ **`engine-error` 不外泄** |
| C **真实 CanvasStore** | 5 | 节点/关系真实落入 `store.getState()`；meta/placement 正确；update 经 `setNodes` 生效；重复 ⇒ `duplicate-target` |
| D 全链对真实 store | 7 | `finalizeRun` 未触碰 store；receipt **3 applied / 0 failed**；store 得 1 节点 + 2 关系；节点带 `aiStatus/ownerAgent`；关系指向计划节点且 `ai-auto`；`run.proposals` 回填；receipt 无 `auto_apply` 值 |

**回归**：路线 B 探针 `p2531` 与 P2-4.5 全链 `p2452` 仍通过（见收口报告）。

## 5. 纯净度 / 依赖 / 基线

| 项 | 结果 |
|---|---|
| 触碰 store 的文件数 | **1**（`adapters/canvasStoreWritePort.ts`，grep 证实） |
| `knowledge/write` → agent/workflow/store | **0** |
| `executor` → knowledge/workflow | **0** |
| `contracts` diff | **空** |
| Applier / executor 改动 | **0**（git diff 证实） |
| 新依赖 | **0** |
| tsc | **48 = 基线** |

## 6. 风险与两个新发现

| # | 项 | 说明 |
|---|---|---|
| **R1（新发现，架构级）** | **同步 adapter 契约是异步持久化的结构性阻断** | `MutationAdapter.applyOp` 同步 ⇒ SQLite / HTTP store 等异步后端**无法接入**，除非重新协商 adapter 契约（须先裁决，且会触达 Applier 调用点）。这是 A3（独立持久化）路线的**前置条件**，不是实现细节 |
| **R2（新发现）** | **receipt 先于落盘的风险被规避，但"崩溃即丢"仍在** | 端口同步写入 ⇒ receipt 记录时数据已落 store 内存；但 store 本身不持久化，进程退出即丢（D3 已明示 CanvasStore 非长期知识源） |
| R3 | `node.delete` 级联删边 | 由 store 领域规则决定（非本适配器发明）；已在文件头注释与探针 A9 记录 |
| R4 | `kind` 不做值域校验 | 有意的分层选择；未知 kind 在 UI 侧显形，而非在写链里被第二个校验器拒绝 |
| R5 | 展示真相源 = CanvasStore | 与 Galaxy 渲染共用同一状态 ⇒ 治理写入会**立即**影响画面（对 C1 有利；但若未来引入独立持久层，需重新定义谁是真相源） |
| R6 | 端口新增读方法 `nodeCount()` | 仅服务确定性布局；若继续增长将退化为读接口 —— 需要时改为注入 placement 序号来源 |

## 7. 禁项核验

❌ 改 contracts ❌ 改 Applier ❌ 改 executor ❌ 引入数据库 ❌ 新依赖 ❌ auto_apply —— 全部未触碰。

---

**状态**：🟡 路线 A1 完成（端口 / 适配 / 审计三笔分离提交）。
