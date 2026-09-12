# P4-1 Final Product Audit — Knowledge Canvas Prototype → AI Employee OS 定位差距

> 文档性质：**审计 + 规划基线（不编码）**
> 时间：2026-09-06
> 关联：`AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`（定位基准）、`P4-PRODUCTIZATION-PLAN.md` §4（P4-2）、`P4-1-5_VISUAL_UNIFICATION_MINI_PLAN.md`
> 纪律：先文档、后编码；本文件不随代码 commit，待用户确认后进入 P4-2 编码。

---

## 0. 审计结论摘要

**P4-1 全部子步已完成并验收**：

| 子步 | 提交 | 交付内容 |
|---|---|---|
| P4-1/1 | `fbd61bb` | VISUAL_GUIDE 统一视觉规范（未来模块引用基准） |
| P4-1/2 | `d91da7c` | FirstRun 三步引导（语言/主题/身份），Settings 可重播 |
| P4-1/3 | `f4c3df6` | 三面空态系统（Welcome/Space/Growth 价值引导 + i18n + dev gate） |
| P4-1/4 | `980361c` | Demo Flow 完整闭环（Welcome→Space→Nox→Growth→Exit，mock 隔离） |
| P4-1/5 文档 | `ccaa05d` | 视觉统一迷你计划 + AI Employee OS Visual Evolution 基准 |
| P4-1/5 编码 | `b1a2661` | token 收敛 / reduced-motion 补全 / D1 dark hardcode 修复 |

**原型质量定级：可用、可演示、主题/双语/无障碍一致**。
- i18n 对齐 **zh=en=308**，无 CJK 泄漏；
- 三主题（light/dark/reduced）视觉一致，reduced-motion 已全量守卫；
- `data-theme` 渲染前首帧就位（无闪烁）；
- Demo 闭环无报错、无 404、退出零残留。

**与 AI Employee OS 定位的差距：结构性差距（非质量差距）**——当前是「单页 Dashboard 式知识画布原型」，定位目标是「空间化 AI 员工操作系统」。两者在信息架构、首页范式、Shell 形态、视觉材料四个层面存在代差，需通过后续 Visual Evolution 阶段（非 P4-2）迁移。

---

## 1. 当前 UI 状态评估（事实层）

### 1.1 已实现且稳定的能力
- **入口层**：Welcome（hero + 三卡 `wd-card`）+ FirstRun 三步门控（`FirstRunGate`/`FirstRunScreen`）。
- **主工作区**：`store.mode` ∈ {`space`, `growth`}；`ModeSwitch` 切换；`CanvasRegion` 按 mode 渲染 `CanvasViewport`(节点图) 或 `GalaxyCanvas`(成长星系)。
- **AI 关联解释**：`AIInsightPanel` + `AssociationExplainer`（Nox Knowledge Navigator 面板，P4-1/5 已修为 light/dark 自适应）。
- **AI 状态反馈**：`ThinkingRing` / `MasteryRing` / `morphicons/*`（AIStatus/EmployeeStatus/MemoryStatus/ProviderStatus/TaskStatus）。
- **设置**：`AppearanceSettings` / `LanguageSettings` / `ThemeSwitcher`。
- **Demo 驱动**：`mock/sequencer.ts`（`startDemo`/`runImportDemo`/`endDemo` + `useDemoActive` hook，置于 sequencer 层，非 canvasStore）。
- **主题与无障碍**：`themeBootstrap.ts` 首帧写 `data-theme`；`prefers-reduced-motion` 守卫覆盖 capture-path 全部 transition。

### 1.2 已知债务（P4-1 期间记录，非阻塞）
- **D2–D5 dark hardcode**：`p1Demo.css` / `p2Demo.css` / `p3Demo.css` / `morphiconDemo.css` 含非 token 兜底 hex，但**不在 capture 演示路径**，登记为 demo 债务。
- **canvasStore demoActive 偏离**：原方案拟在 canvasStore 加 `demoActive` 字段，实测触发 40 个预存 lint 违规；改为 sequencer 模块级 `demoActiveFlag` + `useDemoActive()` hook。**已用户确认接受**，作为最小偏离保留。
- **仓库级 lockfile 风险（P1）**：独立于本原型包，列为 P1 待决，不在此范围。

