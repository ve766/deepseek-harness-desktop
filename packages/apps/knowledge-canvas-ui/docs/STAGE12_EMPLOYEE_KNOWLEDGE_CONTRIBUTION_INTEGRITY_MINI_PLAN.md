# Stage 12 Mini Plan · AI Employee Knowledge Contribution Integrity

> Design only. No code. Single markdown commit. Stops at review node.
> Prerequisite: Stage 11 (`c40398a`) accepted — Employee Knowledge Contribution Surface (B+A) in place, 11/11 acceptance PASS.
> This plan does NOT assume a requirement. It audits the real post-Stage-11 architecture,
> lists code-verified gaps, evaluates candidate directions against the standing red lines,
> and raises D1–Dx decision points for you to resolve. Nothing here is decided.

---

## 1. 架构审计：Stage 11 后真实状态（代码核实）

### 1.1 Knowledge Universe（`src/knowledge/knowledgeUniverse.ts`）
- `createBackend()` 是全仓**唯一**命名具体后端之处；解析顺序 `LightRAG HTTP → InMemory 原型 → MockBackend(默认)`。
- `getSharedUniverse()` 模块级单例（Stage 4 D2，单源真相）。
- `bindEmployee(id)` → 只读 `EmployeeKnowledgeLens`（`canWrite:false`）。`bindEmployeeAccess(id)` → `createEmployeeKnowledgeAccess(id, getSharedUniverse())`（Stage 9 加性兄弟）。
- 隔离良好：仅在本文件 import `LightRAGBackend`/`InMemoryLightRAGClient`/`LightRAGHttpClient`/`MockBackend`，其余全部经 `KnowledgeBackend` 接口。

### 1.2 EmployeeKnowledgeAccess（`src/knowledge/lens/employeeKnowledgeAccess.ts`）
- 只读投影 + 贡献 seam。方法：`listOwned` / `listAll` / `query`(→`backend.getNeighbors`) / `memory`(→`backend.getMemory`) / `summary` / `contribute`(→`knowledgeAccess.contribute`)。
- `permission = resolvePermission(agentId)`；`canWrite = permission !== 'read'`。
- R6 干净：仅 import `KnowledgeBackend` 接口类型 + `resolvePermission`/`contribute`，无具体后端、无 LightRAG*、无 UI。

### 1.3 Contribution seam（`src/knowledge/lens/knowledgeAccess.ts`）
- `ContributionResult = { ok:true; nodeId; status:'draft'; ownerAttribution:'attributed'|'unsupported' } | { ok:false; reason }`。
- `contribute(backend, src, agentId)`：先 `resolvePermission==='read'` → `permission-denied`；否则先试 `importSourceAs`（可选能力 `OwnedImportCapable`），失败降级 `importSource`；**永远返回 `status:'draft'`**。
- `DEFAULT_PERMISSION_POLICY`：`assistant`/`task='read'`，`nox`/`knowledge='contribute'`。**无任何 agent 拥有 `'own'` 层级**（类型含 `'own'` 但策略表未用）。
- `draft → review → confirmed` 生命周期在此显式 deferred（Stage 9 D6 / Stage 11 D5）。

### 1.4 LightRAG adapter（`src/knowledge/backends/lightRAGBackend.ts`）
- 实现 `KnowledgeBackend` 5 方法；`importSource(src)` → `importSourceAs(src, undefined)`。
- `importSourceAs(src, ownerAgent?)`：**设置 `ownerBySource`(内存 Map) + 调用 `ingestSource`（经 ingestion layer）+ `client.insert`**。即 LightRAG 后端下归因可用、且走 ingestion。
- 限制：`ownerBySource` 为实例内存 Map，依赖 `getSharedUniverse()` 单例存活；**reload 即丢**（KG 无原生 owner 字段，Stage 4 D3 已知限制）。无 review/confirm 转换。

### 1.5 Ingestion layer（`src/knowledge/ingestion/ingestion.ts`）
- `ingestSource(src, opts?)` → 解析组件（`chat` 直通；`url` 仅当 scrapling flag 启用否则 placeholder；`pdf/video/github` 均为 placeholder）→ 产出 `IngestedDocument{content, meta:{sourceRef, ownerAgent?, fetchedAt}}`。
- **关键**：`meta.ownerAgent` 被产出但**未被任何后端消费**（LightRAG 用自身 `ownerBySource` Map；Mock 忽略）。即 ingestion 的 ownerAgent 元数据当前是死数据。
- 仅 `LightRAGBackend.importSourceAs` 调用 `ingestSource`；**MockBackend 与贡献 seam 直连 `importSource`，不经过 ingestion**。

