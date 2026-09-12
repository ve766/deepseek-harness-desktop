# Stage 5 · Knowledge Space / Shared Knowledge Universe Visualization — Mini Plan

> 设计文档（仅设计，不编码）。审核通过并裁决 D1–D5 后才放行编码。
> 前置：Stage 4 已落地 `knowledgeUniverse.ts` 适配器接缝（commit `356caaf`），
> 确立了 "Shared Knowledge Universe = 共享基础设施" 的架构基线。

---

## 1. 目标与定位

将 `knowledge` 路由从「generic canvas surface（复用 `children`）」提升为**真正的 Shared
Knowledge Space**——一个拥有明确身份（Space identity）与知识图谱可视化层（节点 / 关系 /
来源 / 贡献者）的专属 surface，并可视化「Employee → Knowledge Universe 的 readonly lens」。

严格守住既有红线：
- 不 Dashboard 化（space 仍是图谱画布 + 轻量 overlay，不是统计卡片网格）
- 不新增 Chat UI
- 不把知识变成任何员工的私有空间（lens 只读、共享）
- 不提前接 Runtime
- 不破坏 `KnowledgeBackend` 接缝（未来 GraphRAG / KG / Neo4j / LlamaIndex 只换 backend adapter）

---

## 2. 架构审计结论（真实现状，非假设）

| 关注点 | 现状 | Stage 5 处理 |
|---|---|---|
| knowledge 路由 | `MacWindowShell` default 分支 `surface = children`（entered-gated canvas） | 提升为命名 surface `SharedKnowledgeSpace` |
| 图谱画布 | `CanvasRegion` → `CanvasViewport`/`GalaxyCanvas`/`EdgeLayer`/`GalaxyEdgeLayer`，由 `canvasStore`（单例）驱动 | **复用**，不重写 |
| 后端实例 | `mock/bootstrap.ts` `new MockBackend()`（canvas 用）＋ `knowledgeUniverse.getSharedUniverse()` `new MockBackend()`（lens 用）＝ **两个实例** | D2 决策：是否统一为同一 universe |
| 节点来源 | `KnowledgeNode.source?: SourceRef`（pdf/url/video/github/chat）已存在，**未在 UI 显式展示** | 在 inspector/tooltip 显式展示 |
| 贡献者 | `KnowledgeNode.ownerAgent?: AgentId` 已存在，`KnowledgeNode.tsx:26` 渲染头像徽标；`canvasStore.autoClusterIfNeeded` 按 ownerAgent 分组 | 强化：图例 + 贡献者 chip；lens 面板列出各员工贡献 |
| 关系 | `KnowledgeEdge`（from/to/kind/reason）＋ `Relationship`（Galaxy 可解释边）均存在 | 加 edge-type 图例 |
| 接缝 | `KnowledgeBackend`：listNodes/listEdges/importSource/getNeighbors/getMemory | 全部读取走接口，绝不绕过 |
| Memory / Capability / Knowledge 边界 | Memory=用户上下文（`AIInsightPanel.getMemory`）；Capability=员工能力（`AgentProfile`+shell mock，无 knowledge 字段）；Knowledge=共享图谱资产 | 保持三者边界，lens 只读 Knowledge |

**关键结论**：数据模型已具备 Stage 5 所需的全部字段（source / ownerAgent / edges / relationships），
Stage 5 主要是**可视化层 + surface 身份提升 + lens 可视化**，不是数据模型改造。

---

## 3. 设计决策（待用户裁决 D1–D5）

### D1 · 提升方式（推荐：包装复用，不重写画布）
新增 `SharedKnowledgeSpace` surface，**包裹复用**现有 canvas（`CanvasRegion`/`GalaxyCanvas`），
叠加：① Space 身份头（标题 + 副标题 + 图例）；② 知识图谱可视化层（source/contributor/edge-type
overlay）；③ 员工 readonly lens 侧栏。MacWindowShell 的 knowledge 路由改为渲染 `<SharedKnowledgeSpace />`。
保留 entered-gate（FirstRunGate）不变。

