# STAGE14 P2-4.1 Implementation Review — ActivityBus Wiring

> 阶段：**P2-4.1 实现完成，停在 Review Node，未提交**。
> 范围：将 4 个已确认事件发射点接入 ActivityBus；最小 runtime wiring，无 UI 行为变化。

---

## 1. 文件清单

| # | 文件 | 动作 | 内容 |
|---|---|---|---|
| 1 | `src/activity/activityBus.ts` | **新增**（~150 行） | ActivityBus runtime：`createActivityRuntime()` + 宿主单例 emit helpers |
| 2 | `src/components/KnowledgeNode.tsx` | +2 行 | 点击节点 → `node.clicked`（import + emit） |
| 3 | `src/components/CanvasViewport.tsx` | +2 行 | 框选结束 → `node.selected` |
| 4 | `src/components/useNoxResearch.ts` | +2 行 | 查询发起 → `search.performed`（`target.query`） |
| 5 | `src/components/useEmployeeKnowledgeContribute.ts` | +4 行（含注释） | 贡献成功 → `document.imported`（`docId = r.nodeId`） |

> 注：`KnowledgeNode.tsx` 在本仓库**未跟踪**（P2-1 已知现状），故其改动不出现在 `git diff`，但**在盘上生效**（已 grep 验证：import 行 6、emit 行 45）。

## 2. 四个发射点（4/4，与批准清单一致）

| 事件 kind | source | 发射点 | 触发时机 |
|---|---|---|---|
| `node.clicked` | `user` | `KnowledgeNode.tsx:45` | 单击节点（紧随既有 `setSelection`，不改变其行为） |
| `node.selected` | `user` | `CanvasViewport.tsx:187` | 框选结束（`onPointerUp` 内既有逻辑之后） |
| `search.performed` | `user` | `useNoxResearch.ts:66` | 查询发起（`setState(retrieving)` 之后） |
| `document.imported` | `ingestion` | `useEmployeeKnowledgeContribute.ts:54` | `access.contribute(src)` 成功返回后（`r.ok` 才发） |

**未接（按裁决留 pending anchor）**：`galaxy.opened` · `knowledge.viewed` · `task.created` · `node.dragEnd`（有锚点但不在首批清单）· `extraction.completed/failed` · `entity.discovered` · `relation.created`（LightRAG 服务端异步，本地无真锚点）。

## 3. Runtime 设计要点

- **方案 A（丢弃式）**：`publish → notify → discard`，**零缓冲**。`seq` 只递增计数，事件对象发出即弃。
- **`replay()` 契约冲突的处理**：冻结契约要求 `replay(): AsyncIterable<ActivityEvent>`。按裁决"不实现 replay"，实现为**空 async generator** + 注释明示"P2-4.1 by design empty；持久化回放属 Activity Timeline 阶段"。`latestSeq` 返回计数器（真实递增）。
- **生命周期**：`create → running → dispose → closed`。`dispose()` 后 `dispatch` 静默丢弃、sinks 清空、emit 仍返回事件但不通知（closed 语义）。
- **订阅者隔离**（P2-3 Q5）：`dispatch` 逐 sink `try/catch`，单个观察者异常不影响链路、不传播回发布者。
- **发射端模型**：`createEmitter(id)` 产生绑定 bus 的 emitter（`emit()` 分配 `seq/ts/id` 后同步 dispatch）；宿主层暴露 `emitUserActivity` / `emitIngestionActivity` 两个 helper，组件**只 import 函数，不持有 bus**。

## 4. 依赖方向（实测）

```
components/useEmployeeKnowledgeContribute ─┐
components/KnowledgeNode ──────────────────┤
components/CanvasViewport ─────────────────┼─→ src/activity/activityBus.ts
components/useNoxResearch ─────────────────┘         │ import type only
                                                     ↓
                                    contracts/activityBus.ts + activityEvent.ts
```

