# P4-1/4 Demo Flow — Mini Plan

> 阶段：设计（仅方案，未编码）。本子步在 P4-1/3 EmptyState 已交付的 `action` 预留槽基础上，接入一条"体验示例知识库"引导链。
> 边界红线（与用户确认）：仅 mock 层驱动，**禁止**真实 Agent Core / LLM Router / Embedding / KG Backend / 真实 Memory。
> 复用优先：`runImportDemo()`、`STAGE_ORDER`、已有 Canvas / ThinkingRing / MorphIcon / AIInsightPanel / NoxGapCard 全部直接复用，不重造。

---

## 1. 实现前审查结论（7 项确认）

| # | 确认点 | 结论 |
|---|---|---|
| 1 | 直接复用 `runImportDemo` / `STAGE_ORDER`？ | ✅ **复用**。`runImportDemo()`（`mock/sequencer.ts`）已实现完整脚本化流 `import→analyze→scan→relate→map→done`，驱动 `store.setAiState/setAiStage/setInsight`，生成 draft 节点 + AI 边 + AI cluster，结束复位 `idle`。这正是"导入资产→AI 理解→形成知识空间"的 Space 演示，也是 Nox thinking→completed 演示。`STAGE_ORDER`/`STAGE_LABEL` 驱动阶段横幅 + ThinkingRing。 |
| 2 | `seedDemo` 最小新增数据结构 | 新增一组**独立前缀** `demo-*` 的 Space 子集（~3 节点 + 2 边 + 1 cluster），与永久 `SEED_*` 零 id 冲突；`seedDemo(s)` 仅调用既有 `s.setNodes/setEdges/setClusters`。不新增后端方法。详见 §3。 |
| 3 | `DemoController` 是否需要独立文件 | ❌ **不需要**。扩展 `mock/sequencer.ts` 增加 `runDemoFlow()` + `startDemo()`/`endDemo()`；store 仅新增 `demoActive` 布尔态 + `setDemoActive()` 动作。无新 class / Provider / Manager（延续 P4-1/3 "纯展示、无 Manager" 纪律）。 |
| 4 | `EmptyState.action` 如何接入 | `EmptyState` 已有 `action?: ReactNode` 槽（P4-1/3 预留，组件**零改动**）。仅 `WelcomeDashboard` 在 welcome 空态传入 `action = <button onClick={startDemo}>{t('demo.start')} →</button>`。Space/Growth 空态**不传** action（Demo 是 Welcome 主动 opt-in，EmptyState 仍只是价值引导层）。 |
| 5 | Welcome → Space → Nox → Growth 完整状态流 | 见 §2 状态机。Welcome(空)→点 action→`startDemo()`→`seedDemo()`→进 CanvasRegion(Space)→`runImportDemo()`(Nox thinking→completed)→面板出现"查看成长星系"→`setMode('growth')`→Galaxy 展示已 seed 的 GROWTH_* 图 + NoxGapCard。 |
| 6 | Demo 完成后恢复普通交互 | `endDemo()` = 还原 `startDemo()` 时拍的快照（nodes/edges/clusters/mode/relationships/paths/progress/recs）+ `clearAiGenerated()`（移除 draft/auto 节点、AI 边、AI cluster、AI path、AI rec，复位 aiState/idle、aiStage/null、insight/null）。零残留。 |
| 7 | 是否与现有 Mock 数据重复/冲突 | 永久 `SEED_*` 不受影响；Demo 用独立 `demo-*` id；`runImportDemo` 草稿节点用 `uid('doc')` 唯一；`endDemo` 还原快照 → 无残留、无重复。 |

---

## 2. 状态机

