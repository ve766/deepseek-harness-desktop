# Stage 13 — S13-A Execution Plan (Read-Only LLM Wiring)

> **Status: DESIGN-ONLY — 停在审核节点（Review Node），待用户确认目标文件范围 + 决策点 A–D 后方可编码。**
> 本文件不修改任何代码、不安装环境、不引入 Runtime/Workflow。

## 1. 来源裁决（OA / OB / OC + 红线）

- **OA**：cordis host 注册 `LlmRuntime` + `LlmRouter`；**禁止知识 app 直连 `llm-ollama`**；范围限定只读推理调用，不引入 Agent Runtime / Workflow / Tool。
- **OB**：增加 `KnowledgeQueryCapable` optional capability seam，**保持与 `OwnedImportCapable` 同级扩展模式**；**禁止修改 `KnowledgeBackend` 五方法接口**。
- **OC**：首个只读推理入口放在 **Nox Research 对话窗**；暂不做 Employee Card `askBrain`。
- **红线（延续）**：不引入 Runtime/Workflow Engine；不改五方法；不新增 Memory 写入；不做任务执行；不进入 Stage 14。

## 2. 已核实事实（源码级 file:line）

| 事实 | 位置 | 含义 |
|------|------|------|
| `LlmRouter` 是 cordis Service，`apply(ctx, config)` 安装为 `ctx.llmRouter`，`inject:['llm']` | `packages/llm/llm-router/src/service.ts:54-58, 243-258` | 推理经 router，不直接碰 Ollama |
| `LlmRouter.prepareCall(req, signal) → PreparedLlmCall`；`PreparedLlmCall.stream({messages}) → AsyncIterable<StreamChunk>` | `service.ts:160-194`；`packages/llm/llm/src/index.ts:155-172, 800-813` | 流式生成入口 |
| `LlmRuntime` 是 cordis Service（注册为 `ctx.llm`），仅做 adapter 注册 + 流式分发 | `packages/llm/llm/src/index.ts:46-49, 284, 779-814` | 运行时本体 |
| `llm-ollama` `apply(ctx, config)` 把 `OllamaAdapter` 注册到 `ctx.llm` 的 `ollama` provider；`DEFAULT_BASE_URL=localhost:11434/v1` | `packages/llm/llm-ollama/src/index.ts:27-40` | 适配器注册方式；**不**在知识 app 内直接调用 |
| 知识 app **当前零 cordis**：`src` 内 `cordis/new App/ctx.llm` 仅命中 `types.ts:2` 注释 | Grep 全 `knowledge-canvas-ui/src` | 需自建 host（见决策 A） |
| 知识 app 入口为 `main.tsx`（`createRoot`），另有 `p1/p2/p3/morphiconDemoEntry` | Grep `createRoot` | 接线可走惰性单例，勿改 `main.tsx` |
| `knowledgeUniverse.ts` 已是「单例 seam」范式：`getSharedUniverse()` / `bindEmployeeAccess(id)` | `src/knowledge/knowledgeUniverse.ts:96-133` | LLM 侧沿用此范式 |
| `OwnedImportCapable` 探针 + `contribute()` 在 `knowledgeAccess.ts:52-100`；**line 73-76 注释陈旧**（写 "degrades to importSource…MockBackend still works"，与代码矛盾） | `src/knowledge/lens/knowledgeAccess.ts` | OB seam 的同款落点 + 顺手修注释 |
| `LightRAGBackend.getNeighbors(nodeId, text)` 已把 `client.query(text)` 语义检索融合进图邻居；`getNeighbors` 是五方法之一（需 seed） | `src/knowledge/backends/lightRAGBackend.ts:72-92` | 自由文本检索需经 seam 暴露（正合 OB） |
| `employeeKnowledgeAccess.ts` 现有 `query(seedNodeId, text)` 需 seed，无自由检索；`EmployeeKnowledgeAccess` 接口 `:44-68` | `src/knowledge/lens/employeeKnowledgeAccess.ts:44-68, 86-97` | 加 `researchQuery(text)` 只读方法 |
| `NoxGapCard.tsx` 是「知识缺口/学习路径卡」，含 `store`/`useRecommendations`，**无对话框** | `src/components/NoxGapCard.tsx:1-97` | OC 的 Nox 对话窗基本待建 |
| `AIInsightPanel.tsx` growth 分支渲染 `<NoxGapCard />`；`research` 动作当前仅 `runImportDemo()` | `src/components/AIInsightPanel.tsx:53-100, 30-31` | Nox 面板挂载点 |

