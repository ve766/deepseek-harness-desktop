# STAGE14 P2-1 UI / mock 解耦 Review

> 状态：**P2-1 执行完成，停在 Review Node**。代码改动已在工作树，**未提交**（待裁决）。
> 目标：落实 F10 —— UI 层禁止 import `mock/*`；领域常量迁入 domain 层。
> 目标结构：`Component → Domain Contract → Backend Adapter`。
> 约束：不新增依赖 · 不改 lockfile · 不做粒子/3D/美化 · 不顺手清理其它 mock · 不重构组件 · 不改变数据语义。

---

## 0. 结论摘要

| 项 | 结果 |
|---|---|
| **UI → mock import** | **15 → 0**（13 个文件，15 条 import 全部改写） |
| 新增 domain 层 | `src/domain/nodeKinds.ts`（GROWTH_KINDS）· `src/domain/agents.ts`（AGENTS/AGENT_MAP） |
| 新增 demo 层 | `src/demo/sequencer.ts` · `src/demo/galaxy.ts`（demo 驱动移出 mock/） |
| canvasStore / backend seam | **未受影响**（见 §5） |
| 新增类型错误 | **0**（tsc 6.0.3，TS2307 模块解析错误 = 0；逐行比对 HEAD 无新增） |
| 生产逻辑行为变化 | **无**（移动内容逐字一致；改写的仅是 import 说明符） |
| git 范围 | 11 M + 1 重命名(R) + 3 新增(A)；详见 §6 |

---

## 1. moved / changed 文件清单

### 1.1 新增（4 个）

| 文件 | 内容来源 |
|---|---|
| `src/domain/nodeKinds.ts` | `GROWTH_KINDS`（自 `mock/data.ts` 抽离，**逐字**） |
| `src/domain/agents.ts` | `AGENTS` / `AGENT_MAP`（自 `mock/agents.ts` 迁移，**逐字** + 2 行说明） |
| `src/demo/sequencer.ts` | 自 `mock/sequencer.ts` 迁移（仅 `./data` → `../mock/data`） |
| `src/demo/galaxy.ts` | 自 `mock/galaxy.ts` 迁移（仅 `./data` → `../mock/data`） |

### 1.2 删除（3 个）

| 文件 | 说明 |
|---|---|
| `mock/agents.ts` | **源文件未跟踪**（untracked）→ 删除不产生 git `D` |
| `mock/galaxy.ts` | **源文件未跟踪** → 删除不产生 git `D` |
| `mock/sequencer.ts` | **源文件已跟踪** → 工作树出现 ` D`，提交时与 `demo/sequencer.ts` 合并为**重命名**（相似度 **98.7%**） |

### 1.3 修改（12 个 tracked + 4 个 untracked）

**已跟踪（git 可见，` M`）**：

| 文件 | 改动 |
|---|---|
| `components/P3Showcase.tsx` 等 **9 个组件** | 仅 import 说明符改写（见 §3 表） |
| `mock/bootstrap.ts` | `./galaxy`→`../demo/galaxy`、`./sequencer`→`../demo/sequencer` |
| `mock/data.ts` | 移除 `GROWTH_KINDS`（+2 行注释，净 −5 行） |

**未跟踪（git 不可 diff，属既有 `??` 噪声，改写了 import 但无法在 git 中呈现）**：

| 文件 |
|---|
| `components/CanvasToolbar.tsx` · `KnowledgeNode.tsx` · `SideNav.tsx` · `NoxGapCard.tsx` |

> ⚠️ **诚实披露（tracked/untracked 混态）**：`packages/apps/knowledge-canvas-ui/src` 处于**部分已跟踪**状态 —— 64 个文件已提交、其余未提交。因此：9 个组件的改写是 git 可见的 `M`；4 个组件（CanvasToolbar/KnowledgeNode/SideNav/NoxGapCard）是**未跟踪文件**，改写真实存在但 git 无法呈现 diff，只能待该包整体首次提交时一并入库。此混态是**既有项目现状**，非本次引入。

---

## 2. UI → mock import 数量变化

| 指标 | 之前 | 之后 |
|---|---|---|
| `components/` + `P3Showcase.tsx` 对 `mock/*` 的 import | **15** | **0** |
| 全仓对 `mock/*` 的 import | 18 | **5** |

**剩余 5 处（全部合法，非 UI 层）**：

