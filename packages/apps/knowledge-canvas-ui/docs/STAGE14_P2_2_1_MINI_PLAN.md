# STAGE14 P2-2.1 Mini Plan — 类型骨架

> 状态：**待批准，未编码**。本计划只描述 P2-2.1 的实现范围与验收方式。
> 上游：`STAGE14_P2_2_ARCHITECTURE_CONTRACTS.md`（已批准契约，`3f07f83`）。
> 用户裁决（2026-09-11）：P2-2.1 **只实现 A–E 五组类型定义**，其余一律不做。

---

## 1. 目标与非目标

### 1.1 目标

建立**未来不会推倒重来的骨架**，让两条主链路在**类型层面**先成立：

```
知识数据 → Activity → SceneGraph → Renderer
Agent → Run → (Turn → ToolCall → Result)
```

交付物是**纯类型**：`type` / `interface` 定义，**不含运行时逻辑**。

### 1.2 非目标（本阶段不做）

| 不做 | 归属 |
|---|---|
| WebGL renderer · Canvas renderer · 粒子系统 · 动画实现 · shader | P3 |
| UI 视觉改造 | 禁止（N2） |
| Agent 编排 · LangGraph · handoff · 多 Agent 通信协议 | P2-4 / P3 |
| 新依赖 | 禁止（N8） |
| 插件事件系统 · 云端 provider 编排 · 复杂权限系统 | P2-3 / P3（**不过度设计**） |
| Proposal / Reviewer / Applier 类型 | P2-2.3（见 §7 Q3） |
| 任何运行时实现（bus 实现、IR 构建器、路由实现） | 后续阶段 |

---

## 2. 文件布局

新增**一个目录、五个文件**，全部 `type`-only：

```
packages/apps/knowledge-canvas-ui/src/contracts/
├── activityEvent.ts     (A) ActivityEvent 类型定义
├── activityBus.ts       (B) ActivityBus 基础接口
├── sceneGraph.ts        (C) SceneGraph IR 类型定义
├── renderer.ts          (D) Renderer interface 类型定义
└── agentRun.ts          (E) Agent Run 类型定义
```

**为何新增 `contracts/` 而非放进 `domain/`**：`domain/` 目前存放**领域数据**（`agents.ts` 花名册、`nodeKinds.ts` 归属词汇）；本批是**接口契约**，二者生命周期与变更频率不同。分开可避免日后「改一个枚举要动领域数据目录」。

**依赖方向（严格）**：

```
contracts/  ← 只依赖 types.ts 的 AgentId（type-only import）
            ← 不得 import store / knowledge / llm / mock / demo
```

---

## 3. 逐项范围

### A. `contracts/activityEvent.ts`

| 类型 | 内容 |
|---|---|
| `ActivitySourceId` | `'user' \| 'ingestion'`（**冻结**，与契约 §3.4 一致） |
| `ActivityKind` | 冻结 12 种：`galaxy.opened` · `node.clicked` · `node.selected` · `node.dragEnd` · `search.performed` · `task.created` · `knowledge.viewed` · `document.imported` · `extraction.completed` · `extraction.failed` · `entity.discovered` · `relation.created` |
| `ActivityTarget` | `nodeIds?` / `edgeIds?` / `docId?` / `query?` |
| `ActivityEvent` | `id` · `seq` · `ts` · `source` · `kind` · `actor?` · `target?` · `payload?` · `severity?` · `runId?` |
| `ActivityFilter` | `sources?` / `kinds?` / `sinceSeq?` |

### B. `contracts/activityBus.ts`

| 类型 | 内容 |
|---|---|
| `Unsubscribe` | `() => void` |
| `ActivitySource` | `id: ActivitySourceId`、`subscribe(next): Unsubscribe` |
| `ActivityBus` | `register` · `subscribe` · `replay` · `latestSeq` |

> ⚠️ **只定义接口，不实现**。`replay` 返回 `AsyncIterable<ActivityEvent>` —— 这是「脚本化 demo 可被事件回放取代」的类型保障，值这个设计成本。

### C. `contracts/sceneGraph.ts`

| 类型 | 内容 |
|---|---|
| 基元 | `Vec2` · `BBox` |
| 意图 | `VisualIntent`（`state` / `emphasis?` / `symbol?` / `palette?`）· `AnimationIntent` · `SymbolRef` · `PaletteHint` |
| 场景 | `SceneNode` · `SceneEdge` · `SceneGroup` · `SceneOverlay` · `SceneMetadata` · `SceneGraph` |
| 增量 | `SceneOp` · `ScenePatch`（含 `dirty?: DirtyRegion`）· `DirtyRegion` |

> IR 内**不得出现** CSS / shader / DOM 相关字段。位置 `Vec2` 由 `layoutGalaxy`（纯函数，F9）产出。

### D. `contracts/renderer.ts`

| 类型 | 内容 |
|---|---|
| `RenderCapability` | `'svg' \| 'canvas2d' \| 'webgl2' \| 'webgpu'` |
| `RenderSurface` | `kind` · `target` |
| `Viewport` | 视口/缩放（最小集） |
| `Renderer` | `id` · `capability` · `mount` · `unmount` · `apply(ScenePatch)` · `setViewport` · `hitTest` · `dispose` |
| `RendererProbe` | `detect()` · `select(preferred?)` |