### 1.6 UI Visibility Layer（Stage 10/11）
- `useEmployeeKnowledgeAccess`（Stage 10，只读）：`summary`+`listOwned`+`listAll`，暴露 `permission/ownedCount/ownedNodes/relatedCount`，cancelled 守卫。R6 干净。
- Stage 11 新增：`useEmployeeKnowledgeContribute`（权限 gate + 单次受控写）、`EmployeeKnowledgeContribute.tsx`、`useEmployeeKnowledgeSuggestions`（只读邻居查询）、`EmployeeKnowledgeSuggestions.tsx`。
- `EmployeeKnowledgeContribute.tsx` 结果区仅展示 `knowledge.contrib.draft` 标签 + `nodeId` 文本 + `ownerAttribution` 徽章；**不链接到所创建节点、不刷新员工 owned 列表、不展示 review/confirmed**（符合 Stage 11 D5 不虚构状态机）。

---

## 2. 缺口分析（G1–G6，均代码核实）

| ID | 缺口 | 证据（代码位置） | 影响 |
|---|---|---|---|
| **G1** | 默认（Mock）后端下归因丢失 | `mock/mockBackend.ts` 仅实现 `importSource`（无 `importSourceAs`），push 的 node **不设 `ownerAgent`**；`knowledgeAccess.contribute` 对 Mock 降级为 `unsupported` | 默认/dev 模式下贡献的节点不归属贡献者，`listOwned()`（`n.ownerAgent===id` 过滤）**不含刚贡献的节点** → 员工"我的贡献"里看不到自己刚提交的内容 |
| **G2** | 贡献写入路径绕过 ingestion layer（仅 Mock） | `mock/mockBackend.importSource` 直接 push 原始 node（无归一化文本）；`ingestSource` 仅被 LightRAG 调用 | Mock 模式下贡献节点无归一化内容；ingestion 的 `ownerAgent` 元数据全程死数据；两后端行为不一致 |
| **G3** | 贡献生命周期冻结在 `draft` | `ContributionResult.status` 恒为 `'draft'`；`KnowledgeNode.aiStatus` 仅置 `'draft'`；无 review/confirmed 转换 | 节点永远停在 draft，无"待确认/已确认"语义，也无法驱动任何下游 |
| **G4** | `'own'` 权限层级无消费者 | `DEFAULT_PERMISSION_POLICY` 无 `'own'` agent；review/confirm 角色未定义 | G3 的生命周期无法被任何权威角色推进（谁有权确认？） |
| **G5** | 贡献结果 UI 不呈现所创建节点 / 不刷新 owned 列表 | `EmployeeKnowledgeContribute.tsx` 仅显 `nodeId` 文本，无跳转、无 owned 刷新 | 提交后用户看不到"我刚贡献了什么"，体验断裂 |
| **G6** | LightRAG 归因非持久（已知限制，非阻断） | `ownerBySource` 内存 Map，reload 即丢（Stage 4 D3） | 生产态 LightRAG 下 reload 后归属丢失；属已知限制，列为观察项 |
| **G7**（次要） | 贡献表单含非法 `SourceRef` 类型 `'text'` | `EmployeeKnowledgeContribute.tsx:15` 的 `SOURCE_TYPES` 含 `'text'`，但 `types.ts` 的 `SourceRef.type` 仅为 `'pdf'\|'url'\|'video'\|'github'\|'chat'`（无 `'text'`） | 选型与类型系统不一致，提交 `'text'` 时下游 `ingestSource`/`importSource` 走默认分支；属预存小缺陷，可借 A2 一并校正 |

> 注：G1–G5 均为 Stage 11 显式留白的已知限制（Stage 11 D5/D6 故意不虚构 review/confirmed、不接 ingestion）。Stage 12 是否收回这些留白，由 D 项裁决。

---

## 3. 候选方向评估（仅分析，不实现）