## 3. 目标文件范围（本计划核心）

### 3.1 新建（NEW）
1. **`src/llm/llmContext.ts`** — cordis `App` 单例 + `getLlmRouter()` / `getLlmRuntime()`。
   - 惰性创建 `new App()`；挂载 `LlmRuntime`（cordis `llm` 服务，挂载方式沿用 harness host 既有范式，编码时对照确认）；`applyOllama(ctx, config)` 注册 `ollama` adapter；`applyRouter(ctx)` 安装 `ctx.llmRouter`。
   - 镜像 `knowledgeUniverse.ts` 单例 seam（模块级，非 React Provider）。**不触碰 `main.tsx`**。
2. **`src/components/NoxResearchPanel.tsx`** — Nox 只读研究对话窗：输入框 + 流式答案区 + 检索上下文引用 + thinking/error 态。**只读**，无写回。
3. **`src/knowledge/lens/useNoxResearch.ts`** — React hook `useNoxResearch(agentId)`：编排 `access.researchQuery(text)`（检索）→ `getLlmRouter().prepareCall(...)` → `prepared.stream({messages})` → 组装文本。无写操作。

### 3.2 修改（MODIFIED）
4. **`src/knowledge/lens/knowledgeAccess.ts`** — 新增 `interface KnowledgeQueryCapable { query?(text): Promise<QueryHit[]> }` + `retrieve(backend, text)` 探针函数（与 `OwnedImportCapable`/`contribute` 同级）；**顺手修正 line 73-76 陈旧注释**。不改五方法接口。
5. **`src/knowledge/backends/lightRAGBackend.ts`** — 新增 **optional** `async query(text): Promise<QueryHit[]>`（接口外扩展，同 `importSourceAs` 模式），将 `client.query(text)` 命中映射为 `{nodeId, score, reason}`。**不改 `KnowledgeBackend` 接口**。
6. **`src/knowledge/lens/employeeKnowledgeAccess.ts`** — `EmployeeKnowledgeAccess` 接口 + 实现新增 `researchQuery(text): Promise<ResearchQueryResult>`，委托 `retrieve(backend, text)` 并把命中节点标题/摘要水合为上下文字符串。只读。
7. **`src/components/AIInsightPanel.tsx`** — growth 分支在 `<NoxGapCard />` 后渲染 `<NoxResearchPanel />`（小改，新增挂载点）。
8. **`src/i18n/zh-CN.ts` + `en-US.ts`** — 新增 `nox.research.{placeholder,send,answer,context,error,thinking}` 中英双包。
9. **`package.json`** — 新增 workspace 内部依赖：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-llm-router`、`@deepseek-ai/dsh-llm-ollama`、`@deepseek-ai/dsh-ai-provider-manager`。需 `pnpm install` 更新 lockfile（**非外部环境安装**，见决策 B）。

### 3.3 明确排除（OUT OF SCOPE）
- **不**改 `main.tsx`（用惰性单例）。
- **不**改 `MockBackend`（无 `query` → seam 优雅返回 `backend-unsupported`）。
- **不**安装 LightRAG/Ollama 运行时（S13-B 再处理）。
- **不**做 Employee Card `askBrain`（OC）。
- **不**做任务执行 / Workflow / Agent Runtime。
- **不**改 `KnowledgeBackend` 五方法接口。

## 4. 接线流程（Nox ask → 检索 → 推理 → 渲染）

```
用户输入 text
  → useNoxResearch.ask(text)
    → access.researchQuery(text)                // employeeKnowledgeAccess
      → retrieve(backend, text)                 // knowledgeAccess (OB seam)
        → backend 有 query()? → client.query(text) 映射命中  (LightRAGBackend)
        → 否则 → { ok:false, reason:'backend-unsupported' } (MockBackend 优雅降级)
      → 命中节点水合为上下文字符串 (只读)
    → const prepared = await getLlmRouter().prepareCall({ provider:'auto'|'ollama', model?, messages:[system+context+user] })
    → for await (chunk of prepared.stream({ messages })) assemble text  // StreamChunk
    → 渲染答案 + 引用命中节点
