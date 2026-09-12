# P4-2 Showcase Mini Plan — 六面 × 双语 × 三主题演示资产

> 文档性质：**方案（先文档、后编码）**
> 时间：2026-09-06
> 依据：`P4-PRODUCTIZATION-PLAN.md` §4（P4-2 产品 Showcase）
> 纪律：用户确认后再编码；per-commit scope freeze；不混入 harness 噪声。

---

## 1. 目标（v0.1 视觉样本库 = 未来重构基准）
产出一套**可复现**的 AI Employee OS 演示资产（六面 × 双语 × 三主题），作为 **AI Employee OS Showcase v0.1 视觉样本库**。

> **关键定位（2026-09-06 方向调整，须严格记录）**：
> **P4-2 不是 UI 重构阶段。** 其目标是建立视觉样本库，为后续 **Visual Evolution / Liquid Glass UI 重构** 提供**基准对比物**（before 状态）。
>
> 继续保持的红线：
> - 不改架构
> - 不新增组件体系
> - 不实现 Liquid Glass
> - 不重做 Shell
> - 不进入 visionOS / spatial UI 改造
>
> 因此 P4-2 的验收重点除「六面截图正确」外，**额外要求：为每个页面记录其未来 Visual Evolution 的改造方向**（见 §9），使样本库同时成为重构任务的输入规格。

---

## 2. 六展示面对照（当前代码映射）

| # | 展示面（计划 §4.1） | 当前代码落点 | 演示触发方式 |
|---|---|---|---|
| S1 | **Welcome Dashboard** | `WelcomeDashboard.tsx`（hero + `wd-card` × 3 + Demo 入口） | `?kcuEmpty=welcome` 直接加载 |
| S2 | **Knowledge Space** | `CanvasViewport` + `KnowledgeNode`/`EdgeLayer`（Space 视图） | Demo `?kcuDemo=1` → 进 Space → Nox thinking→done |
| S3 | **Growth Galaxy** | `GalaxyCanvas` + `GalaxyNode`/`GalaxyEdgeLayer`（Growth 视图） | Demo → 点「查看成长星系」 |
| S4 | **Nox Knowledge Navigator** | `AIInsightPanel` + `AssociationExplainer`（关联解释面板） | Demo Space 态中可见；**需显式截图该面板** |
| S5 | **AI 状态反馈** | `ThinkingRing` / `MasteryRing` / `morphicons/*`（AIStatus/EmployeeStatus/MemoryStatus/ProviderStatus/TaskStatus） | Demo Nox thinking 态 + 各 morphicon 静态展示 |
| S6 | **多语言切换** | `LanguageSettings` + i18n（`zh-CN`/`en-US`） | 同一 surface 分别用 `lang=zh-CN` / `en-US` 截图 |

> 注：S4/S5 在当前 `capture-demo.cjs` 中**未作为独立面**截获（仅随 Space 态附带）。P4-2 需将其**显式拆为独立截图面**。

---

## 3. 截图矩阵与数量

维度：**6 面 × 双语(zh/en) × 三主题(light/dark/reduced)**。

- 但 S6（多语言）本质是 S1–S5 的 cross-cutting 属性，不单独乘面；实际按「每个 surface 各拍 zh-light / en-light / zh-dark / zh-reduced」四帧。
- **总帧数估算**：S1–S5 = 5 面 × 4 帧 = **20 帧**；S6 由 S1–S5 的 zh/en 帧直接证明，不增帧。
- 复用既有 20 张命名约定并扩展：
  - `showcase-welcome-{zh-light,en-light,zh-dark,zh-reduced}.png`
  - `showcase-space-{...}.png`（含 Nox 思考态可单列 `showcase-space-thinking-{...}.png`）
  - `showcase-growth-{...}.png`
  - `showcase-nox-navigator-{...}.png`（**新增 S4 独立面**）
  - `showcase-ai-status-{...}.png`（**新增 S5 独立面**：thinking ring + morphicon 组）

> 现有 `capture-demo.cjs` 已覆盖 S1/S2/S3 共 4 surface（welcome/space-demo/growth-demo/exit）× 4 主题 = 16 张 + exit 4 张。P4-2 在其基础上**新增 S4、S5 两个 surface**（× 4 主题 = 8 张），并把 welcome/space/growth 改名为 showcase-* 命名，总数约 **28 张**（含 thinking 单列）。