### 2.1 顶层 Demo 状态机（新增 `demoActive` 布尔 + `demoPhase` 由现有 `mode` 派生）
```
        startDemo()                 runImportDemo() 完成
  idle ───────────► space_demo ─────────────────────────► growth_show
   ▲                  │  (Nox thinking→completed)              │
   │                  │ 面板出现"查看成长星系" CTA              │ setMode('growth')
   │                  ▼                                        ▼
   └──────────────────────── endDemo() ◄─────────── 用户点"退出示例" / done
        (还原快照 + clearAiGenerated → 回到普通交互)
```
- 进入 Space 演示时 `demoActive=true`；退出即 `false`。
- `aiState` 在 Space 演示内由 `runImportDemo` 驱动：`idle → inferring(STAGE_ORDER) → idle`。
- Growth 阶段 `demoActive` 仍为 true，仅切换 `mode='growth'`（复用现有 Galaxy 渲染 + `NoxGapCard`）。

### 2.2 与现有状态机的衔接
- `STAGE_ORDER = [import, analyze, scan, relate, map, done]` —— 直接复用，不新增阶段。
- `AiState ∈ {idle, inferring, arrived, clustering}`、`AiStage ∈ {import,…,done,null}` —— 全部已有，Demo 仅用 `idle/inferring` + 阶段。

---

## 3. 数据结构（`mock/data.ts` 新增，独立前缀）

```ts
// 仅 Demo 使用，id 全部 demo-* 前缀，绝不触碰永久 SEED_*
export const DEMO_SPACE_NODES: KnowledgeNode[] = [
  { id: 'demo-video',   kind: 'video',       title: '产品演示录屏',     meta:{duration:'06:20'}, aiStatus:'confirmed', position:{x:300,y:160}, ownerAgent:'task' },
  { id: 'demo-doc',     kind: 'document',    title: '竞品分析报告',     meta:{pages:'14'},       aiStatus:'confirmed', position:{x:560,y:300}, ownerAgent:'nox' },
  { id: 'demo-project', kind: 'project',     title: 'AI 员工计划',      meta:{branch:'main'},    aiStatus:'confirmed', position:{x:520,y:140}, ownerAgent:'assistant', isHub:true },
]
export const DEMO_SPACE_EDGES: KnowledgeEdge[] = [
  { id:'demo-e1', from:'demo-doc',     to:'demo-project', kind:'manual', reason:'edge.rel1' },
  { id:'demo-e2', from:'demo-video',   to:'demo-project', kind:'manual', reason:'edge.rel2' },
]
export const DEMO_SPACE_CLUSTER: Cluster[] = [
  { id:'demo-cl', title:'cluster.seedProject', kind:'auto', memberIds:['demo-video','demo-doc','demo-project'] },
]
```
- 复用 `runImportDemo()`：它会以 `freePosition(view)` 生成一个 `uid('doc')` 草稿节点，连到附近 360px 内的 `demo-*` 节点 → 自动形成 Demo 专属边与 AI cluster。
- Growth 阶段不新增数据，直接展示既有 `GROWTH_*`（已 seed）。

---

## 4. 文件变化清单（范围冻结：仅 `packages/apps/knowledge-canvas-ui/`）

| 文件 | 变更 | 说明 |
|---|---|---|
| `mock/data.ts` | 新增 | `DEMO_SPACE_NODES/EDGES/CLUSTER`（§3） |
| `mock/sequencer.ts` | 扩展 | 新增 `seedDemo(s)`、`runDemoFlow()`、`startDemo()`、`endDemo()`；`runImportDemo` 原样复用 |
| `store/canvasStore.ts` | 最小扩展 | 新增 `demoActive` 态 + `setDemoActive(b)`；`startDemo/endDemo` 逻辑放 sequencer（含快照），store 仅暴露布尔供 UI 门控 |
| `components/WelcomeDashboard.tsx` | 修改 | welcome 空态传 `action=<button onClick={startDemo}>`（**仅此一处接 EmptyState.action**） |
| `components/AIInsightPanel.tsx` | 修改 | `demoActive` 时：Space 阶段末尾追加"查看成长星系"CTA；Growth 阶段追加"退出示例"CTA（均调用 store 方法） |
| `mock/bootstrap.ts` | 修改 | 新增 dev-only `?kcuDemo=1` 门控（镜像 `?kcuEmpty`），自动 `startDemo()` 便于 headless 验收 |
| `i18n/zh-CN.ts` / `en-US.ts` | 新增 key | `demo.start / demo.exit / demo.growthCta / demo.spaceDone / demo.growthHint / demo.done`（约 6 个，1:1，302→308） |
| `docs/DEMO_FLOW_MINI_PLAN.md` | 新增 | 本方案 |