### D2 · 后端统一（推荐：统一为单一 universe 实例）
将 `mock/bootstrap.ts` 的 `new MockBackend()` 改为 `getSharedUniverse()`（**1 行**），
使 canvas 与 lens 共享**同一个** KnowledgeBackend 实例。
- 收益：真正「shared」；未来换 KG 引擎**仅改 `createBackend()` 一处**（bootstrap 与 seam 同时生效）。
- 风险：bootstrap 同时驱动 demo sequencer（`importSource`/`getNeighbors`），仍走 MockBackend，无行为变化。
- 若保守：保留 bootstrap 独立 MockBackend（两者 seed 同源 fixture，视觉一致），但 canvas 与 lens 为两个实例。
**默认推荐统一。**

### D3 · 图谱可视化层内容（全部只读、来自数据模型）
- **节点**：现有 `KnowledgeNode`（kind/title/meta）。
- **关系**：现有 `KnowledgeEdge` + Galaxy `Relationship`，加 edge-type 图例（related/prerequisite/derived/partOf/sequence）。
- **来源**：`node.source?: SourceRef` → inspector/tooltip 显式展示（type 图标 + uri 链接，只读）。
- **贡献者**：`node.ownerAgent` → 在节点头像徽标基础上，加图例说明 + 贡献者 chip；lens 面板按员工聚合。

### D4 · Employee → Universe readonly lens 可视化
新增侧栏（或 Space 内 overlay），调用 Stage 4 接缝 `bindEmployee(id)`：
- 列出每位员工的知识贡献（nodeCount / ownedNodeIds）。
- 选中某员工 → 在画布上**高亮其拥有节点**（用 `canvasStore.setSelection` 这类非变更高亮，
  或只读 highlight state），**不创建私有子空间、不写回、不隔离**。
- 全部 `canWrite:false`；Memory/Capability 不混入（仅 Knowledge）。

### D5 · 边界保持（硬约束）
- Memory = 用户上下文（维持 `AIInsightPanel.getMemory`，不迁入 Space）。
- Capability = 员工能力描述（维持 `AgentProfile`/shell mock，不迁入 Space）。
- Knowledge = 共享宇宙图谱资产（Space 唯一载体）。
- 禁止：Dashboard 化、新增 Chat UI、员工私有知识空间、提前接 Runtime。

---

## 4. 组件与文件设计（编码阶段才落地）

### 新增
- `src/components/SharedKnowledgeSpace.tsx` + `.css`
  - 包裹现有 canvas（`CanvasRegion` 或对应 viewport），加 Space 身份头 + 图例 + lens 侧栏插槽。
  - 透传 entered-gate；自身透明、非玻璃（守单玻璃纪律）。
- `src/components/KnowledgeContributorsPanel.tsx` + `.css`（可选内联于上者）
  - 渲染员工列表 + `bindEmployee(id)` 贡献摘要；选中高亮（只读）。

### 修改
- `src/components/MacWindowShell.tsx`
  - knowledge 路由：`surface = <SharedKnowledgeSpace />`（替换 `children` 默认分支）。
  - 不新增 Rail 项；不改 Home/Center/Detail/CC。
- `src/mock/bootstrap.ts`（仅当 D2 通过）
  - `createStore(getSharedUniverse())` 替代 `createStore(new MockBackend())`。
- `src/i18n/zh-CN.ts` + `en-US.ts`
  - 新增 `space.*`（title/subtitle/source/contributor/legend/edgeTypes…）与 `lens.*`（contribution/highlight…）键。
- `scripts/capture-showcase.cjs`
  - 新增 `shell-knowledge-space` surface（4 主题）＋ ok 门（见 §7）。

### 复用（不修改契约）
`CanvasRegion` / `CanvasViewport` / `GalaxyCanvas` / `EdgeLayer` / `KnowledgeNode` /
`canvasStore` / `KnowledgeBackend` / `knowledgeUniverse.bindEmployee` /
`EmployeeCard` / `EmployeeIcon`。

---

## 5. 开源 KG / GraphRAG 接入点评估

