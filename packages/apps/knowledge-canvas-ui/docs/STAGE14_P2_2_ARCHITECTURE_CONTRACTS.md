# STAGE14 P2-2 架构契约（Design Implementation）

> 状态：**设计契约，未编码**。所有 TS 签名用于固定接口形状，**示意性质**；实现需另出 Mini Plan + 批准。
> 上游：P2-0 架构冻结（F1–F11 / N1–N10）· P2-1 UI→mock 解耦完成。
> 裁决（2026-09-11）：① Proposal 主线 ② `local-only` 产品级红线 ③ ActivityBus 首阶段范围冻结 ④ 只做契约不做重量实现 ⑤ 明确禁止项（见 §6）。

贯穿全局：

> 本项目不是聊天机器人，是 **AI Employee OS**。所有知识变化必须**可审计、可解释、可撤销**；
> 所有 AI 动作以**事件**外显；所有渲染能**换引擎而不改业务层**。

---

## 0. 四条不可协商红线

| # | 红线 | 强制位置 |
|---|---|---|
| R-1 | **Agent 不得直接修改 Knowledge Store** —— 只能产出 Proposal | §1 全链路 |
| R-2 | **UI 不得绕过 Agent Core 写入** —— UI 的手工编辑也走 Proposal | §1.2 |
| R-3 | **`privacy='local-only'` 不可绕过**：禁 cloud、禁 remote failover | §2（Agent Core 内强制 + Applier 二次校验，纵深防御） |
| R-4 | **渲染器只消费 IR，不得读业务层**；换引擎只新增 renderer | §4 |

---

## 1. Proposal 模型（裁决 1 正式纳入主线）

### 1.1 全链路

```
Agent / Ingestion / UI
        ↓  产出（不写）
KnowledgeWriteProposal
        ↓
Review / Validation        ← schema · Import Rule(F1) · local-only · 置信度阈值 · 破坏性操作
        ↓  决策：auto_apply / needs_approval / reject
KnowledgeApplier
        ↓
Knowledge Store
```

### 1.2 契约

```ts
export type ProposalSource =
  | { kind: 'agent';     agentId: AgentId; runId: string; turnIndex?: number }
  | { kind: 'ingestion'; docId: string }
  | { kind: 'user' }                       // UI 手工编辑也走同一通道 → 审计一致（R-2）

export type ProposalOpType =
  | 'node.create' | 'node.update' | 'node.delete'
  | 'relation.create' | 'relation.update' | 'relation.delete'

export interface ProposalOp {
  type: ProposalOpType                                   // operation type
  target: { nodeId?: string; relationId?: string }       // target entity / relation
  payload: unknown
  confidence: number                                     // 0..1
  reason: string                                         // 单操作解释
  evidence?: readonly string[]                           // chunk id / 文档片段 / 事件 id
  undo?: unknown                                         // 撤销所需快照
}

export interface KnowledgeWriteProposal {
  id: string
  source: ProposalSource          // 来源
  agentId: AgentId                // 归属员工
  timestamp: number               // 创建时间
  confidence: number              // 提案级整体置信度 0..1
  explanation: string             // 提案级解释（为什么做这批改动）
  ops: readonly ProposalOp[]
}
```

**字段完备性对照裁决要求**：source ✓ · agentId ✓ · timestamp ✓ · confidence ✓ · operation type ✓ · target entity/relation ✓ · explanation/reason ✓。

### 1.3 Review / Validation

```ts
export type ReviewDecision = 'auto_apply' | 'needs_approval' | 'reject'

export interface ReviewResult {
  proposalId: string
  decision: ReviewDecision
  perOp: readonly { index: number; ok: boolean; code?: string; reason?: string }[]
}

export interface ProposalReviewer {
  review(p: KnowledgeWriteProposal): ReviewResult
}
```

判定顺序（短路）：

| 序 | 检查 | 失败结果 |
|---|---|---|
| 1 | schema / 类型 | `reject` |
| 2 | **Import Rule（F1）**：外部输入只入 Space；Growth 只能经 Relationship 派生 | `reject`（逐 op） |
| 3 | **`local-only` 约束（R-3）** | `reject` |
| 4 | 置信度低于阈值 | `needs_approval` |
| 5 | 破坏性操作（`*.delete`） | `needs_approval`（默认） |