| 方向 | 内容 | 红线兼容性 | 风险 | 优先级 |
|---|---|---|---|---|
| **A. Contribution Integrity（归因+摄入接线+节点可见）** | ① Mock 补 `importSourceAs` 写 `ownerAgent`（关 G1）② 贡献写入统一经 `ingestSource`（关 G2）③ 结果 UI 呈现所建节点+刷新 owned（关 G5） | 高兼容：`KnowledgeBackend` 5 方法接口不动（`importSourceAs` 已是 interface-external 可选扩展，LightRAG 已实现，Mock 补实现属 impl-only）；无 Runtime/Workflow/Chat；Memory=User；Capability 只读；LightRAG backend-only；不动 Rail/Card | 低 | **高（推荐主线）** |
| **B. Contribution Lifecycle（draft→review→confirmed）** | 引入 `'own'` 层级 + 单步 owner 确认 seam + 待确认列表 UI（关 G3/G4） | 可行但更大：需新角色 + 新 surface + 新后端能力；命名须避开 "Workflow Engine"（Stage 11 红线）；须确保是"单步确认"非编排 | 中 | 中（可选辅线） |
| **C. Ingestion 真实提取器（pdf/video/github）** | 实现真实抽取 | 需 Python sidecar（Stage 8 D3 Phase 2 已 defer），超出前端 Stage 范围 | 高（跨仓库） | 低 / 延后 |
| **D. Knowledge-aware Agent 全量（读侧主动利用）** | 员工主动用知识于任务 | 需 Agent Runtime → 红线冻结；Stage 11 已落 A 读侧建议 | — | 低（Stage 11 已部分覆盖） |
| **E. 多代理知识协作 / provenance 合并（G6 全量）** | 跨代理冲突解决 | 无根基、体量大 | 高 | 低 / 延后 |

**推荐 Stage 12 主范围**：**方向 A（Contribution Integrity）** —— 收回 Stage 11 故意留下的两个真实缺陷（G1 归因丢失、G2 摄入绕过）+ 关 G5 体验断裂；完全在红线内、低风险、与 Stage 11 最连贯。
**可选辅线**：**方向 B（生命周期/确认）** —— 仅当 D5 明确放行"引入确认语义"时纳入；须以"单步 owner 确认"命名，严禁 "Workflow"。
**明确延后**：C、D、E（待红线放宽或跨仓库 sidecar 就绪再议）。

---

## 4. 继续遵守的红线（继承 Stage 9/10/11，Stage 12 不可突破）

1. **不新增 Rail**；不修改 `NavigationRail` / `NavRoute`（成员冻结）。
2. **不破坏 `EmployeeCard` / `EmployeeIdentity` 契约**（引用方 props 不变）。
3. **不修改 `KnowledgeBackend` 五方法接口**（`listNodes/listEdges/importSource/getNeighbors/getMemory`）。`importSourceAs` 已是 interface-external **可选**扩展（非接口方法），允许在 Mock 补实现（impl-only，不改签名）。
4. **不引入 Runtime / Workflow Engine / Chat**；Stage 11 已落 A 读侧建议，不扩展为运行时。
5. **Memory 继续属 User Context**；不建 per-agent memory，不写回 Memory。
6. **Capability 继续 display-only**；不进 KG / backend / `EmployeeKnowledgeAccess` 数据耦合。
7. **LightRAG 继续 backend adapter**；不反向污染（lens / UI / types 不 import `LightRAG*`）。
8. **新增 Stage 12 约束**：不虚构 `review`/`confirmed` 状态机（除非 D5 明确放行方向 B）；贡献/确认 UI 仅落在既有 `EmployeeDetail` 内，不进 Rail/Card。

---

## 5. 候选设计（提交裁决，非已决定）

### 5.1 方向 A — Contribution Integrity（主，对应 G1/G2/G5）
- **A1 归因持久化**：在 `src/mock/mockBackend.ts` 增补 `importSourceAs(src, ownerAgent?)`，push node 时写入 `ownerAgent`（与 LightRAGBackend 对称）。`knowledgeAccess.contribute` 现有逻辑已优先调 `importSourceAs`，无需改 seam。→ 关 G1。
- **A2 摄入接线**：让贡献写入统一经 `ingestSource`（Mock 与 LightRAG 皆然），使 `chat`/`url` 归一化文本 + `ownerAgent` 元数据透传；pdf/video/github 仍走 placeholder。→ 关 G2（并盘活 ingestion 的死元数据）。
- **A3 节点可见**：`EmployeeKnowledgeContribute.tsx` 结果区由"仅文本"升级为"展示所建节点标题 + 可跳转 `KnowledgeNode` + 提交后刷新 `ownedNodes`"。**不引入 review/confirmed**（守 D5）。→ 关 G5。