- `src/activity/` 的 import **全部为 `import type`**，且**仅指向** `../contracts/*`
- **0** runtime import（无 react、无 crypto）· **0** store/knowledge/llm/mock/demo 引用
- `document.imported` 在**调用方**（hook）发射而非 `lightRAGBackend` —— knowledge 层**零改动**，无反向依赖
- 无 `index.ts`，无 barrel

## 5. 验收结果（对照 6 项验收 + 8 项标准）

| # | 标准 | 结果 |
|---|---|---|
| 1 | 四个事件均有 emit 点 | ✅ **4/4**（见 §2） |
| 2 | ActivityBus 创建位置唯一 | ✅ `createActivityRuntime(` 全仓**仅** `src/activity/activityBus.ts` |
| 3 | component 不持有 bus 实例 | ✅ 组件持有扫描 = **NONE**；无 `new ActivityBus(` |
| 4 | 无循环依赖 | ✅ DFS 三色：**cycles = 0**（components → activity → contracts） |
| 5 | tsc 新增错误 = 0 | ✅ **48 = 基线**；`TS2307 = 0`；`activity/` 内 **0**；改动行错误 **0** |
| 6 | git diff 只含 P2-4.1 文件 | ✅ tracked `M` = 3 文件 **+8 行**（另 KnowledgeNode 改动在未跟踪文件上生效）；新增 `src/activity/`；`contracts/` **零改动** |
| V4 | UI 行为零变化 | ✅ 全部为既有逻辑后的**加法**发射，未改任何 store 调用 |
| V8 | 无持久化/跨会话/网络 | ✅ 无 localStorage / indexedDB / fetch |
| — | package.json / lockfile | ✅ 未触碰（其 `M` 为既有基线，未 stage） |

## 6. 过程中发现并修复的问题

1. **导入源错误（已修）**：最初把 `ActivityBus` 类型从 `contracts/activityEvent` 导入 → `TS2305` ×1 + 隐式 any ×3（52 ≠ 48）。**这正是"实现必须过 tsc 门"的价值**：修正为从 `contracts/activityBus` 导入后回到 48。
2. **grep 子串陷阱（第二次踩）**：`grep -cv import` 把 `emitIngestionActivity('document.imported', ...)` 误排除（`imported` 含子串 `import`），计数显示 3 → 修正排除方式后确认 **4/4**。与此前 `timeout` 陷阱同类，已记入长期记忆。

## 7. 风险与后续

| # | 项 | 说明 |
|---|---|---|
| R1 | `replay()` 空实现 | 类型满足、语义缺口已注释；若后续误以为可用会得到空流 —— Activity Timeline 阶段必须补真实现或演进契约 |
| R2 | `search.performed` 语义 | 发射点是 Nox 研究查询而非通用搜索框；语义偏差已在 P2-4.1 Review 标注，此处按裁决接入 |
| R3 | 未跟踪文件上的改动 | `KnowledgeNode.tsx` 改动 git 不可见（P2-1 既有现状），该包整体首次提交时入库 |
| R4 | pending anchor 清单 | 8 种 kind 未接线（见 §2），长期悬空需在 P3 前决定接/删/改 |

## 8. 红线与状态

| 项 | 状态 |
|---|---|
| HEAD | `23b172e`（本轮无 commit） |
| staged | **0**（未提交） |
| tracked 改动 | 3 文件 +8 行（全属 P2-4.1） |
| untracked | 145（含新增 `src/activity/` 与本文档） |
| `contracts/` | **零改动** |
| 根 `src ' M'` | 0 |
| `ActivitySourceId` | 未扩展（仍 `'user' \| 'ingestion'`） |
| package.json / lockfile | 未触碰 |
| 服务 | 未启动（Ollama 11434 常驻、LightRAG 9621 停） |

---

**状态**：🟡 停在 **P2-4.1 Review Node，未提交**。待裁决：① 是否提交（建议单批次：`src/activity/` + 3 个 tracked 组件；KnowledgeNode 随包首提入库）② 本 Review 是否提交 ③ 是否进入 P2-4.2（AgentRun skeleton，需另出设计）。