```
- **只读**：全程无 `contribute` / `importSource` / `getMemory` 写回；OA「禁止直连」通过只经 `ctx.llmRouter` 满足。

## 5. 红线符合性矩阵

| 红线 | 本计划如何满足 |
|------|----------------|
| 不引入 Runtime/Workflow Engine | cordis `App` = DI/服务宿主，**非** Agent loop；`LlmRuntime`/`LlmRouter` 是既有推理服务，OA 已批准 |
| 不改 `KnowledgeBackend` 五方法 | `query` 以接口外 optional 方法新增（同 `importSourceAs` 模式），`types.ts` 接口不动 |
| 不新增 Memory 写入 | Nox 面板只 `retrieve` + `prepareCall`，无 `getMemory` 写、无 KG 写 |
| 不做任务执行 | 无 tool / agent / workflow 调用 |
| 不进入 Stage 14 | 本计划仅 S13-A |
| OA 禁止直连 llm-ollama | 仅经 `getLlmRouter()` → `ctx.llm` → adapter，绝不 fetch localhost:11434 |

## 6. 验收标准（Acceptance）

- **AC1**：`getLlmRouter()` 返回可用 router（LlmRuntime + ollama adapter 已注册）；Ollama 在线时 `prepareCall({provider:'ollama'})` 解析 `qwen3:8b`，离线时抛 `NO_ADAPTER` 且 **UI 优雅提示**（不崩）。
- **AC2**：`KnowledgeQueryCapable` seam 就位；MockBackend 下 `retrieve` 返回 `backend-unsupported`（**零回归**）；LightRAGBackend 激活时 `query` 命中可用。
- **AC3**：Nox Research 面板：自由文本 → 检索上下文（若有）→ router 流式 → 答案渲染；**无任何后端/内存写回**。
- **AC4**：红线静态验证——`KnowledgeBackend` 五方法未变（grep 证明）；OA 无直连；无 Runtime/Workflow/Stage14。
- **AC5**：i18n 双包齐全；oxlint 0w/0e；`tsc` 通过；Stage 1–11 surface（MacWindowShell/TitleBar/NavigationRail/EmployeeCard/EmployeeCenter/SharedKnowledgeSpace/canvasStore）**零回归**（仅 `AIInsightPanel` 小改挂载点）。
- **AC6**：per-commit scope 冻结——先提交本计划 doc，再实现+验证+提交代码，均过 lefthook。

## 7. 待裁决决策点（确认目标文件范围用）

- **A（OA 解释）**：知识 app 当前无 cordis host，real harness host 未接入此原型。本计划**在知识 app 内自建局部 cordis `App` 单例**作为「host」（镜像 `knowledgeUniverse` seam）。是否认可「局部 host」即满足 OA「cordis host 注册」？还是要求接入 real harness host（`packages/host/*`，跨包大改，建议推迟）？
- **B（lockfile）**：新增 5 个内部 workspace 依赖需 `pnpm install` 更新 `pnpm-lock.yaml`（**非安装外部运行时**）。是否认可此 lockfile 更新？（与历史 lockfile 风险一致）
- **C（MockBackend 降级）**：默认 MockBackend 下 `retrieve` = unsupported → Nox 仅走 LLM 无知识上下文（S13-B 接入真实后端后才有检索）。是否认可此优雅降级？
- **D（Nox 面板落点）**：新建 `NoxResearchPanel.tsx` 挂 `AIInsightPanel` growth 分支（推荐，零改动 NoxGapCard）。还是改为直接扩展 `NoxGapCard`？

## 8. 编码门控（确认后执行）

1. 用户确认目标文件范围 + 决策点 A–D。
2. 先提交本执行计划 doc（design baseline）。
3. 按 §3 文件清单实现 → oxlint + tsc + 运行时探针验证（含 MockBackend 降级路径）→ lefthook。
4. 单一 scoped commit（不混入无关改动）→ 停在 S13-A Acceptance Node，**不自动进入下一子项**。