| 文件 | 指向 | 性质 |
|---|---|---|
| `demo/galaxy.ts` | `../mock/data` | demo 驱动消费 fixture（方向正确：demo → mock） |
| `demo/sequencer.ts` | `../mock/data` | 同上 |
| `knowledge/knowledgeUniverse.ts` | `mock/mockBackend` | **组装根**（唯一合法的后端选择点，未动） |
| `main.tsx` | `mock/bootstrap` | 入口 wiring |
| `p3DemoEntry.tsx` | `mock/bootstrap` | 入口 wiring |

---

## 3. 新 domain contract 位置

| 契约 | 位置 | 内容 | 用途 |
|---|---|---|---|
| **节点归属词汇** | `src/domain/nodeKinds.ts` | `GROWTH_KINDS = Set('concept','skill','memory','task','learningPath')` | Space/Growth 边界（对应 `KNOWLEDGE_MODE_BOUNDARY.md §4`） |
| **员工花名册** | `src/domain/agents.ts` | `AGENTS: AgentProfile[]` + `AGENT_MAP` | 四角色（`AgentId` 已在 `types.ts`，`ownerAgent` 已是数据层事实） |

依赖方向（现已成立）：`Component → domain/`；`demo/ → mock/ (data)`；`domain/` 不依赖任何 `mock/`。

---

## 4. 改写明细（15 条 import → 新目标）

| 原模块 | 新模块 | 文件数 |
|---|---|---|
| `mock/data` (GROWTH_KINDS) | `domain/nodeKinds` | 3（CanvasToolbar / CanvasViewport / GalaxyCanvas） |
| `mock/agents` (AGENTS/AGENT_MAP) | `domain/agents` | 8（AIInsightPanel / EmployeeKnowledgeContribute / EmployeeKnowledgeDetail / KnowledgeNode / MacWindowShell / SharedKnowledgeSpace / SideNav / P3Showcase） |
| `mock/sequencer` | `demo/sequencer` | 3（AIInsightPanel / CanvasToolbar / WelcomeDashboard） |
| `mock/galaxy` (runLearningPathDemo) | `demo/galaxy` | 1（NoxGapCard） |

---

## 5. 是否影响 canvasStore / backend seam？

**否。** 逐项核实：

| seam | 状态 |
|---|---|
| `store/canvasStore.ts` | 未触碰（`createStore(backend: KnowledgeBackend)` 不变） |
| `knowledge/knowledgeUniverse.ts` | 未触碰（仍是全仓唯一 `MockBackend` import 点） |
| `types.ts` | 未触碰（`AgentId` / `AgentProfile` 仍在） |
| `KnowledgeBackend` 5 方法契约 | 未触碰 |
| `demo/sequencer.ts` / `demo/galaxy.ts` 对 store 的引用 | 保持原样（`import { store } from '../store/canvasStore'`） |

---

## 6. git diff 范围确认

当前工作树（全仓）：**144 ?? / 110 M / 1 D**（基线 144 ?? / 99 M / 0 D）。

**本次 P2-1 引入的 git 可见变更**：

| 类别 | 数量 | 文件 |
|---|---|---|
| ` M` | 11 | 9 组件 + `mock/bootstrap.ts` + `mock/data.ts` |
| ` D` | 1 | `mock/sequencer.ts`（→ 提交时重命名为 `demo/sequencer.ts`，相似度 98.7%） |
| 新增（untracked） | 4 | `domain/nodeKinds.ts` · `domain/agents.ts` · `demo/sequencer.ts` · `demo/galaxy.ts` |

**建议的提交 staging（单一批次，15 个路径项）**：

```
git add packages/apps/knowledge-canvas-ui/src/components/{P3Showcase,AIInsightPanel,CanvasViewport,EmployeeKnowledgeContribute,EmployeeKnowledgeDetail,GalaxyCanvas,MacWindowShell,SharedKnowledgeSpace,WelcomeDashboard}.tsx
git add packages/apps/knowledge-canvas-ui/src/mock/bootstrap.ts packages/apps/knowledge-canvas-ui/src/mock/data.ts
git add packages/apps/knowledge-canvas-ui/src/mock/sequencer.ts          # 记录删除
git add packages/apps/knowledge-canvas-ui/src/demo/sequencer.ts          # 记录新增 -> 合并为重命名
git add packages/apps/knowledge-canvas-ui/src/domain/nodeKinds.ts packages/apps/knowledge-canvas-ui/src/domain/agents.ts packages/apps/knowledge-canvas-ui/src/demo/galaxy.ts
```

提交后 `git diff --cached -M --name-status` 预期：**11 M + 1 R + 3 A = 15 项**，**无 ` D`**（重命名已合并）。