---

## 2. 与 AI Employee OS 定位的差距分析（六维度）

对照 `AI_EMPLOYEE_OS_VISUAL_EVOLUTION.md`：

| # | 定位维度 | 当前状态 | 差距 | 差距类型 |
|---|---|---|---|---|
| G1 | **核心定位** | Knowledge Canvas Prototype（单页知识画布） | 目标：AI Employee OS Spatial Workspace（空间化员工操作系统） | 架构/范式 |
| G2 | **Shell 形态** | 仅 `space`/`growth` 双 mode + SideNav，无 Desktop 外壳 | 目标：Desktop → Employee Center / Knowledge Space / Memory / Marketplace / Settings（非 Dashboard 中心） | 信息架构 |
| G3 | **首页范式** | Welcome 为 hero + 三数据卡堆叠（`wd-card--discover/grow/gap`） | 目标：单核心 AI Employee 入口（Apple 式大留白，如 🐈‍⬛ Nox「你的 AI 知识员工」+ 今日完成 + 进入工作） | 视觉/交互范式 |
| G4 | **AI Employee Card** | 组件零散存在（`AgentAvatar`/`MasteryRing`/`EmployeeStatusIcon`/`NoxGapCard`），**无统一卡** | 目标：Avatar+Identity+Status+Level/Growth+Capability 统一员工视觉模型 | 组件体系 |
| G5 | **Knowledge Space** | 传统节点关系图（`CanvasViewport`/`KnowledgeNode`/`EdgeLayer`） | 目标：知识生命系统（资料→AI理解→洞察→成长），非数据关系图 | 可视化范式 |
| G6 | **视觉材料** | 现有 token + 圆角/阴影/玻璃变量（`--glass-*` 已定义但未成体系），**无 Liquid Glass 材料** | 目标：Apple Liquid Glass / visionOS（半透明层叠、浮动窗、内容穿透、柔和边缘高光、空间层级） | 视觉材料 |

**结论**：G1/G2/G3/G4/G5/G6 全部为**未来 Visual Evolution 阶段**的迁移目标；P4-1/P4-2 不解决这些代差，只保证当前原型「演示稳定、一致、可复现」。

---

## 3. Liquid Glass / Spatial UI 后续迁移路线

> 原则：不提前改架构；每阶段先文档后编码；不引入 backend / Agent Core / 真实数据面。

### Phase 0 — 当前基线（已完成）
- token 体系收敛、主题自适应、reduced-motion 守卫、`--glass-*` 变量已就位。
- **可立即复用**：theme bootstrap、i18n store、morphicon 状态层、AIInsightPanel 事件出口。

### Phase 1 — Visual Evolution（P4-2 之后，独立排期）
目标：在不改信息架构前提下，把现有原型「换装」为 Liquid Glass 观感 + 单核心首页 + 统一员工卡。
- **G3 首页**：Welcome 从三卡堆叠 → 单核心 Nox 入口（大留白 + Avatar + 今日完成 + 进入工作）。
- **G4 员工卡**：抽象 `EmployeeCard` 组件（Avatar+Identity+Status+Level+Capability），收敛 `AgentAvatar`/`MasteryRing`/`NoxGapCard`。
- **G6 玻璃材料（轻量）**：用现有 `--glass-blur`/`--glass-*` + `backdrop-filter` 在面板层做半透明层叠；先验证 light/dark 下可读性。
- **不触碰**：Shell 结构、节点图、真实数据。

### Phase 2 — Spatial Shell（信息架构迁移）
目标：Desktop 外壳 + 多工作区浮动玻璃面板。
- **G2 Shell**：新增 `DesktopShell`（MacWindowShell 已存在，可作起点）→ Employee Center（落地页）/ Knowledge Space / Memory / Marketplace / Settings。
- **G6 空间层级**：浮动窗口 + z 轴深度 + 内容穿透玻璃 + 柔和边缘高光。
- **G1 定位升级**：从「画布」叙事转为「员工操作系统」叙事。