**`EmptyState.tsx` / `EmptyState.css` 零改动**（action 槽已预留）。

---

## 5. 复用现有代码清单（不重造）

- `runImportDemo()` —— Space 导入演示 + Nox thinking→completed 全流。
- `STAGE_ORDER` / `STAGE_LABEL` —— 阶段横幅 + ThinkingRing 文案。
- `store.setAiState/setAiStage/setInsight/clearAiGenerated` —— Demo 驱动与复位。
- `ThinkingRing`、`MorphIcon`(AIStatusIcon)、`NoxGapCard`、`ProviderStatusCard` —— 状态可视化。
- `AIInsightPanel` 的 `.cta` 按钮 + `.insight__thinking` 区块 —— Demo CTA 与思考态。
- `seedGalaxy()` + `GROWTH_*` 数据 —— Growth 阶段直接展示。
- `EmptyState.action` 槽 —— Welcome 入口。
- `?kcuEmpty` 门控模式 —— 复刻为 `?kcuDemo`。

---

## 6. 验收矩阵

| 维度 | 场景 | 断言 |
|---|---|---|
| i18n | `zh-CN == en-US` key 集合 | 308 == 308，无缺失 |
| i18n | en-US CJK 泄漏 | 无（排除 `lang.opt*/region*`） |
| 构建 | esbuild | bundle 无 error（仅 es2024 别名警告） |
| 行为·Welcome | 空态 | `.emptystate--welcome` 存在 + `action` 按钮含 `demo.start` 文案 |
| 行为·Demo 启动 | 点 action | `demoActive=true`；进入 Space；`runImportDemo` 跑完 → 出现 `uid('doc')` 草稿节点 + AI 边 + AI cluster；`aiState` 经历 `inferring→idle` |
| 行为·Nox 状态 | Space 演示中 | ThinkingRing 可见；阶段横幅依次 `import→…→done` |
| 行为·Growth 展示 | 点"查看成长星系" | `mode='growth'`；Galaxy 渲染 `GROWTH_*` 节点/边/路径；`NoxGapCard` 出现 |
| 行为·恢复 | 点"退出示例" | `endDemo()` 后：无 `demo-*` 节点、无 `uid('doc')` 草稿、无 AI cluster；`demoActive=false`；回到普通交互（与启动前快照一致） |
| 回归·普通路径 | 正常进入（无 `?kcuDemo`） | 不触发 Demo；`?kcuEmpty` 仍可用；Welcome/Empty 逻辑不变 |
| 主题 | dark | 三处空态 + Demo 覆盖层正常 |
| 动效 | reduced-motion | `animLive=0`；Demo 阶段切换不强制动画 |
| 语言 | zh / en | 上述断言在两种 UI 语言下均成立 |
| Dev gate | `?kcuDemo=1` | 启动即自动 `startDemo()`，headless 可截 12 图 |

headless 验收脚本：`capture-demo.cjs`（镜像 `capture-empty.cjs`），覆盖 welcome(w/action) / space-demo / growth-demo / demo-exit-restore × zh-light/en-light/zh-dark/zh-reduced。

---

## 7. 非目标护栏（明确不做）

- ❌ 不建 `DemoController` / `DemoManager` / `DemoProvider` 类。
- ❌ 不实现真实 Agent/LLM/Embedding/KG/Memory；所有"AI"均为 mock 脚本。
- ❌ 不自动创建 Growth 节点 / fake concept / fake learning path（Growth 仅展示既有 `GROWTH_*`）。
- ❌ 不改 App 核心流程、不改 EmptyState 组件、不新造设计 token。
- ❌ 不新增 `empty.action.*`（沿用 P4-1/3 决策，action 文案用 `demo.*`）。

---

**确认后进入编码**：按 §4 文件清单实现，提交 `P4-1/4: add Demo Flow`，完成后停在验收节点，不自动进入子步 5/5。