**关于「deleted=0」**：工作树当前 `1 D` 是**重命名的已跟踪源半**（`mock/sequencer.ts` → `demo/sequencer.ts`，98.7% 相似），staged 后 git 记为 `R`（rename），**无文件丢失**、可从 `HEAD` 完全恢复；`mock/agents.ts`、`mock/galaxy.ts` 源文件**本就未跟踪**，删除不产生 `D`。故「deleted=0」在提交语义下成立。

---

## 7. 验收对照

| 验收项 | 要求 | 结果 |
|---|---|---|
| UI → mock import | 清理 | ✅ 15 → 0 |
| 领域常量入 domain | 抽离 | ✅ `GROWTH_KINDS` → `domain/nodeKinds.ts` |
| 保持行为不变 | 不变 | ✅ 迁移内容逐字一致（diff 仅 import 路径 + 注释） |
| 不引入新依赖 | 无新依赖 | ✅ 未动 `package.json` / lockfile |
| `src ' M'`（仓库根） | 0 | ✅ **0** |
| deleted | 0 | ✅ 提交语义下为 0（重命名，非删除） |
| 不污染已有 99 M | 不混入 | ✅ 仅新增 11 个 P2-1 相关 `M`；既有 `STAGE11` 报告等 `M` 未触碰 |
| 无生产逻辑行为变化 | 无 | ✅ tsc 6.0.3：**TS2307=0**；逐行比对 HEAD，**0 个新增错误** |

### 类型检查证据（tsc 6.0.3，strict）

- 总错误行 57，全部为**既有错误**（CSS side-effect 声明 TS2882、`LocText` 未导出 TS2459、morphicons props TS2322、`process` 缺 @types/node TS2591、`mock/data.ts` 缺 `Relationship/LearningPath/Progress/AIRecommendation` 类型导入 TS2304）。
- 唯一落在新文件上的错误 `demo/sequencer.ts:122 TS2740` 与原始 `mock/sequencer.ts` 该处**逐字节一致** → 既有错误仅随文件迁移。
- `mock/data.ts` 的 4 个 TS2304 行号 324→319（GROWTH_KINDS 移除净 −5 行）→ 既有错误仅行号平移。

---

## 8. 边界遵守

- ✅ 只处理了 inventory 确认的 mock fixture/domain 边界
- ✅ 文件移动保持 git 可追踪性（相似度 98.7%，提交记为 rename；agents/galaxy 源文件未跟踪故无 rename 可记，已在 §6 披露）
- ✅ 未顺手清理其它 mock（`mockBackend.ts` / `bootstrap.ts` / `data.ts` 的 fixture 数据均保留；`bootstrap.ts` 仅改必要 import）
- ✅ 未重构组件结构、未优化 UI
- ✅ 未改变数据结构语义（`GROWTH_KINDS` 值、`AGENTS` 内容逐字保留）
- ✅ 未新增依赖、未修改 lockfile

---

## 9. 一个必须报你的开放问题（demo 驱动：relocate vs port）

`mock/sequencer.ts` / `mock/galaxy.ts` 是**脚本化 demo 驱动**（读 fixture 数据、驱动 store 动画），不是 fixture 数据本身。本次把它们移到 `src/demo/` —— **这是「重定位」而非「依赖倒置」**：UI 仍然依赖一个脚本化模拟，只是不再从 `mock/` 命名空间取用。

| 方案 | 说明 | 是否本次采用 |
|---|---|---|
| A. 重定位到 `demo/`（本次） | UI 不再 import `mock/*`，demo 驱动有了显式命名 | ✅ 已做 |
| B. 引入 domain 端口（ActivitySource） | UI 依赖契约，mock 序列器作为 adapter 实现 → 真事件源可无缝替换 | ❌ 未做，留待裁决 |

按你「保持单目标推进」的边界，我**未**引入 B（它会新增一个抽象层，超出「清理 import」的范围）。建议 B 留到 P2-2（Agent Core 接入）时，与真实活动事件源一起设计。

---

## 10. 红线

| 项 | 状态 |
|---|---|
| HEAD | `94153a7`（**未变**，无 commit） |
| 仓库根 `src ' M'` | **0** |
| `pnpm-lock.yaml` | 未触碰 |
| `packages/llm` · router · UI 架构 · 依赖 | 未触碰 |
| 粒子/3D/Shader/美化 | 未做 |
| 服务 | 未启动（Ollama 11434 仍按 P1 收尾状态运行，与本任务无关） |

**状态**：🟡 停在 **P2-1 Review Node**。代码在工作树未提交，等你裁决 ① 是否提交（staging 清单见 §6）② 本 Review 是否落盘/提交 ③ demo 驱动的 A/B 方案取舍。