`needs_approval` 是**保留人机协作能力**的挂钩点 —— P2-2 只留接口与判定规则，不实现审批 UI。

### 1.4 Applier

```ts
export interface KnowledgeApplier {
  apply(p: KnowledgeWriteProposal, r: ReviewResult): Promise<ApplyResult>
  undo(undoToken: string): Promise<boolean>
}
export interface ApplyResult { proposalId: string; applied: number; failed: number; undoToken: string }
```

**禁止**：Agent 直接修改 Knowledge Store；UI 绕过 Agent Core 写入。二者均违反 R-1 / R-2。

---

## 2. `local-only` 隐私约束（裁决 2 —— 不可绕过）

**它不是用户配置项。** 默认即 `local-only`；放开需要产品级显式授权，而非设置项开关。

```ts
export type Privacy = 'local-only' | 'any'
// 'any' 不由用户设置；仅当产品层显式授权后才可能出现
```

`privacy === 'local-only'` 时，同时成立：

| 约束 | 说明 |
|---|---|
| **禁止 cloud provider** | `providerKind` 只能是 `ollama`（或等价本地后端） |
| **禁止 failover 到 remote** | failover 白名单在本地-only 下**只允许换本地端口/本地模型**，不得换到云端 |
| **检查在 Agent Core 内** | 路由层（`RouteRequest` → `Profile`）强制；**不得**下放到 UI 或插件 |
| **Applier 二次校验** | 纵深防御：即使路由出错，写入前再拦一次 |

路由优先级（隐私在最前，且不可被后续规则覆盖）：

1. **隐私红线** → 强制本地
2. 能力匹配（严格 JSON / 长上下文）
3. 成本档 / 延迟档
4. 健康度 failover（仅在红线允许的候选集内）

---

## 3. ActivityEvent 契约（裁决 3 —— 首阶段范围冻结）

### 3.1 事件

```ts
export type ActivitySourceId = 'user' | 'ingestion'      // 冻结：仅此两个

export interface ActivityEvent {
  readonly id: string
  readonly seq: number                 // bus 分配，稠密 → replay 游标
  readonly ts: number
  readonly source: ActivitySourceId
  readonly kind: ActivityKind
  readonly actor?: AgentId
  readonly target?: ActivityTarget
  readonly payload?: unknown
  readonly severity?: 'info' | 'success' | 'warning' | 'error'
  readonly runId?: string
}

export interface ActivityTarget {
  nodeIds?: readonly string[]
  edgeIds?: readonly string[]
  docId?: string
  query?: string
}
```

### 3.2 事件类型（A. UI 源 / B. ingestion 源）

```ts
export type ActivityKind =
  // A. UI Activity Source
  | 'galaxy.opened'
  | 'node.clicked' | 'node.selected' | 'node.dragEnd'
  | 'search.performed'
  | 'task.created'
  | 'knowledge.viewed'
  // B. ingestion Activity Source
  | 'document.imported'
  | 'extraction.completed' | 'extraction.failed'
  | 'entity.discovered'
  | 'relation.created'
```

### 3.3 Bus

```ts
export interface ActivitySource {
  readonly id: ActivitySourceId
  subscribe(next: (e: ActivityEvent) => void): () => void
}
export interface ActivityFilter {
  sources?: readonly ActivitySourceId[]
  kinds?: readonly ActivityKind[]
  sinceSeq?: number
}
export interface ActivityBus {
  register(src: ActivitySource): () => void
  subscribe(filter: ActivityFilter, next: (e: ActivityEvent) => void): () => void
  replay(opts?: { fromSeq?: number; filter?: ActivityFilter }): AsyncIterable<ActivityEvent>
  readonly latestSeq: number
}
```

**设计决定（不可省）**：

- **append-only + `seq` + `replay`** ⇒ 脚本化 demo 序列器可被「事件回放」取代，同时支撑审计与可视化重放。
- **生命周期用 subsystem 模式**（`Initialize` / `Deinitialize` 注册注销）—— 悬挂订阅是长期运行程序的真实泄漏源。
- **高频事件在 subscribe 层合并**，合并策略不进事件语义。

### 3.4 范围冻结（**不接**）

| 不在 P2-2 | 时机 |
|---|---|
| plugin source | P2-3（届时一并引入进程隔离） |
| external integrations | 未定 |
| social events | 未定 |
| automation events | 未定 |

