# Stage 11 Mini Plan · AI Employee Knowledge Contribution Surface

> Design only. No code. Single markdown commit. Stops at review node.
> Prerequisite: Stage 10 (`363d1a1`) accepted — read-only Knowledge Visibility Layer in place.
> Scope-freeze inherited from Stage 9/10; this plan adds a **guarded write** via the
> already-defined Stage 9 `contribute()` seam plus optional read-side suggestions.

---

## 1. 架构审计：Shared Knowledge Universe 当前能力边界（Q1）

### 1.1 已具备（verified in code）
| 能力 | 落地 | 状态 |
|---|---|---|
| Employee **读取**知识 | Stage 9 `EmployeeKnowledgeAccess`（listOwned/listAll/query/summary）+ Stage 10 `useEmployeeKnowledgeAccess` | ✅ |
| Employee **展示**贡献 | Stage 10 `EmployeeKnowledgeSummary`（owned count + permission badge）/ `EmployeeKnowledgeDetail`（owned + related + provenance） | ✅ |
| Knowledge Space **可视化** | Stage 5 canvas + Stage 10 employee readonly lens 增强 | ✅ |
| 贡献 **seam** | Stage 9 `knowledgeAccess.contribute(src, backend, agentId)` → `ContributionResult{ ok, nodeId, status:'draft', ownerAttribution }` | ✅（仅 seam） |
| 权限 gate | Stage 9 `resolvePermission`：`nox/knowledge='contribute'`，`assistant/task='read'` | ✅ |

### 1.2 缺口（G1–G6）
- **G1 无员工侧写回 UI**：`contribute()` seam 自 Stage 9 起存在，但 Stage 10 D8 显式「纯只读、无 contribute 按钮」——写入路径从未接通到 UI。
- **G2 贡献生命周期未暴露**：`ContributionResult.status` 已定义（`draft → review → confirmed`），但 UI 从不读取/展示；当前 seam 仅产出 `draft`。
- **G3 无知识感知推荐**：员工看到的是静态 owned 列表，未用 `query(seedNodeId,text)` / `getNeighbors(nodeId,text)` 做上下文「相关知识」推荐。
- **G4 Agent 运行时利用知识（方向 A 全量）**：需 Agent Runtime → 被红线冻结。
- **G5 Task → Knowledge → Learning Loop（方向 C）**：需 Task 模型 + 学习写回 + 可能触及 Memory 写 → 冲突「Memory=User / 无 Runtime / KB 5 方法不变」。
- **G6 多代理协作（方向 D）**：需跨代理冲突解决 / provenance 合并 → 无根基、体量大。

---

## 2. 下一步演进方向评估与优先级（Q2，仅分析不实现）

| 方向 | 内容 | 红线兼容性 | 优先级 |
|---|---|---|---|
| **A. Knowledge-aware Agent** | 员工主动利用知识 | 仅「读侧建议」兼容（复用 `query`/`getNeighbors`，无 Runtime）；全量需 Agent Runtime → 冻结 | **中**（本阶段仅读侧） |
| **B. Knowledge Contribution Workflow** | 员工产出知识 | `contribute()` seam 已存在；Stage 10 刻意停在只读。最连贯的下一步。**但「Workflow」命名与 Stage 11 红线「不引入 Workflow」冲突** → 必须 scope 为「单次受控写动作 + 状态展示」，非编排引擎 | **高**（主选） |
| **C. Task → Knowledge → Learning Loop** | 任务驱动学习写回 | 需 Task 模型 + 写回 + 可能动 Memory → 冲突多条红线 | **低 / 延后** |
| **D. Multi-Agent Knowledge Collaboration** | 多代理协作 | 需跨代理合并/冲突解决，无根基 | **低 / 延后** |

**推荐 Stage 11 主范围**：以 **B 受控写（Contribution Surface）** 为主线 —— 复用 Stage 9 `contribute()` seam，经 `permission==='contribute'` 门控，UI 触发一次写并展示 `ContributionResult` 状态；**不**构建 workflow/orchestration 引擎。
**可选辅线**：**A 读侧建议** —— 在既有 surface 用 `query()` 展示「相关知识推荐」（纯读、零运行时）。
**明确延后**：C、D（待红线放宽再议）。

---

## 3. 继续遵守的红线（Q3，Stage 11 不可突破）
1. **不新增 Rail**；不修改 `NavigationRail` / `NavRoute`（7 成员冻结）。
2. **不破坏 `EmployeeCard` / `EmployeeIdentity` 契约**（引用方 props 不变）。
3. **不修改 `KnowledgeBackend` 五方法接口**（`listNodes/listEdges/importSource/getNeighbors/getMemory`）。
4. **不引入 Runtime / Workflow / Chat** —— 本阶段只做一次受控 `contribute()` 调用 + 状态展示，不是编排。
5. **Memory 继续属 User Context**；不建 per-agent memory，不写回 Memory。
6. **Capability 继续 display-only**；不进 KG / backend / `EmployeeKnowledgeAccess` 数据耦合。
7. **LightRAG 继续 backend adapter**；不反向污染（lens / UI / types 不 import `LightRAG*`）。

---

## 4. 候选设计（提交裁决，非已决定）

### 4.1 Contribution Surface（主，对应 B）
- 在 **EmployeeDetail** 的 Knowledge section 末尾（或 SharedKnowledgeSpace 的 employee lens 面板）增加一个「贡献知识」入口。
- 入口仅当 `permission === 'contribute'`（nox / knowledge）时渲染；`read` 权限（assistant / task）保持只读、不显示按钮。
- 触发后调用 `access.contribute(src)`（src 来自既有 `SourceRef` 形态：URL / 文本 / 文件，不新增 backend 方法）。
- 展示 `ContributionResult`：`status`（draft/review/confirmed 如已声明）+ `ownerAttribution`（attributed / unsupported）。
- **不自动 confirm**：Stage 9 D6 的 `draft → review → confirmed` 仍是 seam 状态机，UI 仅展示，不代行确认。

