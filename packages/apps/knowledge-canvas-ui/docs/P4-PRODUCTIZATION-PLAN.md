# P4 产品化规划 — AI Employee OS 体验闭环

> 状态：规划文档（v1.0）
> 纪律：先文档、后编码；每阶段先出方案，用户确认后再动手；per-commit scope freeze；不自动进入下一阶段。
> 本文件只描述规划，不涉及任何代码改动。

---

## 0. 总目标与原则

P4 不再新增大量功能，而是**完成 AI Employee OS 产品体验闭环**——让现有能力（Morphicon 状态层、Theme、Space/Growth 双视图、多语言、Mock backend）以"产品"而非"原型"的形态呈现给使用者。

三条原则：

1. **体验闭环优先**：首次启动 → 空状态 → Demo 引导 → 主界面 → 状态反馈 → 多语言，全程无断点。
2. **契约固化优先于扩展**：先把 P0–P3 沉淀的 Morphicon / Theme / Space-Growth 约定写成文档契约，后续一切扩展（Today/Agent/Command Palette/Timeline）都按契约接入，不重构。
3. **冻结纪律延续**：不接真实 backend、Agent Core、LLM Router、真实 Embedding/KG，不引入大型 UI 框架。

---

## 1. 范围与冻结约束（贯穿 P4 全阶段）

| 类别 | 允许 | 禁止 |
|---|---|---|
| 后端 | 沿用 `MockBackend`，可丰富 mock 数据 | 接真实 backend / Memory / Embedding / KG |
| 智能层 | 沿用 `AiStage` 状态机与事件出口 | 接 Agent Core / LLM Router / 真实推理 |
| UI 框架 | 现有 React + 手写 CSS（token 体系） | 引入 Tailwind / MUI / 大型动画库 |
| 状态层 | 沿用 MorphIcon 7 态 + 各域词汇表 | 新增第 8 个基类态（除非 P4-0 评审通过） |
| 主题 | 沿用 token + `data-theme` 机制 | 改回 `prefers-color-scheme` 硬编码路径 |
| 代码改动 | 仅体验精修、文档、Showcase 脚本 | 改 llm-router / agent-loop / ai-provider-manager |

---

## 2. P4-0 架构文档固化（契约层）

**目标**：把 P0–P3 的隐性约定转为显式契约，作为 P4-3 未来模块的设计依据，也作为新成员接手的事实标准。

### 2.1 `STATUS_CONTRACT.md`
- **来源事实**：`components/morphicons/geometry.ts`（7 基类态：`idle/thinking/searching/learning/completed/warning/error`）、`states.ts`（Provider/Employee/Task/AI/Memory 五套语义→基类映射 `*_TO_BASE` + i18n `*_KEY`）、`useMorphState`（最小停留/终态停留 + reduced-motion 降级）。
- **内容**：
  - 7 基类态的视觉语义定义（每个态该长什么样、何时进入、何时退出）。
  - 新增第 N 个状态面的标准流程：① 在 `states.ts` 加 `Xxx_TO_BASE` 映射；② 在 i18n 加 `status.*` 域 key；③ 复用 `MorphIcon`，不碰基类。
  - 语义态爆炸规避规则（同一视觉态可被多个语义态映射，但禁止语义态反向创造新视觉态）。
- **验收**：未来模块设计文档（P4-3）可直接引用本契约，无需读源码。

### 2.2 `THEME_TOKEN_GUIDE.md`
- **来源事实**：`styles/app.css` 的 `:root` token 基线（设计 token 块：`--space-*`/`--radius-*`/`--shadow-*`/`--text-*`/`--glass-*`）、System 跟随 OS 的 `@media` 闸门、显式 `:root[data-theme="dark"]` 覆写、`themeBootstrap.ts` 的 `applyTheme('system')` 移除属性机制、`localStorage.kcu-theme` 持久化。
- **内容**：
  - Token 清单与语义（颜色/间距/圆角/阴影/字体/玻璃）。
  - 三模式驱动机制（system/light/dark）与 `data-theme` 契约。
  - **自定义主题路径**：新增 `:root[data-theme="brand-x"]` 只需覆写同一 token 集。
  - **已知 Caveat（待 P4 非阻塞优化收敛）**：显式 dark 块内含少量组件级硬编码覆写（`.tbtn`/`.knode__connect`/`.bg-layer__base`/`.gnode__sugg-text`），自定义主题若只覆写 token 会"半残"。
