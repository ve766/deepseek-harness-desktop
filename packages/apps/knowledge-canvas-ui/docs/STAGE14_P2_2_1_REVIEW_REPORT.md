# STAGE14 P2-2.1 Review Report — 类型骨架

> 状态：**实现完成，停在 Review Node**。5 个契约文件已建立，**未提交**（按裁决 6 不自动 commit）。
> 上游：P2-2.1 Mini Plan（已批准）· `STAGE14_P2_2_ARCHITECTURE_CONTRACTS.md`（`3f07f83`）。

---

## 1. 交付物

`packages/apps/knowledge-canvas-ui/src/contracts/`（新增目录，**5 个文件，390 行，全部 type-only**）：

| 文件 | 行数 | 内容 |
|---|---|---|
| `activityEvent.ts` | 62 | `ActivitySourceId` · `ActivityKind`（12 种，冻结）· `ActivitySeverity` · `ActivityTarget` · `ActivityEvent` · `ActivityFilter` |
| `activityBus.ts` | 30 | `Unsubscribe` · `ActivitySource` · `ActivityReplayOptions` · `ActivityBus` |
| `sceneGraph.ts` | 161 | `Vec2` · `BBox` · `VisualIntent` · `AnimationIntent` · `SymbolRef` · `PaletteHint` · `SceneNode` / `SceneEdge` / `SceneGroup` / `SceneOverlay` / `SceneMetadata` / `SceneGraph` · `SceneOp` / `ScenePatch` / `DirtyRegion` |
| `renderer.ts` | 46 | `RenderCapability` · `Viewport` · `RenderSurface` · `Renderer` · `RendererProbe` |
| `agentRun.ts` | 91 | `TaskKind` · `RunStatus` · `RunTurnRole` · `ToolCallStatus` · `Privacy` · `RouteNeeds` · `Agent` · `RunTurn` · `ToolCall` · `RunResult` · `AgentRunRequest` · `AgentRun` |

**无 `index.ts`**（按裁决 4，保持依赖显式、避免循环依赖）。

---

## 2. 裁决落实核对

| # | 裁决 | 落实 |
|---|---|---|
| 1 | 目录用 `src/contracts/`；contracts 不依赖 store/knowledge/llm/mock/demo | ✅ 5 文件仅 type-only 导入 `./activityEvent` · `./sceneGraph` · `../types`（`AgentId`） |
| 2 | Proposal / Reviewer / Applier 延期 P2-2.3；不引入 approval / reviewer 状态机 / permission / undo storage | ✅ 5 文件中**零**相关类型 |
| 3 | `ActivityKind` 用纯 `type`，**不**加 const 数组 | ✅ 纯联合类型，无 `ACTIVITY_KINDS` 常量 |
| 4 | 用 `export type`；禁 default export；禁 barrel | ✅ 全部 `export type` / `export interface`；无 `export default`；无 `index.ts` |
| 5 | 增加「contracts 纯净度」验收 | ✅ 见 §3.2，全部 0 |
| 6 | 不自动 commit；不改业务代码；不修旧 TS error；不顺手整理目录 | ✅ 见 §4 |

---

## 3. 验收结果

### 3.1 tsc 检查（tsc 6.0.3，strict，`--noEmit`）

| 指标 | 结果 |
|---|---|
| 解析到的错误数 | **48**（与 P2-1 提交后基线**完全一致**） |
| `TS2307` cannot-find-module | **0** |
| **`contracts/` 内错误** | **0** |
| 落在「与 HEAD 相同行」的既有错误 | 33 |
| **落在被改动行的错误** | **0** |

⇒ **本轮零新增类型错误**。`contracts/` 自身完全干净。

### 3.2 contracts 纯净度（新增验收项）

| 检查 | 结果 |
|---|---|
| runtime import（非 `import type`） | **0 / 5 文件** |
| 运行时导出（`export const/let/var/function/class/default`） | **0** |
| 外部依赖包导入 | **0** |
| 副作用 / 实现代码 | **0** |
| 命中禁用路径（store/ · knowledge/ · llm/ · mock/ · demo/） | **0** |
| 仅含 type / interface / union | ✅ |
| 文件数（应 5，无 barrel） | ✅ 5 |

⇒ **contracts 已是纯 ABI 层**。

### 3.3 git diff 审查

| 指标 | 结果 |
|---|---|
| `git diff --stat` | 仅 **99 个既有 `M`**（tsconfig / package.json / lockfile 噪声），**无一项属本轮** |
| `contracts/` 中的 `M` | **0**（全部为新增） |
| kcu/src 被改动（非新增）的 tracked 文件 | **0** |
| `deleted` | **0** |
| 仓库根 `src ' M'` | **0** |
| `pnpm-lock.yaml` / `package.json` | 未触碰（仍在既有 `M` 中，未 stage） |

⇒ **既有业务代码零改动**，未顺手整理目录、未修旧 TS error。

---

## 4. 明确未做（对照禁止项）

| 未做 | 说明 |
|---|---|
| WebGL / Canvas renderer | `renderer.ts` 只有接口 |
| 粒子系统 · 动画实现 · shader | 无；`AnimationIntent` 是**意图**类型，非实现 |
| UI 视觉改造 | 零组件改动 |
| Agent 编排 · LangGraph · handoff | `agentRun.ts` 止于单 Run 生命周期 |
| 新依赖 | `package.json` 未动 |
| 插件事件源 · 多 Agent 协议 · 云端编排 · 权限系统 | 未定义（P2-3 / P3） |
| Proposal / Reviewer / Applier 类型 | 延期 P2-2.3 |
| 自动 commit | 未提交，等你裁决 |

---

## 5. 两条主链路的现状

```
知识数据 → Activity → SceneGraph → Renderer
   ✅ 类型层面全部就位（contracts/activityEvent · activityBus · sceneGraph · renderer）

Agent → Proposal → Applier → Knowledge
   ⚠️ 仅 Agent 侧就位（contracts/agentRun）
   ⏳ Proposal / Reviewer / Applier —— P2-2.3
```

第二条链路目前**在类型层只完成了一半**，这是按你的裁决（Q3）刻意为之，不是遗漏。

---

## 6. 待你裁决

1. 是否提交这 5 个契约文件（建议单批次：`git add src/contracts/` 5 项）
2. `STAGE14_P2_2_1_MINI_PLAN.md` 与本 Review 是否一并提交
3. 是否进入 P2-2.3（Proposal / Reviewer / Applier 类型）

---

**状态**：🟡 停在 **P2-2.1 Review Node**，未提交，等待裁决。