---

## 4. 走查清单（每面须证明什么）

| 面 | 必须证明 | 断言键 |
|---|---|---|
| S1 Welcome | 入口可达、有 Demo action、三主题一致、无 CJK 泄漏 | `hasWelcomeEmpty` / `actionHasDemo` / `cjkLeak=false` |
| S2 Space | 节点图渲染、Nox 思考态可见、进入成功 | `entered` / `thinking` / `spaceNodeCount>0` |
| S3 Growth | 成长星系渲染、有退出 Demo CTA | `galaxyNodeCount>0` / `hasExitCta` |
| S4 Nox Navigator | 关联解释面板在 light/dark 均为**主题自适应**（非恒暗，验证 D1 修复） | `noxPanelThemeAdaptive`（light/dark 背景色取自有 token） |
| S5 AI 状态 | ThinkingRing 动画在 reduced 主题关闭；morphicon 组正常 | `motionOff=ok` / morphicon 渲染 |
| S6 多语言 | zh/en 帧文本无 CJK 泄漏（en 帧）、1:1 key 对齐 | `cjkLeak=false`（en 帧） / `zhKeyCount===enKeyCount` |

全局断言（沿用并扩展）：`errors=0` / `fourohfour=[]` / `themeAttr===theme`（首帧） / `motionOff=ok`（reduced 帧）。

> **CJK 泄漏检测范围（验收规则调整，2026-09-06）**：CJK 泄漏校验目标为 **UI 文案/导航/按钮/状态标签/设置项/Showcase 固定文本**，**不包含**用户知识内容。
> - **Included**：UI labels / buttons / navigation / status text / employee & system messages。
> - **Excluded**：mock knowledge nodes / imported documents / user-generated content / knowledge-graph titles。
> - 理由：Knowledge OS 是多语言知识容器，不应因 UI 英文验收而禁止中文知识内容存在；en 帧画布仍可出现中文节点标题（真实产品即如此）。
> - 实现：capture 脚本在 en 帧仅对 **移除 `.knode` / `.gnode` 子树后的 body 文本** 做 CJK 检测。

---

## 5. 交付物
1. **离线截图脚本**：基于 `kcu-dist/capture-demo.cjs` 范式扩展（新增 S4/S5 surface + S6 双语断言），输出 6 面 × 双语 × 三主题。
   - 不引入新依赖；沿用 Playwright-core + Edge headless + `addInitScript` 驱动 localStorage。
2. **Showcase 走查清单**：见 §4，逐条勾选。
3. （可选）静默录屏脚本 —— **优先截图集**，不引入录屏依赖（按计划 §4.2）。

---

## 6. 验收标准
- 六面截图集完整，**双语 × 三主题**全部渲染正确。
- 无 CJK 泄漏、无主题回归、`errors=0`、`404=0`。
- `data-theme` 首帧正确、reduced-motion 动画关闭。
- 走查清单逐条勾选。

---

## 7. 范围边界（红线）
- **P4-2 是样本库阶段，不是 UI 重构阶段。**
- **仅演示资产 + 截图脚本**；不新增组件/架构/依赖。
- **不改架构、不新增组件体系、不实现 Liquid Glass、不重做 Shell、不进入 visionOS / spatial UI 改造。**
- 不接入 backend / Agent Core / Memory / KG / 真实数据。
- 不修 D2–D5 demo 债务（F6，不在演示路径）。
- S3 Growth 保留现 mock 逻辑，**不扩功能**。
- 改动仅限本原型包；不混入 harness 噪声 `M`。

---

## 8. 执行步骤（编码阶段，待确认后）
1. 扩展 `capture-demo.cjs` → 新增 S4 Nox Navigator、S5 AI 状态两个 surface + S6 双语断言；命名改为 `showcase-*`。
2. 跑全矩阵截图（约 28 张），断言全绿。
3. 产出走查清单勾选表。
4. 提交 `P4-2: add Showcase capture assets (6 surfaces × bilingual × 3 themes)`。
5. **停在验收节点**，不自动进入 P4-3 / Visual Evolution。

---

## 9. 每面未来 Visual Evolution 改造方向（样本库 → 重构输入规格）