> 只定义**接口**；`RendererProbe` 的探测逻辑属实现，本阶段不做。

### E. `contracts/agentRun.ts`

| 类型 | 内容 |
|---|---|
| `TaskKind` | `'extract' \| 'classify' \| 'plan' \| 'qa' \| 'summarize'` |
| `RunStatus` | `pending` / `running` / `awaiting_approval` / `completed` / `failed` / `cancelled` |
| `Agent` | `id: AgentId` · `taskKinds` |
| `RunTurn` | `index` · `role` · `content` · `ts` |
| `ToolCall` | `id` · `name` · `args` · `status` · `result?` · `ts` |
| `RunResult` | `status` · `output?` · `error?` · `usage?` |
| `AgentRun` | `runId` · `agentId` · `status` · `turns` · `toolCalls` · `proposals` · `result?` · `cancel()` |
| `RouteNeeds` / `AgentRunRequest` | 路由输入（含 `privacy`，默认 `local-only`） |

> 层级 `Agent → Run → Turn → ToolCall → Result`。**不含** handoff / 编排 / 多 Agent。

---

## 4. 明确不做（逐条对照禁止项）

| 禁止项 | 本计划中的体现 |
|---|---|
| WebGL renderer | D 只有接口，无实现 |
| Canvas renderer | 同上 |
| 粒子系统 | 不在任何文件出现 |
| 动画实现 | C 只有 `AnimationIntent`（**意图**，非实现） |
| shader | IR 内无 shader 字段 |
| UI 视觉改造 | 零改动现有组件 |
| Agent 编排 | E 只到单 Run 生命周期 |
| LangGraph | 不引入 |
| 新依赖 | `package.json` 零改动 |

**不过度设计（用户第 5 条）**：不定义插件事件源类型、多 Agent 通信协议、云端编排、权限系统。`ActivitySourceId` 保持 `'user' \| 'ingestion'` 两个字面量，**不为未来预留联合成员**。

---

## 5. 与现有代码的关系（零改动清单）

| 文件 | 状态 |
|---|---|
| `types.ts` | 不改（只被 `agentRun.ts` **类型导入** `AgentId`） |
| `store/canvasStore.ts` | 不改 |
| `knowledge/*` | 不改（`KnowledgeBackend` seam 不变） |
| `llm/*` | 不改 |
| `domain/*` · `demo/*` · `mock/*` | 不改 |
| `package.json` · `pnpm-lock.yaml` | 不改 |

---

## 6. 验收标准

| # | 标准 | 检查方式 |
|---|---|---|
| 1 | 新增 **5 个文件**，全部在 `src/contracts/` | `git status --short` |
| 2 | 全部 **type-only**：无 `export const` / `export function` / 运行时语句 | grep 校验 |
| 3 | `contracts/` **不** import store / knowledge / llm / mock / demo | grep 校验 |
| 4 | `tsc --noEmit`（tsc 6.0.3）：**新增错误 = 0**（基线 57 条既有错误不变） | 逐行比对 HEAD |
| 5 | 现有文件 **零改动**：diff 仅 5 个新增文件 | `git diff --cached --name-status` |
| 6 | `package.json` / lockfile 未改 | `git status --short` |

**提交方式**：单批次 5 个文件（同一逻辑单元），staged 前输出清单，`src ' M'=0`、`deleted=0`、不污染既有 99 M。

---

## 7. 风险与开放问题

| # | 问题 | 建议 |
|---|---|---|
| Q1 | `src/contracts/` vs 放 `src/domain/` | **建议 `contracts/`**（理由见 §2）；若你倾向 `domain/`，我照办 |
| Q2 | `ActivityKind` 用纯 `type` 联合，还是额外导出 `const` 数组便于校验 | **建议纯 type**（本阶段「类型定义」），需要运行时数组时再加 |
| Q3 | Proposal / Reviewer / Applier 类型是否也进 P2-2.1 | **建议不进** —— 你的 A–E 清单未含；建议归 P2-2.3，本计划保持单目标 |
| Q4 | 是否加 `contracts/index.ts` barrel | **建议不加** —— barrel 会成为跨模块运行时导入面，与纯净度门禁精神冲突 |
| Q5 | 类型文件是否需要 `export type` 显式标注 | **建议显式**（`isolatedModules: true` 已在 tsconfig 中，显式更安全） |

---

## 8. 步骤（批准后执行）

1. 建 `src/contracts/`，写入 5 个 type-only 文件
2. grep 校验：无运行时导出、无越层 import
3. `tsc --noEmit` 逐行比对 HEAD，确认 0 新增错误
4. 输出 staged 清单 → 单批次提交
5. 停在 P2-2.1 Review Node

---

**状态**：🟡 停在 **P2-2.1 Mini Plan Review Node**，等待批准（尤其 Q1 / Q3）。批准后我才编码。