### 4.2 Knowledge-aware Suggestions（辅，对应 A 读侧）
- 在 EmployeeDetail / SharedKnowledgeSpace 选中某节点时，用 `query(seedNodeId, text)` 取 Top-N `NeighborHit`，渲染「相关知识推荐」只读列表。
- 纯读；复用现有 seam；无运行时；不写回。

### 4.3 禁止项（scope freeze 硬约束）
- 不新增任何 `NavRoute`；不改 `EmployeeCard` / `EmployeeIdentity`。
- 不改 `KnowledgeBackend` / `KnowledgeNode` / `KnowledgeEdge` / `AgentProfile` / `types.ts` 的契约。
- 不引入 Workflow / Runtime / Chat / 新全局 Provider。
- 不将 Capability 接入知识数据流；不触碰 LightRAG 实现。

---

## 5. 待裁决 D1–D8

| # | 议题 | 选项 | 推荐 |
|---|---|---|---|
| **D1** | Stage 11 主线范围 | A. 仅 B（Contribution Surface）<br>B. B + A 读侧建议<br>C. 仅 A 读侧（最保守） | **B**（B 主 + A 读侧可选） |
| **D2** | 贡献入口落点 | A. 仅 EmployeeDetail Knowledge section<br>B. 仅 SharedKnowledgeSpace employee lens<br>C. 两处都放 | **A**（最小侵入，复用 Stage 10 section） |
| **D3** | 「Contribution Workflow」是否放行 | A. 放行但 scope 为「单次受控写 + 状态展示」（非引擎）<br>B. 禁止，Stage 11 仅做 A 读侧 | **A**（守红线 4 的前提下放行受控写） |
| **D4** | A 读侧建议是否纳入 Stage 11 | A. 纳入（复用 query）<br>B. 延后到 Stage 12 | **A**（低成本、纯读、零红线风险） |
| **D5** | 状态展示深度 | A. 仅显示 `draft` + ownerAttribution<br>B. 显示完整 draft/review/confirmed 生命周期（seam 当前只产 draft） | **A**（seam 未实现 review/confirmed 转换，UI 不虚构状态） |
| **D6** | src 来源形态 | A. 复用既有 `SourceRef`（url/text/file）<br>B. 新增表单字段 | **A**（不新增 backend 方法） |
| **D7** | 权限门控 | A. 仅 `contribute` 权限（nox/knowledge）显示入口；`read` 全只读<br>B. 全部显示但 read 禁用 | **A** |
| **D8** | 验收强制断言 | 见 §6（含 noNewRailItem / noEmployeeCardContractChange / noKnowledgeBackendChange / noRuntimeIntroduced / noMemoryLeak / noCapabilityCoupling / noLightRAGBackwardPollution） | — |

---

## 6. 验收断言草案（编码阶段目标，本计划不含代码）

```
noNewRailItem=true                  # NavRoute 联合仍 7 成员，无新增
noEmployeeCardContractChange=true  # EmployeeCard.tsx 字节级未变
noKnowledgeBackendChange=true      # types.ts 未改 + 5 方法接口不变
noRuntimeIntroduced=true           # 无 Agent Runtime / Workflow 引擎；仅一次 contribute() 调用
noMemoryLeak=true                  # 新增异步（若有）带 cancelled 守卫 + unmount 清理
noCapabilityCoupling=true          # capability 不进 KB/KG/EmployeeKnowledgeAccess
noLightRAGBackwardPollution=true   # lens/UI/types 无 LightRAG* import
contributeGatedByPermission=true   # 入口仅 permission==='contribute' 渲染
contributeNotAutoConfirm=true      # 无自动 confirm；仅展示 ContributionResult 状态
dataFromAccessOnly=true            # UI 仅经 EmployeeKnowledgeAccess，无直读 backend
readOnlySuggestionsOk=true         # 若含 A 读侧，query() 仅读、不写回
oxlintClean=true                   # .oxlintrc.staged.json 0w/0e
```

---

## 7. Scope Freeze（本 commit 仅文档；编码阶段允许文件）

- **本 commit**：仅 `docs/STAGE11_EMPLOYEE_KNOWLEDGE_CONTRIBUTION_MINI_PLAN.md`。
- **编码阶段（待裁决后）允许**：
  - `components/EmployeeDetail.tsx`（扩展既有 Knowledge section）
  - `components/SharedKnowledgeSpace.tsx`（employee lens 只读推荐，可选）
  - 新增 `components/EmployeeKnowledgeContribute.tsx`（受控写 UI）
  - 新增/复用 `useEmployeeKnowledgeAccess` 暴露 `contribute` 调用（仍仅 import `knowledgeUniverse`）
  - `i18n/zh-CN.ts` / `i18n/en-US.ts`（新增贡献/状态文案）
- **编码阶段禁止**（与 §3 红线一致）：
  - `components/EmployeeCard.tsx` / `EmployeeIdentity` 契约
  - `components/NavigationRail.tsx` / `NavRoute`
  - `types.ts`（`KnowledgeBackend` / `KnowledgeNode` / `KnowledgeEdge` / `AgentProfile`）
  - `knowledge/backends/*` / `LightRAG*` 实现
  - 任何 Runtime / Workflow / Chat / 新全局 Provider

---

## 8. 决策门控

本计划为 **设计文档**。提交后 **停在审核节点**，等待 D1–D8 裁决确认，再进入编码（届时仍单 commit、仅目标文件、不混 harness 噪声）。