> 本节为 P4-2 方向调整的核心交付：**每个展示面记录其未来改造方向**，使 v0.1 样本库成为后续重构的 before 基准与需求来源。

### S1 Welcome — `WelcomeDashboard`
- **当前**：`WelcomeDashboard.tsx`，hero + `wd-card` × 3（发现/成长/缺口）数据卡片堆叠 + Demo 入口。
- **未来方向**：**AI Employee Home**（单核心 AI Employee 入口，Apple 官网式大留白）。
  ```
  🐈‍⬛ Nox

  今日知识状态
  最近理解内容
  AI 工作进度

        [进入工作]
  ```
- **约束**：不要继续堆 Dashboard 卡片；以**单一核心主体（Nox）** 取代卡片矩阵。

### S2 Knowledge Space — `Canvas`
- **当前**：`CanvasViewport` + `KnowledgeNode`/`EdgeLayer`，node–node–node 关系图。
- **未来方向**：**Spatial Knowledge UI** —— 不是简单节点图，而是知识生命周期：
  ```
  资料
   ↓
  AI 理解
   ↓
  洞察
   ↓
  知识成长
  ```
- **约束**：从「数据关系图」升级为「知识生命系统」的视觉与交互模型。

### S3 Growth Galaxy — `GalaxyCanvas`
- **当前**：`GalaxyCanvas` + `GalaxyNode`/`GalaxyEdgeLayer`，星图 mock。
- **未来方向**：**空间化成长系统**（spatial growth system）。
- **约束**：**保留现在 mock 逻辑，不扩功能**；仅做视觉/空间化升级。

### S4 Nox Navigator — `AIInsightPanel`
- **当前**：`AIInsightPanel` + `AssociationExplainer`，关联解释面板。
- **未来方向**：**统一 AI Employee Card 系统**。
  - 参考：**Apple Widget + Character AI + macOS App Icon**。
  - 未来支持员工卡维度：**状态 / 能力 / 记忆 / 成长**。
  - 例：`🐈‍⬛ Nox — Knowledge Agent` 卡，集成 Status/Capability/Memory/Growth。
- **约束**：从「单面板」升级为「可复用员工卡体系」。

### S5 AI 状态反馈 — `ThinkingRing` / `morphicons/*`
- **当前**：`ThinkingRing`（Nox 思考态）+ morphicon 状态组（AI/Employee/Memory/Provider/Task Status）。
- **未来方向**：统一状态语言 —— 与 AI Employee Card 的 Status 维度对齐，形成连贯的「员工状态」视觉系统（参考 `ui-primitives` 的 `StateDot` 四态 + 员工五态薄层）。
- **约束**：状态视觉需与 Card / Shell 体系一致，不单独演进。

### S6 多语言 — `LanguageSettings` + i18n
- **当前**：`zh-CN` / `en-US` 1:1（308/308），实时切换。
- **未来方向**：在 Visual Evolution 中维持 i18n 1:1 契约；新增视觉语言（如 Liquid Glass 主题）不得破坏 key 对齐与 CJK 泄漏检查。
- **约束**：国际化作为跨切面属性，随各面重构同步保持。

---

## 10. P4-2 后门控：AI Employee OS UI Design Review

> **P4-2 完成后不自动进入 P4-3。** 下一阶段先召开 **AI Employee OS UI Design Review**，确定以下设计基线，之后才进入 UI Evolution 编码。

Design Review 须产出决议的事项：
1. **Liquid Glass Design System** —— 玻璃材质规范（半透明层叠 / 内容穿透 / 柔和边缘高光 / 深浅一致 / 空间层级）。
2. **首页视觉语言** —— AI Employee Home（S1 未来方向）的最终视觉与文案。
3. **Employee Card 规范** —— 统一员工卡结构（Avatar + Identity + Status + Level/Growth + Capability），含 Nox 首发卡。
4. **Spatial Shell 方向** —— Desktop → Employee Center / Knowledge Space / Memory / Marketplace / Settings 的 shell 形态（不以 Dashboard 为中心）。
5. **Knowledge Space 视觉模型** —— Spatial Knowledge UI（资料→AI理解→洞察→成长）的视觉与交互范式。

> 衔接：Design Review 决议 → 单独立项 Visual Evolution（不在 P4-2 / P4-3 范围内）。