> 冻结理由：事件系统过早膨胀会让 `ActivityKind` 变成垃圾抽屉，且每种源都带来背压/隔离/失败语义的成本。

---

## 4. SceneGraph IR 契约（裁决 4-B）

**IR 不绑定 SVG / WebGL / Canvas2D。** IR 内不含 CSS、shader 名、DOM 概念 —— 只有领域对象 + **意图**。

### 4.1 场景

```ts
export interface SceneGraph {
  readonly version: number
  readonly nodes: ReadonlyMap<string, SceneNode>
  readonly edges: ReadonlyMap<string, SceneEdge>
  readonly groups: readonly SceneGroup[]
  readonly overlay?: SceneOverlay
  readonly metadata: SceneMetadata          // 图级元数据
}

export interface SceneNode {
  id: string
  kind: string                              // 镜像 KnowledgeNode.kind
  position: Vec2                            // 由 layoutGalaxy（纯函数，F9）产出
  radius: number
  metadata: SceneNodeMetadata               // 领域元数据，不参与渲染决策
  visual: VisualIntent                      // 视觉意图
  animation?: AnimationIntent               // 动画意图
  ownerAgent?: AgentId
}

export interface SceneEdge {
  id: string; from: string; to: string; kind: string
  weight?: number
  metadata: SceneEdgeMetadata
  reason?: string                           // 可解释：为什么连
  visual: VisualIntent
  animation?: AnimationIntent
}
```

### 4.2 意图（IR 的核心 —— 与渲染技术解耦的关键）

```ts
export interface VisualIntent {
  state: 'idle' | 'draft' | 'confirmed' | 'highlighted' | 'dimmed' | 'error'
  emphasis?: number                         // 0..1
  symbol?: SymbolRef                        // → Morphicons（符号层，不是 renderer）
  palette?: PaletteHint                     // 设计 token 名，非硬编码色值
}

export interface AnimationIntent {
  kind: 'appear' | 'grow' | 'pulse' | 'move' | 'connect' | 'fade'
  durationMs: number
  easing?: 'linear' | 'easeOut' | 'spring'
  staggerMs?: number
}
```

同一份意图，不同 renderer 各自表现：SVG → CSS transition；Canvas2D → rAF 补间；WebGL → shader uniform。**语义在 IR，表现在 renderer。**

### 4.3 增量更新与 dirty region

```ts
export type SceneOp =
  | { op: 'upsert'; nodes?: SceneNode[]; edges?: SceneEdge[] }
  | { op: 'remove'; nodeIds?: string[]; edgeIds?: string[] }
  | { op: 'visual';   nodeIds?: string[]; edgeIds?: string[]; visual: Partial<VisualIntent> }
  | { op: 'animate';  nodeIds?: string[]; edgeIds?: string[]; animation: AnimationIntent }

export interface ScenePatch {
  ops: readonly SceneOp[]
  dirty?: DirtyRegion                        // 渲染器可只重绘此区域
}
export interface DirtyRegion {
  bbox?: BBox
  nodeIds?: readonly string[]
}
```

**禁止每帧重建全图** —— 万节点规模下必崩。IR 必须支持 dirty-region 增量。

### 4.4 消费方

| Renderer | 状态 |
|---|---|
| SVG | **现在存在**（现状等价于一个 SVG renderer） |
| Canvas2D | 未来：只新增 |
| WebGL 粒子银河 | 未来：只新增 |
| 3D 城市 | 未来：只新增 |

Morphicons = **符号/材质提供者**，被 renderer 消费（SVG → 组件；WebGL → 纹理图集），**不是 renderer**。

---

## 5. Renderer Interface 契约（裁决 4-C）

```ts
export type RenderCapability = 'svg' | 'canvas2d' | 'webgl2' | 'webgpu'

export interface RenderSurface { readonly kind: RenderCapability; readonly target: unknown }

export interface Renderer {
  readonly id: string
  readonly capability: RenderCapability
  mount(surface: RenderSurface): void
  unmount(): void
  apply(patch: ScenePatch): void            // 只接受增量 patch
  setViewport(vp: Viewport): void
  hitTest(p: Vec2): string | null
  dispose(): void                           // 必须释放 GPU 资源
}

export interface RendererProbe {
  detect(): readonly RenderCapability[]
  select(preferred?: RenderCapability): Renderer     // webgpu → webgl2 → canvas2d → svg
}
```

