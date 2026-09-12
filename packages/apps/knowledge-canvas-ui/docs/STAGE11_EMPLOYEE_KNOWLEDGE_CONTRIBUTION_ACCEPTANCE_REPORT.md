# Stage 11 — AI Employee Knowledge Contribution Surface · Acceptance Report

**Status:** ✅ ACCEPTED (停 Stage 11 验收节点，不进入 Stage 12)
**Mini Plan:** `docs/STAGE11_EMPLOYEE_KNOWLEDGE_CONTRIBUTION_MINI_PLAN.md` (commit `e420caf`, D1–D8 已裁决)
**Coding commit:** `c40398a`（单 commit，仅 Stage 11 目标文件，9 files / +653）

---

## 1. 裁决落点（D1–D8 回顾）

| 裁决 | 决定 |
|------|------|
| D1 主线 | B（受控单写贡献）+ A（只读知识感知推荐）；不进入 Learning Loop / 多代理协作 |
| D2 入口落点 | EmployeeDetail（Center 轻量、Space 浏览，Detail 为身份上下文最佳位置）|
| D3 贡献约束 | 单次受控写 seam；无 Workflow Runtime / 任务编排 / Chat UI；不自动确认 |
| D4 读侧建议 | 复用 `query`/`getNeighbors`；只读；无推荐 Runtime |
| D5 状态展示 | 仅 `draft` + `ownerAgent` + `source provenance`；不虚构 review/confirmed |
| D6 模型复用 | 复用现有 `SourceRef`；不新增 `KnowledgeBackend` 方法 |
| D7 权限门 | `contribute` 权限 gate 控制入口；无权限不显示写入口、不允许调用 |
| D8 验收断言 | 见第 3 节（11 项全 PASS）|

---

## 2. 实现内容（目标文件，单 commit）

**新增（4）**
- `src/components/useEmployeeKnowledgeContribute.ts` — 贡献 seam：绑定 `bindEmployeeAccess`，`canContribute = permission !== 'read'`，硬 gate 后单次 `access.contribute(src)`；unmount 用 `cancelledRef` 守卫。
- `src/components/useEmployeeKnowledgeSuggestions.ts` — 只读推荐 adapter：复用 `listAll`/`query`（→ `getNeighbors`），`cancelled` 守卫防泄漏。
- `src/components/EmployeeKnowledgeContribute.tsx` — 受控贡献入口；`if (!canContribute) return null`；仅展示 `draft` 真实状态。
- `src/components/EmployeeKnowledgeSuggestions.tsx` — 只读相关知识推荐（仅当 `seedNodeId` 存在）。

**修改（4）**
- `src/components/EmployeeKnowledgeDetail.tsx` — 接入 `EmployeeKnowledgeSuggestions`（seed = 首个 owned node）+ `EmployeeKnowledgeContribute`。
- `src/components/EmployeeDetail.css` — 新增贡献/推荐区块样式。
- `src/i18n/zh-CN.ts` / `src/i18n/en-US.ts` — 新增 `knowledge.contrib.*` / `knowledge.suggest.*` 键。

**数据链：** `UI → useEmployeeKnowledge{Contribute,Suggestions} → EmployeeKnowledgeAccess → SharedUniverse`（经 `knowledgeUniverse` seam）。UI 仅 `import` `knowledgeUniverse`（运行时）+ 类型；无 `KnowledgeBackend` / `LightRAG*` / `MockBackend` / `createBackend`。

---

## 3. 验收探针结果（D8）

> 全部扫描**先 strip `//` 与 `/* */` 注释、再 strip 字符串字面量**后执行 token / regex 匹配，避免红线说明文字与字符串常量误报。oxlint 使用项目实际支持的 `-c .oxlintrc.staged.json`。

| # | 断言 | 结果 | 证据 |
|---|------|------|------|
| 1 | `contributeGatedByPermission` | ✅ PASS | hook `canContribute`+`if (!canContribute)`+`access.contribute(`；UI `if (!canContribute) return null` |
| 2 | `contributeNotAutoConfirm` | ✅ PASS | 无 `confirm`/`approve`/`publish`/`reject` 状态流转 token；UI 仅展示 `knowledge.contrib.draft` |
| 3 | `dataFromAccessOnly` | ✅ PASS | 22 imports，0 个 forbidden（`backend`/`lightrag`）；seam `../knowledge/knowledgeUniverse` 已用 |
| 4 | `noKnowledgeBackendChange` | ✅ PASS | Stage 11 代码无 `KnowledgeBackend` token；`types.ts` 未改动 |
| 5 | `noRuntimeIntroduced` | ✅ PASS | 无 `Workflow`/`Runtime`/`Orchestrator`/`Scheduler`/`ChatUI` token；无 runtime/workflow import |
| 6 | `noCapabilityCoupling` | ✅ PASS | 无 `Capability` token；无 capability import |
| 7 | `noLightRAGBackwardPollution` | ✅ PASS | 无任何 `LightRAG`/`lightrag` token |
| 8 | `noEmployeeCardContractChange` | ✅ PASS | 无 `EmployeeCard`/`EmployeeIdentity` token；对应文件未改动 |
| 9 | `noNewRailItem` | ✅ PASS | 无 `NavRoute`/`NavigationRail` token；对应文件未改动 |
| 10 | `noWorkflowEngineIntroduced` | ✅ PASS | 无任何 `Workflow`/`WorkflowEngine`/`workflow` token；无 workflow import（与 `noRuntimeIntroduced` 正交，独立断言）|
| 11 | `noPrivateKnowledgeSpace` | ✅ PASS | Stage 11 代码无 private/isolated 知识空间 token；SharedUniverse seam 保持 `ownerAttribution` provenance + `status:'draft'`，未引入私有命名空间；`employeeKnowledgeAccess.ts`/`knowledgeAccess.ts`/`knowledgeUniverse.ts` 均未被 Stage 11 改动 |

**合计：11 / 11 PASS。**

### oxlint
`oxlint -c .oxlintrc.staged.json` 对 7 个目标文件：**Found 0 warnings and 0 errors.**

---

## 4. Scope Freeze 合规

- ✅ 允许项均已实现：EmployeeDetail 贡献入口、contribution UI seam、只读 recommendation adapter。
- ✅ 禁止项均未触碰：未改 `KnowledgeBackend` 五方法接口、`Employee`/`Memory`/`Capability` 模型；未新增 Runtime / Workflow Engine / Chat；未新增 Rail；无 LightRAG 反向污染 UI。

## 5. 结论

Stage 11（AI Employee Knowledge Contribution Surface）**实现完成并通过全部验收断言**。代码已单 commit，仅含 Stage 11 目标文件，不含 harness 噪声与 dist。**当前停在 Stage 11 验收节点，不自动进入 Stage 12。**