### 5.2 方向 B — Contribution Lifecycle（辅，对应 G3/G4，需 D5 放行）
- **B1** 在 `DEFAULT_PERMISSION_POLICY` 引入一个 `'own'` agent（如 `curator`/`knowledge` 升 own？由 D 裁决）。
- **B2** 在 seam 新增可选 `confirmContribution(nodeId, confirmerId)` 后端能力（interface-external 扩展，同 `importSourceAs` 模式），单步 `draft→confirmed`。
- **B3** UI 新增"待确认"列表 + 单步确认按钮（落在 `EmployeeDetail` 内）。命名为 "Confirm"，**严禁 "Workflow"**。
- **B 不进入 Stage 12** 除非 D5 显式选择方向 B 或 A+B。

---

## 6. D1–Dx 裁决点（待你决定）

| ID | 裁决点 | 选项 |
|---|---|---|
| **D1** | Stage 12 主线方向 | A（Integrity）主 / B（Lifecycle）主 / A+B / 仅 A 子集（如只做 A1+A3） |
| **D2** | 是否在 `MockBackend` 补 `importSourceAs` 写 `ownerAgent`（关 G1） | 是（impl-only，不改接口）/ 否（维持默认模式无归因） |
| **D3** | 是否将贡献写入统一经 `ingestSource`（关 G2，盘活 ingestion ownerAgent 元数据） | 是 / 否（仅 LightRAG 维持现状） |
| **D4** | 结果 UI 是否呈现所建节点 + 刷新 owned 列表（关 G5）；是否允许点击跳转 `KnowledgeNode` | 是（仅展示+刷新）/ 是（含跳转）/ 否 |
| **D5** | 是否引入 `'own'` 层级 + 单步确认语义（方向 B，关 G3/G4） | 否（维持 draft 冻结，守 Stage 11 D5）/ 是（A+B，须 "Confirm" 命名非 "Workflow"） |
| **D6** | 验收断言取舍（依 D1 方向而定，见 §7 草案） | 见下 |

---

## 7. Scope Freeze（提案）

- 继承 §4 红线 1–8。
- Stage 12 改动预期仅触及：`src/mock/mockBackend.ts`（A1/A2）、`src/knowledge/ingestion/*`（若 A2 需微调）、`src/components/EmployeeKnowledgeContribute.tsx` + 其 hook（A3）、可能 `src/components/EmployeeKnowledgeDetail.tsx`（A3 刷新）。
- **明确不触及**：`KnowledgeBackend` 接口签名、`EmployeeCard`/`EmployeeIdentity`、`NavigationRail`/`NavRoute`、`knowledgeAccess.ts` 的权限 gate 逻辑（仅可能增可选 confirm 能力，且只在 D5 放行时）、任何 Runtime/Workflow/Chat、Memory/Capability 写回、LightRAG 反向污染。

---

## 8. 验收断言草案（依 D 裁决定稿，先列候选）

> 沿用 Stage 11 acceptance probe 方法论：所有扫描先 strip `//` + `/* */` + 字符串字面量再 token/regex；oxlint 用 `-c .oxlintrc.staged.json`。

**继承（Stage 11）必过项**
- `contributeGatedByPermission`、`contributeNotAutoConfirm`（仍不自动确认）、`dataFromAccessOnly`、`noKnowledgeBackendChange`（5 方法接口不变）、`noRuntimeIntroduced`、`noCapabilityCoupling`、`noLightRAGBackwardPollution`、`noEmployeeCardContractChange`、`noNewRailItem`。

**方向 A 新增候选**
- `attributionPersistedInDefaultBackend`：Mock 补 `importSourceAs` 后，`contribute` 返回的 node 在 `listOwned()` 中可见（`ownerAgent` 已写）。
- `contributionRoutesThroughIngestion`：Mock + LightRAG 贡献路径均经 `ingestSource`（grep/调用证据）。
- `contributionResultShowsCreatedNode`：UI 呈现所建节点（标题）+ 提交后 `ownedNodes` 刷新；无 review/confirmed 文案。

**方向 B 新增候选（仅当 D5 放行）**
- `contributionLifecycleConfirmExists`：存在单步 `draft→confirmed` 转换，非编排引擎（无 Workflow/Runtime token）。
- `ownTierAuthorityEnforced`：仅 `'own'` 层级可 confirm；普通 contribute 不可。

---

## 9. 提交与节点

- 本 Mini Plan 为**独立 design-only commit**（仅此 markdown 文件；harness 噪声 / dist / 其他 tracked-modified 不入库）。
- 提交后**停在审核节点**，等待 D1–Dx 裁决；**不自动进入编码**，绝不自动进入 Stage 13。
- 编码仅在 D 项全部裁决 + 你明确批准后启动，且仍受 §4 红线 + §7 scope freeze 约束。