**硬约束**

| # | 约束 |
|---|---|
| R-4 | 只消费 `ScenePatch`；**不得**读 store / backend / ActivityBus |
| R-4b | **不得**决定语义（什么算 highlight、什么算 cluster 由 IR 定） |
| R-4c | 能力探测失败**静默降级**，不得中断 |
| R-4d | **只新增 renderer，禁止重写业务层** |

**P2-2 交付**：本接口 + SVG renderer 一致性检查清单。**不交付**：WebGL / 粒子 / 3D 城市实现。

---

## 6. Agent Run Contract（裁决 4-D）

层级：`Agent → Run → Turn → Tool Call → Result`

```ts
export interface Agent {
  id: AgentId
  taskKinds: readonly TaskKind[]            // 该员工能接的任务类型
}

export type RunStatus =
  | 'pending' | 'running' | 'awaiting_approval'
  | 'completed' | 'failed' | 'cancelled'

export interface AgentRun {
  readonly runId: string
  readonly agentId: AgentId
  readonly status: RunStatus
  readonly turns: readonly RunTurn[]
  readonly toolCalls: readonly ToolCall[]
  readonly proposals: readonly string[]      // KnowledgeWriteProposal id
  readonly result?: RunResult
  cancel(): void
}

export interface RunTurn {
  index: number
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: unknown
  ts: number
}

export interface ToolCall {
  id: string
  name: string
  args: unknown
  status: 'pending' | 'ok' | 'error'
  result?: unknown
  ts: number
}

export interface RunResult {
  status: Exclude<RunStatus, 'pending' | 'running'>
  output?: unknown
  error?: { code: string; message: string }
  usage?: { inputTokens?: number; outputTokens?: number; ms: number }
}
```

**生命周期**：`pending → running → (awaiting_approval) → completed | failed | cancelled`

**三条硬规则**：

1. 进度**只经 ActivityEvent 外显**（`run.*`），UI 不轮询 Run 内部。
2. 只产出 `KnowledgeWriteProposal`，**永不直接改 Store**（R-1）。
3. 取消**协作式**：在下一个安全点停止并发出事件。

**暂不引入**：LangGraph · handoff · multi-agent orchestration。本契约只建立单 Agent 单 Run 的基础生命周期。

---

## 7. P2-2 明确不做（裁决 5）

> ⚠️ 你的第 5 条在「P2-2 不做」处被截断，以下按前四条边界与既有红线补全；如与原意不符请指出。

| 不做 | 说明 |
|---|---|
| WebGL / 粒子系统 / 3D 城市**实现** | 只给接口，实现延后 |
| LangGraph / handoff / 多 Agent 编排 | 只建单 Run 生命周期 |
| 插件事件源 / 外部集成 / social / automation 事件 | 范围冻结（§3.4） |
| 云 provider 实装、failover 到 remote | `local-only` 红线（§2） |
| 拆 Agent Core 包 · 新增依赖 · 改 lockfile | 既有红线 |
| 业务实现代码 | P2-2 只产出契约文档；实现需另出 Mini Plan |

---

## 8. 路线（按裁决更新）

| 阶段 | 动作 |
|---|---|
| **P2-2.1** | ActivityBus + ActivityEvent（**仅 UI + ingestion，冻结**） |
| **P2-2.2** | Agent Run 契约 + capability 路由（**先单 provider，全本地**） |
| **P2-2.3** | `KnowledgeWriteProposal` + Reviewer + Applier |
| **P2-2.4** | SceneGraph IR + Renderer 接口（**仅文档 + SVG 一致性清单**） |
| **P2-3** | typed bridge → 插件 ActivitySource（含进程隔离） |
| **P2-4** | 才引入编排；**先补 QA 质量验证**（KV 量化对检索问答的影响未测） |
| **P3** | 首个真实 renderer（WebGL）+ per-agent 多模型 + 真实 backend 默认化 |

---

**状态**：🟡 停在 **P2-2 契约交付点**。design-only，**未创建任何代码文件**。
待裁决：① §7 补全是否符合原意；② 本文是否提交；③ 是否进入 P2-2.1 实现（需另出 Mini Plan）。