- **验收**：文档明确列出"组件级覆写 → token 化"的收敛清单，供 §7 优化使用。

### 2.3 `KNOWLEDGE_MODE_BOUNDARY.md`
- **来源事实**：`types.ts` 的 `SpaceNodeKind = document|video|conversation|project`（我有什么）、`GrowthNodeKind = memory|task|concept|skill|learningPath`（我懂什么/缺什么）、`mode: 'space'|'growth'` 单一切换、`Relationship` 桥接模型、`KnowledgeBackend` 接口。
- **内容**：
  - Space 与 Growth 的语义边界定义（数据语义 + 渲染视图差异，非能力重复）。
  - 节点读写统一经 `KnowledgeBackend`，两面不复写节点管理。
  - **双面关系桥接策略**：同源双视图（如 project 既是"有"也是"学"）**暂不加 `crossMode` 字段**，先通过 `Relationship`（edge）保持桥接；若真实场景出现再设计 `crossMode`（列为未来，非 P4）。
- **验收**：P4-3 的 Today/Agent/Command Palette/Timeline 设计不破坏此边界。

---

## 3. P4-1 产品体验精修（闭环层）

**目标**：让"首次启动 → 空状态 → Demo → 主界面"形成无断点体验，并完成 Apple 风格最终视觉统一。

### 3.1 首次启动体验（First-Run）
- 检测 `localStorage` 首次启动标志；未初始化时进入引导。
- 引导内容：语言选择（复用 `kcu.language.v1`）、主题选择（System/Light/Dark，复用 `themeBootstrap`）、一句产品定位（AI Employee OS 隐喻：招聘/管理动物员工团队）。
- 不新增 PersistedStore，仅复用现有 localStorage 键。

### 3.2 空状态设计（Empty States）
- Welcome Dashboard 无数据态、Knowledge Space 无节点态、Growth Galaxy 无成长态，各配一句引导文案 + 主操作按钮。
- 文案走 i18n（复用 `dashboard.*` / `canvas.*` 域，必要时扩 `empty.*` 域）。
- 空状态使用 MorphIcon `idle` 态作为视觉锚点，不引入新插画资源。

### 3.3 Demo 流程（Guided Demo）
- 一条可重放的 Demo 路径：Welcome → 导入一个示例 Source → Space 出现节点 → 切 Growth 看到成长建议 → Nox 面板给出关联解释 → 切换语言/主题观察一致性。
- Demo 数据来自扩展后的 `MockBackend`（不接真实 backend）。
- Demo 流程本身作为 P4-2 Showcase 的脚本基础。

### 3.4 Apple 风格最终视觉统一
- 统一圆角层级、阴影层级、间距比例（对齐 §2.2 token）。
- 玻璃拟态（`.glass`）统一应用规则。
- 字体排印（标题/正文/注释三级）与字重规范。

### 3.5 交互细节精修
- 按钮/卡片 hover/active 反馈一致性（沿用 `ui-primitives` 的 Pill/Button/StateDot，不自研）。
- 主题切换无闪烁（确保 `bootstrapTheme` 在首帧前应用）。
- reduced-motion 全覆盖（Morphicon/Association 已支持，补齐其余过渡）。

### 3.6 验收
- 首启 → 空态 → Demo → 主界面 全程可走通，无断点、无控制台报错。
- 三主题 + 双语下视觉一致；reduced-motion 关闭所有非必要动画。
- 不引入新依赖。

---

## 4. P4-2 产品 Showcase（演示层）

**目标**：准备一套可复现的 AI Employee OS 演示资产，覆盖六个核心面向。

### 4.1 展示面
1. **Welcome Dashboard** — 首次启动 / 入口。
2. **Knowledge Space** — 「我有什么」（Space 视图）。
3. **Growth Galaxy** — 「我懂什么 / 缺什么」（Growth 视图）。
4. **Nox Knowledge Navigator** — AI 关联解释面板（P2 动画复用）。
5. **AI 状态反馈** — Morphicon / AiStage 状态层（P0/P1 复用）。
6. **多语言切换** — zh-CN / en-US 实时切换（i18n 复用）。

### 4.2 交付物
- 离线截图脚本（沿用 `kcu-dist` 的 `capture-p3.cjs` 范式）输出六面 × 双语 × 三主题。
- 一份 Showcase 走查清单（每个展示面要证明什么）。
- 可选：一段静默录屏脚本（不引入录屏依赖，优先截图集）。