| 接入项 | 位置 | 是否破坏接缝 |
|---|---|---|
| GraphRAG / Neo4j / LlamaIndex 后端 | 仅替换 `knowledgeUniverse.createBackend()` 中的 `new MockBackend()` → `new KgBackend()`（`KgBackend implements KnowledgeBackend`） | **否** |
| 图谱布局/查询能力增强 | `KnowledgeBackend` 接口加方法（如 `listPaths()`）→ 实现方同时更新 MockBackend 与未来 KgBackend | **否**，但属接口演进 |
| 节点来源/贡献者元数据 | 已存在于 `KnowledgeNode.source` / `ownerAgent`，KG 后端只需填充这些字段 | **否** |

**结论**：Stage 5 不接真实 KG；只确保 Space 与 lens 全部经 `KnowledgeBackend` 读取，
为后续 backend adapter 替换预留干净入口。任何 UI / 员工模型变更都不必要。

---

## 6. 边界对照表（落地校验）

| 维度 | Memory（用户上下文） | Capability（员工能力） | Knowledge（共享宇宙） |
|---|---|---|---|
| 载体 | `MemoryEntry` via `getMemory()` | `AgentProfile` + shell mock | `KnowledgeNode`/`Edge` via `getSharedUniverse()` |
| 是否进 Space | 否（AIInsightPanel） | 否（Employee 体系） | **是** |
| 是否可被 lens 读 | 否 | 否 | 是（只读） |
| 归属 | 用户级 | 员工描述 | 共享，员工仅贡献 |

---

## 7. 验收断言（capture `shell-knowledge-space`）

- `knowledgeSpaceSurface`：knowledge 路由渲染 `SharedKnowledgeSpace`（data-surface=knowledge-space），非裸 canvas。
- `graphVizNodes` / `graphVizEdges`：节点与边均已渲染。
- `sourceShown`：至少 1 个节点带 `data-source-type`（来源可视化）。
- `contributorShown`：至少 1 个节点带 `data-owner`（贡献者可视化）。
- `lensReadonly`：员工 lens 面板存在且经 `bindEmployee` 读取，`canWrite===false`（复用 Stage 4 seam 探针）。
- `noNewRailItem`：`railItems === 7`（不新增 Rail 项）。
- `noChatUi`：Space 内无 `.chat` / 输入框类 Chat 元素。
- `noDashboard`：Space 主区为图谱画布（非统计卡片网格）。
- `seamIntact`：新文件不 import `canvasStore`、不绕过 `KnowledgeBackend`（`getSharedUniverse` 经接口读取）。
- 既有 surface（employee-center / employee-detail / home / command-center / shell / shell-knowledge-seam）无回退。

---

## 8. Scope Freeze（编码阶段遵守）

**允许**
- 新建 `SharedKnowledgeSpace.tsx` + `.css`、`KnowledgeContributorsPanel.tsx` + `.css`。
- 修改 `MacWindowShell.tsx`（knowledge 路由指向新 surface）。
- 修改 `bootstrap.ts`（D2 统一后端，1 行）。
- 修改 i18n 2 文件（新增 `space.*` / `lens.*`）。
- 修改 `capture-showcase.cjs`（新增 probe）。

**禁止**
- 新增 Rail 项（knowledge 已存在）。
- Dashboard 化（统计卡片网格作主体）。
- 新增 Chat UI。
- 把知识变成员工私有空间（lens 必须只读、共享）。
- 提前接 Runtime / Registry / Workflow / Prompt。
- 修改 `AgentProfile` / Employee 类型。
- 绕过 `KnowledgeBackend` 直连 `canvasStore` / mock 具体实现。
- 接入真实 KG / 知识库（mock only）。

---

## 9. 待裁决

- **D1**：包装复用现有画布（推荐）/ 其他？
- **D2**：统一后端为单一 universe 实例（推荐）/ 保留 bootstrap 独立实例？
- **D3**：图谱层内容范围（见 §3-D3 是否全取）？
- **D4**：员工 lens 可视化形态（侧栏 / Space 内 overlay）？
- **D5**：边界硬约束确认（默认通过）？

审核通过后按 D1–D5 推荐方案放行编码，单 commit，停在 Stage 5 验收节点。