### Phase 3 — Knowledge Life-System（可视化范式迁移）
目标：**G5** 从节点关系图 → 知识生命系统（资料→AI理解→洞察→成长 流）。
- 复用 `Relationship`/`GrowthNodeKind` 桥接（P4 §6.2 已定「同源双视图」）。
- 新可视化组件只读消费 store，不新增数据面。

### Phase 4 — Spatial Computing 精修
- visionOS 级运动语言（深度位移、焦点景深、specular 高光跟随）。
- 研究跟踪（持续）：liquid glass react ui / apple glassmorphism dashboard / react macos desktop / ai agent ui / knowledge graph react / react flow beautiful examples / spatial ui react（见基线 §1.7）。

**路线图依赖**：Phase 1 → 2 → 3 → 4 顺序；Phase 0 已就绪；研究跟踪贯穿。

---

## 4. 问题分级：必须修 vs 留到未来

### 4.1 必须修（P4-2 验收前完成，属 P4-2 范围）
| ID | 问题 | 处理 | 不修的后果 |
|---|---|---|---|
| M1 | P4-2 演示面仅覆盖 4 面（welcome/space-demo/growth-demo/exit），计划要求 **6 面** | 扩展 capture 脚本：新增 **Nox Knowledge Navigator 面板面** 与 **AI 状态反馈面（morphicon/thinking）** 的显式截图 | 演示资产不完整，不符 §4.1 |
| M2 | 新增 P4-2 文案须保持 zh/en **1:1** | 任何新 key 同步进 `zh-CN.ts`/`en-US.ts`，维持 308→N 对齐、无 CJK 泄漏 | i18n 回归 |
| M3 | 三主题 + reduced-motion 在 P4-2 全 6 面复验 | capture 已断言 `errors=0`/`404=0`/`themeAttr===theme`/`motionOff=ok`，扩展后继续断言 | 主题/无障碍回归 |
| M4 | D1 dark hardcode（Nox 面板）已修，需 P4-2 截图复验 light/dark 自适应 | 已在 P4-1/5 完成，P4-2 截图即证明 | — |

### 4.2 留到未来（Visual Evolution / P5+，不阻塞 P4-2）
| ID | 问题 | 归属阶段 |
|---|---|---|
| F1 | G2 Desktop/Employee Center/Marketplace/Memory Shell | Phase 2 |
| F2 | G3 单核心 Welcome 首页范式 | Phase 1 |
| F3 | G4 统一 AI Employee Card 组件 | Phase 1 |
| F4 | G5 知识生命系统可视化（替代节点图） | Phase 3 |
| F5 | G6 真实 Liquid Glass 材料（深度/穿透/高光） | Phase 1→4 渐进 |
| F6 | D2–D5 demo 债务 dark hardcode（p1/p2/p3/morphiconDemo.css） | 未来清理，当前不在演示路径 |
| F7 | canvasStore demoActive 偏离清理（已接受设计） | 仅在重构 canvasStore 时一并处理 |
| F8 | 仓库级 lockfile 风险（P1） | 独立 P1 待决 |

---

## 5. 风险与开放项
- **演示路径 ≠ 全量代码**：`p1Demo`/`p2Demo`/`p3Demo`/`morphiconDemo` 为独立入口，含 dark hardcode 债务（F6），但不在 P4-2 capture 路径，不阻塞。
- **范式迁移需用户拍板**：G2/G3/G5 涉及信息架构与可视化范式变更，进入 Phase 1/2/3 前须单独出设计文档（沿用 P4-3 设计文档范式）。
- **性能**：Liquid Glass `backdrop-filter` 在低端 GPU 需降级策略（Phase 1 验证项）。

---

## 6. 下一步
- 本文件确认后 → 进入 **P4-2 Showcase**（见 `P4-2_SHOWCASE_MINI_PLAN.md`）。
- Visual Evolution（Phase 1+）在 P4-2 收尾后单独规划，不提前改架构。