### 4.3 验收
- 六面截图集完整，双语三主题全部渲染正确、无 CJK 泄漏、无主题回归。
- Showcase 走查清单逐条勾选。

---

## 5. P4-3 未来模块设计（仅设计，不实现）

**原则**：每个模块只产出**设计文档**（定位 / 与现有契约的关系 / adapter 接入路径 / 不实现范围），不写实现代码。

| 模块 | 定位 | 接入路径（基于现有契约） | 不实现范围 |
|---|---|---|---|
| **Today Dashboard** | 「今天该关注什么」聚合视图 | 订阅 store 选择器（`useNodes`/`useAiStage`/`getMemory`），消费 Space/Growth 数据，不新增数据面 | 不接真实日程/日历 backend |
| **Agent Workspace** | 单员工（如 Nox）工作台 | 复用 `AiStage` 事件出口 + `useMorphState`，新增一个订阅 store 的容器组件 | 不接 Agent Core / 真实执行 |
| **Command Palette** | 全局命令入口 | 命令名走 `LocText`；命令动作调用现有 store 方法 | 不引入新状态管理 |
| **AI Activity Timeline** | AI 活动事件流 | 订阅 `useAiStage`/`useAiState` 事件出口（P3 评审已确认仅事件出口，无提前 UI）；新增一个只读展示组件 | 不提前绑定专有 Timeline 视图逻辑到 store |
| **AI Employee Growth** | 员工能力成长模型 | 复用 `GrowthNodeKind` + `Relationship` 桥接；成长数据由 mock 提供 | 不接真实评估/训练 |

**设计文档产出**：每个模块一份 `docs/design/{module}.md`，明确边界与 adapter 接缝，供 P5+ 实现。

---

## 6. 两个非阻塞优化（P4 期间渐进收敛）

### 6.1 Theme token 收敛
- 将 §2.2 列出的组件级 dark 硬编码覆写（`.tbtn`/`.knode__connect`/`.bg-layer__base`/`.gnode__sugg-text` 等）逐步改写为 token 派生。
- 目标：自定义主题 = 纯 token 覆写即可全量生效，组件选择器零特殊覆写。
- 节奏：随 P4-1 视觉统一顺带收敛，不单独排期阻塞。

### 6.2 Space/Growth 双面关系
- **当前决策**：暂不加 `crossMode` 字段。
- **桥接方式**：同源双视图（如 project）通过 `Relationship`（edge）保持桥接，Space 与 Growth 各自引用同一源节点。
- **触发条件**：仅当真实场景出现"同一源必须双面同步视图状态"时，再设计 `crossMode` 字段（列为未来，非 P4）。

---

## 7. 阶段门控与 Git 纪律

- 每阶段（P4-0 → P4-1 → P4-2 → P4-3）**先出方案/文档，用户确认后再编码**。
- per-commit scope freeze：每个 commit 只包含一个子目标；禁止 amend/reset/rebase/stash；禁止混入 env-debt。
- 改动仅限 `packages/apps/knowledge-canvas-ui/`（当前为未跟踪整包），不触碰 harness tracked 文件。
- 不 commit 直到该阶段评审通过；本规划文档本身也不随代码 commit，待 P4-0 文档齐备后统一评审。

---

## 8. 验收总表（P4 出口）

| 阶段 | 交付 | 验收标准 | 阻塞？ |
|---|---|---|---|
| P4-0 | 三份契约文档 | 未来模块设计可零源码引用接入 | 否 |
| P4-1 | 体验闭环 | 首启→空态→Demo→主界面无断点，三主题双语一致 | 否 |
| P4-2 | Showcase 资产 | 六面 × 双语 × 三主题截图 + 走查清单 | 否 |
| P4-3 | 五份设计文档 | 仅设计，不实现；边界不破坏现有契约 | 否 |
| 优化 | token 收敛 + 双面桥接 | 自定义主题可纯 token 切换；crossMode 不提前引入 | 否 |

**P4 出口判定**：以上全部完成且评审通过，方可进入 P5（按当时目标）。

---

_本规划文档为 P4 唯一当前交付物。后续各阶段文档（STATUS_CONTRACT / THEME_TOKEN_GUIDE / KNOWLEDGE_MODE_BOUNDARY 及 P4-3 设计文档）将在对应阶段经用户确认后创建。_
